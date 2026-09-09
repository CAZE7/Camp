import type { Node } from '@xyflow/react';
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH, getNodeLayoutRank } from './layout';
import { nodeHeight, nodeWidth } from '../../edges/utils/nodeGeometry';

/**
 * Funktionszonen (Befund B3 / Maßnahme C2-Design): Hintergrund-Bänder, die die
 * fünf Funktionsstufen der Anlage sichtbar machen — Quellen → Laden → Speichern
 * & Verteilen → Wechselrichter → Verbrauchen. Die Stufen stammen aus derselben
 * 5-Rang-Klassifikation wie das Auto-Layout (`layout.ts`), damit Layout-Spalten
 * und Zonen immer deckungsgleich sind.
 *
 * Die Bänder werden aus den IST-Positionen der Knoten abgeleitet (nicht aus
 * dem letzten Auto-Layout): Wird ein Bauteil verschoben, folgt seine Zone —
 * so lügt das Hintergrundbild nie über die tatsächliche Anordnung.
 */

/** Vertikaler Abstand der Bänder über/unter dem Planinhalt. */
export const ZONE_PAD_X = 32;
/** Horizontaler Atem zwischen Bandkante und Knoten. */
export const ZONE_PAD_Y = 48;
/**
 * Zwei gleichstufige Knotengruppen, deren Spalten weniger als dieser Wert
 * auseinanderliegen, teilen sich ein Band. Bewusst großzügig (> doppelte
 * Plus/Minus-Schienen-Breite): Polpaare (z. B. zwei Busbar-Zeilen derselben
 * Stufe) sollen EIN Band ergeben — erst deutlich getrennte Cluster (z. B.
 * zwei Batterien an verschiedenen Einbauorten) bilden eigene Bänder.
 */
export const ZONE_MERGE_GAP_X = 240;

export type ZoneStageKey = 'sources' | 'charge' | 'store' | 'inverter' | 'consumers';

export interface ZoneStage {
  rank: number;
  key: ZoneStageKey;
  /** Kurzes Funktions-Label für die Band-Beschriftung. */
  label: string;
}

/** Fünf Funktionsstufen in Flussrichtung (Quelle → Verbrauch). */
export const ZONE_STAGES: readonly ZoneStage[] = [
  { rank: 0, key: 'sources', label: 'Quellen' },
  { rank: 1, key: 'charge', label: 'Laden & Wandeln' },
  { rank: 2, key: 'store', label: 'Speichern & Verteilen' },
  { rank: 3, key: 'inverter', label: 'Wechselrichter' },
  { rank: 4, key: 'consumers', label: 'Verbrauchen' },
] as const;

export interface FunctionZone {
  /** Rang der Funktionsstufe (0–4, identisch zu `getNodeLayoutRank`). */
  rank: number;
  key: ZoneStageKey;
  label: string;
  /** Anzahl der Knoten in diesem Band. */
  nodeCount: number;
  /** Koordinaten in Flow-Einheiten. */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ZoneNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
}

const nodeSpan = (node: ZoneNode): { x: number; y: number; right: number; bottom: number } => {
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;
  const width = nodeWidth(node as unknown as Node, DEFAULT_NODE_WIDTH);
  const height = nodeHeight(node as unknown as Node, DEFAULT_NODE_HEIGHT);
  return { x, y, right: x + width, bottom: y + height };
};

/**
 * Fasst die x-Spannen einer Funktionsstufe zu Bändern zusammen: Intervalle,
 * die sich überlappen oder näher als `ZONE_MERGE_GAP_X` liegen, verschmelzen.
 * Der y-Bereich ist für alle Bänder gleich (globaler Planinhalt ± ZONE_PAD_Y),
 * damit die Bänder als durchgehende Spalten lesen.
 */
export function computeFunctionZones(nodes: readonly ZoneNode[]): FunctionZone[] {
  if (nodes.length === 0) return [];

  let contentMinY = Infinity;
  let contentMaxY = -Infinity;
  const rankSpans = new Map<number, Array<{ start: number; end: number }>>();

  for (const node of nodes) {
    const span = nodeSpan(node);
    contentMinY = Math.min(contentMinY, span.y);
    contentMaxY = Math.max(contentMaxY, span.bottom);
    const rank = getNodeLayoutRank(node as unknown as Node);
    const list = rankSpans.get(rank) ?? [];
    list.push({ start: span.x, end: span.right });
    rankSpans.set(rank, list);
  }

  const zones: FunctionZone[] = [];
  for (const stage of ZONE_STAGES) {
    const spans = (rankSpans.get(stage.rank) ?? []).sort((a, b) => a.start - b.start);
    if (spans.length === 0) continue;

    const merged: Array<{ start: number; end: number; nodeCount: number }> = [];
    for (const span of spans) {
      const current = merged.at(-1);
      if (current && span.start - current.end < ZONE_MERGE_GAP_X) {
        current.end = Math.max(current.end, span.end);
        current.nodeCount += 1;
      } else {
        merged.push({ start: span.start, end: span.end, nodeCount: 1 });
      }
    }

    for (const band of merged) {
      zones.push({
        rank: stage.rank,
        key: stage.key,
        label: stage.label,
        nodeCount: band.nodeCount,
        x: band.start - ZONE_PAD_X,
        width: band.end - band.start + 2 * ZONE_PAD_X,
        y: contentMinY - ZONE_PAD_Y,
        height: contentMaxY - contentMinY + 2 * ZONE_PAD_Y,
      });
    }
  }
  return zones;
}

/** Liefert das Stufen-Metadatum zu einem Rang (Fallback: undefined). */
export function getZoneStage(rank: number): ZoneStage | undefined {
  return ZONE_STAGES.find((stage) => stage.rank === rank);
}
