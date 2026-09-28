/**
 * Thermischer Fixpunkt — Mission Stufe 2 („Fixpoint ≤ 12 Iterationen /
 * 0,05 K").
 *
 * Aufgabe: Iterativ die Leitertemperatur $T$ suchen, bei der Vorgabe und
 * Ergebnis übereinstimmen ($T_{k+1} = f(T_k)$, z. B. Joule-Verlust ×
 * thermischer Widerstand über $R(T) = \rho_{20}(1 + \alpha (T - 20)) L / A$
 * — `copperResistanceRiseFactor` in `lib/materials.ts` liefert den
 * Widerstandsanteil). Die Modellparameter (Umgebung, $R_{th}$, Geometrie)
 * sind EINGABEN der Schrittfunktion — das Modul erfindet keine
 * Konstanten (Architektur-Gate).
 *
 * Mission Bounds (zitierfähig aus dem Missionstext, wie die Kill-Gate-
 * Grenzwerte): höchstens {@link THERMAL_FIXPOINT_MAX_ITERATIONS} Iterationen,
 * Konvergenz bei $|\Delta T| \le$ {@link THERMAL_FIXPOINT_TOLERANCE_K} K.
 *
 * Regel M (kein stiller Fallback): Keine Konvergenz ist ein AUSDRÜCKLICHES
 * Ergebnis (`converged: false` mit letzter Iteration/Δ) — niemals ein
 * „fertig aussehender" Temperaturwert. Schritt-Funktionen, die NaN/±∞
 * liefern, werfen (Defekt der Eingabe, nicht stillschweigend toleriert).
 *
 * Rein, deterministisch (R5): gleiche Eingabe ⇒ bitidentisches Ergebnis.
 * Aktueller Produktivkonsument: keiner (L3: „zunächst NUR Bewertung") —
 * die Evaluierung ruft das Modul auf, der Suchlauf-Anschluss folgt mit
 * begründetem Recapture in Stufe 3.
 */

/** Höchste Iterationszahl (MISSION Stufe 2). */
export const THERMAL_FIXPOINT_MAX_ITERATIONS = 12;

/** Konvergenz-Toleranz in Kelvin (MISSION Stufe 2). */
export const THERMAL_FIXPOINT_TOLERANCE_K = 0.05;

export type ThermalFixpointResult = {
  /** `true` gdw. Schrittänderung ≤ Toleranz innerhalb des Iterationsbudgets. */
  converged: boolean;
  /** Ausgeführte Schritte (≥ 1 bei leerer Konvergenzprüfung der ersten Differenz). */
  iterations: number;
  /** Letzter berechneter Temperaturwert (nach dem letzten Schritt). */
  temperatureC: number;
  /** Betrag der letzten Änderung |T_k − T_{k−1}|. */
  deltaK: number;
};

export type ThermalFixpointOptions = {
  maxIterations?: number;
  toleranceK?: number;
};

/**
 * Fixpunkt-Iteration $T_{k+1} = f(T_k)$ bis $|\Delta T| \le$ Toleranz
 * oder Budget-Erschöpfung.
 *
 * @throws RangeError bei ungültiger Starttemperatur, ungültigen Options-
 *   grenzen oder einer Schrittfunktion, die nicht endlich zurückgibt.
 */
export function thermalFixpoint(
  initialTempC: number,
  step: (temperatureC: number) => number,
  opts?: ThermalFixpointOptions
): ThermalFixpointResult {
  const maxIterations = opts?.maxIterations ?? THERMAL_FIXPOINT_MAX_ITERATIONS;
  const toleranceK = opts?.toleranceK ?? THERMAL_FIXPOINT_TOLERANCE_K;
  if (!Number.isFinite(initialTempC)) {
    throw new RangeError(`thermalFixpoint: Starttemperatur nicht endlich (${initialTempC})`);
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new RangeError(`thermalFixpoint: maxIterations muss ganze Zahl ≥ 1 sein (${maxIterations})`);
  }
  if (!Number.isFinite(toleranceK) || toleranceK < 0) {
    throw new RangeError(`thermalFixpoint: toleranceK ungültig (${toleranceK})`);
  }

  let current = initialTempC;
  let deltaK = Number.POSITIVE_INFINITY;
  let iterations = 0;
  while (iterations < maxIterations) {
    const next = step(current);
    if (!Number.isFinite(next)) {
      throw new RangeError(
        `thermalFixpoint: Schritt ${iterations + 1} lieferte nicht-endlichen Wert (${next})`
      );
    }
    iterations += 1;
    deltaK = Math.abs(next - current);
    current = next;
    if (deltaK <= toleranceK) {
      return { converged: true, iterations, temperatureC: current, deltaK };
    }
  }
  // Budget erschöpft — ausdrücklich NICHT konvergiert (Regel M).
  return { converged: false, iterations, temperatureC: current, deltaK };
}

/**
 * Joule-Schritt für die Evaluierung: $T \mapsto \vartheta_U + I^2 R(T)
 * R_{th}$ mit $R(T) = \rho_{20} (1 + \alpha (T - 20^\circ C)) \, L / A$
 * (`lib/materials.ts` — dieselben Konstanten wie die ΔU-Rechnung).
 *
 * Alle Parameter sind EINGABEN — keine erfundenen Defaults. Für
 * $I = 0$ oder $R_{th} = 0$ ist die Abbildung konstant (= Umgebung),
 * der Fixpunkt konvergiert in einem Schritt.
 */
export function jouleHeatingStep(params: {
  ambientC: number;
  currentA: number;
  lengthM: number;
  crossSectionMm2: number;
  thermalResistanceKPerW: number;
  /** ρ₂₀ in Ω·mm²/m (Modell: `COPPER_RESISTIVITY_OHM_MM2_PER_M`). */
  resistivityOhmMm2PerM: number;
  /** α in 1/K (Modell: `COPPER_TEMPERATURE_COEFFICIENT_PER_K`). */
  temperatureCoefficientPerK: number;
}): (temperatureC: number) => number {
  const {
    ambientC,
    currentA,
    lengthM,
    crossSectionMm2,
    thermalResistanceKPerW,
    resistivityOhmMm2PerM,
    temperatureCoefficientPerK,
  } = params;
  if (
    !Number.isFinite(ambientC) ||
    !Number.isFinite(currentA) ||
    !Number.isFinite(lengthM) ||
    !Number.isFinite(crossSectionMm2) ||
    crossSectionMm2 <= 0 ||
    !Number.isFinite(thermalResistanceKPerW) ||
    thermalResistanceKPerW < 0
  ) {
    throw new RangeError('jouleHeatingStep: ungültige Modellparameter');
  }
  return (temperatureC: number): number => {
    const resistance =
      (resistivityOhmMm2PerM * (1 + temperatureCoefficientPerK * (temperatureC - 20)) * lengthM) /
      crossSectionMm2;
    return ambientC + currentA * currentA * resistance * thermalResistanceKPerW;
  };
}
