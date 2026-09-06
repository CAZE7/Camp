/**
 * lib/planner/autowire/sizing.ts
 *
 * Stufe 4 der AutoWire-Pipeline: Sizing.
 *
 * Wendet die Kabel-Dimensionierung (`calculateWire`) auf jede Verbindungs-
 * Absicht an und berechnet Querschnitt + Sicherungsgröße. Diese Stufe kennt
 * weder die Logik der Struktur noch die Erzeugung von Edge-Objekten.
 */

import { calculateWire } from '../electrical';
import type { ConnectionIntent, SizedCable } from './types';

/**
 * Dimensioniert alle Verbindungs-Absichten.
 *
 * @param intents Verbindungs-Absichten aus der Wiring-Strategy-Stufe
 * @returns       Dimensionierte Kabel (Querschnitt + Sicherungsgröße)
 */
export function sizeConnections(intents: ConnectionIntent[]): SizedCable[] {
  return intents.map((intent) => {
    const { crossSection, fuseSize } = calculateWire(intent.currentA, intent.length);
    return {
      sourceId: intent.sourceId,
      targetId: intent.targetId,
      currentA: intent.currentA,
      length: intent.length,
      crossSection,
      fuseSize,
    };
  });
}
