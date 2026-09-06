import type { Node } from 'reactflow';
import {
  VDE_SIZES,
  FUSE_MAP,
  calculateCrossSection,
  calculateMaxFuse,
  lookupThermalCrossSection,
  selectFuseSize,
  isFuseFeasible,
} from '../electrical';
import { calculateEdgeCurrent } from '../vde-standards';
import {
  addVolts,
  addWatts,
  amps,
  currentFromPower,
  maxAmps,
  meters,
  mm2,
  quantityOr,
  scaleVolts,
  subtractVolts,
  volts,
  watts,
  ZERO_AMPS,
  ZERO_VOLTS,
  ZERO_WATTS,
  type Amps,
  type Meters,
  type Mm2,
  type Volts,
  type Watts,
} from '../units';
import {
  type CableEdge,
  MAX_CROSS_SECTION,
  MIN_CROSS_SECTION,
  VDE_MAX_DC_DROP_FRACTION,
  VDE_MAX_DC_DROP_PER_EDGE_FRACTION,
  crossSectionForDrop,
  edgeCrossSection,
  edgeLength,
  edgeVoltageDrop,
  nextStandardCrossSection,
} from './primitives';
import { isVoltageDropStopType } from './validation';

// lib/autoWire/sizing.ts — Spannungsfall, Querschnitt- und Sicherungsdimensionierung (M6-6).

export type PathDropResult = { supply: Volts; any: Volts; hasSupplyPath: boolean };

export const NO_DROP: PathDropResult = { supply: ZERO_VOLTS, any: ZERO_VOLTS, hasSupplyPath: false };

/**
 * Kumulierter Spannungsfall — Spiegelbild von calculatePathVoltageDrop.
 * Versorgungspfad (Batterie/Landstrom) bevorzugt, parallele Ladezweige
 * fließen nicht in die Last-Bilanz.
 *
 * `@internal` — für Unit-Tests in `autoWire.test.ts` exportiert, um die
 * Rekursion gezielt gegen einen kleinen Fixture-Graphen prüfen zu können.
 */

export function cumulativeDropAt(
  nodeId: string,
  nodeMap: Map<string, Node>,
  edges: CableEdge[],
  nodes: Node[],
  sysVoltage: Volts,
  visited: Set<string>
): PathDropResult {
  if (visited.has(nodeId)) return NO_DROP;
  const node = nodeMap.get(nodeId);
  if (!node) return NO_DROP;
  if (node.type === 'battery' || node.type === 'shorePower') {
    return { supply: ZERO_VOLTS, any: ZERO_VOLTS, hasSupplyPath: true };
  }
  if (isVoltageDropStopType(node.type)) {
    return NO_DROP;
  }

  const nextVisited = new Set(visited).add(nodeId);
  let supplyMax: Volts = ZERO_VOLTS;
  let anyMax: Volts = ZERO_VOLTS;
  let hasSupply = false;
  let hasIncoming = false;
  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    if (edge.data?.edgeDomain === 'AC_230V') continue;
    hasIncoming = true;
    const sourceNode = nodeMap.get(edge.source);
    const I = calculateEdgeCurrent(sourceNode, node, nodes, sysVoltage);
    const ownDrop = edgeVoltageDrop(I, edgeLength(edge), edgeCrossSection(edge));
    const sub = cumulativeDropAt(edge.source, nodeMap, edges, nodes, sysVoltage, nextVisited);

    const cumAny = addVolts(ownDrop, sub.any);
    if (cumAny > anyMax) anyMax = cumAny;
    if (sub.hasSupplyPath) {
      hasSupply = true;
      const cumSupply = addVolts(ownDrop, sub.supply);
      if (cumSupply > supplyMax) supplyMax = cumSupply;
    }
  }
  if (!hasIncoming) return NO_DROP;
  return { supply: supplyMax, any: anyMax, hasSupplyPath: hasSupply };
}

export function relevantCumulativeDrop(
  nodeId: string,
  nodeMap: Map<string, Node>,
  edges: CableEdge[],
  nodes: Node[],
  sysVoltage: Volts
): Volts {
  const result = cumulativeDropAt(nodeId, nodeMap, edges, nodes, sysVoltage, new Set());
  return result.hasSupplyPath ? result.supply : result.any;
}

/** Solar-Zuleitung (Panel → Laderegler): eigene Domäne, kein 12-V-Kreis. */

export function sizeDcEdges(
  dcEdges: CableEdge[],
  nodes: Node[],
  allEdges: CableEdge[],
  sysVoltage: Volts,
  nodeMap: Map<string, Node> = new Map(nodes.map((n) => [n.id, n]))
): void {
  const dropLimit = scaleVolts(sysVoltage, VDE_MAX_DC_DROP_FRACTION);
  const perEdgeCap = scaleVolts(sysVoltage, VDE_MAX_DC_DROP_PER_EDGE_FRACTION);

  const sizeEdge = (edge: CableEdge, allowedOwn: Volts): Mm2 => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
    const length = edgeLength(edge);
    const currentCs = edgeCrossSection(edge, MIN_CROSS_SECTION);

    let requiredCs: Mm2 = MAX_CROSS_SECTION;
    if (allowedOwn > 0) {
      const need = crossSectionForDrop(I, length, allowedOwn);
      // Rechnerischer Bedarf über der Normreihe bleibt bei 70 mm² gedeckelt;
      // nur ein tatsächlich vorhandener Nutzer-/Importquerschnitt (>70 mm²)
      // wird erhalten statt verkleinert.
      requiredCs = need > MAX_CROSS_SECTION ? MAX_CROSS_SECTION : nextStandardCrossSection(need);
    }
    const thermalCs = mm2(lookupThermalCrossSection(maxAmps(I, ZERO_AMPS)));
    const raw = mm2(Math.max(requiredCs, thermalCs, currentCs, MIN_CROSS_SECTION));
    if (raw <= MAX_CROSS_SECTION) return nextStandardCrossSection(raw);
    return currentCs > MAX_CROSS_SECTION ? currentCs : MAX_CROSS_SECTION;
  };

  // Direkte Aufrufe dieser Funktion (Unit-Tests, Validierung) dürfen Kanten
  // ohne `data` nicht mit `edge.data!` crashen lassen.
  // dropWarning wird zurückgesetzt: ein geänderter Plan kann eine früher
  // unrealisierbare Kette wieder lösbar machen; der Marker darf nicht
  // veralten.
  for (const edge of dcEdges) {
    if (!edge.data) edge.data = {};
    edge.data.crossSection = sizeEdge(edge, perEdgeCap);
    edge.data.dropWarning = false;
  }

  for (let iteration = 0; iteration < 20; iteration++) {
    let changed = false;
    for (const edge of dcEdges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
      const currentCs = edgeCrossSection(edge, MIN_CROSS_SECTION);
      const cumAtSource = relevantCumulativeDrop(edge.source, nodeMap, allEdges, nodes, sysVoltage);
      const ownDrop = edgeVoltageDrop(I, edgeLength(edge), currentCs);

      if (addVolts(cumAtSource, ownDrop) <= dropLimit) continue;

      const remaining = cumAtSource >= dropLimit ? ZERO_VOLTS : subtractVolts(dropLimit, cumAtSource);
      const allowedOwn = remaining < perEdgeCap ? remaining : perEdgeCap;
      const finalCs = sizeEdge(edge, allowedOwn);
      if (finalCs > currentCs) {
        edge.data!.crossSection = finalCs;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Nacherschleife (AUDIT Issue 3): Das lokale Gate oben verdickt nur die
  // Kante selbst — Vorgelagertes bleibt dünn, und auf tiefen Ketten kann die
  // 3-%-Budgetverletzung bestehen bleiben, obwohl eine konforme Dimensionierung
  // existiert. Deshalb: Verletzung am Lastknoten auflösen, indem auf dessen
  // Versorgungspfad jeweils die Kante mit dem größten Eigenanteil um einen
  // Normschritt dicker wird. Ist jede Pfadkante bei MAX_CROSS_SECTION und das
  // Budget bleibt gerissen, markiert `dropWarning` den Pfad als fachlich
  // unrealisierbar, statt stillschweigend zu violating weiterzumachen.
  const chainOf = (nodeId: string, visited: Set<string>): CableEdge[] => {
    const node = nodeMap.get(nodeId);
    if (!node || visited.has(nodeId)) return [];
    if (node.type === 'battery' || node.type === 'shorePower' || isVoltageDropStopType(node.type)) {
      return [];
    }
    visited.add(nodeId);
    const chain: CableEdge[] = [];
    for (const edge of allEdges) {
      if (edge.target !== nodeId) continue;
      if (edge.data?.edgeDomain === 'AC_230V') continue;
      chain.push(edge);
      chain.push(...chainOf(edge.source, visited));
    }
    return chain;
  };

  for (const loadNode of nodes) {
    if (loadNode.type !== 'consumer' && loadNode.type !== 'inverter') continue;
    if (relevantCumulativeDrop(loadNode.id, nodeMap, allEdges, nodes, sysVoltage) <= dropLimit) continue;
    const chain = chainOf(loadNode.id, new Set<string>());
    if (chain.length === 0) continue;
    // Termination: jede Iteration hebt genau eine Kante um einen Normschritt;
    // mehr als Kanten × Stufen ist unmöglich.
    const guardMax = dcEdges.length * VDE_SIZES.length + 1;
    for (let guard = 0; guard < guardMax; guard++) {
      if (relevantCumulativeDrop(loadNode.id, nodeMap, allEdges, nodes, sysVoltage) <= dropLimit) break;
      let victim: CableEdge | undefined;
      let victimDrop: Volts = ZERO_VOLTS;
      for (const edge of chain) {
        if (!edge.data) edge.data = {};
        const cs = edgeCrossSection(edge, MIN_CROSS_SECTION);
        if (cs >= MAX_CROSS_SECTION) continue;
        const own = edgeVoltageDrop(
          calculateEdgeCurrent(nodeMap.get(edge.source), nodeMap.get(edge.target), nodes, sysVoltage),
          edgeLength(edge),
          cs
        );
        if (!victim || own > victimDrop) {
          victim = edge;
          victimDrop = own;
        }
      }
      if (!victim) {
        for (const edge of chain) {
          if (!edge.data) edge.data = {};
          edge.data.dropWarning = true;
        }
        break;
      }
      victim.data!.crossSection = nextStandardCrossSection(
        mm2(edgeCrossSection(victim, MIN_CROSS_SECTION) + 0.1)
      );
    }
  }
}

/** @internal für Unit-Tests exportiert. */

export function applyFuseSizes(
  dcEdges: CableEdge[],
  nodes: Node[],
  sysVoltage: Volts,
  nodeMap: Map<string, Node> = new Map(nodes.map((n) => [n.id, n]))
): void {
  for (const edge of dcEdges) {
    if (!edge.sourceHandle?.includes('plus')) continue;
    if (!edge.data) edge.data = {};
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
    let cs: Mm2 = edgeCrossSection(edge, MIN_CROSS_SECTION);

    // Altpläne/Importe können Nicht-Normquerschnitte (z. B. 3 mm² oder 95 mm²)
    // enthalten. 95 mm² würde in FUSE_MAP einen RangeError auslösen; solche
    // Kabel werden auf die sichere Normbestung bei 70 mm² abgesichert und
    // als Warnung markiert. Querschnitte <70 mm² werden auf die Normreihe
    // angehoben (nie verkleinert).
    if (!VDE_SIZES.includes(cs)) {
      cs = nextStandardCrossSection(cs);
      edge.data.crossSection = cs;
    }

    if (cs > MAX_CROSS_SECTION) {
      // Kein Norm-Fuse-Map-Eintrag für >70 mm². Größte bekannte Normstufe ist
      // konservativ (kleiner als die tatsächliche Belastbarkeit des Leiters).
      edge.data.fuseSize = selectFuseSize(I, MAX_CROSS_SECTION);
      edge.data.fuseWarning = I > (FUSE_MAP[MAX_CROSS_SECTION] ?? 0);
      continue;
    }

    // Wenn der Nennstrom die zulässige Sicherung für den Querschnitt
    // übersteigt, muss das Kabel hochdimensioniert werden (thermisch).
    // Eine Sicherung über dem Kabel-Maximalwert wäre Brandgefahr.
    if (!isFuseFeasible(I, cs)) {
      const larger = VDE_SIZES.find((s) => s > cs && isFuseFeasible(I, s));
      if (larger !== undefined) {
        cs = mm2(larger);
        edge.data.crossSection = cs;
      } else {
        edge.data.fuseWarning = true;
      }
    }
    edge.data.fuseSize = selectFuseSize(I, cs);
  }
}

/** Netzspannung im 230-V-Zweig. */

export const AC_VOLTAGE: Volts = volts(230);
/** Übliche Absicherung eines Landstromanschlusses. */

export const SHORE_POWER_CURRENT: Amps = amps(16);
/** Standardlänge einer AC-Leitung ohne gespeicherte Länge. */

export const DEFAULT_AC_LENGTH: Meters = meters(2);

export function acCurrentA(
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  nodes: Node[] = []
): Amps {
  const loadOf = (node: Node | undefined): Amps =>
    currentFromPower(quantityOr(node?.data?.watts, watts, ZERO_WATTS), AC_VOLTAGE);

  const total230vLoad = (): Watts => {
    let total: Watts = ZERO_WATTS;
    for (const n of nodes) {
      if (n.type !== 'consumer230v') continue;
      total = addWatts(total, quantityOr((n.data as Record<string, unknown>)?.watts, watts, ZERO_WATTS));
    }
    return total;
  };

  // WR→Gerät: nur die Gerätelast zählt (WR-Nennleistung wäre eine Über-
  // dimensionierung). Gerät→Gerät (Import-Daisy-Chain): das vorgelagerte
  // Gerät trägt auch die Nachbarnlast — Issue 8.
  if (targetNode?.type === 'consumer230v') {
    if (sourceNode?.type === 'consumer230v') return maxAmps(loadOf(sourceNode), loadOf(targetNode));
    return loadOf(targetNode);
  }
  if (sourceNode?.type === 'consumer230v') return loadOf(sourceNode);
  const inverter =
    sourceNode?.type === 'inverter' ? sourceNode : targetNode?.type === 'inverter' ? targetNode : undefined;
  if (inverter) {
    // Die AC-Zuleitung (Landstrom→ac_in bzw. WR→Gerät) trägt den tatsächlichen
    // 230-V-Laststrom. Bei mehreren 230-V-Verbrauchern ist der WR nur Nennlast;
    // die Summe der Geräte ist maßgeblich, sonst wird die Leitung zu dünn.
    const ownLoad = quantityOr(
      (inverter.data as Record<string, unknown>)?.continuousPower ||
        (inverter.data as Record<string, unknown>)?.watts,
      watts,
      ZERO_WATTS
    );
    const connectedLoad = total230vLoad();
    const load = ownLoad > connectedLoad ? ownLoad : connectedLoad;
    return currentFromPower(load, AC_VOLTAGE);
  }
  if (sourceNode?.type === 'shorePower' || targetNode?.type === 'shorePower') {
    const supply = sourceNode?.type === 'shorePower' ? sourceNode : targetNode;
    const other = supply === sourceNode ? targetNode : sourceNode;
    // ELEC-003: Der Anschlusswert wird modelliert gepflegt (shorePower.rating
    // in A). Nur wenn er fehlt, greift der Modell-Default von 16 A.
    const modeled = shoreSupplyRating(supply);
    const chargerAmps = quantityOr((other?.data as Record<string, unknown>)?.amps, amps, ZERO_AMPS);
    return maxAmps(modeled ?? SHORE_POWER_CURRENT, chargerAmps);
  }
  return ZERO_AMPS;
}

/** @internal für Unit-Tests exportiert. */

/**
 * Modellierter Absicherungswert einer Landstromdose in A (ELEC-003).
 * `rating` ist bewusst als Absicherung/Anschlusswert definiert; fehlt er,
 * liefert die Funktion undefined und der Aufrufer entscheidet über Defaults.
 */
function shoreSupplyRating(node: Node | undefined): Amps | undefined {
  if (!node || node.type !== 'shorePower') return undefined;
  const rating = Number((node.data as Record<string, unknown>)?.rating);
  if (!Number.isFinite(rating) || rating <= 0) return undefined;
  return amps(rating);
}

export function sizeAcEdges(edges: CableEdge[], nodes: Node[]): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    if (edge.data?.edgeDomain !== 'AC_230V') continue;
    if (!edge.data) edge.data = {};
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = acCurrentA(sourceNode, targetNode, nodes);
    const length = edgeLength(edge, DEFAULT_AC_LENGTH);
    edge.data.crossSection = calculateCrossSection(I, length, edge.data.crossSection, 'AC_230V');
    // ELEC-003: AC-Zweige waren ungesichert dimensioniert. Die Sicherung ist
    // der kleinere Wert aus modellierter Dosen-Absicherung (sonst Normwert
    // ≥ Astlast) und der Kabelträgigkeit — selectFuseSize kapselt beides.
    const rating = shoreSupplyRating(sourceNode) ?? shoreSupplyRating(targetNode);
    edge.data.fuseSize =
      rating !== undefined && rating <= calculateMaxFuse(edge.data.crossSection)
        ? rating
        : selectFuseSize(I, edge.data.crossSection);
  }
}
