import type { Node } from '../domain/graph'; // ARCH-001
import { type Meters, type Mm2 } from '../units';
import { safeText } from '../safeText'; // AUDIT T1
import { CHARGER_TYPES, type CableEdge, connectionKey, isLeadChemistry, labelOf } from './primitives';
import { isStarterBattery, looksLikeMinusBusbar, looksLikePlusBusbar } from './validation';
import { isIntentPinned } from '../electricalGraph/intent';
import { compareIds } from '../sortOrder';
import type { ConflictCollector } from './conflicts';

// lib/autoWire/routing.ts — Rails, Node-/Edge-Erzeugung, Nutzerkanten-Heilung (M6-6).

export function buildDictionaries(currentNodes: Node[]) {
  const nodesByType: Record<string, Node[]> = {};
  const nodesByLabel = new Map<string, Node>();
  for (const node of currentNodes) {
    const type = node.type || 'default';
    if (!nodesByType[type]) nodesByType[type] = [];
    nodesByType[type].push(node);
    if (node.data?.label) {
      nodesByLabel.set(`${type}-${safeText(node.data.label)}`, node);
    }
  }
  return { nodesByType, nodesByLabel };
}

import { relativeGridPosition } from './placement';

function deterministicAutoNodeId(currentNodes: readonly Node[], type: string, label: string): string {
  const base = `auto-node:${encodeURIComponent(type)}:${encodeURIComponent(label)}`;
  const used = new Set(currentNodes.map((node) => node.id));
  if (!used.has(base)) return base;

  // Deterministic collision handling: an imported/user id is never replaced,
  // and the same graph always selects the same first free suffix.
  let suffix = 1;
  while (used.has(`${base}:${suffix}`)) suffix += 1;
  return `${base}:${suffix}`;
}

export function ensureNode(
  currentNodes: Node[],
  nodesByType: Record<string, Node[]>,
  nodesByLabel: Map<string, Node>,
  batteryNode: Node,
  type: string,
  label: string,
  offsetX: number,
  offsetY: number,
  extraData: Record<string, unknown> = {}
): Node {
  let typeNodes = nodesByType[type];
  if (!typeNodes) {
    typeNodes = [];
    nodesByType[type] = typeNodes;
  }

  const key = `${type}-${label}`;
  let node = nodesByLabel.get(key);
  if (!node) {
    node = {
      id: deterministicAutoNodeId(currentNodes, type, label),
      type,
      // R-8 (M11-2): Platzierung in Flussrichtung auf dem 16-px-Raster —
      // Issue 11 (Härtung gegen fehlende Position) bleibt erhalten.
      position: relativeGridPosition(batteryNode, offsetX, offsetY),
      data: { label, ...extraData },
    };
    currentNodes.push(node);
    typeNodes.push(node);
    nodesByLabel.set(key, node);
  }
  return node;
}

type AutoEdgeIdRef = { counter: number; usedIds: Set<string> };

function nextAutoEdgeId(edgeIdRef: AutoEdgeIdRef, prefix: 'e-auto-' | 'e-auto-ac-'): string {
  let id = `${prefix}${edgeIdRef.counter++}`;
  while (edgeIdRef.usedIds.has(id)) id = `${prefix}${edgeIdRef.counter++}`;
  edgeIdRef.usedIds.add(id);
  return id;
}

export function addDcEdge(
  newEdges: CableEdge[],
  dcEdges: CableEdge[],
  edgeIdRef: AutoEdgeIdRef,
  existingConnections: Set<string>,
  sourceId: string,
  targetId: string,
  handle: 'plus' | 'minus',
  length: Meters,
  domain: 'DC_12V' | 'Solar' = 'DC_12V'
): CableEdge | null {
  const key = `${sourceId}|${targetId}|${handle}|${handle}`;
  if (existingConnections.has(key)) return null;
  existingConnections.add(key);
  const edge: CableEdge = {
    id: nextAutoEdgeId(edgeIdRef, 'e-auto-'),
    source: sourceId,
    target: targetId,
    sourceHandle: handle,
    targetHandle: handle,
    type: 'cableEdge',
    // AUDIT D2: Herkunft als DATENFELD, nicht als ID-Präfix — AutoWire
    // erkennt seine eigenen Kanten am Flag wieder und ersetzt nur die.
    //
    // `lengthIsAssumption` (dreißigste Fassung): Die übergebene Länge ist eine
    // Planungsannahme (siehe `docs/ai/AUTOWIRE-CONTEXT.md` §7.3), kein
    // Messwert. Sie muss als solche erkennbar sein — sonst zeigt der Inspector
    // sie wie eine Nutzereingabe an.
    data: { length, lengthIsAssumption: true, edgeDomain: domain, autoWired: true },
  };
  newEdges.push(edge);
  dcEdges.push(edge);
  return edge;
}

export function addAcEdge(
  newEdges: CableEdge[],
  edgeIdRef: AutoEdgeIdRef,
  existingConnections: Set<string>,
  sourceId: string,
  targetId: string,
  sourceHandle: string,
  targetHandle: string,
  length: Meters,
  crossSection: Mm2
): void {
  const key = `${sourceId}|${targetId}|${sourceHandle}|${targetHandle}`;
  if (existingConnections.has(key)) return;
  existingConnections.add(key);
  newEdges.push({
    id: nextAutoEdgeId(edgeIdRef, 'e-auto-ac-'),
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
    type: 'cableEdge',
    // AUDIT D2: s. addDcEdge — Flag statt String-Präfix.
    // `lengthIsAssumption`: s. addDcEdge.
    data: { length, lengthIsAssumption: true, crossSection, edgeDomain: 'AC_230V', autoWired: true },
  });
}

export type Rails = { plus: Node; minus: Node };

/** @internal für Unit-Tests exportiert. */

export function resolveRails(
  currentNodes: Node[],
  nodesByType: Record<string, Node[]>,
  nodesByLabel: Map<string, Node>,
  batteryNode: Node,
  autoCreatedNodeIds: Set<string>
): Rails {
  const busbars = nodesByType['busbar'] || [];
  const plusByRole = busbars.find(looksLikePlusBusbar);
  const minusByRole = busbars.find(looksLikeMinusBusbar);

  // A busbar is a conductor, not a combined plus/minus distribution block.
  // Reusing one node for both rails would directly connect the battery poles
  // through the generated backbone. Always select or create *two* nodes.
  const createRail = (role: 'positive' | 'negative'): Node => {
    const node = ensureNode(
      currentNodes,
      nodesByType,
      nodesByLabel,
      batteryNode,
      'busbar',
      role === 'positive' ? 'Plus-Schiene' : 'Minus-Schiene',
      role === 'positive' ? 280 : 560,
      role === 'positive' ? -120 : 80,
      { role }
    );
    autoCreatedNodeIds.add(node.id);
    return node;
  };

  let plus = plusByRole;
  let minus = minusByRole;
  // A legacy label can accidentally contain both terms; it must still not
  // turn one physical conductor into both polarities.
  if (plus?.id === minus?.id) minus = undefined;

  // An explicitly identified rail takes precedence over its array position.
  // Use a different unambiguous/generic rail for the other polarity whenever
  // possible before adding a new node.
  if (!plus) plus = busbars.find((node) => node.id !== minus?.id);
  if (!minus) minus = busbars.find((node) => node.id !== plus?.id);

  if (!plus) plus = createRail('positive');
  if (!minus) minus = createRail('negative');

  // Persist the inferred role too. This makes a subsequent auto-wire run
  // deterministic and lets the UI distinguish the two existing rails.
  plus.data = { ...plus.data, role: 'positive' };
  minus.data = { ...minus.data, role: 'negative' };

  return { plus, minus };
}

export function findOrCreate(
  currentNodes: Node[],
  nodesByType: Record<string, Node[]>,
  nodesByLabel: Map<string, Node>,
  batteryNode: Node,
  autoCreatedNodeIds: Set<string>,
  type: string,
  label: string,
  offsetX: number,
  offsetY: number,
  extraData: Record<string, unknown> = {},
  labelRegex?: RegExp
): Node {
  const byExact = nodesByLabel.get(`${type}-${label}`);
  if (byExact) return byExact;
  const typeNodes = nodesByType[type] || [];
  if (labelRegex) {
    const byRe = typeNodes.find((n) => labelRegex.test(labelOf(n)));
    if (byRe) return byRe;
  }
  if (typeNodes.length === 1) {
    const only = typeNodes[0];
    if (only) return only;
  }
  const created = ensureNode(
    currentNodes,
    nodesByType,
    nodesByLabel,
    batteryNode,
    type,
    label,
    offsetX,
    offsetY,
    extraData
  );
  autoCreatedNodeIds.add(created.id);
  return created;
}

export function retargetEdge(
  edge: CableEdge,
  next: { source?: string; target?: string },
  existingConnections: Set<string>
): 'ok' | 'drop' {
  const oldKey = connectionKey(edge);
  const newSource = next.source ?? edge.source;
  const newTarget = next.target ?? edge.target;
  const newKey = `${newSource}|${newTarget}|${edge.sourceHandle || ''}|${edge.targetHandle || ''}`;
  if (newKey === oldKey) return 'ok';
  if (existingConnections.has(newKey)) {
    existingConnections.delete(oldKey);
    return 'drop';
  }
  existingConnections.delete(oldKey);
  edge.source = newSource;
  edge.target = newTarget;
  existingConnections.add(newKey);
  return 'ok';
}

/**
 * Fädelt unsichere Nutzer-Kanten in die Ziel-Topologie ein:
 *  - Batterie-Minus → X  wird zu  Shunt-Minus → X  (kein Shunt-Bypass)
 *  - X-Minus → Batterie/Shunt-Batteriepin  landet normalisiert auf der Minus-Schiene
 *  - Batterie-Plus → Verbraucher  führt über den Sicherungskasten; → Inverter/Lader
 *    über die Plus-Schiene; → 230-V-Seite  an den Wechselrichter-Ausgang oder entfällt
 *  - Ladequellen direkt auf die Batterie  werden auf die Plus-/Minus-Schiene gelegt
 *
 * Kanten, die nach dem Umlegen doppelt wären, entfallen (kein paralleler Pfad).
 */
/** @internal für Unit-Tests exportiert. */
export interface HealContext {
  nodeMap: Map<string, Node>;
  houseBatteryId: string;
  shuntId: string;
  plusRailId: string;
  minusRailId: string;
  fuseBoxId: string;
  existingConnections: Set<string>;
  /**
   * Protokoll der Eingriffe (V2). Fehlt es, arbeitet die Heilung wie bisher —
   * aber dann weiß niemand, was passiert ist; `performAutoWiring` übergibt
   * immer einen Sammler.
   */
  report?: ConflictCollector;
}

export function healUserEdges(userEdges: CableEdge[], ctx: HealContext): CableEdge[] {
  // Kontext einmal benannt in lokale Konstanten legen — der Rumpf arbeitet
  // unverändert weiter (die acht Positional-Parameter waren 1:1
  // fehleranfällig in der Aufrufreihenfolge: shuntId/plusRailId ließen sich
  // ohne Compiler-Hinweis vertauschen).
  const { nodeMap, houseBatteryId, shuntId, plusRailId, minusRailId, fuseBoxId, existingConnections } = ctx;
  const report = ctx.report;
  const dropIds = new Set<string>();
  const chargerTypeSet = new Set<string>(CHARGER_TYPES);

  for (const edge of userEdges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    // ── V2-AUTO-001: Nutzerabsicht schlägt Regel ───────────────────────────
    // Eine festgenagelte Kante (`locked`) oder eine ausdrücklich erklärte
    // Absicht (`intent: 'user' | 'required'`) wird NICHT umgebaut. Der
    // Konflikt wird benannt — entscheiden darf nur der Mensch.
    const pinned = isIntentPinned(edge);
    const nodeIds = [edge.source, edge.target];

    /**
     * Wendet eine Heilungsregel an. Gibt `true` zurück, wenn die Kante
     * behandelt wurde (der Aufrufer macht dann `continue`).
     */
    const heal = (
      ruleId: string,
      what: string,
      severityWhenPinned: 'warning' | 'critical',
      action: 'drop' | { source?: string; target?: string }
    ): void => {
      if (pinned) {
        report?.add({
          kind: 'pinned-edge-violates-rule',
          severity: severityWhenPinned,
          ruleId,
          message: `Benutzerentscheidung widerspricht Regel ${ruleId}: ${what} Die Verbindung wurde unverändert gelassen.`,
          edgeIds: [edge.id],
          nodeIds,
        });
        return;
      }
      if (action === 'drop') {
        existingConnections.delete(connectionKey(edge));
        dropIds.add(edge.id);
        report?.add({
          kind: 'dropped-user-edge',
          severity: 'warning',
          ruleId,
          message: `Verbindung entfernt (Regel ${ruleId}): ${what}`,
          edgeIds: [edge.id],
          nodeIds,
        });
        return;
      }
      const before = `${edge.source} → ${edge.target}`;
      if (retargetEdge(edge, action, existingConnections) === 'drop') {
        dropIds.add(edge.id);
        report?.add({
          kind: 'dropped-user-edge',
          severity: 'warning',
          ruleId,
          message: `Verbindung entfernt (Regel ${ruleId}): ${what} Nach dem Umlegen wäre sie ein zweiter, paralleler Pfad gewesen.`,
          edgeIds: [edge.id],
          nodeIds,
        });
        return;
      }
      report?.add({
        kind: 'healed-user-edge',
        severity: 'info',
        ruleId,
        message: `Verbindung umgelegt (Regel ${ruleId}): ${what} ${before} → ${edge.source} → ${edge.target}.`,
        edgeIds: [edge.id],
        nodeIds,
      });
    };

    const sourceIsHouseMinus = edge.source === houseBatteryId && !!edge.sourceHandle?.includes('minus');
    const targetIsHouseMinus = edge.target === houseBatteryId && !!edge.targetHandle?.includes('minus');

    // AUDIT ELE-001: Batterie×Batterie plus↔minus ist keine modellierte
    // Serienschaltung. AutoWire würde beide Akkus zusätzlich auf gemeinsame
    // Plus-/Minus-Schienen legen und daraus einen Kurzschluss bauen. Solche
    // Kanten werden beim AutoWire-Lauf entfernt statt gefährlich umgesetzt.
    const sourceIsBattery = sourceNode?.type === 'battery';
    const targetIsBattery = targetNode?.type === 'battery';
    if (sourceIsBattery && targetIsBattery) {
      const sPlus = !!edge.sourceHandle?.includes('plus');
      const tMinus = !!edge.targetHandle?.includes('minus');
      const sMinus = !!edge.sourceHandle?.includes('minus');
      const tPlus = !!edge.targetHandle?.includes('plus');
      if ((sPlus && tMinus) || (sMinus && tPlus)) {
        heal(
          'ELE-001',
          'Plus und Minus zweier Batterien direkt verbunden — ohne erklärte Reihenschaltung (bankTopology) ist das ein Kurzschlusspfad.',
          'critical',
          'drop'
        );
        continue;
      }
    }

    // AUDIT ELE-002: Solar-Kanten nur zwischen Panels (String) oder Panel
    // → Laderegler/MPPT. Direktverbindungen zu Batterie/Verbraucher sind
    // fachlich falsch und werden beim AutoWire-Lauf entfernt.
    const isSolarType = (type?: string): boolean => type === 'solar' || type === 'roofSolar';
    const sourceSolar = isSolarType(sourceNode?.type);
    const targetSolar = isSolarType(targetNode?.type);
    if (sourceSolar || targetSolar) {
      const other = sourceSolar ? targetNode : sourceNode;
      const solarPair = sourceSolar && targetSolar;
      const otherIsController = other?.type === 'mpptController' || other?.type === 'charger';
      if (!solarPair && !otherIsController) {
        heal(
          'ELE-002',
          'Solarmodul ohne Laderegler verbunden — die Modulspannung liegt ungeregelt am Ziel an.',
          'critical',
          'drop'
        );
        continue;
      }
    }

    if (sourceIsHouseMinus && edge.target !== shuntId && targetNode?.type !== 'battery') {
      heal(
        'AUTO-SHUNT-BYPASS',
        'Minus-Abgang direkt an der Batterie umgeht den Batteriecomputer (Shunt) — er misst dann nicht den gesamten Strom.',
        'warning',
        { source: shuntId }
      );
      continue;
    }
    if (targetIsHouseMinus && edge.source !== shuntId && sourceNode?.type !== 'battery') {
      // Issue 1: Der Minus-Port auf der TARGET-Seite des Shunts ist die
      // BATTERIESITE — dort zu landen wäre erneut ein Shunt-Bypass. Rückleiter
      // landen auf der Minus-SCHIENE, Richtung normalisiert (Schiene -> X),
      // damit die Kante mit der Auto-Kante dedupliziert statt parallel zu
      // stehen (key: rail|X|minus|minus, identisch zu addDcEdge).
      heal(
        'AUTO-SHUNT-BYPASS',
        'Rückleiter direkt auf die Batterieklemme umgeht den Batteriecomputer (Shunt).',
        'warning',
        { source: minusRailId, target: edge.source }
      );
      continue;
    }

    // Issue 1, Fall 2: Kanten, die direkt auf den Batterie-Pin des Shunts
    // zeigen (target:shunt, targetHandle:minus), waren ein unentdeckter
    // Bypass, weil kein Zweig sie fing.
    if (
      edge.target === shuntId &&
      !!edge.targetHandle?.includes('minus') &&
      sourceNode?.type !== 'battery' &&
      edge.source !== shuntId
    ) {
      if (edge.source === minusRailId) {
        // Schiene -> Shunt-Batteriepin umgeht alle Lasten; die korrekte
        // Shunt->Schiene-Kante stellt das Auto-Wiring. Diese Kante entfällt.
        heal(
          'AUTO-SHUNT-BYPASS',
          'Minus-Schiene direkt auf den Batterie-Pin des Shunts gelegt — das überbrückt die Messstrecke.',
          'warning',
          'drop'
        );
        continue;
      }
      heal(
        'AUTO-SHUNT-BYPASS',
        'Verbindung auf den Batterie-Pin des Shunts umgeht die Messstrecke.',
        'warning',
        { source: minusRailId, target: edge.source }
      );
      continue;
    }

    const sourceIsHousePlus = edge.source === houseBatteryId && !!edge.sourceHandle?.includes('plus');
    if (sourceIsHousePlus) {
      if (targetNode?.type === 'consumer') {
        heal(
          'AUTO-FUSE-BYPASS',
          'Verbraucher direkt an der Batterie-Plusklemme — die Leitung ist dann nicht abgesichert.',
          'critical',
          { source: fuseBoxId }
        );
        continue;
      }
      if (targetNode?.type === 'inverter') {
        heal(
          'AUTO-RAIL-NORMALISE',
          'Wechselrichter wird über die Plus-Schiene gespeist, nicht direkt von der Klemme.',
          'warning',
          { source: plusRailId }
        );
        continue;
      }
      if (targetNode?.type === 'fuse' && edge.target !== plusRailId) {
        heal(
          'AUTO-RAIL-NORMALISE',
          'Sicherung sitzt im Abgang der Plus-Schiene, nicht direkt an der Klemme.',
          'warning',
          { source: plusRailId }
        );
        continue;
      }
      // Issue 5b: Ladegeräte hängen nie direkt an der Batterie-Plus-Klemme.
      // Richtung normalisieren (charger -> Plus-Schiene); dedupliziert gegen
      // die Auto-Zuleitung, statt sie parallel zu verdoppeln.
      if (targetNode && chargerTypeSet.has(targetNode.type || '')) {
        heal(
          'AUTO-RAIL-NORMALISE',
          'Ladequelle speist über die Plus-Schiene, nicht direkt auf die Batterieklemme.',
          'warning',
          { source: edge.target, target: plusRailId }
        );
        continue;
      }
      // Issue 5a: Eine 12-V-Batterie speist nie direkt eine 230-V-Seite.
      // Existiert ein Wechselrichter, hängt die Kante an dessen AC-Ausgang;
      // sonst entfällt sie — als Direktabgang war sie fachlich nie zulässig,
      // und eine erhaltene Leiche würde die Validierung nur verwirren.
      if (
        targetNode?.type === 'consumer230v' ||
        targetNode?.type === 'shorePower' ||
        targetNode?.type === 'acBatteryCharger'
      ) {
        // V2-AUTO-002: `find()` nahm den ERSTEN Wechselrichter im Array —
        // bei zwei Geräten entschied die Einfügereihenfolge. Jetzt gilt die
        // kleinste ID (stabil), und bei Mehrdeutigkeit wird gefragt.
        const inverters = [...nodeMap.values()]
          .filter((nd) => nd.type === 'inverter')
          .sort((left, right) => compareIds(left.id, right.id));
        const inverter = inverters[0];
        if (inverters.length > 1) {
          report?.add({
            kind: 'ambiguous-ac-source',
            severity: 'warning',
            ruleId: 'AUTO-AC-SOURCE',
            message:
              'Mehrere Wechselrichter vorhanden — die 230-V-Verbindung wurde dem Gerät mit der kleinsten ID zugeordnet. Bitte die Quelle am Verbraucher ausdrücklich setzen (Feld „acSourceId“).',
            edgeIds: [edge.id],
            nodeIds: inverters.map((nd) => nd.id),
          });
        }
        if (inverter) {
          heal(
            'ELE-AC-DIRECT',
            '230-V-Gerät direkt an der 12-V-Batterie — die Verbindung gehört an den Wechselrichter-Ausgang.',
            'critical',
            { source: inverter.id }
          );
        } else {
          heal(
            'ELE-AC-DIRECT',
            '230-V-Gerät direkt an der Batterie, aber kein Wechselrichter im Plan — die Verbindung ist fachlich nicht herstellbar.',
            'critical',
            'drop'
          );
        }
        continue;
      }
    }

    if (sourceNode && chargerTypeSet.has(sourceNode.type || '') && edge.target === houseBatteryId) {
      const rail = edge.sourceHandle?.includes('minus') ? minusRailId : plusRailId;
      heal(
        'AUTO-RAIL-NORMALISE',
        'Ladequelle speist über die Sammelschiene, nicht direkt auf die Batterieklemme.',
        'warning',
        { target: rail }
      );
    }
  }

  return userEdges.filter((e) => !dropIds.has(e.id));
}

/** @internal für Unit-Tests exportiert. */

export function pickHouseBattery(batteries: Node[]): Node | undefined {
  if (batteries.length === 0) return undefined;
  return batteries.find((b) => !isStarterBattery(b)) || batteries[0];
}

export function pickExistingStarter(
  batteries: Node[],
  house: Node,
  allowChemistryFallback: boolean
): Node | undefined {
  const others = batteries.filter((b) => b.id !== house.id);
  const byLabel = others.find(isStarterBattery);
  if (byLabel) return byLabel;
  // AGM/Blei als Starter nur, wenn ein Ladebooster die Starterseite braucht.
  // Ohne Booster ist eine zweite AGM eine Aufbaubatterie und wird parallel gelegt.
  // Bei drei+ Batterien wird eine zweite AGM NICHT automatisch zur Starter-
  // Batterie erklärt — das wäre ein unbeabsichtigter Umbau eines echten
  // Aufbaubatterien-Banks (z. B. zwei 100-Ah-AGM) in ein Starter-Paar.
  if (allowChemistryFallback && others.length === 1) return others.find(isLeadChemistry);
  return undefined;
}

/**
 * Verdrahtet das komplette System VDE-konform und abgesichert.
 *
 * @param initialNodes  Aktuelle Komponenten des Plans
 * @param existingEdges Aktuelle Kanten (Nutzer-Kanten bleiben erhalten;
 *                      Auto-Kanten früherer Läufe werden ersetzt)
 */
