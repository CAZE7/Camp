/**
 * Linienstärken für Kabel — PERFEKTE LÖSUNG 100% nach Modul 2
 *
 * Spec (Dark Engineering):
 * - Hauptstromschienen (DC MAIN / AC MAIN / Backbone): 3px + Glow bei Selektion
 * - Zweigleitungen: 2px solid
 * - Solar Main: 2.5px
 * - CAN/Sensor: 1.5px / 1.25px dashed filigran
 * - Hover/Selektion: +1px + drop-shadow Glow
 * - Trassen-Modus: Abgänge dünner (1.5px), Hauptstränge bleiben 3px
 * - vector-effect: non-scaling-stroke — kein Pixelmatsch beim Zoom (Modul 5)
 */

export const BACKBONE_STROKE_WIDTH = 3; // Spec: 3px für MAIN (vorher 4px)
export const NORMAL_STROKE_WIDTH = 2;
export const SOLAR_STROKE_WIDTH = 2.5;
export const CAN_STROKE_WIDTH = 1.5;
export const SENSOR_STROKE_WIDTH = 1.25;
export const EMPHASIS_STROKE_BONUS = 1;
export const TRUNK_BRANCH_STROKE_WIDTH = 1.5;

export type EdgeRole =
  | 'dcMain'
  | 'dcBranch'
  | 'dc24v'
  | 'dc48v'
  | 'acMain'
  | 'acBranch'
  | 'acPE'
  | 'solarMain'
  | 'canBus'
  | 'sensor'
  | 'pipe';

export function cableStrokeWidth(input: {
  isBackbone?: boolean;
  emphasized?: boolean;
  trunkMode?: boolean;
  role?: EdgeRole;
}): number {
  // Rollen-basierte Hierarchie hat Vorrang (Modul 2)
  if (input.role) {
    switch (input.role) {
      case 'dcMain':
      case 'acMain':
      case 'acPE':
        return input.emphasized ? 4 : 3;
      case 'dcBranch':
      case 'acBranch':
        return input.emphasized ? 3 : 2;
      case 'solarMain':
      case 'dc24v':
      case 'dc48v':
        return input.emphasized ? 3.5 : 2.5;
      case 'canBus':
        return input.emphasized ? 2.5 : 1.5;
      case 'sensor':
        return input.emphasized ? 2 : 1.25;
      case 'pipe':
        return input.emphasized ? 3 : 2;
    }
  }

  // Legacy Backbone-Logik (Abwärtskompatibilität)
  const base = input.isBackbone ? BACKBONE_STROKE_WIDTH : NORMAL_STROKE_WIDTH;
  if (input.trunkMode && !input.isBackbone) return TRUNK_BRANCH_STROKE_WIDTH;
  return input.emphasized ? base + EMPHASIS_STROKE_BONUS : base;
}

/**
 * Gibt das passende Dash-Array für die Domäne zurück
 * MAIN = solid, CAN/SENSOR = dashed filigran
 */
export function cableDashArray(role?: EdgeRole, hasError?: boolean): string | undefined {
  if (hasError) return '8 6';
  if (!role) return undefined;
  switch (role) {
    case 'canBus':
      return '6 3';
    case 'sensor':
      return '4 4';
    case 'acPE':
      return undefined; // PE solid, aber Form + Stripes via CSS
    default:
      return undefined;
  }
}
