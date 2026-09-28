import { describe, expect, it } from 'vitest';
import {
  jouleHeatingStep,
  THERMAL_FIXPOINT_MAX_ITERATIONS,
  THERMAL_FIXPOINT_TOLERANCE_K,
  thermalFixpoint,
} from './thermalFixpoint';
import { COPPER_RESISTIVITY_OHM_MM2_PER_M, COPPER_TEMPERATURE_COEFFICIENT_PER_K } from '../../materials';

/**
 * Mission Stufe 2 — Fixpoint-Bounds (≤ 12 Iterationen, ≤ 0,05 K) als
 * Test eingefroren; keine Konvergenz ist ein ausdrückliches Ergebnis
 * (Regel M), Schritt-Funktionen mit Defekt werfen.
 */

describe('thermalFixpoint — Mission-Bounds eingefroren', () => {
  it('Grenzwerte exakt die Missionsvorgabe', () => {
    expect(THERMAL_FIXPOINT_MAX_ITERATIONS).toBe(12);
    expect(THERMAL_FIXPOINT_TOLERANCE_K).toBe(0.05);
  });

  it('konvergente lineare Abbildung stoppt bei |ΔT| ≤ 0,05 K innerhalb von 12 Schritten', () => {
    // T ↦ 20 + 0,5·(T − 20): Fixpunkt 20 K, lineare Konvergenz.
    const result = thermalFixpoint(100, (t) => 20 + 0.5 * (t - 20));
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(THERMAL_FIXPOINT_MAX_ITERATIONS);
    expect(result.deltaK).toBeLessThanOrEqual(THERMAL_FIXPOINT_TOLERANCE_K);
    expect(result.temperatureC).toBeCloseTo(20, 1); // Restabweichung < 0,05
  });

  it('Fixpunkt auf den Startwert (konstante Abbildung) konvergiert in einem Schritt', () => {
    const result = thermalFixpoint(20, () => 20);
    expect(result).toEqual({ converged: true, iterations: 1, temperatureC: 20, deltaK: 0 });
  });

  it('Budget-Erschöpfung ⇒ ausdrücklich converged: false (kein stiller Erfolg)', () => {
    const result = thermalFixpoint(20, (t) => t + 1);
    expect(result.converged).toBe(false);
    expect(result.iterations).toBe(THERMAL_FIXPOINT_MAX_ITERATIONS);
    expect(result.temperatureC).toBe(32);
    expect(result.deltaK).toBe(1);
  });

  it('Optionen überschreiben die Grenzen (enges Budget, weite Toleranz)', () => {
    const few = thermalFixpoint(100, (t) => 20 + 0.5 * (t - 20), { maxIterations: 3 });
    expect(few.converged).toBe(false);
    expect(few.iterations).toBe(3);

    const loose = thermalFixpoint(100, (t) => 20 + 0.5 * (t - 20), { toleranceK: 100 });
    expect(loose.converged).toBe(true);
    expect(loose.iterations).toBe(1);
  });

  it('Determinismus (R5): gleiche Eingabe ⇒ bitidentisches Ergebnis', () => {
    const step = (t: number): number => 20 + 0.9 * (t - 20);
    expect(thermalFixpoint(80, step)).toEqual(thermalFixpoint(80, step));
  });

  it('Eingabe-Guard: NaN-Start, kaputte Schrittfunktion, ungültige Optionen werfen', () => {
    expect(() => thermalFixpoint(Number.NaN, (t) => t)).toThrow(RangeError);
    expect(() => thermalFixpoint(20, () => Number.NaN)).toThrow(/Schritt 1/);
    expect(() => thermalFixpoint(20, (t) => t + 1, { maxIterations: 0 })).toThrow(RangeError);
    expect(() => thermalFixpoint(20, (t) => t + 1, { toleranceK: -1 })).toThrow(RangeError);
    expect(() => thermalFixpoint(20, (t) => t + 1, { toleranceK: Number.NaN })).toThrow(RangeError);
  });
});

describe('jouleHeatingStep — physikalische Schrittfunktion (Evaluierung)', () => {
  const params = {
    ambientC: 20,
    currentA: 10,
    lengthM: 1,
    crossSectionMm2: 6,
    thermalResistanceKPerW: 0.5,
    resistivityOhmMm2PerM: COPPER_RESISTIVITY_OHM_MM2_PER_M,
    temperatureCoefficientPerK: COPPER_TEMPERATURE_COEFFICIENT_PER_K,
  };

  it('konvergiert zu einem stabilen Arbeitspunkt knapp über der Umgebung', () => {
    const result = thermalFixpoint(params.ambientC, jouleHeatingStep(params));
    expect(result.converged).toBe(true);
    expect(result.temperatureC).toBeGreaterThan(params.ambientC);
    expect(result.temperatureC).toBeLessThan(params.ambientC + 1);
    expect(result.deltaK).toBeLessThanOrEqual(THERMAL_FIXPOINT_TOLERANCE_K);
  });

  it('Nullstrom und R_th = 0 ⇒ Umgebungstemperatur nach einem Schritt', () => {
    const cold = thermalFixpoint(35, jouleHeatingStep({ ...params, currentA: 0, ambientC: 20 }));
    // Schritt 1: 35 → 20 (Δ 15 K > Toleranz), Schritt 2: Fixpunkt erreicht.
    expect(cold).toEqual({ converged: true, iterations: 2, temperatureC: 20, deltaK: 0 });

    const isolated = thermalFixpoint(
      35,
      jouleHeatingStep({ ...params, thermalResistanceKPerW: 0, ambientC: 20 })
    );
    expect(isolated.converged).toBe(true);
    expect(isolated.temperatureC).toBe(20);
  });

  it('Widerstand wächst mit Temperatur (α > 0) — Punktbeleg der Kopplung', () => {
    const step = jouleHeatingStep(params);
    expect(step(60)).toBeGreaterThan(step(20)); // heißer ⇒ höherer R ⇒ mehr Anstieg
  });

  it('ungültige Modellparameter werfen (kein stiller Default)', () => {
    expect(() => jouleHeatingStep({ ...params, crossSectionMm2: 0 })).toThrow(RangeError);
    expect(() => jouleHeatingStep({ ...params, currentA: Number.NaN })).toThrow(RangeError);
    expect(() => jouleHeatingStep({ ...params, thermalResistanceKPerW: -1 })).toThrow(RangeError);
  });
});
