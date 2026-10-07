/**
 * lib/autoWire.ts — Fassade des Auto-Wiring-Systems.
 *
 * Modularisiert (M6-6) in:
 *
 *   lib/autoWire/primitives.ts  Konstanten, Kantenzugriff, Spannungsfall-Formeln
 *   lib/autoWire/validation.ts  Klassifikation (Starter, Busbar, AC/Solar/DC)
 *   lib/autoWire/sizing.ts      Querschnitt, Sicherungen, Spannungsfall-Caches
 *   lib/autoWire/routing.ts     Rails, Node-/Edge-Erzeugung, Nutzerkanten-Heilung
 *
 * Diese Datei hält die Orchestrierung (performAutoWiring) und definiert die
 * öffentliche API. Anrufer (Store-Slice, Tests) importieren unverändert
 * 'lib/autoWire'.
 *
 * Topologie (Best Practice, DIN VDE 0100-721 / 0298-4):
 *
 *   Batterie+  --(≤20 cm, abgesichert)-->  Plus-Busbar  --> Sicherungskasten --> 12V-Verbraucher
 *                                             |-- Wechselrichter (eigene Leitungssicherung)
 *                                             |-- Ladequellen (MPPT, Booster, Ladegerät)
 *
 *   Batterie-  --(≤20 cm)-->  Smart Shunt  --> Minus-Busbar --> Rückleiter / Masse
 *
 * Der Shunt sitzt ausschließlich in der Minus-Leitung. Plus/Minus-Busbars
 * werden wiederverwendet, wenn der Plan sie bereits enthält. Vorhandene
 * Nutzer-Kanten bleiben erhalten, unsichere Pfade (Shunt-Bypass,
 * Direktverbindung Batterie→Verbraucher, Laderegler direkt auf die Batterie)
 * werden in die Ziel-Topologie eingefädelt statt parallel verdoppelt.
 *
 * Einheiten (seit K1c)
 * ====================
 * Ströme, Spannungen, Längen und Querschnitte sind Branded Types aus
 * `lib/units.ts`. Vertauschte Argumente (`sizeDcEdges(…, length, current)`)
 * sind damit Compilezeit-Fehler. Die Kanten-Daten selbst (`edge.data.length`,
 * `edge.data.crossSection`) bleiben primitive Zahlen, weil sie serialisiert
 * und von React Flow durchgereicht werden; gelesen wird an genau einer Stelle
 * geprüft (`edgeLength`, `edgeCrossSection`).
 */

import type { Node } from './domain/graph'; // ARCH-001: Domäne statt React-Flow-Typen
import { getSystemVoltage, isStarterBatteryLabel } from './vde-standards';
import {
  addWatts,
  currentFromPower,
  meters,
  mm2,
  parseQuantity,
  quantityOr,
  volts,
  watts,
  ZERO_WATTS,
  type Volts,
} from './units';
import {
  AUTO_EDGE_PREFIX,
  isAutoWiredEdge,
  connectionKey,
  edgeCrossSection,
  chemistriesParallelSafe,
  planningLength,
  type CableEdge,
} from './autoWire/primitives';
import { isAcEdge, isSolarEdge, isStarterBattery } from './autoWire/validation';
import { isFuseType } from './shortCircuit'; // DOM-002: Datenblattwerte der Sicherung
import type { CableEdgeData } from './domain/cableEdgeData';
import { applyFlowLayout } from './autoWire/placement';
import {
  sizeDcEdges,
  applyFuseSizes,
  applyFuseTypes,
  markInfeasibleSizing,
  sizeAcEdges,
} from './autoWire/sizing';
import {
  buildDictionaries,
  ensureNode,
  addDcEdge,
  addAcEdge,
  resolveRails,
  findOrCreate,
  healUserEdges,
  pickHouseBattery,
  pickExistingStarter,
} from './autoWire/routing';
import { createConflictCollector, type AutoWireReport } from './autoWire/conflicts';
import { deriveBatteryBanks, primaryHouseBank, type BatteryBank } from './electricalGraph/batteryBank';
import { buildAcSystem, resolveAcSourceForLoad } from './electricalGraph/acSystem';
import { compareIds } from './sortOrder';
import { safeText } from './safeText';

export { isStarterBatteryLabel };
export { AUTO_EDGE_PREFIX, isAutoWiredEdge } from './autoWire/primitives';
export {
  cumulativeDropAt,
  relevantCumulativeDrop,
  sizeDcEdges,
  applyFuseSizes,
  sizeAcEdges,
} from './autoWire/sizing';
export { resolveRails, healUserEdges, pickHouseBattery } from './autoWire/routing';
export {
  createConflictCollector,
  hasCriticalConflict,
  EMPTY_AUTO_WIRE_REPORT,
  type AutoWireConflict,
  type AutoWireConflictKind,
  type AutoWireConflictSeverity,
  type AutoWireReport,
} from './autoWire/conflicts';

/** Stable identity for one generated cable, including parallel AC/DC domains. */
function autoEdgeIdentityKey(edge: CableEdge): string {
  return JSON.stringify([
    edge.source,
    edge.target,
    edge.sourceHandle ?? '',
    edge.targetHandle ?? '',
    edge.data?.edgeDomain ?? '',
  ]);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Canonical top-to-bottom, left-to-right order for node-category traversals. */
function stableNodeOrder(nodes: readonly Node[]): Node[] {
  return [...nodes].sort((left, right) => {
    const leftY = Number.isFinite(left.position?.y) ? left.position.y : 0;
    const rightY = Number.isFinite(right.position?.y) ? right.position.y : 0;
    const leftX = Number.isFinite(left.position?.x) ? left.position.x : 0;
    const rightX = Number.isFinite(right.position?.x) ? right.position.x : 0;
    return leftY - rightY || leftX - rightX || compareStrings(left.id, right.id);
  });
}

/**
 * Ergebnis eines AutoWire-Laufs.
 *
 * `report` (V2) ist NEU und bewusst Teil des Rückgabewerts, nicht eines
 * Seitenkanals: Ein Lauf, der Nutzerkanten umlegt oder eine Frage offen
 * lässt, muss das dem Aufrufer mitteilen können. Bestehende Aufrufer, die
 * `{ nodes, edges }` destrukturieren, bleiben unverändert gültig.
 */
export type AutoWireResult = { nodes: Node[]; edges: CableEdge[]; report: AutoWireReport };

export function performAutoWiring(
  initialNodes: Node[],
  existingEdges: CableEdge[] = []
): AutoWireResult | null {
  const conflicts = createConflictCollector();
  const currentNodes = initialNodes.map((n) => ({ ...n, data: { ...(n.data || {}) } }));
  // Keep prior IDs attached to their generated connection across recalculation.
  // Sorting each bucket makes even malformed duplicate historical IDs independent
  // of the incoming edge-array order.
  const previousAutoEdgeIdsByConnection = new Map<string, string[]>();
  for (const edge of existingEdges) {
    if (!isAutoWiredEdge(edge)) continue;
    const identity = autoEdgeIdentityKey(edge);
    const ids = previousAutoEdgeIdsByConnection.get(identity) ?? [];
    ids.push(edge.id);
    previousAutoEdgeIdsByConnection.set(identity, ids);
  }
  for (const ids of previousAutoEdgeIdsByConnection.values()) ids.sort(compareStrings);

  // Issue 6: Eine fehlende Nutzerkanten-Länge wurde pauschal als 1 m
  // festgeschrieben — bei Importen mit langer realer Strecke zu dünn
  // dimensioniert und auf dem Canvas unsichtbar (der Renderer-Fallback auf
  // die Geometrie wurde durch den gespeicherten Wert abgeschaltet). Neu:
  // Schätzung aus der Knotengeometrie (PX_PER_METER, konsistent mit der
  // Anzeigeebene); ohne Positionen bleibt der Wert undefined und jeder
  // Lesezugriff nutzt seinen definierten Fallback.
  // Eine gemeinsame Regel statt einer zweiten Kopie: `planningLength`
  // (lib/autoWire/primitives.ts) liefert eingetragene Länge → Luftlinie →
  // undefined. Dieselbe Regel benutzt die Dimensionierung.
  const nodePositions = new Map(initialNodes.map((nd) => [nd.id, nd.position]));
  const pointOf = (nodeId: string) => nodePositions.get(nodeId);
  let userEdges: CableEdge[] = existingEdges
    .filter((e) => !isAutoWiredEdge(e))
    .map((e) => ({
      ...e,
      // AUDIT D1: `...e.data` statt einer Feld-Whitelist. Die Whitelist
      // (length, crossSection, fuseSize, edgeDomain) warf bei JEDEM
      // AutoWire-Klick alles andere still weg — darunter die vom Nutzer
      // eingetragenen Datenblattwerte `fuseType`, `fuseOffset`,
      // `fuseBreakingCapacity` und `acProtection` sowie die Warnmarker
      // `dropWarning`/`fuseWarning`. Ein Datenverlust im Schreibpfad, den
      // kein Test sah: keiner verglich die Key-Menge einer Nutzerkante
      // vor/nach performAutoWiring (Regressionstest jetzt in autoWire.test.ts).
      data: {
        ...(e.data ?? {}),
        // Kanten ohne gespeicherte Länge bekommen weiterhin die
        // Geometrie-Schätzung (Issue 6) — sonst unverändert.
        length: planningLength(e, pointOf),
        // AUDIT D2: Herkunft als Datenfeld festschreiben. Ab hier entscheidet
        // nie wieder eine ID über „Auto" oder „Nutzer".
        autoWired: false,
      },
    }));
  const newEdges: CableEdge[] = [];
  const dcEdges: CableEdge[] = [];
  // AutoWire IDs share the imported/user edge namespace. Reserving every
  // preserved ID before generation prevents React Flow Map-key collisions,
  // including a user edge whose ID happens to use an AutoWire prefix.
  const edgeIdRef = { counter: 1, usedIds: new Set(userEdges.map((edge) => edge.id)) };

  const existingConnections = new Set<string>();
  for (const e of userEdges) {
    existingConnections.add(connectionKey(e));
  }

  const { nodesByType, nodesByLabel } = buildDictionaries(currentNodes);
  const batteries = nodesByType['battery'] || [];
  const orderedBatteries = stableNodeOrder(batteries);
  let batteryNode = pickHouseBattery(batteries);
  if (!batteryNode) return null;
  const autoCreatedNodeIds = new Set<string>();

  const dcdcChargers = nodesByType['dcdcCharger'] || [];
  const orderedDcdcChargers = stableNodeOrder(dcdcChargers);
  // Ein Booster braucht eine getrennte Aufbaubatterie und eine Starterseite.
  // Liegt nur eine Starterbatterie vor, würde der Booster sonst auf dieselbe
  // Schiene wie die Batterie verdrahtet (Bezug auf sich selbst). Stattdessen
  // wird eine Aufbaubatterie als Hausbatterie angelegt.
  if (dcdcChargers.length > 0 && isStarterBattery(batteryNode)) {
    batteryNode = ensureNode(
      currentNodes,
      nodesByType,
      nodesByLabel,
      batteryNode,
      'battery',
      'Aufbaubatterie',
      0,
      -200,
      { capacity: 100, chemistry: 'LiFePO4' }
    );
    autoCreatedNodeIds.add(batteryNode.id);
  }

  // ── Batteriebänke: ERKLÄRTE Verschaltung schlägt Einzelbatterie ──────────
  // `getSystemVoltage` kennt nur einzelne Akkus. Eine erklärte Reihenschaltung
  // (2 × 12 V = 24 V) wäre damit unsichtbar geblieben und die gesamte
  // Dimensionierung hätte mit der halben Spannung gerechnet — doppelter Strom,
  // doppelter Querschnitt, falsche Sicherungen. Die Bank gewinnt, sobald sie
  // im Plan steht; ohne Erklärung bleibt alles wie bisher.
  // Starter-Seite zuerst auflösen (vor der Bank-Ableitung), damit eine
  // erkannte AGM als Starter bereits `role='starter'` trägt, wenn
  // `deriveBatteryBanks` die Bänke einteilt. Sonst wird bei „Lithium + AGM +
  // Booster“ eine irrelevante Frage „Wie sollen diese Batterien verwendet
  // werden?" gestellt, obwohl die Chemie-Heuristik die Starterseite eindeutig
  // bestimmt (pickExistingStarter mit AGM-Fallback).
  let starterBatteryNode = pickExistingStarter(batteries, batteryNode, dcdcChargers.length > 0);
  if (starterBatteryNode && !isStarterBattery(starterBatteryNode)) {
    starterBatteryNode.data = { ...starterBatteryNode.data, role: 'starter' };
  }

  const bankModel = deriveBatteryBanks(currentNodes, getSystemVoltage(currentNodes, batteryNode.id));
  const houseBank = primaryHouseBank(bankModel);
  const sysVoltage =
    houseBank && houseBank.declared && houseBank.batteryIds.includes(batteryNode.id)
      ? houseBank.nominalVoltage
      : getSystemVoltage(currentNodes, batteryNode.id);
  for (const question of bankModel.questions) {
    conflicts.ask(question.question);
  }

  const rails = resolveRails(currentNodes, nodesByType, nodesByLabel, batteryNode, autoCreatedNodeIds);
  const fuseBoxNode = findOrCreate(
    currentNodes,
    nodesByType,
    nodesByLabel,
    batteryNode,
    autoCreatedNodeIds,
    'fuse',
    '12V Sicherungskasten',
    560,
    -120,
    { rating: 100 },
    /sicherung/i
  );
  const shuntNode = findOrCreate(
    currentNodes,
    nodesByType,
    nodesByLabel,
    batteryNode,
    autoCreatedNodeIds,
    'shunt',
    'Smart Shunt',
    280,
    80
  );

  const solars = stableNodeOrder([...(nodesByType['solar'] || []), ...(nodesByType['roofSolar'] || [])]);

  let mpptNode: Node | undefined;
  if (solars.length > 0) {
    mpptNode = (nodesByType['mpptController'] || [])[0] || (nodesByType['charger'] || [])[0];
    if (!mpptNode) {
      mpptNode = findOrCreate(
        currentNodes,
        nodesByType,
        nodesByLabel,
        batteryNode,
        autoCreatedNodeIds,
        'mpptController',
        'MPPT Laderegler',
        280,
        -280,
        { amps: 30 }
      );
    }
    const totalSolarWatts = solars.reduce(
      (sum, n) => addWatts(sum, quantityOr(n.data?.watts, watts, ZERO_WATTS)),
      ZERO_WATTS
    );
    const requiredAmps = Math.ceil(currentFromPower(totalSolarWatts, sysVoltage));
    if ((Number(mpptNode.data.amps) || 0) < requiredAmps) {
      mpptNode.data.amps = requiredAmps;
    }
  }

  // Keine zweite Starterbatterie anlegen, wenn die einzige Batterie schon die Starterseite ist.
  if (dcdcChargers.length > 0 && !starterBatteryNode && !isStarterBattery(batteryNode)) {
    starterBatteryNode = ensureNode(
      currentNodes,
      nodesByType,
      nodesByLabel,
      batteryNode,
      'battery',
      'Starterbatterie',
      -280,
      160,
      { capacity: 80, chemistry: 'AGM' }
    );
    autoCreatedNodeIds.add(starterBatteryNode.id);
  }

  const nodeMap = new Map(currentNodes.map((n) => [n.id, n]));
  userEdges = healUserEdges(userEdges, {
    nodeMap,
    houseBatteryId: batteryNode.id,
    shuntId: shuntNode.id,
    plusRailId: rails.plus.id,
    minusRailId: rails.minus.id,
    fuseBoxId: fuseBoxNode.id,
    existingConnections,
    report: conflicts,
  });

  // ── Backbone: Batterie+ → Plus-Schiene, Batterie- → Shunt → Minus-Schiene ──
  addDcEdge(
    newEdges,
    dcEdges,
    edgeIdRef,
    existingConnections,
    batteryNode.id,
    rails.plus.id,
    'plus',
    meters(0.2)
  );
  addDcEdge(
    newEdges,
    dcEdges,
    edgeIdRef,
    existingConnections,
    batteryNode.id,
    shuntNode.id,
    'minus',
    meters(0.2)
  );
  addDcEdge(
    newEdges,
    dcEdges,
    edgeIdRef,
    existingConnections,
    shuntNode.id,
    rails.minus.id,
    'minus',
    meters(0.5)
  );
  addDcEdge(
    newEdges,
    dcEdges,
    edgeIdRef,
    existingConnections,
    rails.plus.id,
    fuseBoxNode.id,
    'plus',
    meters(1)
  );
  addDcEdge(
    newEdges,
    dcEdges,
    edgeIdRef,
    existingConnections,
    rails.minus.id,
    fuseBoxNode.id,
    'minus',
    meters(1)
  );

  // ── Weitere Aufbaubatterien: ERKLÄRTE Bank statt geratener Parallelschaltung ──
  //
  // Befund V2-AUTO-003 (das teuerste Raten im alten Stand): Zwei Batterien
  // gleicher Spannung und Chemie wurden automatisch parallel auf dieselben
  // Schienen gelegt. Diese Annahme entscheidet über Systemspannung,
  // Bankkapazität, Kurzschlussstrom und JEDE Sicherung im Plan — und sie kann
  // schlicht falsch sein: Zwei 12-V-Akkus können genauso gut eine
  // 24-V-Reihenschaltung oder zwei getrennte Bänke (Aufbau/Reserve) sein.
  // AutoWire rät das nicht mehr. Es verdrahtet, was ERKLÄRT ist
  // (`bankId` + `bankTopology`, s. lib/electricalGraph/batteryBank.ts), und
  // stellt sonst eine Frage.
  //
  // Weiterhin gilt die fachliche Sperre aus AUDIT AUTO-003: Unterschiedliche
  // Chemien oder Nennspannungen werden AUCH DANN NICHT parallel gelegt, wenn
  // jemand sie in dieselbe Bank schreibt — eine Erklärung macht eine
  // unzulässige Verschaltung nicht zulässig.
  //
  // Issue 2 (fehlender nominalVoltage) bleibt beantwortet: Fehlende Werte
  // werden auf die aufgelöste Systemspannung normiert und jeder Kandidat
  // gegen JEDE bereits akzeptierte Batterie geprüft.
  const voltageOf = (b: Node): Volts => quantityOr(b.data?.nominalVoltage, volts, sysVoltage);
  // AUDIT AUTO-003: chemiegenau statt nur „Blei vs. Li" — AGM ‖ Gel wird
  // genauso blockiert wie LiFePO4 ‖ Li-Ion (Ladeschlussspannungen/-
  // spannungsfenster vertragen sich nicht).
  const safeToParallel = (a: Node, b: Node): boolean =>
    voltageOf(a) === voltageOf(b) && chemistriesParallelSafe(a, b);

  const houseBankOfBattery = new Map<string, BatteryBank>();
  for (const bank of bankModel.banks) {
    for (const memberId of bank.batteryIds) houseBankOfBattery.set(memberId, bank);
  }
  const homeBank = houseBankOfBattery.get(batteryNode.id);

  const acceptedParallel: Node[] = [batteryNode];
  for (const extra of orderedBatteries) {
    if (extra.id === batteryNode.id) continue;
    if (starterBatteryNode && extra.id === starterBatteryNode.id) continue;
    if (!acceptedParallel.every((a) => safeToParallel(a, extra))) continue;

    const bank = houseBankOfBattery.get(extra.id);
    const sameDeclaredBank = !!bank && !!homeBank && bank.id === homeBank.id;
    const declaredParallel = sameDeclaredBank && bank.topology === 'parallel';

    if (!declaredParallel) {
      // Keine Verdrahtung ohne Erklärung. Die Batterie bleibt im Plan und
      // sichtbar unverbunden — das ist der ehrliche Zustand: Der Planer weiß
      // nicht, wie sie verschaltet ist.
      conflicts.add({
        kind: 'ambiguous-battery-topology',
        severity: 'warning',
        ruleId: 'AUTO-BANK-001',
        message:
          sameDeclaredBank && bank
            ? `Batterie „${safeText(extra.data?.label) || extra.id}" gehört zur Bank „${bank.id}", deren Verschaltung „${bank.topology}" AutoWire nicht selbst verdrahtet. Bitte die Bank-Verbindungen von Hand zeichnen.`
            : `Verschaltung von „${safeText(extra.data?.label) || extra.id}" ist nicht erklärt — AutoWire nimmt NICHT an, dass sie parallel zur Aufbaubatterie liegt. Bitte am Akku „bankId" und „bankTopology" setzen (z. B. beide auf dieselbe Bank mit „parallel").`,
        edgeIds: [],
        nodeIds: [extra.id, batteryNode.id],
      });
      continue;
    }

    acceptedParallel.push(extra);
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      extra.id,
      rails.plus.id,
      'plus',
      meters(0.2)
    );
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      extra.id,
      shuntNode.id,
      'minus',
      meters(0.2)
    );
  }

  for (const consumer of stableNodeOrder(nodesByType['consumer'] || [])) {
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      fuseBoxNode.id,
      consumer.id,
      'plus',
      meters(3)
    );
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      rails.minus.id,
      consumer.id,
      'minus',
      meters(3)
    );
  }

  const inverters = nodesByType['inverter'] || [];
  const orderedInverters = stableNodeOrder(inverters);
  for (const inverter of orderedInverters) {
    if (!inverter.data.continuousPower && inverter.data.watts) {
      inverter.data.continuousPower = inverter.data.watts;
    }
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      rails.plus.id,
      inverter.id,
      'plus',
      meters(1)
    );
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      rails.minus.id,
      inverter.id,
      'minus',
      meters(1)
    );
  }

  if (solars.length > 0 && mpptNode) {
    for (const solar of solars) {
      addDcEdge(
        newEdges,
        dcEdges,
        edgeIdRef,
        existingConnections,
        solar.id,
        mpptNode.id,
        'plus',
        meters(5),
        'Solar'
      );
      addDcEdge(
        newEdges,
        dcEdges,
        edgeIdRef,
        existingConnections,
        solar.id,
        mpptNode.id,
        'minus',
        meters(5),
        'Solar'
      );
    }
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      mpptNode.id,
      rails.plus.id,
      'plus',
      meters(2)
    );
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      mpptNode.id,
      rails.minus.id,
      'minus',
      meters(2)
    );
  }

  const allChargers = [
    ...stableNodeOrder(nodesByType['charger'] || []),
    ...stableNodeOrder(nodesByType['mpptController'] || []),
    ...orderedDcdcChargers,
    ...stableNodeOrder(nodesByType['acBatteryCharger'] || []),
  ];
  for (const charger of allChargers) {
    if (mpptNode && charger.id === mpptNode.id) continue;
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      charger.id,
      rails.plus.id,
      'plus',
      meters(3)
    );
    addDcEdge(
      newEdges,
      dcEdges,
      edgeIdRef,
      existingConnections,
      charger.id,
      rails.minus.id,
      'minus',
      meters(3)
    );
  }

  if (starterBatteryNode) {
    for (const booster of orderedDcdcChargers) {
      // Lange Strecke Starter→Booster ist fachgerecht (Motorraum); Sicherung sitzt am Plus.
      addDcEdge(
        newEdges,
        dcEdges,
        edgeIdRef,
        existingConnections,
        starterBatteryNode.id,
        booster.id,
        'plus',
        meters(3)
      );
      addDcEdge(
        newEdges,
        dcEdges,
        edgeIdRef,
        existingConnections,
        starterBatteryNode.id,
        booster.id,
        'minus',
        meters(3)
      );
    }
  }

  // Landstromanschlüsse werden NICHT pauschal als RCD-geschützt markiert.
  // Ob ein 30-mA-FI (RCD) vorhanden ist, muss am Bauteil gepflegt und von der
  // Live-Validierung nach DIN VDE 0100-721 angemahnt werden. Ein automatisches
  // Setzen würde einen fehlenden FI verschleiern (Stromschlaggefahr).
  const shorePowers = stableNodeOrder(nodesByType['shorePower'] || []);
  const consumers230v = stableNodeOrder(nodesByType['consumer230v'] || []);
  const acChargers = stableNodeOrder(nodesByType['acBatteryCharger'] || []);

  // ── 230 V: WELCHE Quelle speist WELCHEN Verbraucher? ─────────────────────
  //
  // Befund V2-AUTO-002: Der alte Stand nahm `inverters.at(0)` — den ersten
  // Wechselrichter in der Array-Reihenfolge. Bei zwei Geräten entschied damit
  // die Einfügereihenfolge über den Stromkreis, und derselbe Plan konnte nach
  // einem Reload anders verdrahtet sein. Ebenso wurden ALLE Landstromdosen
  // mit JEDEM AC-Ladegerät verbunden — zwei Quellen auf einem Kreis.
  //
  // Neue Regel, in dieser Reihenfolge und ohne Raten:
  //   1. ausdrückliche Zuordnung am Bauteil (`data.acSourceId`),
  //   2. bestehende Verdrahtung (aus dem AC-Modell gelesen),
  //   3. genau EIN Wechselrichter im Plan → er ist der Verteilpunkt
  //      (Landstrom speist ihn, er speist die Verbraucher — die Standard-
  //      Topologie mit Umschalter, keine Annahme zwischen Gleichrangigen),
  //   4. kein Wechselrichter und genau EINE Landstromdose → diese,
  //   5. sonst: NICHT verdrahten, Frage stellen.
  const acModel = buildAcSystem(currentNodes, userEdges);
  const acSourceNodes = new Map<string, Node>();
  for (const source of acModel.sources) {
    const node = nodeMap.get(source.id);
    if (node) acSourceNodes.set(source.id, node);
  }
  const singleInverter = orderedInverters.length === 1 ? orderedInverters[0] : undefined;
  const singleShore = shorePowers.length === 1 ? shorePowers[0] : undefined;

  /** Quelle für einen 230-V-Verbraucher — `undefined` heißt „nicht entschieden". */
  const acSourceFor = (load: Node, allowInverter: boolean): Node | undefined => {
    const declared = safeText(load.data?.acSourceId);
    if (declared) {
      const node = acSourceNodes.get(declared) ?? nodeMap.get(declared);
      if (node) return node;
      conflicts.add({
        kind: 'ambiguous-ac-source',
        severity: 'warning',
        ruleId: 'AUTO-AC-002',
        message: `„${safeText(load.data?.label) || load.id}" verweist auf die Quelle „${declared}", die es im Plan nicht gibt.`,
        edgeIds: [],
        nodeIds: [load.id],
      });
      return undefined;
    }
    const wired = resolveAcSourceForLoad(load.id, acModel);
    if (wired) {
      const node = acSourceNodes.get(wired);
      if (node && (allowInverter || node.type !== 'inverter')) return node;
    }
    if (allowInverter && singleInverter) return singleInverter;
    if (singleShore && (!allowInverter || !singleInverter)) return singleShore;

    const candidates = allowInverter
      ? [...orderedInverters, ...shorePowers]
      : [...shorePowers, ...orderedInverters];
    conflicts.add({
      kind: 'ambiguous-ac-source',
      severity: 'warning',
      ruleId: 'AUTO-AC-001',
      message:
        candidates.length === 0
          ? `„${safeText(load.data?.label) || load.id}" hat keine 230-V-Quelle im Plan — ohne Wechselrichter oder Landstrom bleibt das Gerät unversorgt.`
          : `„${safeText(load.data?.label) || load.id}" könnte von mehreren 230-V-Quellen gespeist werden. AutoWire entscheidet das nicht; bitte am Gerät die Quelle setzen (Feld „acSourceId").`,
      edgeIds: [],
      nodeIds: [load.id, ...candidates.map((node) => node.id)].sort(compareIds),
    });
    if (candidates.length > 0) {
      conflicts.ask(
        `Welche 230-V-Quelle speist „${safeText(load.data?.label) || load.id}" — ${candidates
          .map((node) => `„${safeText(node.data?.label) || node.id}"`)
          .join(' oder ')}?`
      );
    }
    return undefined;
  };

  for (const consumer of consumers230v) {
    const source = acSourceFor(consumer, true);
    if (!source) continue;
    addAcEdge(
      newEdges,
      edgeIdRef,
      existingConnections,
      source.id,
      consumer.id,
      'plus',
      'plus',
      meters(2),
      mm2(1.5)
    );
  }

  // Landstrom → Wechselrichter-Eingang: Jeder Wechselrichter bekommt den
  // Landstromanschluss (Ladefunktion/Durchleitung). Bei mehreren Dosen ist
  // auch das eine Zuordnungsfrage.
  for (const inverter of orderedInverters) {
    if (shorePowers.length === 0) continue;
    const feed = acSourceFor(inverter, false);
    if (!feed || feed.type !== 'shorePower') continue;
    addAcEdge(
      newEdges,
      edgeIdRef,
      existingConnections,
      feed.id,
      inverter.id,
      'plus',
      'ac_in',
      meters(2),
      mm2(2.5)
    );
  }

  for (const acCharger of acChargers) {
    if (shorePowers.length === 0) continue;
    const feed = acSourceFor(acCharger, false);
    if (!feed) continue;
    addAcEdge(
      newEdges,
      edgeIdRef,
      existingConnections,
      feed.id,
      acCharger.id,
      'plus',
      'plus',
      meters(2),
      mm2(2.5)
    );
  }

  const grounds = stableNodeOrder(nodesByType['ground'] || []);
  for (const ground of grounds) {
    const groundId = ground.id;
    // Nur eine echte direkte Anbindung an die Minus-Schiene bzw. den Shunt
    // zählt als bereits geerdet. Eine Nutzerkante „Masse → Verbraucher“ ist
    // KEIN Erdanschluss und darf die automatische Masseverlegung nicht
    // unterdrücken (vorheriger False-Positive).
    // Issue 7: Importpläne führen Bonds oft ohne Handle-Ids. Ein fehlender
    // Handle an einer rail/shunt↔ground-Kante ist die Minusseite (Plus Bonds
    // zur Karosserie sind per Definition ausgeschlossen); ohne Toleranz
    // entstand ein Doppel-Bond UND der Nutzer-Bond entkam der 16-mm²-Pflicht.
    const connectsToMinusSystem = (e: CableEdge): boolean =>
      (!e.sourceHandle || e.sourceHandle.includes('minus')) &&
      ((e.source === rails.minus.id && e.target === groundId) ||
        (e.target === rails.minus.id && e.source === groundId) ||
        (e.source === shuntNode.id && e.target === groundId) ||
        (e.target === shuntNode.id && e.source === groundId));
    const hasDirectGroundBond = [...userEdges, ...newEdges].some(connectsToMinusSystem);
    if (!hasDirectGroundBond) {
      const groundEdge = addDcEdge(
        newEdges,
        dcEdges,
        edgeIdRef,
        existingConnections,
        rails.minus.id,
        groundId,
        'minus',
        meters(1)
      );
      if (groundEdge) {
        // Massepunkt: 16 mm² als Mindestanbindung an die Karosserie.
        groundEdge.data!.crossSection = mm2(16);
      }
    }
    // 16 mm² auch auf bereits vorhandenen direkten Erdungs-Kanten erzwingen —
    // eine Nutzer-/geheilte Kante darf die VDE-Mindestanbindung nicht
    // unterschreiten.
    for (const edge of [...userEdges, ...newEdges]) {
      if (!connectsToMinusSystem(edge) || !edge.data) continue;
      const current = edgeCrossSection(edge);
      edge.data.crossSection = current > mm2(16) ? current : mm2(16);
      edge.data.edgeDomain = 'DC_12V';
    }
  }

  // Generated edges are emitted in fixed wiring phases; every node-category
  // traversal uses stable top-to-bottom/left-to-right ordering. Preserve that
  // route order while retaining prior IDs by connection identity. Both imported
  // user IDs and historical auto IDs are reserved before allocation.
  const orderedAutoEdges = [...newEdges];
  const assignedIds = new Set(userEdges.map((edge) => edge.id));
  const reservedIds = new Set(assignedIds);
  for (const ids of previousAutoEdgeIdsByConnection.values()) {
    for (const id of ids) reservedIds.add(id);
  }
  const preservedAutoEdges = new Set<CableEdge>();
  for (const edge of orderedAutoEdges) {
    const previousIds = previousAutoEdgeIdsByConnection.get(autoEdgeIdentityKey(edge));
    const previousId = previousIds?.find((id) => !assignedIds.has(id));
    if (previousId === undefined) continue;
    edge.id = previousId;
    assignedIds.add(previousId);
    preservedAutoEdges.add(edge);
  }

  let nextEdgeNumber = 1;
  for (const edge of orderedAutoEdges) {
    if (preservedAutoEdges.has(edge)) continue;
    const prefix = edge.data?.edgeDomain === 'AC_230V' ? 'e-auto-ac-' : AUTO_EDGE_PREFIX;
    let id = `${prefix}${nextEdgeNumber++}`;
    while (reservedIds.has(id)) id = `${prefix}${nextEdgeNumber++}`;
    edge.id = id;
    reservedIds.add(id);
  }

  // ── Nutzerangaben an Auto-Kanten überleben den nächsten Lauf (AUDIT D3) ──
  //
  // AutoWire ersetzt bei jedem Lauf SEINE Kanten (Idempotenz) und baut sie neu
  // auf — mit den festen Planungslängen aus `addDcEdge` (Batterie→Schiene
  // 0,2 m, Panel→Regler 5 m, Verbraucher 3 m). Alles, was der Nutzer im
  // Leitungs-Inspektor an einer solchen Kante eingetragen hatte, war damit beim
  // nächsten Klick auf „Automatisch verbinden“ weg: „5 m → 2 m eingegeben, nach
  // dem Lauf standen wieder 5 m da“.
  //
  // Erhalten werden genau die ANGABEN, die AutoWire nicht rechnet: die Länge
  // (Tatsache der Verkabelung, wie `watts` am Verbraucher), die
  // Datenblattwerte des Schutzorgans (`fuseOffset`, `fuseType`,
  // `fuseBreakingCapacity`, `acProtection`). Querschnitt, Sicherungsgröße und
  // die Warnmarker bleiben berechnet — dafür ist der Knopf da; die erhaltene
  // Länge fließt in diese Rechnung ein (Spannungsfall).
  //
  // Die Quelle sind ausschließlich Auto-Kanten FRÜHERER Läufe
  // (`isAutoWiredEdge`), geschlüsselt über die Verbindung — nicht über die ID,
  // die sich bei jedem Lauf ändert.
  const previousAutoEdgeData = new Map<string, CableEdgeData>();
  for (const e of existingEdges) {
    if (isAutoWiredEdge(e)) previousAutoEdgeData.set(autoEdgeIdentityKey(e), e.data ?? {});
  }
  for (const edge of newEdges) {
    const previous = previousAutoEdgeData.get(autoEdgeIdentityKey(edge));
    if (!previous || !edge.data) continue;
    const previousLength = parseQuantity(previous.length, meters);
    if (previousLength !== null) {
      edge.data.length = previousLength;
      // Der Status wandert mit: Hatte der Nutzer die Länge eingetragen, bleibt
      // sie ein Messwert und wird nicht nachträglich zur Annahme erklärt.
      edge.data.lengthIsAssumption = previous.lengthIsAssumption === true;
    }
    if (previous.fuseOffset !== undefined) edge.data.fuseOffset = previous.fuseOffset;
    if (isFuseType(previous.fuseType)) edge.data.fuseType = previous.fuseType;
    if (Number(previous.fuseBreakingCapacity) > 0)
      edge.data.fuseBreakingCapacity = previous.fuseBreakingCapacity;
    if (previous.acProtection !== undefined) edge.data.acProtection = previous.acProtection;
  }

  // Nutzer-DC-Kanten mitdimensionieren (thermisch + Spannungsfall, Sicherungen korrigieren)
  const allEdges = [...userEdges, ...newEdges];
  const userDcEdges = userEdges.filter((e) => !isAcEdge(e, nodeMap));
  const allDcEdges = [...userDcEdges, ...dcEdges];

  // Nutzer-Kanten ohne gespeicherte Domäne werden hier eindeutig markiert:
  // topologisch AC (Landstrom/230-V-Gerät/AC-Ladegerät) → 'AC_230V',
  // Solar-Zuleitungen → 'Solar', alle übrigen DC-Kanten → 'DC_12V'. Ohne die
  // Markierungen blieben Nutzer-Kanten domänenlos und fielen zwischen DC- und
  // AC-Dimensionierung durch (Property „jede Kante ist dimensioniert“).
  for (const edge of userEdges) {
    if (edge.data && edge.data.edgeDomain === undefined) {
      edge.data.edgeDomain = isAcEdge(edge, nodeMap)
        ? 'AC_230V'
        : isSolarEdge(edge, nodeMap)
          ? 'Solar'
          : 'DC_12V';
    }
  }

  sizeDcEdges(allDcEdges, currentNodes, allEdges, sysVoltage, nodeMap);
  applyFuseSizes(allDcEdges, currentNodes, sysVoltage, nodeMap, allEdges); // ELE-005: Insel-BFS
  // ELE-002: Nicht ausführbare Dimensionierungen auf JEDER Leitung markieren
  // (auch der Minus-Rückleitung) — der Marker wird von der Live-Validierung
  // gelesen, vorher schrieb ihn niemand sichtbar.
  markInfeasibleSizing(allDcEdges, currentNodes, sysVoltage, allEdges);
  // DOM-002: Bauform der Sicherungen mitschreiben (kleinste Bauform, deren
  // Abschaltvermögen den Bank-Ik am Einbauort trägt) — sonst meldete Rule A7
  // in jedem Auto-Plan „Abschaltvermögen unbekannt".
  applyFuseTypes(allDcEdges, currentNodes, sysVoltage);
  sizeAcEdges(allEdges, currentNodes);

  const fuseBoxFeed = allDcEdges.find(
    (e) => e.source === rails.plus.id && e.target === fuseBoxNode.id && e.sourceHandle === 'plus'
  );
  if (fuseBoxFeed?.data?.fuseSize) {
    const currentRating = Number(fuseBoxNode.data.rating) || 0;
    if (autoCreatedNodeIds.has(fuseBoxNode.id) || currentRating < fuseBoxFeed.data.fuseSize) {
      fuseBoxNode.data.rating = fuseBoxFeed.data.fuseSize;
    }
  }

  // R-8 (M11-2): Optionales Auto-Layout direkt nach dem Verdrahten —
  // automatisch erzeugte Knoten rasten in Flussrichtung (Spalten je Schicht,
  // deterministisch). Nutzerknoten bleiben unangetastet.
  applyFlowLayout(
    currentNodes,
    allEdges.map((e) => ({ source: e.source, target: e.target })),
    autoCreatedNodeIds
  );

  return { nodes: currentNodes, edges: allEdges, report: conflicts.report() };
}
