/**
 * Raster des Planers. Eigene Datei ohne Importe: `constants.ts` zieht die
 * Knoten-Registry nach sich, und Store-Slices (über `collision.ts`) dürfen
 * nicht über diese Kette in einen Importzyklus geraten.
 */
export const PLANNER_SNAP_GRID: [number, number] = [16, 16];
