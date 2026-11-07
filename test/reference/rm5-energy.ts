/**
 * test/reference/rm5-energy.ts — REFERENZMODELL 5: Kapazität, Peukert, Solar.
 *
 * Zweck
 * =====
 * Unabhängige Nachrechnung der Energie- und Ertragskette:
 *   - Batteriekapazität aus Tagesbedarf, Autarkie und Entladetiefe,
 *   - Peukert-Korrektur der nutzbaren Kapazität,
 *   - Ladestrom im Ladefenster,
 *   - Solarstrom eines Moduls (I_mp, I_sc) und der Sicherungsboden 1,5625·I_sc.
 *
 * Kein Import aus `lib/batterySizing.ts`, `lib/peukert.ts`, `lib/solar.ts`.
 *
 * Mathematische Definition
 * ------------------------
 *     E_nutz   = P_Tag · d                              [Wh]
 *     C_nom    = E_nutz / (U · DoD)                     [Ah]
 *     C_nom,Res= C_nom · (1 + r/100)
 *     C_Empf   = ceil(C_nom,Res / 5 Ah) · 5 Ah
 *     k_Faktor = min(1, (I_20 / I)^(k − 1)),  I_20 = C/20
 *     C_nutz   = C_Empf · DoD · k_Faktor                [Ah]
 *     I_Laden  = (P_Tag / (U · h_Fenster)) · f_Ladereserve
 *     I_mp     = P_Panel / U_MPP                        [A]
 *     I_sc     = Datenblatt, sonst 1,25 · I_mp          [A]
 *     I_Design = max(I_mp, 1,25 · I_sc)                 [A]
 *     I_Sicherung,min = 1,5625 · I_sc                   [A]
 *
 * Einheiten
 * ---------
 * Wh, Ah, V, A, h, W; Exponent k und Faktoren dimensionslos.
 *
 * Gültigkeitsbereich
 * ------------------
 * - Ein Batterieblock, eine Chemie, konstante Entladetiefe.
 * - Peukert nur für I > I_20 (darunter ist der Faktor 1; die Formel würde
 *   sonst > 1 liefern und Kapazität „gewinnen“).
 * - Modul mit 18 V MPP-Spannung (12-V-Systempanel).
 *
 * Bekannte Grenzen
 * ----------------
 * - **Peukert-Exponenten sind Chemie-Faustwerte (UNVERIFIED).** 1,05 / 1,12 /
 *   1,15 sind Größenordnungen aus der Literatur, keine Datenblattwerte des
 *   konkreten Blocks. Ein Datenblattwert schlägt sie.
 * - Keine Alterung, keine Temperaturwirkung auf die Kapazität, keine
 *   Zyklenzahl — das Repo modelliert das ausdrücklich nicht, und dieses Modell
 *   erfindet es nicht dazu.
 * - Die Entladetiefe je Chemie ist ein Planungswert, kein Garantiewert des
 *   Herstellers.
 * - `1,25` (I_sc-Schätzung aus I_mp) und `1,5625` (Sicherungsboden) sind
 *   **MODELLANNAHMEN**. Für 1,5625 wird landläufig NEC §690.9 angeführt; die
 *   IEC-Seite (60364-7-712) ist im Repo **nicht** belegt. Der Faktor steht
 *   deshalb hier als Modellwert, nicht als Normzitat.
 *
 * Quellen
 * -------
 * - Peukert-Gleichung: Wilhelm Peukert, 1897 — **physikalische Gleichung**,
 *   die Exponenten sind empirisch je Zelle.
 * - DoD-Werte: Planungspraxis je Chemie — **MODELLANNAHME**.
 * - 5-Ah-Raster: Marktüblichkeit (Baugrößen), **MODELLANNAHME**.
 *
 * Abweichungstoleranz
 * -------------------
 * Exakt (≤ 1e-9 relativ) gegenüber `sizeBattery`, `peukertCapacityFactor` und
 * den Solarfunktionen bei gleichen Eingaben.
 */

/** Entladetiefe je Chemie (0…1) — Planungswert, kein Garantiewert. */
export const REF_DOD: Readonly<Record<string, number>> = {
  LiFePO4: 0.9,
  AGM: 0.5,
  Gel: 0.5,
  Blei: 0.3,
};

/** Peukert-Exponent je Chemie — Chemie-Faustwert (UNVERIFIED). */
export const REF_PEUKERT_K: Readonly<Record<string, number>> = {
  LiFePO4: 1.05,
  AGM: 1.12,
  Gel: 1.15,
  Blei: 1.15,
};

/** Ladestrom-Reserve des Modells (Ladezeit-Aufschlag). */
export const REF_CHARGE_DERATING_FACTOR = 1.15;

/** Kapazitätsraster [Ah]. */
export const REF_CAPACITY_STEP_AH = 5;

/** MPP-Spannung eines 12-V-Systempanels [V]. */
export const REF_SOLAR_VMP_V = 18;

/** I_sc-Schätzung aus I_mp — MODELLANNAHME. */
export const REF_SOLAR_ISC_FALLBACK = 1.25;

/** Thermischer Solar-Leitungsstrom-Faktor — MODELLANNAHME. */
export const REF_SOLAR_CABLE_ISC_FACTOR = 1.25;

/** Sicherungsboden-Faktor — MODELLANNAHME (NEC-nah, IEC nicht belegt). */
export const REF_SOLAR_FUSE_ISC_FACTOR = 1.5625;

/** Peukert-Faktor min(1, (I_20/I)^(k−1)); 1 wenn keine Reduktion. */
export function refPeukertFactor(capacity20hAh: number, currentA: number, k: number): number {
  if (!(capacity20hAh > 0) || !(currentA > 0) || !(k >= 1)) return 1;
  const referenceCurrent = capacity20hAh / 20;
  if (currentA <= referenceCurrent) return 1;
  return Math.min(1, Math.pow(referenceCurrent / currentA, k - 1));
}

export interface RefBatteryInput {
  dailyEnergyWh: number;
  autonomyDays: number;
  systemVoltageV: number;
  chemistry: string;
  reservePercent?: number;
  referenceCurrentA?: number;
  chargeWindowHours?: number;
  /** Expliziter Peukert-Exponent (Datenblatt) schlägt den Chemie-Anker. */
  peukertExponent?: number;
}

export interface RefBatteryResult {
  requiredUsableWh: number;
  dodFraction: number;
  requiredNominalAh: number;
  requiredNominalWithReserveAh: number;
  recommendedNominalAh: number;
  peukertFactor: number;
  usableAh: number;
  chargeCurrentA: number;
}

/**
 * Kapazitätsbemessung inklusive Peukert und Ladestrom.
 *
 * @throws RangeError bei nicht-positiven Eingaben, unbekannter Chemie oder
 *   Reserve außerhalb 0…50 % — ein geratener Wert wäre keine Bemessung.
 */
export function refSizeBattery(input: RefBatteryInput): RefBatteryResult {
  const {
    dailyEnergyWh,
    autonomyDays,
    systemVoltageV,
    chemistry,
    reservePercent = 0,
    chargeWindowHours = 5,
  } = input;

  if (!(dailyEnergyWh > 0)) throw new RangeError(`refSizeBattery: Tagesbedarf > 0 (${dailyEnergyWh})`);
  if (!(autonomyDays > 0)) throw new RangeError(`refSizeBattery: Autarkietage > 0 (${autonomyDays})`);
  if (!(systemVoltageV > 0)) throw new RangeError(`refSizeBattery: Systemspannung > 0 (${systemVoltageV})`);
  if (!(chargeWindowHours > 0))
    throw new RangeError(`refSizeBattery: Ladefenster > 0 (${chargeWindowHours})`);
  if (!(reservePercent >= 0 && reservePercent <= 50)) {
    throw new RangeError(`refSizeBattery: Reserve 0…50 % (${reservePercent})`);
  }

  const dodFraction = REF_DOD[chemistry];
  if (dodFraction === undefined) {
    throw new RangeError(`refSizeBattery: unbekannte Chemie „${chemistry}“`);
  }

  const requiredUsableWh = dailyEnergyWh * autonomyDays;
  const requiredNominalAh = requiredUsableWh / (systemVoltageV * dodFraction);
  const requiredNominalWithReserveAh = requiredNominalAh * (1 + reservePercent / 100);
  const recommendedNominalAh =
    Math.ceil(requiredNominalWithReserveAh / REF_CAPACITY_STEP_AH) * REF_CAPACITY_STEP_AH;

  const averageCurrentA =
    input.referenceCurrentA !== undefined && input.referenceCurrentA > 0
      ? input.referenceCurrentA
      : dailyEnergyWh / systemVoltageV / 24;

  const k = input.peukertExponent ?? REF_PEUKERT_K[chemistry] ?? REF_PEUKERT_K['LiFePO4']!;
  const peukertFactor = refPeukertFactor(recommendedNominalAh, averageCurrentA, k);
  const chargeCurrentA = (dailyEnergyWh / (systemVoltageV * chargeWindowHours)) * REF_CHARGE_DERATING_FACTOR;

  return {
    requiredUsableWh,
    dodFraction,
    requiredNominalAh,
    requiredNominalWithReserveAh,
    recommendedNominalAh,
    peukertFactor,
    usableAh: recommendedNominalAh * dodFraction * peukertFactor,
    chargeCurrentA,
  };
}

/** I_mp = P / 18 V [A]. */
export function refSolarImp(watts: number): number {
  return watts / REF_SOLAR_VMP_V;
}

/** I_sc: Datenblatt, sonst 1,25 · I_mp [A]. */
export function refSolarIsc(watts: number, iscFromDatasheet?: number): number {
  return iscFromDatasheet !== undefined && iscFromDatasheet > 0
    ? iscFromDatasheet
    : refSolarImp(watts) * REF_SOLAR_ISC_FALLBACK;
}

/** Thermischer Leitungsstrom der Panel-Zuleitung [A]. */
export function refSolarDesignCurrent(watts: number, iscFromDatasheet?: number): number {
  return Math.max(refSolarImp(watts), refSolarIsc(watts, iscFromDatasheet) * REF_SOLAR_CABLE_ISC_FACTOR);
}

/** Mindest-Sicherungsstrom der Panel-Zuleitung [A]. */
export function refSolarFuseFloor(watts: number, iscFromDatasheet?: number): number {
  return refSolarIsc(watts, iscFromDatasheet) * REF_SOLAR_FUSE_ISC_FACTOR;
}

/**
 * Kalte Leerlaufspannung eines Moduls bei Auslegungs-Mindesttemperatur [V]:
 * `U_oc(T) = U_oc,STC · (1 + TK · (T − 25 °C))` mit TK < 0.
 *
 * @throws RangeError bei positivem TK — ein Modul, dessen Spannung in der Kälte
 *   STEIGT, gibt es bei c-Si nicht; ein solcher Wert ist ein Eingabefehler.
 */
export function refColdVoc(input: {
  vocStcV: number;
  tempCoeffPerKelvin: number;
  designMinTemperatureC: number;
  stcTemperatureC?: number;
}): number {
  const stc = input.stcTemperatureC ?? 25;
  if (!(input.tempCoeffPerKelvin < 0)) {
    throw new RangeError(`refColdVoc: TK muss negativ sein (${input.tempCoeffPerKelvin})`);
  }
  return input.vocStcV * (1 + input.tempCoeffPerKelvin * (input.designMinTemperatureC - stc));
}
