import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { getLayoutedElements } from '../components/planner/utils/layout';
import React from 'react';
import { Node, Edge, Connection } from 'reactflow';
import { initialNodes, initialEdges } from '../components/planner/constants';
import { CableEdgeData } from '../components/edges/CableEdge';
import { PlannerNodeData } from '../components/nodes/types';

interface PlannerState {
  viewMode: 'electric' | 'water';
  setViewMode: (mode: 'electric' | 'water') => void;

  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;

  isInspectorOpen: boolean;
  setInspectorOpen: (isOpen: boolean) => void;
  toggleInspector: () => void;

  systemMessage: string | null;
  setSystemMessage: (msg: string | null) => void;

  nodes: Node[];
  edges: Edge<CableEdgeData>[];
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge<CableEdgeData>[] | ((eds: Edge<CableEdgeData>[]) => Edge<CableEdgeData>[])) => void;

  waterNodes: Node[];
  waterEdges: Edge[];
  setWaterNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setWaterEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;

  season: 'summer' | 'winter';
  setSeason: (season: 'summer' | 'winter') => void;

  waterWarning: string | null;
  setWaterWarning: (warning: string | null) => void;

  firstTappedHandle: { nodeId: string, handleId: string, handleType: string } | null;
  setFirstTappedHandle: (handle: { nodeId: string, handleId: string, handleType: string } | null | ((prev: { nodeId: string, handleId: string, handleType: string } | null) => { nodeId: string, handleId: string, handleType: string } | null)) => void;

  selectedNodes: Node[];
  selectedEdges: Edge[];
  setSelectedNodes: (nodes: Node[]) => void;
  setSelectedEdges: (edges: Edge[]) => void;

  onNodesChange: (changes: import('reactflow').NodeChange[]) => void;
  onEdgesChange: (changes: import('reactflow').EdgeChange[]) => void;
  onWaterNodesChange: (changes: import('reactflow').NodeChange[]) => void;
  onWaterEdgesChange: (changes: import('reactflow').EdgeChange[]) => void;
  onSelectionChange: (params: import('reactflow').OnSelectionChangeParams) => void;
  focusElement: (id: string, elementType: 'node' | 'edge') => void;
  deleteSelected: () => void;
  updateNodeData: (id: string, data: Partial<PlannerNodeData>) => void;
  handleChangeLength: (id: string, length: number) => void;
  handleChangeCrossSection: (id: string, crossSection: number) => void;
  handleChangeFuseSize: (id: string, fuseSize: number) => void;

  isValidConnection: (connection: Connection) => boolean;
  onConnect: (connection: Connection) => void;
  autoWireSystem: () => void;
  onLayout: () => void;
  checkSchematic: () => void;
  exportBOM: () => void;
  onDrop: (event: React.DragEvent, screenToFlowPosition: (client: {x: number, y: number}) => {x: number, y: number}) => void;
  onCustomDrop: (event: Event, screenToFlowPosition: (client: {x: number, y: number}) => {x: number, y: number}) => void;
  addNode: (type: string, label: string, position: {x: number, y: number}, watts?: number) => void;
  applyTemplate: (templateId: string) => void;
  calculatePathVoltageDrop: (targetNodeId: string, customNodes?: Node[], customEdges?: Edge[]) => number;
  isLayoutPending: boolean;
  setIsLayoutPending: (pending: boolean) => void;
}

import { TEMPLATES_DICT } from '../components/planner/templates';
import {
  VDE_SIZES,
  calculateCrossSection,
  getEdgeDomain,
  getHandleDomain,
  lookupThermalCrossSection,
  selectFuseSize,
} from '../lib/electrical';
import { calculateEdgeCurrent, getSystemVoltage } from '../lib/vde-standards';

const nodesMapCache = new WeakMap<Node[], Map<string, Node>>();
const waterNodesMapCache = new WeakMap<Node[], Map<string, Node>>();
const totalWattsCache = new WeakMap<Node[], number>();

export function getDerivedSystemState(nodes: Node[], waterNodes: Node[]) {
  let nodesMap = nodesMapCache.get(nodes);
  let totalWatts = totalWattsCache.get(nodes);

  if (!nodesMap || totalWatts === undefined) {
    nodesMap = new Map();
    totalWatts = 0;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      nodesMap.set(n.id, n);
      if (n.type === 'consumer' || n.type === 'consumer230v' || n.type === 'inverter') {
        totalWatts += (Number(n.data.watts) || 0);
      }
    }
    nodesMapCache.set(nodes, nodesMap);
    totalWattsCache.set(nodes, totalWatts);
  }

  let waterNodesMap = waterNodesMapCache.get(waterNodes);
  if (!waterNodesMap) {
    waterNodesMap = new Map();
    for (let i = 0; i < waterNodes.length; i++) {
      const n = waterNodes[i];
      waterNodesMap.set(n.id, n);
    }
    waterNodesMapCache.set(waterNodes, waterNodesMap);
  }

  return { nodesMap, waterNodesMap, totalWatts };
}

function getNodeMap(currentNodes: Node[], currentWaterNodes: Node[]): Map<string, Node> {
  const { nodesMap, waterNodesMap } = getDerivedSystemState(currentNodes, currentWaterNodes);
  const combined = new Map(nodesMap);
  waterNodesMap.forEach((node, id) => combined.set(id, node));
  return combined;
}

function buildDictionaries(currentNodes: Node[]) {
  const nodesByType: Record<string, Node[]> = {};
  // Optimized O(1) Map lookup replacing typeNodes.find()
  const nodesByLabel = new Map<string, Node>();
  const len = currentNodes.length;
  for (let i = 0; i < len; i++) {
    const node = currentNodes[i];
    const type = node.type || 'default';
    let arr = nodesByType[type];
    if (!arr) {
      arr = [];
      nodesByType[type] = arr;
    }
    arr.push(node);
    if (node.data?.label) {
      nodesByLabel.set(`${type}-${node.data.label}`, node);
    }
  }
  return { nodesByType, nodesByLabel };
}

function ensureNode(
  currentNodes: Node[],
  nodesByType: Record<string, Node[]>,
  nodesByLabel: Map<string, Node>,
  batteryNode: Node,
  type: string,
  label: string,
  offsetX: number,
  offsetY: number,
  extraData: Record<string, unknown> = {}
) {
  let typeNodes = nodesByType[type];
  if (!typeNodes) {
    typeNodes = [];
    nodesByType[type] = typeNodes;
  }

  const key = `${type}-${label}`;
  // Map lookup is O(1) compared to array .find()
  let node = nodesByLabel.get(key);
  if (!node) {
    node = {
      id: crypto.randomUUID(),
      type,
      position: {
        x: batteryNode.position.x + offsetX,
        y: batteryNode.position.y + offsetY,
      },
      data: { label, ...extraData },
    };
    currentNodes.push(node);
    typeNodes.push(node);
    nodesByLabel.set(key, node);
  }
  return node;
}

const AUTO_EDGE_PREFIX = 'e-auto-';

// VDE 0298-4 / 0100-520: max. 3% Spannungsfall auf 12-V-Strecken
// (0,36 V bei 12 V — skaliert mit der tatsächlichen Systemspannung).
// Pro Einzelstrecke max. 2%, damit mehrstufige Pfade (Batterie → Shunt →
// Busbar → Sicherungskasten → Verbraucher) sicher im 3%-Gesamtbudget bleiben.
const VDE_MAX_DC_DROP_FRACTION = 0.03;
const VDE_MAX_DC_DROP_PER_EDGE_FRACTION = 0.02;

/** Eindeutiger Schlüssel einer Verbindung (für Duplikat-Erkennung). */
const connectionKey = (e: {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): string => `${e.source}|${e.target}|${e.sourceHandle || ''}|${e.targetHandle || ''}`;

/**
 * Knoten, an denen die Spannungsfall-Rückwärtssuche endet: Spannungsquellen
 * (Batterie, Landstrom, Solar) und Ladequellen (MPPT, Booster, Ladegeräte).
 * Der Spannungsfall eines Verbraucher-Pfads umfasst nur dessen Versorgungs-
 * strecke — parallele Ladezweige fließen nicht in die Last-Bilanz ein.
 */
const isVoltageDropStopType = (type: string | undefined): boolean =>
  type === 'battery' ||
  type === 'shorePower' ||
  type === 'solar' ||
  type === 'roofSolar' ||
  type === 'charger' ||
  type === 'mpptController' ||
  type === 'dcdcCharger' ||
  type === 'acBatteryCharger';

/**
 * Legt eine DC-Kante (Plus oder Minus) an, sofern nicht bereits eine
 * identische Verbindung existiert (Idempotenz, Erhalt von Nutzer-Kanten).
 * Die Dimensionierung (Querschnitt/Sicherung) erfolgt später zentral über
 * sizeDcEdges + applyFuseSizes.
 */
function addDcEdge(
  newEdges: Edge<CableEdgeData>[],
  dcEdges: Edge<CableEdgeData>[],
  edgeIdRef: { counter: number },
  existingConnections: Set<string>,
  sourceId: string,
  targetId: string,
  handle: 'plus' | 'minus',
  length: number
): Edge<CableEdgeData> | null {
  const key = `${sourceId}|${targetId}|${handle}|${handle}`;
  if (existingConnections.has(key)) return null;
  existingConnections.add(key);
  const edge: Edge<CableEdgeData> = {
    id: `e-auto-${edgeIdRef.counter++}`,
    source: sourceId,
    target: targetId,
    sourceHandle: handle,
    targetHandle: handle,
    type: 'cableEdge',
    data: { length, edgeDomain: 'DC_12V' },
  };
  newEdges.push(edge);
  dcEdges.push(edge);
  return edge;
}

/** Legt eine 230-V-Kante an (feste Dimensionierung, kein Sicherungswert). */
function addAcEdge(
  newEdges: Edge<CableEdgeData>[],
  edgeIdRef: { counter: number },
  existingConnections: Set<string>,
  sourceId: string,
  targetId: string,
  sourceHandle: string,
  targetHandle: string,
  length: number,
  crossSection: number
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

/**
 * Ergebnis der Spannungsfall-Rückwärtssuche für einen Knoten:
 *  - supply: max. Drop über Pfade, die an einer Versorgungsquelle enden
 *    (Batterie/Landstrom) — die physikalische Versorgungsstrecke einer Last
 *  - any:    max. Drop über ALLE Pfade (inkl. paralleler Ladezweige)
 *  - hasSupplyPath: ob mindestens ein Versorgungspfad existiert
 */
type PathDropResult = { supply: number; any: number; hasSupplyPath: boolean };

/**
 * Berechnet den kumulierten Spannungsfall einer Kante — das exakte
 * Spiegelbild von calculatePathVoltageDrop, damit Auto-Wire genau die Werte
 * dimensioniert, die die Kanten-Anzeige später prüft.
 *
 * Für Lastleitungen zählt der Versorgungspfad (Batterie/Landstrom); parallele
 * Ladezweige (Solar, MPPT, Booster) fließen nicht in die Last-Bilanz ein.
 * Nur Zweige ohne Versorgungspfad (reine Ladezweige) werden über ihren
 * eigenen Pfad geprüft.
 */
function cumulativeDropAt(
  nodeId: string,
  nodeMap: Map<string, Node>,
  edges: Edge<CableEdgeData>[],
  nodes: Node[],
  sysVoltage: number,
  visited: Set<string>
): PathDropResult {
  if (visited.has(nodeId)) return { supply: 0, any: 0, hasSupplyPath: false };
  const node = nodeMap.get(nodeId);
  if (!node) return { supply: 0, any: 0, hasSupplyPath: false };
  if (node.type === 'battery' || node.type === 'shorePower') {
    return { supply: 0, any: 0, hasSupplyPath: true };
  }
  if (isVoltageDropStopType(node.type)) {
    return { supply: 0, any: 0, hasSupplyPath: false };
  }

  const nextVisited = new Set(visited).add(nodeId);
  let supplyMax = 0;
  let anyMax = 0;
  let hasSupply = false;
  let hasIncoming = false;
  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    hasIncoming = true;
    const sourceNode = nodeMap.get(edge.source);
    const I = calculateEdgeCurrent(sourceNode, node, nodes, sysVoltage);
    const length = edge.data?.length || 1;
    const cs = edge.data?.crossSection || 2.5;
    const ownDrop = (I * (length * 2)) / (58 * cs);
    const sub = cumulativeDropAt(edge.source, nodeMap, edges, nodes, sysVoltage, nextVisited);

    const cumAny = ownDrop + sub.any;
    if (cumAny > anyMax) anyMax = cumAny;
    if (sub.hasSupplyPath) {
      hasSupply = true;
      const cumSupply = ownDrop + sub.supply;
      if (cumSupply > supplyMax) supplyMax = cumSupply;
    }
  }
  if (!hasIncoming) return { supply: 0, any: 0, hasSupplyPath: false };
  return { supply: supplyMax, any: anyMax, hasSupplyPath: hasSupply };
}

/** Liefert den relevanten kumulierten Drop (Versorgungspfad bevorzugt). */
function relevantCumulativeDrop(nodeId: string, nodeMap: Map<string, Node>, edges: Edge<CableEdgeData>[], nodes: Node[], sysVoltage: number): number {
  const result = cumulativeDropAt(nodeId, nodeMap, edges, nodes, sysVoltage, new Set());
  return result.hasSupplyPath ? result.supply : result.any;
}

/**
 * Dimensioniert alle DC-Kanten nach thermischer Belastbarkeit (VDE 0298-4,
 * mit Derating) und Spannungsfall (max. 3% Gesamtpfad, max. 2% pro Strecke).
 *
 * Phase 1: Grunddimensionierung jeder Kante (eigener Spannungsfall ≤ 2%).
 * Phase 2: Fixpunkt — nur Kanten, deren kumulierter Pfad-Drop das 3%-Budget
 *          überschreitet, werden eine VDE-Normstufe angehoben (monoton,
 *          endlich). Dadurch gibt es kein Überschwingen auf Maximalquerschnitte.
 */
function sizeDcEdges(
  dcEdges: Edge<CableEdgeData>[],
  nodes: Node[],
  allEdges: Edge<CableEdgeData>[],
  sysVoltage: number
): void {
  const dropLimit = VDE_MAX_DC_DROP_FRACTION * sysVoltage;
  const perEdgeCap = VDE_MAX_DC_DROP_PER_EDGE_FRACTION * sysVoltage;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const sizeEdge = (edge: Edge<CableEdgeData>, allowedOwn: number): number => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
    const length = edge.data?.length || 1;
    const currentCs = edge.data?.crossSection || 1.5;

    let requiredCs = 70;
    if (allowedOwn > 0) {
      const dropArea = (I * (length * 2)) / (58 * allowedOwn);
      requiredCs = VDE_SIZES.find((s) => s >= Math.max(1.5, dropArea)) || 70;
    }
    const thermalCs = lookupThermalCrossSection(Math.max(I, 0));
    return Math.max(requiredCs, thermalCs, currentCs, 1.5);
  };

  // Phase 1: Grunddimensionierung (eigener Spannungsfall ≤ 2%, thermisch)
  for (const edge of dcEdges) {
    edge.data!.crossSection = sizeEdge(edge, perEdgeCap);
  }

  // Phase 2: Nur echte Budget-Überschreitungen des Gesamtpfads anheben
  for (let iteration = 0; iteration < 20; iteration++) {
    let changed = false;
    for (const edge of dcEdges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
      const length = edge.data?.length || 1;
      const currentCs = edge.data?.crossSection || 1.5;
      const cumAtSource = relevantCumulativeDrop(edge.source, nodeMap, allEdges, nodes, sysVoltage);
      const ownDrop = (I * (length * 2)) / (58 * currentCs);

      if (cumAtSource + ownDrop <= dropLimit) continue;

      const allowedOwn = Math.min(Math.max(dropLimit - cumAtSource, 0), perEdgeCap);
      const finalCs = sizeEdge(edge, allowedOwn);
      if (finalCs > currentCs) {
        edge.data!.crossSection = finalCs;
        changed = true;
      }
    }
    if (!changed) break;
  }
}

/**
 * Setzt für jede Plus-DC-Kante die berechnete Sicherung:
 * Verbraucher-Nennstrom ≤ Sicherung ≤ Kabel-Maximalsicherung (FUSE_MAP).
 * Minus-Leitungen werden nicht abgesichert (fachgerecht).
 */
function applyFuseSizes(dcEdges: Edge<CableEdgeData>[], nodes: Node[], sysVoltage: number): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of dcEdges) {
    if (edge.sourceHandle !== 'plus') continue;
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
    const cs = edge.data?.crossSection || 1.5;
    edge.data!.fuseSize = selectFuseSize(I, cs);
  }
}

/**
 * Ergänzt bei bestehenden Nutzer-Kanten die fehlende Absicherung
 * („Absichern"): fehlende Sicherungswerte werden berechnet und gesetzt,
 * Hauptsicherungs-Strecken ab Batterie auf max. 20 cm begrenzt, und
 * unterdimensionierte Querschnitte werden nur dann angehoben, wenn der
 * VDE-Spannungsfall-Budget (3% Gesamtpfad) verletzt ist.
 * Ausreichend dimensionierte Nutzer-Werte bleiben unangetastet.
 */
function normalizeUserDcEdges(
  userEdges: Edge<CableEdgeData>[],
  nodes: Node[],
  allEdges: Edge<CableEdgeData>[],
  sysVoltage: number
): void {
  const dropLimit = VDE_MAX_DC_DROP_FRACTION * sysVoltage;
  const perEdgeCap = VDE_MAX_DC_DROP_PER_EDGE_FRACTION * sysVoltage;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Fixpunkt: Querschnitt-Anhebungen einer Kante verringern nur die Drops
  // nachgelagerter Pfade → monoton, endlich.
  for (let iteration = 0; iteration < 10; iteration++) {
    let changed = false;
    for (const edge of userEdges) {
      if (!edge.data || !edge.sourceHandle?.includes('plus')) continue;
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const domain = edge.data.edgeDomain || getEdgeDomain(sourceNode?.type, targetNode?.type, edge.sourceHandle, edge.targetHandle);
      if (domain === 'AC_230V') continue;

      const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
      const length = edge.data.length || 1;

      // 1. Fehlende Sicherung ergänzen (vorhandene Werte bleiben)
      if (!edge.data.fuseSize) {
        const effectiveCs = calculateCrossSection(I, length, edge.data.crossSection, 'DC_12V');
        edge.data.fuseSize = selectFuseSize(I, effectiveCs);
      }

      // 2. Hauptsicherung direkt an der Batterie (VDE 0100-721, max. 20 cm)
      if (sourceNode?.type === 'battery' && (edge.data.length || 1) > 0.2) {
        edge.data.length = 0.2;
      }

      // 3. Querschnitt nur anheben, wenn der Gesamtpfad-Drop das Budget bricht
      const currentCs = edge.data.crossSection || 1.5;
      const ownDrop = (I * (length * 2)) / (58 * currentCs);
      const cumAtSource = relevantCumulativeDrop(edge.source, nodeMap, allEdges, nodes, sysVoltage);
      if (cumAtSource + ownDrop > dropLimit) {
        const allowedOwn = Math.min(Math.max(dropLimit - cumAtSource, 0), perEdgeCap);
        let requiredCs = 70;
        if (allowedOwn > 0) {
          const dropArea = (I * (length * 2)) / (58 * allowedOwn);
          requiredCs = VDE_SIZES.find((s) => s >= Math.max(1.5, dropArea)) || 70;
        }
        const finalCs = Math.max(requiredCs, currentCs, 1.5);
        if (finalCs > currentCs) {
          edge.data.crossSection = finalCs;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}

/**
 * Verdrahtet das komplette System VDE-konform und abgesichert:
 *
 *  - Vollständige Topologie: Batterie → Shunt → Busbar → Sicherungskasten →
 *    Verbraucher; Solar → MPPT → Busbar; Ladequellen → Busbar;
 *    Wechselrichter/230-V strikt getrennt (AC/DC); Landstrom mit RCD 30 mA;
 *    Massepunkt über 16 mm² Hauptschutzleiter.
 *  - Fehlende Schutz-/Verteiler-Komponenten werden ergänzt (Main Busbar,
 *    Smart Shunt, Sicherungskasten, MPPT, ggf. Starterbatterie für den
 *    DC-DC-Ladebooster).
 *  - Jede DC-Kante wird mit dem exakt gleichen Strommodell dimensioniert,
 *    das auch die Live-Validierung verwendet (calculateEdgeCurrent) — nach
 *    dem Auto-Wire treten dadurch keine Sicherungs-/Drop-Warnungen mehr auf.
 *  - Sicherungen werden berechnet, nicht geraten (selectFuseSize).
 *  - Nutzer-Kanten bleiben erhalten und werden nur um fehlende Absicherung
 *    ergänzt (normalizeUserDcEdges).
 *
 * @param initialNodes  Aktuelle Komponenten des Plans
 * @param existingEdges Aktuelle Kanten (Nutzer-Kanten bleiben erhalten;
 *                      Auto-Kanten früherer Läufe werden ersetzt)
 */
function performAutoWiring(
  initialNodes: Node[],
  existingEdges: Edge<CableEdgeData>[] = []
): { nodes: Node[]; edges: Edge<CableEdgeData>[] } | null {
  // Tiefe Kopie der Nodes, damit bestehende Store-Objekte nicht mutiert werden
  const currentNodes = initialNodes.map((n) => ({ ...n, data: { ...(n.data || {}) } }));
  // Tiefe Kopie der Nutzer-Kanten (nur diese werden zurückgegeben)
  const userEdges: Edge<CableEdgeData>[] = existingEdges
    .filter((e) => !e.id.startsWith(AUTO_EDGE_PREFIX))
    .map((e) => ({
      ...e,
      data: {
        length: e.data?.length ?? 1,
        crossSection: e.data?.crossSection,
        fuseSize: e.data?.fuseSize,
        edgeDomain: e.data?.edgeDomain,
      },
    }));
  const newEdges: Edge<CableEdgeData>[] = [];
  const dcEdges: Edge<CableEdgeData>[] = [];
  const edgeIdRef = { counter: 1 };

  // Nutzer-Verbindungen merken → nichts doppelt anlegen (Idempotenz)
  const existingConnections = new Set<string>();
  for (const e of userEdges) {
    existingConnections.add(connectionKey(e));
  }

  const { nodesByType, nodesByLabel } = buildDictionaries(currentNodes);

  const batteryNode = nodesByType['battery']?.[0];
  if (!batteryNode) return null;

  const sysVoltage = getSystemVoltage(currentNodes);
  const autoCreatedNodeIds = new Set<string>();

  /** Nutzer-Komponente wiederverwenden (Typ eindeutig) oder neu anlegen. */
  const ensureAutoNode = (
    type: string,
    label: string,
    offsetX: number,
    offsetY: number,
    extraData: Record<string, unknown> = {},
    opts: { reuseUniqueType?: boolean } = { reuseUniqueType: true }
  ): Node => {
    const typeNodes = nodesByType[type] || [];
    const byLabel = nodesByLabel.get(`${type}-${label}`);
    const candidate = byLabel || (opts.reuseUniqueType && typeNodes.length === 1 ? typeNodes[0] : undefined);
    if (candidate) return candidate;
    const node = ensureNode(currentNodes, nodesByType, nodesByLabel, batteryNode, type, label, offsetX, offsetY, extraData);
    autoCreatedNodeIds.add(node.id);
    return node;
  };

  const busbarNode = ensureAutoNode('busbar', 'Main Busbar', 300, 0);
  const fuseBoxNode = ensureAutoNode('fuse', '12V Sicherungskasten', 300, 200, { rating: 100 });
  const shuntNode = ensureAutoNode('shunt', 'Smart Shunt', 150, 0);

  const solars = [...(nodesByType['solar'] || []), ...(nodesByType['roofSolar'] || [])];

  // ── MPPT: fehlenden Laderegler ergänzen und passend dimensionieren ──
  let mpptNode: Node | undefined;
  if (solars.length > 0) {
    mpptNode = ensureAutoNode('mpptController', 'MPPT Laderegler', 150, -200, { amps: 30 });
    const totalSolarWatts = solars.reduce((sum, n) => sum + (Number(n.data.watts) || 0), 0);
    const requiredAmps = Math.ceil(totalSolarWatts / sysVoltage);
    if ((Number(mpptNode.data.amps) || 0) < requiredAmps) {
      // Regel B: Solarregler darf durch die Panel-Leistung nicht überlastet sein
      mpptNode.data.amps = requiredAmps;
    }
  }

  // ── DC-DC-Ladebooster: Starterseite (Eingang) sicherstellen ──
  const dcdcChargers = nodesByType['dcdcCharger'] || [];
  const starterBatteryNode =
    dcdcChargers.length > 0 && (nodesByType['battery'] || []).length < 2
      ? ensureAutoNode(
          'battery',
          'Starterbatterie',
          -150,
          250,
          { capacity: 80, chemistry: 'AGM' },
          { reuseUniqueType: false }
        )
      : (nodesByType['battery'] || [])[1];

  // ── Topologie: Batterie → Shunt → Busbar → Sicherungskasten ──
  // Hauptsicherung direkt an der Batterie (max. 20 cm, VDE 0100-721)
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, batteryNode.id, shuntNode.id, 'plus', 0.2);
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, batteryNode.id, shuntNode.id, 'minus', 0.2);
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, shuntNode.id, busbarNode.id, 'plus', 0.5);
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, shuntNode.id, busbarNode.id, 'minus', 0.5);
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, busbarNode.id, fuseBoxNode.id, 'plus', 1);
  addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, busbarNode.id, fuseBoxNode.id, 'minus', 1);

  // ── Verbraucher: jeder 12-V-Verbraucher abgesichert über den Sicherungskasten ──
  for (const consumer of nodesByType['consumer'] || []) {
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, fuseBoxNode.id, consumer.id, 'plus', 3);
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, fuseBoxNode.id, consumer.id, 'minus', 3);
  }

  // ── Wechselrichter: abgesicherte DC-Versorgung über die Busbar ──
  const inverters = nodesByType['inverter'] || [];
  for (const inverter of inverters) {
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, busbarNode.id, inverter.id, 'plus', 1);
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, busbarNode.id, inverter.id, 'minus', 1);
  }

  // ── Solar: Panel → MPPT (Panel-Strom) und MPPT → Busbar ──
  if (solars.length > 0 && mpptNode) {
    for (const solar of solars) {
      addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, solar.id, mpptNode.id, 'plus', 5);
      addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, solar.id, mpptNode.id, 'minus', 5);
    }
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, mpptNode.id, busbarNode.id, 'plus', 2);
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, mpptNode.id, busbarNode.id, 'minus', 2);
  }

  // ── Weitere Ladequellen (Booster, AC-Ladegeräte, weitere MPPTs) ──
  const allChargers = [
    ...(nodesByType['charger'] || []),
    ...(nodesByType['mpptController'] || []),
    ...(nodesByType['dcdcCharger'] || []),
    ...(nodesByType['acBatteryCharger'] || []),
  ];
  for (const charger of allChargers) {
    if (mpptNode && charger.id === mpptNode.id) continue; // MPPT bereits über Solar-Zweig angebunden
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, charger.id, busbarNode.id, 'plus', 3);
    addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, charger.id, busbarNode.id, 'minus', 3);
  }

  // ── DC-DC-Ladebooster Eingang: Starterbatterie → Booster (abgesichert) ──
  if (starterBatteryNode) {
    for (const booster of dcdcChargers) {
      addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, starterBatteryNode.id, booster.id, 'plus', 0.2);
    }
  }

  // ── 230-V-Welt (strikt getrennt von DC) ──
  const shorePowers = nodesByType['shorePower'] || [];
  for (const sp of shorePowers) {
    // RCD/FI 30 mA nach VDE 0100-721 ist bei Landstrom Pflicht
    sp.data.hasRcd = true;
  }
  const consumers230v = nodesByType['consumer230v'] || [];
  if (inverters.length > 0) {
    const mainInverter = inverters[0];
    for (const c of consumers230v) {
      addAcEdge(newEdges, edgeIdRef, existingConnections, mainInverter.id, c.id, 'plus', 'plus', 2, 1.5);
    }
    for (const sp of shorePowers) {
      addAcEdge(newEdges, edgeIdRef, existingConnections, sp.id, mainInverter.id, 'plus', 'ac_in', 2, 2.5);
    }
  } else {
    // Ohne Wechselrichter versorgt der Landstrom die 230-V-Verbraucher direkt
    for (const sp of shorePowers) {
      for (const c of consumers230v) {
        addAcEdge(newEdges, edgeIdRef, existingConnections, sp.id, c.id, 'plus', 'plus', 2, 1.5);
      }
    }
  }

  // ── Massepunkt: 16 mm² Hauptschutzleiter (VDE 0100-540) ──
  const grounds = nodesByType['ground'] || [];
  if (grounds.length > 0) {
    const groundEdge = addDcEdge(newEdges, dcEdges, edgeIdRef, existingConnections, busbarNode.id, grounds[0].id, 'minus', 1);
    if (groundEdge) {
      groundEdge.data!.crossSection = 16; // Mindestquerschnitt; das Sizing erhöht nur
    }
  }

  // ── Dimensionierung: Querschnitt & Sicherung pro DC-Kante ──
  sizeDcEdges(dcEdges, currentNodes, newEdges, sysVoltage);
  applyFuseSizes(dcEdges, currentNodes, sysVoltage);

  // ── Bestehende Nutzer-Kanten um fehlende Absicherung ergänzen ──
  normalizeUserDcEdges(userEdges, currentNodes, [...userEdges, ...newEdges], sysVoltage);

  // Sicherungskasten-Nennwert = Sicherung der Einspeisung (nur wenn Auto-Wire
  // den Kasten selbst angelegt hat)
  const fuseBoxFeed = dcEdges.find(
    (e) => e.source === busbarNode.id && e.target === fuseBoxNode.id && e.sourceHandle === 'plus'
  );
  if (fuseBoxFeed && autoCreatedNodeIds.has(fuseBoxNode.id) && fuseBoxFeed.data?.fuseSize) {
    fuseBoxNode.data.rating = fuseBoxFeed.data.fuseSize;
  }

  return { nodes: currentNodes, edges: [...userEdges, ...newEdges] };
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  viewMode: 'electric',
  setViewMode: (mode) => set({ viewMode: mode }),

  isSidebarOpen: true,
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  isInspectorOpen: true,
  setInspectorOpen: (isOpen) => set({ isInspectorOpen: isOpen }),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),

  systemMessage: null,
  setSystemMessage: (msg) => set({ systemMessage: msg }),

  nodes: initialNodes,
  edges: initialEdges,
  setNodes: (update) => set({ nodes: typeof update === 'function' ? update(get().nodes) : update }),
  setEdges: (update) => set({ edges: typeof update === 'function' ? update(get().edges) : update }),

  waterNodes: [],
  waterEdges: [],
  setWaterNodes: (update) => set({ waterNodes: typeof update === 'function' ? update(get().waterNodes) : update }),
  setWaterEdges: (update) => set({ waterEdges: typeof update === 'function' ? update(get().waterEdges) : update }),

  season: 'summer',
  setSeason: (season) => set({ season }),

  waterWarning: null,
  setWaterWarning: (warning) => set({ waterWarning: warning }),

  firstTappedHandle: null,
  setFirstTappedHandle: (update) => set({ firstTappedHandle: typeof update === 'function' ? update(get().firstTappedHandle) : update }),

  isLayoutPending: false,
  setIsLayoutPending: (pending) => set({ isLayoutPending: pending }),

  selectedNodes: [],
  selectedEdges: [],
  setSelectedNodes: (nodes) => set({ selectedNodes: nodes }),
  setSelectedEdges: (edges) => set({ selectedEdges: edges }),

  onNodesChange: (changes) => set((state) => {
    const newNodes = applyNodeChanges(changes, state.nodes);
    const deletedNodeIds = new Set<string>();
    for (const change of changes) {
      if (change.type === 'remove') deletedNodeIds.add(change.id);
    }
    if (deletedNodeIds.size > 0) {
      return {
        nodes: newNodes,
        edges: state.edges.filter(e => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target))
      };
    }
    return { nodes: newNodes };
  }),
  onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) as Edge<CableEdgeData>[] })),
  onWaterNodesChange: (changes) => set((state) => {
    const newWaterNodes = applyNodeChanges(changes, state.waterNodes);
    const deletedNodeIds = new Set<string>();
    for (const change of changes) {
      if (change.type === 'remove') deletedNodeIds.add(change.id);
    }
    if (deletedNodeIds.size > 0) {
      return {
        waterNodes: newWaterNodes,
        waterEdges: state.waterEdges.filter(e => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target))
      };
    }
    return { waterNodes: newWaterNodes };
  }),
  onWaterEdgesChange: (changes) => set((state) => ({ waterEdges: applyEdgeChanges(changes, state.waterEdges) })),

  onSelectionChange: (params) => set({ selectedNodes: params.nodes, selectedEdges: params.edges }),

  // Fokussiert eine betroffene Komponente/Leitung ("Beheben" aus der Warn-Zentrale):
  // markiert sie als ausgewählt (ReactFlow-Highlight + Inspector) und passt die Ansicht ein.
  focusElement: (id, elementType) => {
    set((state) => {
      if (elementType === 'edge') {
        const edges = state.edges.map((e) => ({ ...e, selected: e.id === id }));
        const waterEdges = state.waterEdges.map((e) => ({ ...e, selected: e.id === id }));
        const nodes = state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
        const target = edges.find((e) => e.id === id) || waterEdges.find((e) => e.id === id) || null;
        return {
          edges,
          waterEdges,
          nodes,
          selectedEdges: target ? [target] : [],
          selectedNodes: [],
        };
      }
      const nodes = state.nodes.map((n) => ({ ...n, selected: n.id === id }));
      const waterNodes = state.waterNodes.map((n) => ({ ...n, selected: n.id === id }));
      const edges = state.edges.map((e) => (e.selected ? { ...e, selected: false } : e));
      const target = nodes.find((n) => n.id === id) || waterNodes.find((n) => n.id === id) || null;
      return {
        nodes,
        waterNodes,
        edges,
        selectedNodes: target ? [target] : [],
        selectedEdges: [],
      };
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('planner-fit-view'));
    }
  },

  deleteSelected: () => set((state) => {
    const nodeIdsSet = new Set<string>();
    const selectedNodesLen = state.selectedNodes.length;
    for (let i = 0; i < selectedNodesLen; i++) {
      nodeIdsSet.add(state.selectedNodes[i].id);
    }

    const edgeIdsSet = new Set<string>();
    const selectedEdgesLen = state.selectedEdges.length;
    for (let i = 0; i < selectedEdgesLen; i++) {
      edgeIdsSet.add(state.selectedEdges[i].id);
    }

    const filterNode = (n: Node) => !nodeIdsSet.has(n.id);
    const filterEdge = (e: Edge) => !nodeIdsSet.has(e.source) && !nodeIdsSet.has(e.target) && !edgeIdsSet.has(e.id);

    return {
      nodes: state.nodes.filter(filterNode),
      edges: state.edges.filter(filterEdge),
      waterNodes: state.waterNodes.filter(filterNode),
      waterEdges: state.waterEdges.filter(filterEdge),
      selectedNodes: [],
      selectedEdges: [],
    };
  }),

  updateNodeData: (id, data) => set((state) => ({
    nodes: state.nodes.map((n) => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, ...data } };
      }
      return n;
    }),
    waterNodes: state.waterNodes.map((n) => {
      if (n.id === id) {
        return { ...n, data: { ...n.data, ...data } };
      }
      return n;
    })
  })),

  handleChangeLength: (id, length) => set((state) => ({
    edges: state.edges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, length } };
      }
      return e;
    }),
    waterEdges: state.waterEdges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, length } };
      }
      return e;
    })
  })),

  isValidConnection: (connection) => {
    const { nodes, waterNodes, viewMode, edges } = get();
    const allNodes = [...nodes, ...waterNodes];

    // Create a node map for O(1) lookups
    const { nodesMap } = getDerivedSystemState(allNodes, []);

    const sourceNode = nodesMap.get(connection.source || '');
    const targetNode = nodesMap.get(connection.target || '');

    if (viewMode === 'water') {
      if (sourceNode?.type === 'grayWaterTank' && targetNode?.type === 'sink') {
        return false;
      }
    } else {
      // Strict AC vs. DC domain separation
      const sourceDomain = getHandleDomain(sourceNode?.type, connection.sourceHandle, 'source');
      const targetDomain = getHandleDomain(targetNode?.type, connection.targetHandle, 'target');
      if (sourceDomain !== targetDomain) {
        return false; // Blocker!
      }

      // Pre-check for polarity matching
      const sHandle = connection.sourceHandle || '';
      const tHandle = connection.targetHandle || '';

      const sIsPlus = sHandle.includes('plus');
      const tIsPlus = tHandle.includes('plus');
      const sIsMinus = sHandle.includes('minus');
      const tIsMinus = tHandle.includes('minus');

      // Exception for series connection between batteries or solars
      const isSeriesException =
        (sourceNode?.type === 'battery' && targetNode?.type === 'battery') ||
        (sourceNode?.type === 'solar' && targetNode?.type === 'solar');

      // AC uses L/N/PE, not plus/minus — skip DC polarity on AC-AC links
      if (sourceDomain !== 'AC_230V' && !isSeriesException) {
        if ((sIsPlus && !tIsPlus) || (sIsMinus && !tIsMinus)) {
          return false; // Polarity mismatch strict block
        }
      }
    }

    // Check for cycles
    // If there is already a path from the connection's target back to the connection's source,
    // adding this new edge will create a cycle.
    const outgoersMap = new Map<string, string[]>();

    const currentEdges = viewMode === 'water' ? get().waterEdges : edges;
    for (let i = 0; i < currentEdges.length; i++) {
      const edge = currentEdges[i];
      let targets = outgoersMap.get(edge.source);
      if (!targets) {
        targets = [];
        outgoersMap.set(edge.source, targets);
      }
      targets.push(edge.target);
    }

    const hasPath = (fromNode: string, toNode: string, visited = new Set<string>()): boolean => {
      if (fromNode === toNode) return true;
      if (visited.has(fromNode)) return false;
      visited.add(fromNode);
      const outgoers = outgoersMap.get(fromNode) || [];
      for (let i = 0; i < outgoers.length; i++) {
        if (hasPath(outgoers[i], toNode, visited)) return true;
      }
      return false;
    };

    if (connection.source && connection.target && hasPath(connection.target, connection.source)) {
      return false;
    }

    return true;
  },

  onConnect: (connection) => {
    if (!connection.source || !connection.target) return;

    const { viewMode, waterNodes, nodes } = get();

    if (viewMode === 'water') {
      const { nodesMap, waterNodesMap } = getDerivedSystemState(nodes, waterNodes);
      const sourceNode = nodesMap.get(connection.source || '') || waterNodesMap.get(connection.source || '');
      const targetNode = nodesMap.get(connection.target || '') || waterNodesMap.get(connection.target || '');

      if (sourceNode?.type === 'pump' && targetNode?.type === 'sink') {
        get().setWaterWarning("Ein Accumulator schont die Pumpe und verhindert stotternden Wasserfluss.");
        setTimeout(() => get().setWaterWarning(null), 5000);
      }

      const newEdge: Edge = {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        id: crypto.randomUUID(),
        type: 'waterPipe',
        data: {}
      };
      set((state) => ({ waterEdges: addEdge(newEdge, state.waterEdges) }));
      
      return;
    }

    const { nodesMap } = getDerivedSystemState(nodes, []);
    const sourceNode = nodesMap.get(connection.source || '');
    const targetNode = nodesMap.get(connection.target || '');
    const edgeDomain = getEdgeDomain(sourceNode?.type, targetNode?.type, connection.sourceHandle);

    const newEdge: Edge<CableEdgeData> = {
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      id: crypto.randomUUID(),
      type: 'cableEdge',
      data: {
        length: 3,
        crossSection: edgeDomain === 'AC_230V' ? 1.5 : 2.5,
        edgeDomain,
      },
    };
    set((state) => ({ edges: addEdge(newEdge, state.edges) as Edge<CableEdgeData>[] }));
    
  },

  autoWireSystem: () => {
    const { nodes, edges } = get();

    const result = performAutoWiring(nodes, edges);
    if (!result) {
      get().setSystemMessage('Bitte zuerst eine Batterie platzieren, bevor Komponenten verbunden werden.');
      return;
    }

    // Nutzer-Kanten bleiben erhalten; nur Auto-Kanten früherer Läufe
    // werden durch die frisch berechneten ersetzt (Idempotenz).
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      result.nodes,
      result.edges,
      'LR'
    );

    set({ nodes: [...layoutedNodes], edges: [...layoutedEdges] });

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
        window.dispatchEvent(new CustomEvent('planner-auto-wired', { detail: { edgeCount: result.edges.length } }));
      });
    }
  },

  onLayout: () => {
    const { nodes, edges } = get();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      'LR'
    );
    set({ nodes: [...layoutedNodes], edges: [...layoutedEdges] });
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('planner-fit-view'));
      });
    }
  },

  checkSchematic: () => {
    const { nodes, edges } = get();
    const schematic = { nodes, edges };
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('check-schematic', { detail: schematic });
      window.dispatchEvent(event);
    }
  },

  applyTemplate: (templateId: string) => {
    const template = TEMPLATES_DICT[templateId];
    if (template) {
      set({
        nodes: [...template.nodes],
        edges: [...template.edges],
        waterNodes: [],
        waterEdges: [],
      });
    }
  },

  exportBOM: () => {
    const { nodes, waterNodes, edges, waterEdges } = get();
    const counts: Record<string, number> = {};

    for (let i = 0; i < nodes.length; i++) {
      const type = nodes[i].type!;
      counts[type] = (counts[type] || 0) + 1;
    }
    for (let i = 0; i < waterNodes.length; i++) {
      const type = waterNodes[i].type!;
      counts[type] = (counts[type] || 0) + 1;
    }

    const cableLengths: Record<string, number> = {};

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const cs = e.data?.crossSection || 2.5;
      cableLengths[cs] = (cableLengths[cs] || 0) + (e.data?.length || 3);
    }
    for (let i = 0; i < waterEdges.length; i++) {
      const e = waterEdges[i];
      const pipeType = e.data?.pipeType || 'water';
      cableLengths[pipeType] = (cableLengths[pipeType] || 0) + (e.data?.length || 2);
    }

    const bom = { counts, cableLengths };

    if (typeof window !== 'undefined') {
      const event = new CustomEvent('export-bom', { detail: bom });
      window.dispatchEvent(event);
    }
  },

  onDrop: (event, screenToFlowPosition) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    const label = event.dataTransfer.getData('application/reactflow-label');
    const wattsStr = event.dataTransfer.getData('application/reactflow-watts');

    if (typeof type === 'undefined' || !type) {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    get().addNode(type, label, position, wattsStr ? Number(wattsStr) : undefined);
  },

  onCustomDrop: (event, screenToFlowPosition) => {
    const customEvent = event as CustomEvent;
    const { clientX, clientY, type, label, watts } = customEvent.detail;

    const position = screenToFlowPosition({
      x: clientX,
      y: clientY,
    });

    get().addNode(type, label, position, watts);
  },

  addNode: (type, label, position, watts?: number) => {
    const newNode: Node = {
      id: `${type}-${crypto.randomUUID()}`,
      type,
      position,
      data: { label, ...(watts !== undefined ? { watts } : {}) },
    };

    if (type === 'battery') {
      newNode.data = { capacity: 100, chemistry: 'LiFePO4', ...newNode.data };
    } else if (type === 'consumer') {
      newNode.data = { watts: 50, hours: 2, ...newNode.data };
    } else if (type === 'charger' || type === 'mpptController' || type === 'dcdcCharger' || type === 'acBatteryCharger') {
      newNode.data = { amps: 10, ...newNode.data };
    } else if (type === 'fuse') {
      newNode.data = { rating: 30, ...newNode.data };
    } else if (type === 'shorePower') {
      newNode.data = { hasRcd: false, ...newNode.data };
    } else if (type === 'consumer230v') {
      newNode.data = { watts: 1000, hours: 0.5, ...newNode.data };
    } else if (type === 'solar') {
      newNode.data = { voltage: 18, amps: 5, watts: 90, ...newNode.data };
    } else if (type === 'inverter') {
      newNode.data = { watts: 1000, continuousPower: 1000, ...newNode.data };
    }

    const { viewMode } = get();
    if (viewMode === 'water') {
      set((state) => ({ waterNodes: state.waterNodes.concat(newNode) }));
    } else {
      set((state) => ({ nodes: state.nodes.concat(newNode) }));
    }
  },

  handleChangeCrossSection: (id, crossSection) => set((state) => ({
    edges: state.edges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, crossSection } };
      }
      return e;
    })
  })),

  handleChangeFuseSize: (id, fuseSize) => set((state) => ({
    edges: state.edges.map((e) => {
      if (e.id === id) {
        return { ...e, data: { ...e.data!, fuseSize } };
      }
      return e;
    })
  })),

  calculatePathVoltageDrop: (targetNodeId, customNodes, customEdges) => {
    const edges = customEdges || get().edges;
    const nodes = customNodes || get().nodes;
    const sysVoltage = getSystemVoltage(nodes);

    // Identische Logik wie die Auto-Wire-Dimensionierung (cumulativeDropAt):
    // Versorgungspfad (Batterie/Landstrom) bevorzugt, sonst bester Ladezweig.
    const nodesMap = getNodeMap(nodes, []);
    return relevantCumulativeDrop(targetNodeId, nodesMap, edges, nodes, sysVoltage);
  },
}));
