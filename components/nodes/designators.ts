import { createContext } from 'react';

/**
 * Eindeutige Bauteil-Bezeichnungen im Plan (Nachtest 2026-10-16:
 * „doppelte Kürzel — G1, G2, W1 doppelt, E1 dreifach“).
 *
 * `NodeSymbol` zeigte bisher das statische Kürzel der BauteilART — jede
 * Batterie hieß „G1“, jeder Verbraucher „E1“. In einem Plan mit zwei
 * Batterien und drei Verbrauchern war damit nichts mehr eindeutig
 * benennbar (weder für den Nutzer noch in Warnungen/Stückliste).
 *
 * Jetzt zählt der Canvas pro Kürzel-Gruppe durch: Die erste Batterie
 * bleibt „G1“, weitere heißen „G1.2“, „G1.3“ … (Schema aus PR #536,
 * dort nur für Batterien; hier für alle Arten, weil der Bericht auch
 * G2/W1/E1 doppelt sah). Die Zuordnung kommt per Kontext aus dem Canvas
 * — kein Store-Import in den Knoten, kein Importzyklus.
 *
 * Es ist eine eindeutige Anlagenkennung im Plan, keine Normvorgabe.
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

/** Knoten-ID → Bezeichnung. Ohne Provider (z. B. Einzeltests) gilt die Basis der Art. */
export const DesignatorContext = createContext<ReadonlyMap<string, string>>(new Map());
