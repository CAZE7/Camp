/**
 * Linienstärken für Kabel — eine einzige Quelle der Wahrheit.
 *
 * Vorher skalierte die Strichstärke mit dem Querschnitt (2–10 px). Bei vielen
 * parallelen Leitungen verschmolzen 10-px-Linien optisch zu Blöcken und
 * überdeckten die 16-px-Lanes. Jetzt kodiert die Stärke die *Rolle* der
 * Leitung (Hauptstrang vs. Abgang), der Querschnitt steht im Label:
 *
 *  - Backbone (Batterie ↔ Sicherung ↔ Verteilung): 4 px
 *  - normale Leitung: 2 px (Relaunch D-4)
 *  - Hover/Auswahl: +1 px (Hit-Feedback, ersetzt reine Hover-Farbe)
 *  - Trassen-Modus: Abgänge dünner (1,5 px), Hauptstränge bleiben 4 px
 */
export const BACKBONE_STROKE_WIDTH = 4;
export const NORMAL_STROKE_WIDTH = 2;
export const EMPHASIS_STROKE_BONUS = 1;
export const TRUNK_BRANCH_STROKE_WIDTH = 1.5;

export function cableStrokeWidth(input: {
  isBackbone: boolean;
  emphasized?: boolean;
  trunkMode?: boolean;
}): number {
  const base = input.isBackbone ? BACKBONE_STROKE_WIDTH : NORMAL_STROKE_WIDTH;
  if (input.trunkMode && !input.isBackbone) return TRUNK_BRANCH_STROKE_WIDTH;
  return input.emphasized ? base + EMPHASIS_STROKE_BONUS : base;
}
