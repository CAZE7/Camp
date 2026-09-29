/**
 * lib/verify/deviceClasses.ts — PRODUKTNORM-ZUORDNUNG DER SCHUTZORGANE.
 *
 * Für die Koordinationsbedingung **I₂ ≤ 1,45 · I_z** (IEC 60364-4-43 §433.1,
 * Bedingung 2) braucht die Engine den konventionellen Auslösestrom I₂. Die
 * Norm sagt dazu ausdrücklich: „The current I₂ ensuring effective operation of
 * the protective device shall be provided by the manufacturer or as given in
 * the product standard.“ Genau das setzt dieses Modul um:
 *
 *   | Produktklasse          | I₂        | Herkunft                                  |
 *   |------------------------|-----------|-------------------------------------------|
 *   | IEC 60269-1 gG         | 1,6 … 2,1 × In (stromabhängig) | Produktnorm  |
 *   | IEC 60898-1 LS-Schalter| 1,45 × In | Produktnorm                               |
 *   | ISO 8820-3 Kfz-Flachsicherung | 1,35 × In | Hersteller-Datenblatt/ISO-Prüfung |
 *   | Bolzensicherung (MIDI/MEGA/ANL/MRBF), Class T | NICHT BELEGT | Datenblatt nötig |
 *   | RCD                    | entfällt (kein Überstromschutz) | —                      |
 *
 * Die Zeile „NICHT BELEGT“ ist der wichtigste Teil dieser Tabelle: Für
 * Bolzen- und Class-T-Sicherungen gibt es in diesem Repo KEINE belegte
 * Produktnorm mit konventionellen Strömen. Die Engine meldet in diesem Fall
 * `UNPROVABLE` und verlangt den Datenblattwert — sie erfindet keinen Faktor.
 *
 * Quellen (Sekundärtranskriptionen der Produktnormen, geprüft 2026-09-29):
 *   - IEC 60269-1 konventionelle Ströme gG: Inf/If = 1,5/2,1 (In ≤ 4 A),
 *     1,5/1,9 (4 < In < 16 A), 1,25/1,6 (In ≥ 16 A) — Fig. H10 in
 *     electrical-installation.org (Schneider-Electrical-Installation-Guide,
 *     Tab. II/III der IEC 60269-1).
 *   - IEC 60898-1: konventioneller Auslösestrom 1,45 × In (großer Prüfstrom);
 *     Auslösebereiche B = 3–5 × In, C = 5–10 × In.
 *   - ISO 8820-3 (Blade): 110 % → 100 h ohne Auslösung, 135 % → Auslösung
 *     zwischen 0,75 s und 600 s (Datenblätter Eaton/Bussmann ATM-Serie,
 *     ISO 8820-3-konform).
 */

import {
  FUSE_BREAKING_CAPACITY_A,
  breakingCapacityAOf as breakingCapacityFromPlanTable,
  isFuseType,
  type FuseType,
} from '../shortCircuit';
import type { FuseDevice, FuseProductClass, McbDevice, ProtectionDevice, Provenance } from './types';

/** Produktnorm-Herkunft eines I₂-Werts. */
export interface ConventionalCurrent {
  /** Konventioneller Auslösestrom I₂ in A — `null` = nicht belegt. */
  i2A: number | null;
  /** I₂/In (nur gesetzt, wenn belegt). */
  ratio: number | null;
  /** Quelle im Klartext (geht in den Report). */
  source: string;
  provenance: Provenance;
  /** Handlungsanweisung, wenn nicht belegt. */
  remedy: string | null;
}

const GG_TABLE_SOURCE =
  'IEC 60269-1 (gG), konventionelle Ströme: 2,1 × In (In ≤ 4 A), 1,9 × In (4 < In < 16 A), 1,6 × In (In ≥ 16 A)';
const MCB_SOURCE = 'IEC 60898-1 (LS-Schalter), konventioneller Auslösestrom 1,45 × In';
const BLADE_SOURCE =
  'ISO 8820-3 / Hersteller-Datenblatt (Blade): 135 % × In löst in ≤ 600 s aus, 110 % × In über 100 h nicht';
const DATASHEET_REMEDY =
  'Konventionellen Auslösestrom I₂ (bzw. I²t-Kennlinie) des konkreten Produkts aus dem Datenblatt eintragen (Feld `i2A`).';

/** I₂/In der gG-Sicherung nach IEC 60269-1, stromabhängig. */
export function iec60269Ratio(ratedCurrentA: number): number {
  if (ratedCurrentA <= 4) return 2.1;
  if (ratedCurrentA < 16) return 1.9;
  return 1.6;
}

/**
 * Überstrom-Schutzorgane (Sicherung oder Leitungsschutzschalter).
 *
 * Der RCD gehört NICHT dazu: Er schützt nicht gegen Überlast, und die
 * §433.1-Ungleichungen sind auf ihn nicht anwendbar (`conventionalOperatingCurrentI2`).
 * Diese Union macht das im Typsystem sichtbar.
 */
export type OvercurrentProtectionDevice = FuseDevice | McbDevice;

/** Typprüfung: Ist das Organ ein Überstrom-Schutzorgan? */
export function isOvercurrentProtection(device: ProtectionDevice): device is OvercurrentProtectionDevice {
  return device.type === 'fuse' || device.type === 'mcb';
}

/** Ist die Produktklasse eine Sicherung (Überstromschutz)? */
export function isFuse(device: ProtectionDevice): boolean {
  return device.type === 'fuse';
}

/** Schützt das Organ gegen Überlast (I_z-Koordination nach §433.1)? */
export function providesOverloadProtection(device: ProtectionDevice): boolean {
  return device.type === 'fuse' || device.type === 'mcb';
}

/**
 * Konventioneller Auslösestrom I₂ eines Schutzorgans.
 *
 * Reihenfolge: Datenblattwert des konkreten Produkts schlägt die Produktnorm
 * (`VERIFIED_DATASHEET` vor `VERIFIED_NORM`); ist keiner von beiden belegt,
 * bleibt `i2A: null` und die Engine meldet UNPROVABLE.
 */
export function conventionalOperatingCurrentI2(device: ProtectionDevice): ConventionalCurrent {
  if (device.type === 'rcd') {
    return {
      i2A: null,
      ratio: null,
      source: 'RCD ist kein Überstromschutz — §433.1 ist auf ihn nicht anwendbar',
      provenance: 'DERIVED',
      remedy: null,
    };
  }

  const explicit = device.i2A;
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return {
      i2A: explicit,
      ratio: explicit / device.ratedCurrentA,
      source: 'Datenblattwert des konkreten Produkts (Feld `i2A`)',
      provenance: 'VERIFIED_DATASHEET',
      remedy: null,
    };
  }

  if (device.type === 'mcb') {
    return {
      i2A: 1.45 * device.ratedCurrentA,
      ratio: 1.45,
      source: MCB_SOURCE,
      provenance: 'VERIFIED_NORM',
      remedy: null,
    };
  }

  if (device.productClass === null) {
    // Bauform fehlt ⇒ keine Produktnorm benennbar. Der Rückgriff auf eine
    // Klasse (vorher 'bolt-down') war eine erfundene Zuordnung.
    return {
      i2A: null,
      ratio: null,
      source: 'Bauform (`fuseType`) nicht angegeben — keine Produktnorm benennbar',
      provenance: 'UNVERIFIED',
      remedy: DATASHEET_REMEDY,
    };
  }

  switch (device.productClass) {
    case 'iec60269-gg': {
      const ratio = iec60269Ratio(device.ratedCurrentA);
      return {
        i2A: ratio * device.ratedCurrentA,
        ratio,
        source: GG_TABLE_SOURCE,
        provenance: 'VERIFIED_NORM',
        remedy: null,
      };
    }
    case 'iso8820-blade':
      return {
        i2A: 1.35 * device.ratedCurrentA,
        ratio: 1.35,
        source: BLADE_SOURCE,
        provenance: 'VERIFIED_DATASHEET',
        remedy: null,
      };
    case 'bolt-down':
    case 'ul248-classT':
      return {
        i2A: null,
        ratio: null,
        source: `kein konventioneller Auslösestrom belegt (${device.productClass})`,
        provenance: 'UNVERIFIED',
        remedy: DATASHEET_REMEDY,
      };
    default: {
      const exhaustive: never = device.productClass;
      throw new RangeError(`conventionalOperatingCurrentI2: unbekannte Produktklasse ${String(exhaustive)}`);
    }
  }
}

/** Produktklasse der Planer-Bauform (`lib/shortCircuit.ts` FUSE_TYPES). */
export function productClassOfFuseType(variant: FuseType): FuseProductClass {
  if (variant === 'ato') return 'iso8820-blade';
  if (variant === 'classT') return 'ul248-classT';
  if (variant === 'midi' || variant === 'mega' || variant === 'anl' || variant === 'mrbf') return 'bolt-down';
  const exhaustive: never = variant;
  throw new RangeError(`productClassOfFuseType: unbekannte Bauform ${String(exhaustive)}`);
}

/**
 * Wirksames Abschaltvermögen (A) eines Schutzorgans.
 *
 * Reihenfolge: explizites Datenblattfeld → Bauform-Tabelle des Planers
 * (`lib/shortCircuit.ts`, Hersteller-Ankerwerte) → `null` (= nicht bewertbar).
 * Der MRBF-Korridor ist spannungsabhängig und wird übergeben.
 */
export function breakingCapacityOf(device: ProtectionDevice, systemVoltageV?: number): number | null {
  if (device.type === 'rcd') return null;
  if (device.type === 'mcb') {
    const kA = device.breakingCapacityKA;
    return typeof kA === 'number' && Number.isFinite(kA) && kA > 0 ? kA * 1000 : null;
  }
  const repoType: FuseType | null = device.variant && isFuseType(device.variant) ? device.variant : null;
  if (repoType === null && typeof device.breakingCapacityA !== 'number') {
    // Ohne Bauform ist der Tabellenwert nicht zuordenbar — der kleinste
    // Tabellenwert wäre eine erfundene Zusage, deshalb `null`.
    return null;
  }
  return breakingCapacityFromPlanTable(repoType, device.breakingCapacityA, systemVoltageV);
}

/** Abschaltvermögen der reinen Bauform-Tabelle (Reportzwecke/Doku). */
export function tableBreakingCapacityA(variant: FuseType): number {
  return FUSE_BREAKING_CAPACITY_A[variant];
}

/** Kurzbezeichnung eines Schutzorgans (Meldungen, Report). */
export function describeDevice(device: ProtectionDevice): string {
  if (device.type === 'fuse') {
    const variant = device.variant ? ` ${device.variant}` : '';
    return `Sicherung ${device.ratedCurrentA} A (${device.productClass ?? 'Bauform nicht angegeben'}${variant})`;
  }
  if (device.type === 'mcb') {
    return `LS-Schalter ${device.characteristic}${device.ratedCurrentA}${device.poles ? `, ${device.poles}-polig` : ''}`;
  }
  const iDelta = device.ratedResidualCurrentA * 1000;
  return `RCD Typ ${device.residualType} ${iDelta} mA${device.selective ? ' (selektiv)' : ''}${
    device.poles ? `, ${device.poles}-polig` : ''
  }`;
}
