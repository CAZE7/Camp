import type { Edge, Node } from '@xyflow/react';
import { measuredWidth, measuredHeight } from '../../edges/utils/nodeGeometry';

/**
 * Identität des Planstands, wie ihn ein BILD zeigt.
 *
 * Abgrenzung zu `planFingerprintHash` (lib/verify/pipeline.ts): Jener hasht die
 * **Prüfeingabe** — id, type, data, Kantenanschlüsse, Optionen. Er lässt
 * `position` bewusst weg, weil die Lage eines Symbols kein elektrisches
 * Ergebnis ändert. Das ist für die Verifikation richtig.
 *
 * Für ein Übergabedokument reicht es nicht. Der Schaltplan ist eine Zeichnung:
 * Ein verschobenes Bauteil ergibt ein anderes Bild, ohne dass sich der
 * Prüf-Fingerprint ändert. Ebenso wenig erfasst er `viewMode` oder das
 * Wasser-Gewerk, obwohl `capturePlanImage` genau danach auswählt, was es
 * rendert, und `buildBom` beide Gewerke mischt.
 *
 * Diese Identität deckt deshalb die DARSTELLUNG ab. Beide Prüfungen zusammen
 * beantworten die Frage, die ein Übergabedokument stellen muss: „Stammen
 * Bild, Stückliste und Prüfbericht aus demselben Plan?"
 *
 * Bewusst NICHT enthalten: `selected`. Auswahl ist keine Plandaten-Änderung,
 * und `capturePlanImage` löst die Auswahl vor dem Rendern ohnehin auf. Ein
 * Klick dürfte eine Berichtserzeugung nicht abbrechen lassen.
 */

/** Minimalform eines Graphen, wie ihn die Aufnahme zeigt. */
interface GraphLike {
  viewMode: 'electric' | 'water';
  nodes: readonly Node[];
  edges: readonly Edge[];
  waterNodes: readonly Node[];
  waterEdges: readonly Edge[];
}

const round = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

function describeNodes(nodes: readonly Node[]): unknown[] {
  return [...nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((node) => ({
      id: node.id,
      type: node.type ?? null,
      // Die Lage ist der Punkt, den der Prüf-Fingerprint nicht abdeckt.
      x: round(node.position?.x),
      y: round(node.position?.y),
      // RF 12: die flachen Felder sind die GESETZTEN Maße. Gelesen wird
      // über die Messgrenze (nodeGeometry), damit eine abgeschlossene
      // Messung die Identität ebenso ändert wie eine gesetzte Größe.
      width: round(measuredWidth(node) ?? undefined),
      height: round(measuredHeight(node) ?? undefined),
      data: node.data ?? {},
    }));
}

function describeEdges(edges: readonly Edge[]): unknown[] {
  return [...edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      type: edge.type ?? null,
      data: edge.data ?? {},
    }));
}

/** FNV-1a 64 Bit über zwei Startwerte — gleiche Bauart wie im Prüfzertifikat. */
function digest(text: string): string {
  const fnv = (seed: number): number => {
    let hash = seed;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  };
  return `${fnv(0x811c9dc5).toString(16).padStart(8, '0')}${fnv(0x811c9dc6).toString(16).padStart(8, '0')}`;
}

/** Kanonische Form: sortierte Schlüssel, `undefined` fällt heraus. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
}

/**
 * Identität der Darstellung. Ändert sich bei jeder Änderung, die das
 * aufgenommene Bild oder die Stückliste sichtbar anders macht.
 */
export function planCaptureIdentity(state: GraphLike): string {
  return digest(
    canonical({
      viewMode: state.viewMode,
      nodes: describeNodes(state.nodes),
      edges: describeEdges(state.edges),
      waterNodes: describeNodes(state.waterNodes),
      waterEdges: describeEdges(state.waterEdges),
    })
  );
}

/** Welches Gewerk zeigt das aufgenommene Bild? */
export function capturedTrade(viewMode: 'electric' | 'water'): 'Elektrik' | 'Wasser' {
  return viewMode === 'water' ? 'Wasser' : 'Elektrik';
}
