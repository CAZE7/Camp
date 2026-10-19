/**
 * Laufende Anlagenkennungen (G1, G1.2, …) ohne React.
 *
 * Vorlagen und die SEO-Seite importieren dieses Modul aus Server-Komponenten.
 * Der Canvas-Kontext lebt getrennt in `designators.ts`.
 */

/** Bauteiltyp → Basis-Kürzel (Spiegel der `dinCode`s in `NodeSymbol`). */
export const NODE_TYPE_DESIGNATOR_BASE: Readonly<Record<string, string>> = {
  battery: 'G1',
  charger: 'G2',
  mpptController: 'G2',
  dcdcCharger: 'G2',
  acBatteryCharger: 'G2',
  solar: 'G3',
  consumer: 'E1',
  consumer230v: 'E2',
  fuse: 'F1',
  ground: 'PE',
  inverter: 'U1',
  shorePower: 'X1',
  shunt: 'R1',
  busbar: 'W1',
  conduit: 'W0',
};

export function designatorForIndex(base: string, index: number): string {
  return index <= 0 ? base : `${base}.${index + 1}`;
}

function asNodeData(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' ? { ...(data as Record<string, unknown>) } : {};
}

/**
 * Knoten-ID → Bezeichnung, in Plan-Reihenfolge durchnummeriert.
 * Unbekannte Typen (Wasser, Dach, Altpläne) bekommen keinen Eintrag —
 * ihre Karten zeigen weiter das Basis-Kürzel ihrer Art.
 */
export function designatorMapFor(
  nodes: readonly { id: string; type?: string | null }[]
): Map<string, string> {
  const counters = new Map<string, number>();
  const map = new Map<string, string>();
  for (const node of nodes) {
    const base = node.type ? NODE_TYPE_DESIGNATOR_BASE[node.type] : undefined;
    if (!base) continue;
    const index = counters.get(base) ?? 0;
    counters.set(base, index + 1);
    map.set(node.id, designatorForIndex(base, index));
  }
  return map;
}

/**
 * Schreibt die laufende Bezeichnung nach `data.designator`.
 *
 * Der Canvas-Kontext allein reicht nicht: Vorlagen, der Erststart-Plan und
 * migrierte Speicherstände zeigten weiter das statische Art-Kürzel, sobald
 * die Karte den Kontext nicht sah oder das Suffix abgeschnitten wurde.
 * Eine schon passende Bezeichnung bleibt die gleiche Referenz.
 */
export function nodesWithUniqueDesignators<T extends { id: string; type?: string | null; data?: unknown }>(
  nodes: readonly T[]
): T[] {
  const computed = designatorMapFor(nodes);
  return nodes.map((node) => {
    const next = computed.get(node.id);
    if (!next) return node;
    const data = asNodeData(node.data);
    if (data.designator === next) return node;
    return { ...node, data: { ...data, designator: next } };
  });
}

/** Kontext gewinnt, sonst die gespeicherte Bezeichnung (Vorlage, Import, Altplan). */
export function resolvedDesignator(
  map: ReadonlyMap<string, string>,
  id: string,
  data: { designator?: unknown } | null | undefined
): string | undefined {
  const fromPlan = map.get(id);
  if (fromPlan) return fromPlan;
  return typeof data?.designator === 'string' && data.designator.trim() !== '' ? data.designator : undefined;
}
