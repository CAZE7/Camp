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

import type { Node } from 'reactflow';
import { getSystemVoltage, isStarterBatteryLabel } from './vde-standards';
import {
  addWatts,
  currentFromPower,
  meters,
  mm2,
  quantityOr,
  volts,
  watts,
  ZERO_VOLTS,
  ZERO_WATTS,
  type Meters,
  type Volts,
} from './units';
import {
  AUTO_EDGE_PREFIX,
  connectionKey,
  edgeCrossSection,
  isLeadChemistry,
  type CableEdge,
} from './autoWire/primitives';
import { isAcEdge, isSolarEdge, isStarterBattery } from './autoWire/validation';
import { sizeDcEdges, applyFuseSizes, sizeAcEdges } from './autoWire/sizing';
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

export { isStarterBatteryLabel };
export { AUTO_EDGE_PREFIX } from './autoWire/primitives';
export {
  cumulativeDropAt,
  relevantCumulativeDrop,
  sizeDcEdges,
  applyFuseSizes,
  sizeAcEdges,
} from './autoWire/sizing';
export { resolveRails, healUserEdges, pickHouseBattery } from './autoWire/routing';

export function performAutoWiring(
  initialNodes: Node[],
  existingEdges: CableEdge[] = []
): { nodes: Node[]; edges: CableEdge[] } | null {
  const currentNodes = initialNodes.map((n) => ({ ...n, data: { ...(n.data || {}) } }));
  // Issue 6: Eine fehlende Nutzerkanten-Länge wurde pauschal als 1 m
  // festgeschrieben — bei Importen mit langer realer Strecke zu dünn
  // dimensioniert und auf dem Canvas unsichtbar (der Renderer-Fallback auf
  // die Geometrie wurde durch den gespeicherten Wert abgeschaltet). Neu:
  // Schätzung aus der Knotengeometrie (100 px = 1 m, konsistent mit der
  // Anzeigeebene); ohne Positionen bleibt der Wert undefined und jeder
  // Lesezugriff nutzt seinen definierten Fallback.
  const nodePositions = new Map(initialNodes.map((nd) => [nd.id, nd.position]));
  const geometricLength = (e: { source: string; target: string }): Meters | undefined => {
    const a = nodePositions.get(e.source);
    const b = nodePositions.get(e.target);
    if (!a || !b) return undefined;
    return meters(Math.max(1, Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0)) / 100));
  };
  let userEdges: CableEdge[] = existingEdges
    .filter((e) => !e.id.startsWith(AUTO_EDGE_PREFIX))
    .map((e) => ({
      ...e,
      data: {
        length: e.data?.length ?? geometricLength(e),
        crossSection: e.data?.crossSection,
        fuseSize: e.data?.fuseSize,
        edgeDomain: e.data?.edgeDomain,
      },
    }));
  const newEdges: CableEdge[] = [];
  const dcEdges: CableEdge[] = [];
  const edgeIdRef = { counter: 1 };

  const existingConnections = new Set<string>();
  for (const e of userEdges) {
    existingConnections.add(connectionKey(e));
  }

  const { nodesByType, nodesByLabel } = buildDictionaries(currentNodes);
  const batteries = nodesByType['battery'] || [];
  let batteryNode = pickHouseBattery(batteries);
  if (!batteryNode) return null;
  const autoCreatedNodeIds = new Set<string>();

  const dcdcChargers = nodesByType['dcdcCharger'] || [];
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

  const sysVoltage = getSystemVoltage(currentNodes, batteryNode.id);

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

  const solars = [...(nodesByType['solar'] || []), ...(nodesByType['roofSolar'] || [])];

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
      (sum, n) => addWatts(sum, quantityOr((n.data as Record<string, unknown>)?.watts, watts, ZERO_WATTS)),
      ZERO_WATTS
    );
    const requiredAmps = Math.ceil(currentFromPower(totalSolarWatts, sysVoltage));
    if ((Number(mpptNode.data.amps) || 0) < requiredAmps) {
      mpptNode.data.amps = requiredAmps;
    }
  }

  let starterBatteryNode = pickExistingStarter(batteries, batteryNode, dcdcChargers.length > 0);
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
  userEdges = healUserEdges(
    userEdges,
    nodeMap,
    batteryNode.id,
    shuntNode.id,
    rails.plus.id,
    rails.minus.id,
    fuseBoxNode.id,
    existingConnections
  );

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

  // Weitere Aufbaubatterien parallel auf dieselben Schienen (nicht die Starterbatterie).
  // Parallelschaltung unterschiedlicher Chemien/Nennspannungen ist fachlich
  // unzulässig (Lade-/Entladeprofile, Innenwiderstände, Spannungsfenster).
  // Solche Batterien werden NICHT auf die Schiene gelegt, statt eine
  // gefährliche 24-V-auf-12-V- bzw. AGM-auf-LiFePO4-Verbindung zu erzeugen.
  // Issue 2: Ein fehlender nominalVoltage war bisher ein stiller
  // Freifahrtschein (Haustür-Vergleich house↔extra, extras untereinander
  // ungeprüft — 24 V landeten auf der 12-V-Schiene). Fehlende Werte werden
  // auf die aufgelöste Systemspannung normiert und jeder Kandidat gegen
  // JEDE bereits akzeptierte Batterie geprüft.
  const voltageOf = (b: Node): Volts =>
    quantityOr((b.data as Record<string, unknown>)?.nominalVoltage, volts, sysVoltage);
  const safeToParallel = (a: Node, b: Node): boolean =>
    voltageOf(a) === voltageOf(b) && isLeadChemistry(a) === isLeadChemistry(b);
  const acceptedParallel: Node[] = [batteryNode];
  for (const extra of batteries) {
    if (extra.id === batteryNode.id) continue;
    if (starterBatteryNode && extra.id === starterBatteryNode.id) continue;
    if (!acceptedParallel.every((a) => safeToParallel(a, extra))) continue;
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

  for (const consumer of nodesByType['consumer'] || []) {
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
  for (const inverter of inverters) {
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
    ...(nodesByType['charger'] || []),
    ...(nodesByType['mpptController'] || []),
    ...(nodesByType['dcdcCharger'] || []),
    ...(nodesByType['acBatteryCharger'] || []),
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
    for (const booster of dcdcChargers) {
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
  const shorePowers = nodesByType['shorePower'] || [];
  const consumers230v = nodesByType['consumer230v'] || [];
  if (inverters.length > 0) {
    const mainInverter = inverters[0];
    for (const c of consumers230v) {
      addAcEdge(
        newEdges,
        edgeIdRef,
        existingConnections,
        mainInverter.id,
        c.id,
        'plus',
        'plus',
        meters(2),
        mm2(1.5)
      );
    }
    // Jeder Wechselrichter bekommt den Landstrom-Eingang; die 230-V-Verbraucher
    // hängen am ersten WR, damit nicht zwei WR parallel einen Kreis speisen.
    for (const inverter of inverters) {
      for (const sp of shorePowers) {
        addAcEdge(
          newEdges,
          edgeIdRef,
          existingConnections,
          sp.id,
          inverter.id,
          'plus',
          'ac_in',
          meters(2),
          mm2(2.5)
        );
      }
    }
  } else {
    for (const sp of shorePowers) {
      for (const c of consumers230v) {
        addAcEdge(newEdges, edgeIdRef, existingConnections, sp.id, c.id, 'plus', 'plus', meters(2), mm2(1.5));
      }
    }
  }

  for (const acCharger of nodesByType['acBatteryCharger'] || []) {
    for (const sp of shorePowers) {
      addAcEdge(
        newEdges,
        edgeIdRef,
        existingConnections,
        sp.id,
        acCharger.id,
        'plus',
        'plus',
        meters(2),
        mm2(2.5)
      );
    }
  }

  const grounds = nodesByType['ground'] || [];
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
  applyFuseSizes(allDcEdges, currentNodes, sysVoltage, nodeMap);
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

  return { nodes: currentNodes, edges: allEdges };
}
