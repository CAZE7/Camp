import type { LayoutPort, LayoutPortSide } from './contract';

/**
 * lib/planner/layout-engine/ports.ts — Anschluss-Seiten je Bauteiltyp.
 *
 * Warum es diese Datei gibt (Finding 2026-09-27): Der ELK-Adapter baute seinen
 * Graphen ohne `ports` und ohne `sourcePort`/`targetPort`. Die Option
 * `elk.portConstraints: 'FIXED_ORDER'` (lib/routing/elk/tokens.ts) war damit
 * wirkungslos, und ELK durfte Bauteile so anordnen, dass Anschlüsse
 * gegeneinander zeigen — der Router bekam anschließend Kanten, die quer über
 * die Karte mussten.
 *
 * Die Konvention steht in `components/nodes/handleLayout.ts` (Markup-Wahrheit)
 * und in der Bauteil-Registry (`handles`, geprüft gegen das Markup). Diese
 * Datei ist die Domänen-Kopie für die Layoutschicht — `lib` darf aus
 * Architekturgründen (ADR-0008) nicht auf `components/` zugreifen. Ein Test
 * (`ports.test.ts`) vergleicht sie deshalb gegen die Registry: eine vierte,
 * unbemerkt driftende Kopie kann so nicht entstehen.
 *
 * Konvention:
 *  - Eingänge (target) links (WEST), Ausgänge (source) rechts (EAST).
 *  - Innerhalb einer Seite: `plus` 0, `minus` 1 (im Markup 30 %/70 %) — die
 *    Reihenfolge ist der `index` in `FIXED_ORDER`.
 *  - Wechselrichter: `ac_in` oben (NORTH) — die dokumentierte Ausnahme.
 *  - Wasser und Leerrohr: `in` links, `out` rechts, je Index 0.
 *
 * Port-IDs sind **global eindeutig**, denn elkjs löst Kanten-Endpunkte über
 * einen graphweiten Namensraum auf (verifiziert: zwei Knoten mit derselben
 * Port-ID ⇒ die Kante dockt am falschen Knoten an). Deshalb steckt die
 * Knoten-ID im Port: `<node>::<role>:<handle>`.
 *
 * Nicht gelistete Typen (Dachelemente, Unbekanntes) haben keine Ports: ELK
 * ordnet sie dann allein nach den Kanten.
 */

/** Port-ID: knotenspezifisch, damit elkjs eindeutig auflösen kann. */
export const layoutPortId = (nodeId: string, role: 'source' | 'target', handle: string): string =>
  `${nodeId}::${role}:${handle}`;

type LayoutPortSpec = {
  readonly role: 'source' | 'target';
  readonly handle: string;
  readonly side: LayoutPortSide;
  readonly index: number;
};

const spec = (
  role: 'source' | 'target',
  handle: string,
  side: LayoutPortSide,
  index: number
): LayoutPortSpec => ({ role, handle, side, index });

/** DC-Durchgang: plus/minus links (Eingang) und rechts (Ausgang). */
const dcPassThrough: readonly LayoutPortSpec[] = [
  spec('target', 'plus', 'WEST', 0),
  spec('target', 'minus', 'WEST', 1),
  spec('source', 'plus', 'EAST', 0),
  spec('source', 'minus', 'EAST', 1),
];

/** Wasser: in links, out rechts. */
const waterPassThrough: readonly LayoutPortSpec[] = [
  spec('target', 'in', 'WEST', 0),
  spec('source', 'out', 'EAST', 0),
];

const PORTS_BY_KIND: Readonly<Record<string, readonly LayoutPortSpec[]>> = {
  // Strom speichern / verteilen / laden
  battery: dcPassThrough,
  shunt: dcPassThrough,
  busbar: dcPassThrough,
  fuse: dcPassThrough,
  charger: dcPassThrough,
  mpptController: dcPassThrough,
  dcdcCharger: dcPassThrough,
  acBatteryCharger: dcPassThrough,
  // Solar (Panel und Dachpanel teilen das Markup)
  solar: dcPassThrough,
  roofSolar: dcPassThrough,
  // Verbraucher (die 12-V-Karte hat Plus und Minus auf beiden Seiten)
  consumer: dcPassThrough,
  // Wechselrichter: Netz-Eingang oben, DC links, AC-Ausgang rechts
  inverter: [
    spec('target', 'ac_in', 'NORTH', 0),
    spec('target', 'plus', 'WEST', 0),
    spec('target', 'minus', 'WEST', 1),
    spec('source', 'plus', 'EAST', 0),
  ],
  shorePower: [spec('source', 'plus', 'EAST', 0)],
  consumer230v: [spec('target', 'plus', 'WEST', 0)],
  ground: [spec('target', 'minus', 'WEST', 0), spec('source', 'minus', 'EAST', 0)],
  conduit: [spec('target', 'in', 'WEST', 0), spec('source', 'out', 'EAST', 0)],
  // Wasser
  freshWaterTank: waterPassThrough,
  grayWaterTank: waterPassThrough,
  pump: waterPassThrough,
  accumulator: waterPassThrough,
  preFilter: waterPassThrough,
  sink: waterPassThrough,
  shower: waterPassThrough,
};

const specsForKind = (kind: string | null | undefined): readonly LayoutPortSpec[] =>
  (kind && PORTS_BY_KIND[kind]) || [];

/** Anschlüsse eines Bauteiltyps inklusive knotenspezifischer Port-IDs. */
export function portsForNode(nodeId: string, kind: string | null | undefined): readonly LayoutPort[] {
  return specsForKind(kind).map((entry) => ({
    id: layoutPortId(nodeId, entry.role, entry.handle),
    side: entry.side,
    index: entry.index,
  }));
}

/** Ports eines Bauteiltyps ohne Knotenbindung (für Tests/Diagnose). */
export function portSpecsForKind(kind: string | null | undefined): readonly LayoutPortSpec[] {
  return specsForKind(kind);
}

/**
 * Port-ID für eine Kante — `undefined`, wenn der Typ den Handle nicht kennt.
 * Der Aufrufer fällt dann auf die Knoten-ID zurück (Altbestand/Import).
 */
export function layoutPortForHandle(
  nodeId: string,
  kind: string | null | undefined,
  role: 'source' | 'target',
  handle: string | null | undefined
): string | undefined {
  if (!handle) return undefined;
  const known = specsForKind(kind).some((entry) => entry.role === role && entry.handle === handle);
  return known ? layoutPortId(nodeId, role, handle) : undefined;
}
