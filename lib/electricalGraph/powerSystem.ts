/**
 * lib/electricalGraph/powerSystem.ts — SPANNUNGSEBENEN 12 V / 24 V / 48 V.
 *
 * Befund V2-VOLT-001: Die Engine rechnete zwar mit `getSystemVoltage`
 * (lib/vde-standards.ts) und respektierte eine eingetragene
 * `nominalVoltage` — aber nirgends existierte der BEGRIFF einer
 * Spannungsebene. Folgen:
 *
 *   - Ein 24-V-Wechselrichter an einer 12-V-Bank fiel erst in der
 *     Strom-/Querschnittsrechnung auf (als „zu hoher Strom"), nicht als das,
 *     was er ist: ein inkompatibles Bauteil.
 *   - 48 V war schlicht nicht aussprechbar; jeder Default hieß „12".
 *
 * Diese Datei gibt der Ebene einen Namen, ein Fenster und eine
 * Vergleichsoperation. Sie rechnet NICHT — Ströme, Querschnitte und
 * Sicherungen bleiben in `lib/electrical.ts` / `lib/vde-standards.ts`
 * (eine Quelle, AGENTS.md §4.2).
 *
 * MODELLANNAHME (keine Normkopie): Die Klassengrenzen unten sind die in der
 * Fahrzeug-/Marinepraxis üblichen Bordnetzebenen. Sie sind so breit gewählt,
 * dass sowohl Blei (12,0 / 24,0 / 48,0 V nominal) als auch LiFePO4
 * (12,8 / 25,6 / 51,2 V) und die zugehörigen Ladeschlussspannungen
 * (14,6 / 29,2 / 58,4 V) in ihre Klasse fallen — und schmal genug, dass
 * benachbarte Ebenen sich nicht überlappen.
 */

import { volts, type Volts } from '../units';

/** Bordnetz-Spannungsebene. `unknown` ist ein Zustand, kein Default. */
export type SystemVoltageClass = '12V' | '24V' | '48V' | 'unknown';

/** Alle modellierten Ebenen, aufsteigend. */
export const SYSTEM_VOLTAGE_CLASSES: readonly Exclude<SystemVoltageClass, 'unknown'>[] = [
  '12V',
  '24V',
  '48V',
];

/**
 * Fenster je Ebene (inklusiv unten, exklusiv oben) in Volt.
 * 10 … 18 … 36 … 72 — s. Modellannahme im Kopf dieser Datei.
 */
export const SYSTEM_VOLTAGE_WINDOWS: Readonly<
  Record<Exclude<SystemVoltageClass, 'unknown'>, { min: Volts; max: Volts }>
> = {
  '12V': { min: volts(10), max: volts(18) },
  '24V': { min: volts(18), max: volts(36) },
  '48V': { min: volts(36), max: volts(72) },
};

/** Zellzahl-Verhältnis zur 12-V-Ebene — Grundlage von `scaleToClass`. */
const CLASS_FACTOR: Readonly<Record<Exclude<SystemVoltageClass, 'unknown'>, number>> = {
  '12V': 1,
  '24V': 2,
  '48V': 4,
};

/**
 * Ebene einer gemessenen/eingetragenen Spannung.
 * Außerhalb aller Fenster ⇒ `'unknown'` — ausdrücklich KEIN Rückfall auf 12 V
 * (Regel M: kein stiller Fallback).
 */
export function classifySystemVoltage(value: Volts): SystemVoltageClass {
  if (!Number.isFinite(value)) return 'unknown';
  for (const cls of SYSTEM_VOLTAGE_CLASSES) {
    const window = SYSTEM_VOLTAGE_WINDOWS[cls];
    if (value >= window.min && value < window.max) return cls;
  }
  return 'unknown';
}

/**
 * Nennspannung einer Ebene für eine Chemie.
 * `lifepo4` ⇒ 12,8 / 25,6 / 51,2 V; alles andere ⇒ 12 / 24 / 48 V.
 * (Die Chemie-Normalisierung liegt in `lib/autoWire/primitives.ts` —
 * hier wird der bereits normalisierte Schlüssel erwartet.)
 */
export function nominalVoltageOfClass(
  cls: Exclude<SystemVoltageClass, 'unknown'>,
  chemistryKey?: string
): Volts {
  const base = chemistryKey === 'lifepo4' || chemistryKey === 'liion' ? 12.8 : 12;
  return volts(base * CLASS_FACTOR[cls]);
}

/**
 * Skaliert eine 12-V-Bezugsgröße auf die Ebene — z. B. die
 * Entladeschlussspannung oder ein Spannungsfall-Budget.
 */
export const scaleToClass = (value: Volts, cls: Exclude<SystemVoltageClass, 'unknown'>): Volts =>
  volts(value * CLASS_FACTOR[cls]);

/** Ergebnis einer Spannungsprüfung — `ok: false` nennt immer einen Grund. */
export type VoltageCompatibility =
  | { ok: true; cls: SystemVoltageClass }
  | { ok: false; cls: SystemVoltageClass; reason: VoltageMismatchReason; detail: string };

export type VoltageMismatchReason =
  /** Bauteil und System liegen in verschiedenen Bordnetzebenen. */
  | 'class-mismatch'
  /** Systemspannung unterschreitet die Mindestspannung des Bauteils. */
  | 'below-min'
  /** Systemspannung überschreitet die Höchstspannung des Bauteils. */
  | 'above-max'
  /** Spannung liegt in keiner modellierten Ebene. */
  | 'unknown-class';

/** Spannungsfenster eines Bauteils (Teilmenge von `ComponentConstraints`). */
export type VoltageWindow = {
  minVoltage?: Volts | undefined;
  maxVoltage?: Volts | undefined;
  /** Ausdrücklich deklarierte Ebene (z. B. „24-V-Wechselrichter"). */
  voltageClass?: SystemVoltageClass | undefined;
};

/**
 * Passt ein Bauteil an diese Systemspannung?
 *
 * Reihenfolge: deklarierte Ebene → min → max. Fehlende Angaben werden NICHT
 * erfunden: Ein Bauteil ohne Fenster und ohne Ebene ist kompatibel, weil die
 * Datenlage keine Aussage hergibt — das ist ein bewusster, dokumentierter
 * Unterschied zu „geprüft in Ordnung" (die Verifikationsebene führt dafür
 * `UNPROVABLE`, s. lib/verify/types.ts).
 */
export function checkVoltageCompatibility(
  component: VoltageWindow,
  systemVoltage: Volts
): VoltageCompatibility {
  const cls = classifySystemVoltage(systemVoltage);

  if (component.voltageClass && component.voltageClass !== 'unknown') {
    if (cls === 'unknown') {
      return {
        ok: false,
        cls,
        reason: 'unknown-class',
        detail: `Systemspannung ${systemVoltage} V liegt in keiner modellierten Ebene (12 V / 24 V / 48 V).`,
      };
    }
    if (component.voltageClass !== cls) {
      return {
        ok: false,
        cls,
        reason: 'class-mismatch',
        detail: `Bauteil ist für ${component.voltageClass} ausgelegt, das System läuft auf ${cls}.`,
      };
    }
  }

  if (component.minVoltage !== undefined && systemVoltage < component.minVoltage) {
    return {
      ok: false,
      cls,
      reason: 'below-min',
      detail: `Systemspannung ${systemVoltage} V unterschreitet die Mindestspannung ${component.minVoltage} V.`,
    };
  }

  if (component.maxVoltage !== undefined && systemVoltage > component.maxVoltage) {
    return {
      ok: false,
      cls,
      reason: 'above-max',
      detail: `Systemspannung ${systemVoltage} V überschreitet die Höchstspannung ${component.maxVoltage} V.`,
    };
  }

  return { ok: true, cls };
}
