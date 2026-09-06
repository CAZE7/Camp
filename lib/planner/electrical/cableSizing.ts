/**
 * lib/planner/electrical/cableSizing.ts
 *
 * Zentrale Kabel-Dimensionierung. Kombiniert Spannungsabfall, Norm-aufrundung
 * und Sicherungs-Auslegung zu einer einzigen Empfehlung.
 */

import { VDE_MIN_CROSS_SECTION } from './standards';
import { calculateMinCrossSection, roundUpToVDECrossSection } from './voltageDrop';
import { recommendFuseSize } from './fuseSizing';
import { VDE_CURRENT_CAPACITY } from './ampacity';

/**
 * Berechnet den passenden Kabelquerschnitt und die empfohlene Sicherung.
 *
 * @param currentA Strom in Ampere
 * @param lengthM Kabellänge in Metern (Hin- und Rückleiter wird intern berücksichtigt)
 * @returns Empfohlener Querschnitt (mm²) und Sicherungsgröße (A)
 */
export function calculateWire(
  currentA: number,
  lengthM: number
): { crossSection: number; fuseSize: number; length: number; minCrossSection: number } {
  const minCrossSection = calculateMinCrossSection(currentA, lengthM);
  // Der Endquerschnitt ist max(Mindestquerschnitt, absolutes Minimum)
  const minRequired = Math.max(VDE_MIN_CROSS_SECTION, minCrossSection);
  const crossSection = roundUpToVDECrossSection(minRequired);
  const recommendedFuse = recommendFuseSize(crossSection, true);
  // A fuse must never exceed the thermal limit of the selected conductor.
  // Keep this guard here (rather than only in the UI) because auto-wiring and
  // imported plans also consume calculateWire directly.
  const fuseSize = Math.min(recommendedFuse, VDE_CURRENT_CAPACITY[crossSection] ?? recommendedFuse);

  return { crossSection, fuseSize, length: lengthM, minCrossSection };
}
