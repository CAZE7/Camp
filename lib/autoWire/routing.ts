import type { Node } from 'reactflow';
import { type Meters, type Mm2 } from '../units';
import { CHARGER_TYPES, type CableEdge, connectionKey, isLeadChemistry, labelOf } from './primitives';
import { isStarterBattery, looksLikeMinusBusbar, looksLikePlusBusbar } from './validation';

// lib/autoWire/routing.ts — Rails, Node-/Edge-Erzeugung, Nutzerkanten-Heilung (M6-6).

export function buildDictionaries(currentNodes: Node[]) {
  const nodesByType: Record<string, Node[]> = {};
  const nodesByLabel = new Map<string, Node>();
  for (const node of currentNodes) {
    const type = node.type || 'default';
    if (!nodesByType[type]) nodesByType[type] = [];
    nodesByType[type].push(node);
    if (node.data?.label) {
      nodesByLabel.set(`${type}-${node.data.label}`, node);
    }
  }
  return { nodesByType, nodesByLabel };
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
      id: crypto.randomUUID(),
      type,
      position: {
        // Issue 11: importierte Knoten können ohne Position eintreffen;
        // Auto-Wire härtet gegen 0 statt mit TypeError abzubrechen.
        x: (batteryNode.position?.x ?? 0) + offsetX,
        y: (batteryNode.position?.y ?? 0) + offsetY,
      },
      data: { label, ...extraData },
    };
    currentNodes.push(node);
    typeNodes.push(node);
    nodesByLabel.set(key, node);
  }
  return node;
}

export function addDcEdge(
  newEdges: CableEdge[],
  dcEdges: CableEdge[],
  edgeIdRef: { counter: number },
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
    id: `e-auto-${edgeIdRef.counter++}`,
    source: sourceId,
    target: targetId,
    sourceHandle: handle,
    targetHandle: handle,
    type: 'cableEdge',
    data: { length, edgeDomain: domain },
  };
  newEdges.push(edge);
  dcEdges.push(edge);
  return edge;
}

export function addAcEdge(
  newEdges: CableEdge[],
  edgeIdRef: { counter: number },
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
    id: `e-auto-ac-${edgeIdRef.counter++}`,
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
    type: 'cableEdge',
    data: { length, crossSection, edgeDomain: 'AC_230V' },
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
}

export function healUserEdges(userEdges: CableEdge[], ctx: HealContext): CableEdge[] {
  // Kontext einmal benannt in lokale Konstanten legen — der Rumpf arbeitet
  // unverändert weiter (die acht Positional-Parameter waren 1:1
  // fehleranfällig in der Aufrufreihenfolge: shuntId/plusRailId ließen sich
  // ohne Compiler-Hinweis vertauschen).
  const { nodeMap, houseBatteryId, shuntId, plusRailId, minusRailId, fuseBoxId, existingConnections } = ctx;
  const dropIds = new Set<string>();
  const chargerTypeSet = new Set<string>(CHARGER_TYPES);

  for (const edge of userEdges) {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const sourceIsHouseMinus = edge.source === houseBatteryId && !!edge.sourceHandle?.includes('minus');
    const targetIsHouseMinus = edge.target === houseBatteryId && !!edge.targetHandle?.includes('minus');

    if (sourceIsHouseMinus && edge.target !== shuntId && targetNode?.type !== 'battery') {
      if (retargetEdge(edge, { source: shuntId }, existingConnections) === 'drop') {
        dropIds.add(edge.id);
      }
      continue;
    }
    if (targetIsHouseMinus && edge.source !== shuntId && sourceNode?.type !== 'battery') {
      // Issue 1: Der Minus-Port auf der TARGET-Seite des Shunts ist die
      // BATTERIESITE — dort zu landen wäre erneut ein Shunt-Bypass. Rückleiter
      // landen auf der Minus-SCHIENE, Richtung normalisiert (Schiene -> X),
      // damit die Kante mit der Auto-Kante dedupliziert statt parallel zu
      // stehen (key: rail|X|minus|minus, identisch zu addDcEdge).
      if (retargetEdge(edge, { source: minusRailId, target: edge.source }, existingConnections) === 'drop') {
        dropIds.add(edge.id);
      }
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
        existingConnections.delete(connectionKey(edge));
        dropIds.add(edge.id);
        continue;
      }
      if (retargetEdge(edge, { source: minusRailId, target: edge.source }, existingConnections) === 'drop') {
        dropIds.add(edge.id);
      }
      continue;
    }

    const sourceIsHousePlus = edge.source === houseBatteryId && !!edge.sourceHandle?.includes('plus');
    if (sourceIsHousePlus) {
      if (targetNode?.type === 'consumer') {
        if (retargetEdge(edge, { source: fuseBoxId }, existingConnections) === 'drop') {
          dropIds.add(edge.id);
        }
        continue;
      }
      if (targetNode?.type === 'inverter') {
        if (retargetEdge(edge, { source: plusRailId }, existingConnections) === 'drop') {
          dropIds.add(edge.id);
        }
        continue;
      }
      if (targetNode?.type === 'fuse' && edge.target !== plusRailId) {
        if (retargetEdge(edge, { source: plusRailId }, existingConnections) === 'drop') {
          dropIds.add(edge.id);
        }
        continue;
      }
      // Issue 5b: Ladegeräte hängen nie direkt an der Batterie-Plus-Klemme.
      // Richtung normalisieren (charger -> Plus-Schiene); dedupliziert gegen
      // die Auto-Zuleitung, statt sie parallel zu verdoppeln.
      if (targetNode && chargerTypeSet.has(targetNode.type || '')) {
        if (retargetEdge(edge, { source: edge.target, target: plusRailId }, existingConnections) === 'drop') {
          dropIds.add(edge.id);
        }
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
        const inverter = [...nodeMap.values()].find((nd) => nd.type === 'inverter');
        if (inverter) {
          if (retargetEdge(edge, { source: inverter.id }, existingConnections) === 'drop') {
            dropIds.add(edge.id);
          }
        } else {
          existingConnections.delete(connectionKey(edge));
          dropIds.add(edge.id);
        }
        continue;
      }
    }

    if (sourceNode && chargerTypeSet.has(sourceNode.type || '') && edge.target === houseBatteryId) {
      const rail = edge.sourceHandle?.includes('minus') ? minusRailId : plusRailId;
      if (retargetEdge(edge, { target: rail }, existingConnections) === 'drop') {
        dropIds.add(edge.id);
      }
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
