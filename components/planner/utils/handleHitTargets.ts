/**
 * Minimienscreenmaß für einen Anschluss-Trefferbereich. Die tatsächlichen
 * React-Flow-Handles behalten ihre Plan-Geometrie; nur die separate
 * Bildschirm-Trefferschicht nutzt diesen Wert.
 */
export const HANDLE_HIT_TARGET_SCREEN_PX = 44;

/**
 * Verteilt nahe Trefferzentren entlang derselben Node-Kante so, dass ihre
 * screen-space Intervalle mindestens `minimumGap` auseinanderliegen. Die
 * Verschiebung minimiert die Summe der quadrierten Abstände und bleibt damit
 * klein, wenn Plus-/Minus-Ports bei niedrigem Zoom zusammenrücken.
 *
 * Die isotone Regression arbeitet auf `center - index * minimumGap`; der
 * Pool-Adjacent-Violators-Schritt erzwingt eine nicht fallende Folge und
 * liefert die kleinste symmetrische Korrektur für jede kollidierende Gruppe.
 */
export function separateHandleHitTargets(
  centers: readonly number[],
  minimumGap = HANDLE_HIT_TARGET_SCREEN_PX
): number[] {
  const offsets = centers.map(() => 0);
  if (centers.length < 2 || !Number.isFinite(minimumGap) || minimumGap <= 0) return offsets;

  const ordered = centers
    .map((center, originalIndex) => ({ center, originalIndex }))
    .sort((a, b) => a.center - b.center || a.originalIndex - b.originalIndex);

  const blocks: Array<{ start: number; end: number; mean: number; count: number }> = [];
  ordered.forEach(({ center }, index) => {
    const value = center - index * minimumGap;
    blocks.push({ start: index, end: index, mean: value, count: 1 });

    while (blocks.length > 1) {
      const current = blocks[blocks.length - 1];
      const previous = blocks[blocks.length - 2];
      if (!current || !previous || previous.mean <= current.mean) break;
      const count = previous.count + current.count;
      const mean = (previous.mean * previous.count + current.mean * current.count) / count;
      blocks.splice(-2, 2, {
        start: previous.start,
        end: current.end,
        mean,
        count,
      });
    }
  });

  for (const block of blocks) {
    for (let index = block.start; index <= block.end; index += 1) {
      const item = ordered[index];
      if (!item) continue;
      const separatedCenter = block.mean + index * minimumGap;
      offsets[item.originalIndex] = separatedCenter - item.center;
    }
  }

  return offsets;
}
