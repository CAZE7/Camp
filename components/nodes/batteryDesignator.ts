import { createContext } from 'react';

/**
 * QA B-03: Jede Batterie bekommt eine eigene Bezeichnung. Die erste bleibt
 * „G1“, weitere hängen die Nummer an („G1.2“, „G1.3“). Das ist eine eindeutige
 * Anlagenkennung im Plan, keine Normvorgabe.
 *
 * Die Zuordnung kommt aus dem Canvas per Kontext (kein Store-Import hier, damit
 * es keinen Importzyklus Store → Registry → Knoten gibt).
 */
export function batteryDesignator(index: number): string {
  return index <= 0 ? 'G1' : `G1.${index + 1}`;
}

/** Knoten-ID → Bezeichnung. Ohne Provider (z. B. Einzeltests) gilt „G1“. */
export const BatteryDesignatorContext = createContext<ReadonlyMap<string, string>>(new Map());

export function batteryDesignatorMap(
  nodes: readonly { id: string; type?: string | null }[]
): Map<string, string> {
  const map = new Map<string, string>();
  nodes
    .filter((node) => node.type === 'battery')
    .forEach((node, index) => map.set(node.id, batteryDesignator(index)));
  return map;
}
