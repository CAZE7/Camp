import type { Node } from '../domain/graph'; // ARCH-001
import {
  VDE_SIZES,
  FUSE_MAP,
  calculateCrossSection,
  calculateMaxFuse,
  lookupThermalCrossSection,
  selectFuseSize,
  isFuseFeasible,
  designAmpacity,
} from '../electrical';
import { getCableCurrents } from '../electricalGraph/currentFlow';
import {
  addVolts,
  amps,
  maxAmps,
  meters,
  mm2,
  scaleVolts,
  subtractVolts,
  ZERO_AMPS,
  ZERO_VOLTS,
  type Amps,
  type Meters,
  type Mm2,
  type Volts,
} from '../units';
import {
  DEFAULT_EDGE_LENGTH,
  MAX_CROSS_SECTION,
  MIN_CROSS_SECTION,
  VDE_MAX_DC_DROP_FRACTION,
  VDE_MAX_DC_DROP_PER_EDGE_FRACTION,
  crossSectionForDrop,
  edgeCrossSection,
  edgeVoltageDrop,
  nextStandardCrossSection,
  planningLength,
  type CableEdge,
} from './primitives';
import { isVoltageDropStopType } from './validation';
import { solarDesignCurrentOf, solarDropBasisVoltageOf, solarFuseFloorOf, solarPanelEndOf } from '../solar'; // ELE-007
import { breakingCapacityAOf, isFuseType, shortCircuitAtFuseA, type FuseType } from '../shortCircuit'; // DOM-002

// lib/autoWire/sizing.ts — Spannungsfall, Querschnitt- und Sicherungsdimensionierung (M6-6).

export type PathDropResult = { supply: Volts; any: Volts; hasSupplyPath: boolean };

export const NO_DROP: PathDropResult = { supply: ZERO_VOLTS, any: ZERO_VOLTS, hasSupplyPath: false };

/**
 * EINE Stromquelle für die Dimensionierung (AUDIT §2/§13): dasselbe
 * Topologie-Strommodell, das die Verifikations-Engine und die Kanten-Anzeige
 * bewerten. Die frühere Endpunkt-Heuristik (`calculateEdgeCurrent`) maß die
 * Kabel an der Gesamtlast des Endpunkts — eine 12-A-Last hinter einer
 * Sammelschiene dimensionierte den Batteriehauptstrang trotzdem für 12 A.
 *
 * `null` (nicht bestimmbar, Datenlücke) wird mit 0 A dimensioniert und von
 * der Live-Validierung als Lücke ausgewiesen — es wird kein Strom erfunden,
 * der die Leitung später „fehldimensioniert“ aussehen ließe, ohne dass der
 * Nutzer eine Zahl sieht.
 *
 * Performance (AUDIT §19): `getCableCurrents` ist Referenz-gecacht — in einer
 * Dimensionierungsrunde (gleiche nodes/edges-Referenzen) wird das Modell
 * genau EINMAL berechnet und von allen Kanten geteilt.
 */
export function modelCurrentOf(nodes: Node[], edges: CableEdge[], edgeId: string): Amps {
  const operating = getCableCurrents(nodes, edges).byEdgeId.get(edgeId)?.operatingCurrent;
  return amps(operating ?? 0);
}

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
  const pointOf = (id: string) => nodeMap.get(id)?.position;
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
    const I = modelCurrentOf(nodes, edges, edge.id);
    const ownDrop = edgeVoltageDrop(
      I,
      planningLength(edge, pointOf) ?? DEFAULT_EDGE_LENGTH,
      edgeCrossSection(edge)
    );
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
  const pointOf = (id: string) => nodeMap.get(id)?.position;
  const dropLimit = scaleVolts(sysVoltage, VDE_MAX_DC_DROP_FRACTION);
  const perEdgeCap = scaleVolts(sysVoltage, VDE_MAX_DC_DROP_PER_EDGE_FRACTION);
  // AUDIT ELE-007 (Restpunkt, nachgezogen 2026-09-08): Panel-Zuleitungen
  // bekommen ihr Drop-Budget an der MPP-Basis (18 V × Anteil ≈ 0,54 V)
  // statt an der 12,8-V-Systemreferenz — vorher ~40 % zu früh (konservativ,
  // aber falsch bemessen; Anzeige in voltageDrop.ts nutzt dieselbe Basis).
  const solarDropLimit = scaleVolts(solarDropBasisVoltageOf(), VDE_MAX_DC_DROP_FRACTION);
  const solarPerEdgeCap = scaleVolts(solarDropBasisVoltageOf(), VDE_MAX_DC_DROP_PER_EDGE_FRACTION);

  const sizeEdge = (edge: CableEdge, allowedOwn: Volts): Mm2 => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = modelCurrentOf(nodes, allEdges, edge.id);
    // AUDIT ELE-007: Solar-Zuleitungen werden thermisch UND im Spannungsfall
    // mit dem DESIGN-Strom (≥ 1,25 × Isc, IEC-62548-Kontext) dimensioniert —
    // nicht mit der Imp-Näherung. Konservativ: Isc-Schätzwert ohne Datenblatt
    // ist 1,25 × Imp (lib/solar.ts). Der Spannungsfall wird dadurch ebenfalls
    // mit dem höheren Strom gerechnet (sichere Richtung).
    const panel = solarPanelEndOf(sourceNode, targetNode);
    const sizingI = panel ? solarDesignCurrentOf(panel) : I;
    const length = planningLength(edge, pointOf) ?? DEFAULT_EDGE_LENGTH;
    const currentCs = edgeCrossSection(edge, MIN_CROSS_SECTION);

    let requiredCs: Mm2 = MAX_CROSS_SECTION;
    if (allowedOwn > 0) {
      const need = crossSectionForDrop(sizingI, length, allowedOwn);
      // Rechnerischer Bedarf über der Normreihe bleibt bei 70 mm² gedeckelt;
      // nur ein tatsächlich vorhandener Nutzer-/Importquerschnitt (>70 mm²)
      // wird erhalten statt verkleinert.
      requiredCs = need > MAX_CROSS_SECTION ? MAX_CROSS_SECTION : nextStandardCrossSection(need);
    }
    const thermalCs = mm2(lookupThermalCrossSection(maxAmps(sizingI, ZERO_AMPS)));
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
    // ELE-007: Panel-Kanten an der MPP-Basis (18 V), Rest an der Systembasis.
    const panel = solarPanelEndOf(nodeMap.get(edge.source), nodeMap.get(edge.target));
    edge.data.crossSection = sizeEdge(edge, panel ? solarPerEdgeCap : perEdgeCap);
    edge.data.dropWarning = false;
  }

  for (let iteration = 0; iteration < 20; iteration++) {
    let changed = false;
    for (const edge of dcEdges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);
      const I = modelCurrentOf(nodes, allEdges, edge.id);
      const currentCs = edgeCrossSection(edge, MIN_CROSS_SECTION);
      const cumAtSource = relevantCumulativeDrop(edge.source, nodeMap, allEdges, nodes, sysVoltage);
      const ownDrop = edgeVoltageDrop(I, planningLength(edge, pointOf) ?? DEFAULT_EDGE_LENGTH, currentCs);

      // ELE-007: Budget der Panel-Kante an der MPP-Basis bemessen.
      const panel = solarPanelEndOf(sourceNode, targetNode);
      const limit = panel ? solarDropLimit : dropLimit;
      const edgeCap = panel ? solarPerEdgeCap : perEdgeCap;
      if (addVolts(cumAtSource, ownDrop) <= limit) continue;

      const remaining = cumAtSource >= limit ? ZERO_VOLTS : subtractVolts(limit, cumAtSource);
      const allowedOwn = remaining < edgeCap ? remaining : edgeCap;
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
          modelCurrentOf(nodes, allEdges, edge.id),
          planningLength(edge, pointOf) ?? DEFAULT_EDGE_LENGTH,
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
  nodeMap: Map<string, Node> = new Map(nodes.map((n) => [n.id, n])),

  /** ELE-005: volle Kantenliste für die Insel-BFS der Wechselrichter-Last. */
  allEdges: CableEdge[] = []
): void {
  for (const edge of dcEdges) {
    if (!edge.sourceHandle?.includes('plus')) continue;
    if (!edge.data) edge.data = {};
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = modelCurrentOf(nodes, allEdges, edge.id);
    // AUDIT ELE-007: Solar-Zuleitungen brauchen eine Sicherung ≥ 1,56 × Isc
    // (NEC 690.8 × 690.9 als Modellannahme, Quellendoku in lib/solar.ts).
    // Der höhere Wert steuert Bump-Logik und selectFuseSize — der Querschnitt
    // wächst dadurch bei Bedarf mit (identischer Mechanismus wie bei DC).
    const solarPanel = solarPanelEndOf(sourceNode, targetNode);
    const fuseCurrent = solarPanel ? Math.max(I, solarFuseFloorOf(solarPanel)) : I;
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
      edge.data.fuseSize = selectFuseSize(fuseCurrent, MAX_CROSS_SECTION);
      edge.data.fuseWarning = fuseCurrent > (FUSE_MAP[MAX_CROSS_SECTION] ?? 0);
      continue;
    }

    // Wenn der Nennstrom die zulässige Sicherung für den Querschnitt
    // übersteigt, muss das Kabel hochdimensioniert werden (thermisch).
    // Eine Sicherung über dem Kabel-Maximalwert wäre Brandgefahr.
    if (!isFuseFeasible(fuseCurrent, cs)) {
      const larger = VDE_SIZES.find((s) => s > cs && isFuseFeasible(fuseCurrent, s));
      if (larger !== undefined) {
        cs = mm2(larger);
        edge.data.crossSection = cs;
      } else {
        edge.data.fuseWarning = true;
      }
    }
    edge.data.fuseSize = selectFuseSize(fuseCurrent, cs);
  }
}

/** Standardlänge einer AC-Leitung ohne gespeicherte Länge. */

export const DEFAULT_AC_LENGTH: Meters = meters(2);

/**
 * EHEMALIGE AC-Endpunkt-Heuristik `acCurrentA` (2026-10 entfernt,
 * AUDIT §13 „eine Stromquelle"): sie maß 230-V-Leitungen an der
 * Insel-Gesamtlast des Endpunkts statt am tatsächlichen Durchfluss —
 * dieselbe Fehlerkategorie wie auf der DC-Seite (siehe
 * `docs/AUDIT-STROMBERECHNUNG-2026-10.md`). Alle AC- und DC-Stromwerte
 * kommen jetzt aus EINEM Topologie-Strommodell — `getCableCurrents`
 * (`lib/electricalGraph/currentFlow.ts`), hier über `modelCurrentOf`.
 * Die historische Implementation steht im Git-History dieses Files.
 */

/**
 * Modellierter Absicherungswert einer Landstromdose in A (ELEC-003).
 * `rating` ist bewusst als Absicherung/Anschlusswert definiert; fehlt er,
 * liefert die Funktion undefined und der Aufrufer entscheidet über Defaults.
 */
function shoreSupplyRating(node: Node | undefined): Amps | undefined {
  if (!node || node.type !== 'shorePower') return undefined;
  const rating = Number(node.data?.rating);
  if (!Number.isFinite(rating) || rating <= 0) return undefined;
  return amps(rating);
}

export function sizeAcEdges(edges: CableEdge[], nodes: Node[]): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const pointOf = (id: string) => nodeMap.get(id)?.position;
  for (const edge of edges) {
    if (edge.data?.edgeDomain !== 'AC_230V') continue;
    if (!edge.data) edge.data = {};
    // AUDIT ELE-004: Hier wurde bisher ein Datenblatt ERFUNDEN —
    // `acProtection ?? { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 }`
    // auf jede AC-Kante. Damit war der ehrliche `not-modeled`-Zweig der
    // Abschaltbedingung (lib/acProtection.ts) aus dem Produktpfad
    // unerreichbar: Die Prüfung lief gegen geratene Werte und meldete
    // „ok-with-assumption“. Mit geratener B-Charakteristik ist Zs,max =
    // 1,92 Ω (C: 0,96 Ω) — dieselbe Leitung hätte mit einem real verbauten
    // C16 versagt, ohne dass der Plan das gezeigt hätte (AUDIT §5: keine
    // erfundenen VDE-Aussagen).
    //
    // Nutzer-/Import-Angaben bleiben unangetastet; fehlen sie, sagt die
    // Live-Validierung ausdrücklich „Abschaltbedingung unbekannt“ und fragt
    // Bauform, Charakteristik und Icn im Inspektor ab.
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    const I = modelCurrentOf(nodes, edges, edge.id);
    const length = planningLength(edge, pointOf) ?? DEFAULT_AC_LENGTH;

    // AUDIT CRASH-001: calculateCrossSection gibt Nutzer-/Import-Querschnitte
    // > 70 mm² bewusst unverändert durch — der DC-Pfad (applyFuseSizes)
    // fängt das, der AC-Pfad reichte sie an calculateMaxFuse weiter und riss
    // mit RangeError den GESAMTEN AutoWire-Lauf. Symmetrisch zum DC-Pfad:
    // unbekannte Querschnitte auf die Normreihe anheben (nie verkleinern),
    // > 70 mm² auf die 70-mm²-Normbestung absichern + Warnmarke.
    let cs: Mm2 = edgeCrossSection(edge, MIN_CROSS_SECTION);
    if (!VDE_SIZES.includes(cs)) {
      cs = nextStandardCrossSection(cs);
      edge.data.crossSection = cs;
    }
    if (cs > MAX_CROSS_SECTION) {
      // Querschnitt bleibt unverändert (95 mm² niemals auf 70 schwächen);
      // gesichert wird auf die größte bekannte Normstufe (konservativ).
      edge.data.fuseSize = selectFuseSize(I, MAX_CROSS_SECTION);
      edge.data.fuseWarning = I > (FUSE_MAP[MAX_CROSS_SECTION] ?? 0);
      continue;
    }
    edge.data.crossSection = calculateCrossSection(I, length, cs, 'AC_230V');
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

/**
 * AUDIT DOM-002: Auto-Wire vergibt die Sicherungs-BAUFORM mit. Bisher wurde
 * nur der Nennstrom (`fuseSize`) gewählt — der Kurzschluss-Check (Ik der
 * Batteriebank vs. Abschaltvermögen, useLiveValidation Rule A7) läge ohne
 * Bauform in JEDEM Auto-Plan als ungelöster Hinweis. Politik: die kleinste
 * Bauform, deren typisches Abschaltvermögen den Ik am Einbauort (Pol →
 * Sicherung, gedämpft über fuseOffset/Querschnitt) trägt. ATO nur bis 30 A
 * Nennstrom (Baugröße), darüber MEGA/ANL/MRBF, Spitzenbank (> MRBF-Deckel)
 * → Class T. Nutzer-Einträge und explizite Datenblatt-Werte gewinnen und
 * bleiben unangetastet. AC-Kanten: LS-Schalter/RCD-Modell, keine DC-Bauform.
 */
/**
 * Markiert **nicht ausführbare** DC-Dimensionierungen (AUDIT ELE-002/009).
 *
 * `applyFuseSizes` setzt den Marker bisher nur auf Plus-Kanten — die
 * Minus-Rückleitung führt aber denselben Strom. Im Referenzplan `acdc`
 * standen dadurch 7 von 14 Kanten mit 152,06 A auf 70 mm² (Iz_design =
 * 120,4 A, FUSE_MAP[70] = 100 A) da, davon 4 ganz ohne Marker: Ein Plan, der
 * so nicht ausführbar ist, sah im Datenbild vollständig unauffällig aus.
 *
 * Der Marker ist bewusst eine EIGENSCHAFT DER KANTE (nicht des Vorzeichens):
 * „für diesen Leiter existiert bei diesem Strom keine zulässige
 * Normsicherung“ gilt für Hin- und Rückweg. Die Live-Validierung liest ihn
 * und meldet ihn als kritisch — vorher schrieb AutoWire ihn an vier Stellen
 * und niemand las ihn (AUDIT ELE-009).
 *
 * Idempotent und rücksetzend: jeder Aufruf berechnet den Marker für jede
 * Kante neu, ein geänderter Plan kann eine früher unrealisierbare
 * Dimensionierung wieder lösbar machen.
 */
export function markInfeasibleSizing(
  dcEdges: CableEdge[],
  nodes: Node[],
  sysVoltage: Volts,
  allEdges: CableEdge[] = []
): void {
  for (const edge of dcEdges) {
    if (!edge.data) edge.data = {};
    const I = modelCurrentOf(nodes, allEdges, edge.id);
    const cs = edgeCrossSection(edge, MIN_CROSS_SECTION);
    // Plus-Leiter: schutzbezogen — keine Normsicherung trägt den Strom bei
    // diesem Querschnitt (I_B ≤ I_n ≤ I_z, isFuseFeasible kapselt das).
    // Minus-Leiter: rein thermisch — eine Rückleitung wird nicht abgesichert,
    // maßgeblich ist Iz = Tabellenwert × 0,7. Beide Fälle sind für den Nutzer
    // derselbe Befund: „diese Leitung ist bei diesem Strom nicht ausführbar“.
    const isPlusConductor = edge.sourceHandle?.includes('plus') ?? false;
    const infeasible = isPlusConductor ? !isFuseFeasible(I, cs) : I > designAmpacity(cs);
    edge.data.fuseWarning = I > 0 && infeasible;
  }
}

export function applyFuseTypes(dcEdges: CableEdge[], nodes: Node[], sysVoltage: number): void {
  const batteries = nodes.filter((n) => n.type === 'battery');
  for (const edge of dcEdges) {
    const data = edge.data;
    if (!data || !(Number(data.fuseSize) > 0)) continue;
    if (data.edgeDomain === 'AC_230V') continue;
    if (isFuseType(data.fuseType) || Number(data.fuseBreakingCapacity) > 0) continue;
    const ik = shortCircuitAtFuseA(batteries, data.fuseOffset, data.crossSection, sysVoltage);
    if (ik === null) continue; // Bank nicht schätzbar → ehrlich nichts erfinden
    // Kandidaten spannungsabhängig aufsteigend nach wirksamem Abschaltvermögen
    // sortieren (MRBF kollabiert bei 24-V-Bänken auf 5 kA) und die kleinste
    // tragende Bauform stempeln. Auswahlprinzip „kleinstes Abschaltvermögen ≥
    // Ik": höheres Abschaltvermögen bedeutet physikalisch immer längere/
    // energiereichere Lichtbögen beim Abschalten (Class T ist das Dach für
    // Lithium-Spitzenbänke, nicht die Familienwahl von nebenan); ANL (6 kA)
    // schlägt damit bewusst MRBF (10 kA), sobald letzterer nicht nötig ist.
    // ATO bleibt Baugrößenbeschränkung ≤ 30 A.
    const base: readonly FuseType[] =
      Number(data.fuseSize) > 30
        ? ['mega', 'anl', 'mrbf', 'classT']
        : ['ato', 'mega', 'anl', 'mrbf', 'classT'];
    const nominees = [...base].sort(
      (a, b) =>
        (breakingCapacityAOf(a, undefined, sysVoltage) ?? 0) -
        (breakingCapacityAOf(b, undefined, sysVoltage) ?? 0)
    );
    data.fuseType =
      nominees.find((t) => (breakingCapacityAOf(t, undefined, sysVoltage) ?? 0) >= ik) ?? 'classT';
  }
}
