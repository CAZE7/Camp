/**
 * lib/verify/context.ts — Eingabe-Rahmen der Verifikations-Pipeline.
 *
 * Hier stehen die **Annahmen**, mit denen die Engine rechnet, an EINER Stelle.
 * Der Unterschied zu einem stillen Default ist die Reportpflicht: jede Annahme
 * dieses Moduls wird über `assumptionStatements` in `VerificationReport.
 * limitations` ausgewiesen. Ein Bericht, der mit 30 °C Umgebung rechnet und das
 * nicht sagt, wäre genau die stille Behauptung, die Regel M verbietet.
 *
 * Alle Werte sind überschreibbar; die Voreinstellungen entsprechen den
 * Referenzbedingungen der Tabellenwerte (`VDE_AMPACITY`, 30 °C Luft) und der
 * konservativen Leiter-Betriebstemperatur (70 °C PVC) aus `physics.ts`.
 */

import type { Node } from '../domain/graph';

import type { PlanEdge } from './graph';
import { MAX_CONDUCTOR_TEMPERATURE_C, REFERENCE_AMBIENT_C } from './physics';
import type { InsulationClass } from './physics';
import { isVerificationProfile } from './rules';
import {
  INSTALLATION_CONTEXTS,
  type ConductionGraph,
  type InstallationContext,
  type VerificationProfile,
} from './types';

/**
 * Umgebungs- und Verlegebedingungen des Laufs.
 *
 * Bewusst NICHT `AmpacityConditions` (den Namen belegt `physics.ts` für die
 * Eingabe der einzelnen I_z-Rechnung); diese Form beschreibt die ANNAHMEN des
 * gesamten Laufs, aus denen je Kante eine physikalische Eingabe wird.
 */
export interface RunConditions {
  /** Umgebungstemperatur in °C. */
  ambientC: number;
  /** Isolierstoff der Leitung (bestimmt die Grenzleitertemperatur). */
  insulation: InsulationClass;
  /** Anzahl belasteter Stromkreise in derselben Trasse (1 = keine Häufung). */
  bundledCircuits: number;
}

/** Optionen eines Verifikationslaufs. */
export interface VerificationOptions {
  /** Regelprofil (Filter über die Herkunft der Anforderung). */
  profile: VerificationProfile;
  /** Installationskontext (Fahrzeug, Marine, stationär). */
  context: InstallationContext;
  /** Umgebungsbedingungen — gelten für alle Kanten ohne eigene Angabe. */
  ampacity: RunConditions;
  /** Häufung je Kante (`edgeId` → Anzahl Stromkreise), überschreibt `ampacity`. */
  bundlingByEdge: Readonly<Record<string, number>>;
  /** Leiter-Betriebstemperatur der ΔU-Rechnung in °C. */
  voltageDropTemperatureC: number;
  /**
   * Referenzstrom der Peukert-Rechnung (PWR-001) in A.
   * `null` = `C_20 / 20 h` (die Referenz der Peukert-Formel selbst).
   */
  energyReferenceCurrentA: number | null;
  /**
   * Tagesenergie, die der Plan zusätzlich decken muss (Wh) — z. B. aus einer
   * Bedarfsrechnung. `null` = nur die Geräte des Plans zählen.
   */
  additionalDailyEnergyWh: number | null;
}

/** Voreinstellungen: Tabellenreferenz + konservativer Betriebspunkt. */
export const DEFAULT_VERIFICATION_OPTIONS: Readonly<VerificationOptions> = Object.freeze({
  profile: 'NORM_CORE',
  context: 'VEHICLE',
  ampacity: Object.freeze({
    ambientC: REFERENCE_AMBIENT_C,
    insulation: 'PVC',
    bundledCircuits: 1,
  }),
  bundlingByEdge: Object.freeze({}),
  voltageDropTemperatureC: MAX_CONDUCTOR_TEMPERATURE_C.PVC,
  energyReferenceCurrentA: null,
  additionalDailyEnergyWh: null,
});

/**
 * Erzeugt vollständige Optionen aus Teilangaben.
 *
 * @throws RangeError bei unplausiblen Werten — die Engine rechnet nicht mit
 *   einer Umgebungstemperatur oberhalb der Grenzleitertemperatur und nicht mit
 *   einer Häufung < 1 weiter, als wäre nichts.
 */
export function verificationOptions(overrides: Partial<VerificationOptions> = {}): VerificationOptions {
  const merged: VerificationOptions = {
    ...DEFAULT_VERIFICATION_OPTIONS,
    ...overrides,
    ampacity: { ...DEFAULT_VERIFICATION_OPTIONS.ampacity, ...(overrides.ampacity ?? {}) },
    bundlingByEdge: overrides.bundlingByEdge ?? DEFAULT_VERIFICATION_OPTIONS.bundlingByEdge,
  };
  // Profil und Kontext sind geschlossene Wertemengen. Ein Tippfehler darf
  // NICHT zu »keine Regel angewandt« führen: eine leere Regelliste wäre ein
  // grünes Zertifikat ohne Prüfung — genau der stille Fallback, den Regel M
  // verbietet. Deshalb hier hart abbrechen statt weiterrechnen.
  if (!isVerificationProfile(merged.profile)) {
    throw new RangeError(
      `verificationOptions: unbekanntes Regelprofil „${String(merged.profile)}“ — zulässig: NORM_CORE, CAMP_MODEL, PRACTICE`
    );
  }
  if (!(INSTALLATION_CONTEXTS as readonly string[]).includes(merged.context)) {
    throw new RangeError(
      `verificationOptions: unbekannter Installationskontext „${String(merged.context)}“ — zulässig: ${INSTALLATION_CONTEXTS.join(', ')}`
    );
  }
  const tMax = MAX_CONDUCTOR_TEMPERATURE_C[merged.ampacity.insulation];
  if (!Number.isFinite(merged.ampacity.ambientC) || merged.ampacity.ambientC >= tMax) {
    throw new RangeError(
      `verificationOptions: Umgebungstemperatur ${merged.ampacity.ambientC} °C ist für ${merged.ampacity.insulation} (T_max ${tMax} °C) unzulässig`
    );
  }
  if (!(merged.ampacity.bundledCircuits >= 1)) {
    throw new RangeError(
      `verificationOptions: Häufung muss ≥ 1 Stromkreis sein (erhielt ${merged.ampacity.bundledCircuits})`
    );
  }
  if (!(merged.voltageDropTemperatureC > 0) || merged.voltageDropTemperatureC >= 200) {
    throw new RangeError(
      `verificationOptions: Leiter-Betriebstemperatur ${merged.voltageDropTemperatureC} °C ist unplausibel`
    );
  }
  return merged;
}

/** Kontext eines Passes: Plan, Modell und Annahmen. */
export interface PassContext {
  /** Plan-Knoten (Originalform — einige Prüfungen brauchen `node.data`). */
  nodes: readonly Node[];
  /** Plan-Kanten (Originalform). */
  edges: readonly PlanEdge[];
  /** Übersetztes Modell. */
  graph: ConductionGraph;
  /** Annahmen und Profil des Laufs. */
  options: VerificationOptions;
}

/** Häufung einer Kante: kantenspezifisch, sonst die globale Annahme. */
export function bundledCircuitsFor(context: PassContext, edgeId: string): number {
  const explicit = context.options.bundlingByEdge[edgeId];
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 1) return explicit;
  return context.options.ampacity.bundledCircuits;
}

/**
 * Klartext der Annahmen für den Report (`VerificationReport.limitations`).
 * Nie leer — jeder Lauf nennt seine Rechengrundlage.
 */
export function assumptionStatements(options: VerificationOptions): string[] {
  const statements = [
    `Umgebungstemperatur ${options.ampacity.ambientC} °C, Isolierstoff ${options.ampacity.insulation}, Häufung ${options.ampacity.bundledCircuits} Stromkreis(e) — Vorgabe des Laufs, nicht je Kabel gemessen.`,
    `Spannungsfall mit Leiter-Betriebstemperatur ${options.voltageDropTemperatureC} °C (konservativ gegen den kalten 20-°C-Wert der Dimensionierung).`,
  ];
  if (options.ampacity.bundledCircuits > 1 || Object.keys(options.bundlingByEdge).length > 0) {
    statements.push(
      'Häufungsfaktoren setzen gleichartige, gleichzeitig belastete Stromkreise in einer gemeinsamen Trasse voraus (VDE_GROUP_FACTORS-Transkription).'
    );
  }
  if (options.additionalDailyEnergyWh !== null) {
    statements.push(
      `Zusätzlicher Tagesbedarf ${options.additionalDailyEnergyWh} Wh wurde der Energiebilanz hinzugerechnet (Angabe des Aufrufers).`
    );
  }
  return statements;
}
