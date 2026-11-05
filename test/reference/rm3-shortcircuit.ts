/**
 * test/reference/rm3-shortcircuit.ts — REFERENZMODELL 3: Kurzschlussstrom und
 * Abschaltvermögen einer Batteriebank.
 *
 * Zweck
 * =====
 * Unabhängige Nachrechnung von
 *   - Block-Innenwiderstand R_i aus Nennkapazität und Chemie,
 *   - Ersatzwiderstand der Parallelschaltung,
 *   - Kurzschlussstrom an den Polklemmen und am Sicherungseinbauort,
 *   - Vergleich mit dem Abschaltvermögen des Schutzorgans.
 *
 * **Zusätzlich prüft dieses Modell eine Eigenschaft, die die Produktivfunktion
 * heute verletzt: Repräsentationsinvarianz.** Der Kurzschlussstrom einer Bank
 * darf von der Reihenfolge der Batterieknoten nicht abhängen. Genau das ist
 * Befund K-3 (I-E-11) — hier wird er reproduzierbar.
 *
 * Mathematische Definition
 * ------------------------
 *     R_i,Block = (ρ_100Ah / C_nominal) · 100          [mΩ]   (lineare Skalierung)
 *     1/R_i,Bank = Σ 1/R_i,Block                        [mΩ]
 *     I_k,Pol   = U_Bank / (R_i,Bank / 1000)            [A]
 *     R_Leitung = k · L · ρ_Cu(20 °C) / A               [Ω]    (k = 2)
 *     I_k,Sicherung = U_Bank / (R_i,Bank/1000 + R_Leitung)
 *
 * Einheiten
 * ---------
 * R [mΩ] bzw. [Ω], C [Ah], U [V], I [A], L [m], A [mm²].
 *
 * Gültigkeitsbereich
 * ------------------
 * - Alle Blöcke einer Bank haben **dieselbe** Nennspannung. Eine Bank aus
 *   12,8 V-LiFePO4 und 12,0 V-AGM parallel ist elektrisch keine Bank, sondern
 *   ein Ausgleichsstrom-Kreis; für sie gibt es hier bewusst KEIN Ergebnis.
 * - Temperatur 20 °C (die Produktivwerte sind ebenfalls 20-°C-Anker).
 * - Reine Parallelschaltung, keine Kabel zwischen den Blöcken.
 *
 * Bekannte Grenzen — ausdrücklich
 * -------------------------------
 * Das ist die wichtigste Aussage dieses Moduls: **Der Kurzschlussstrom ist eine
 * Schätzung, kein Messwert.** Er hängt an R_i, und R_i ist ein Chemie-Anker
 * (3 mΩ/100 Ah LiFePO4, 5 AGM, 6 Gel/Blei), nicht ein Datenblattwert des
 * konkreten Blocks. Der Fehler kann leicht ±30 % betragen. Deshalb:
 *   - Ein Datenblatt-R_i schlägt den Anker (das Produktivmodell kann das,
 *     dieses Modell bildet nur den Anker nach).
 *   - Das Abschaltvermögen wird gegen ein 6-kA/10-kA-Raster geprüft, nicht
 *     gegen einen gemessenen prospektiven Strom.
 *   - 20 °C ist der ungünstigste Fall für R_i (warm ⇒ größer ⇒ I_k kleiner);
 *     der kalte Wert ist damit die **obere** Schranke — konservativ für die
 *     Abschaltvermögensprüfung, NICHT konservativ für die Selektivität.
 *
 * Quellen
 * -------
 * - R_i-Anker: CAMP-Modellwerte (`BATTERY_RI_MILLIOHM_AT_100AH`), abgeleitet
 *   aus Hersteller-Datenblättern üblicher Bauformen. Status:
 *   **MODELLANNAHME / Herstellerdaten-Mittel**, kein Normwert.
 * - Abschaltvermögen-Raster 6 kA / 10 kA: IEC 60898-1. **Normbeleg.**
 * - ρ_Cu(20 °C) = 0,0175 Ω·mm²/m: Materialwert (s. RM-1).
 *
 * Abweichungstoleranz
 * -------------------
 * Exakt (≤ 1e-9 relativ) gegenüber `bankEquivalentRiMilliOhm` und
 * `batteryShortCircuitCurrentA` des Produktivmodells, **solange die Bank
 * gleichspannig ist**. Bei gemischten Nennspannungen liefert dieses Modell
 * `null` (nicht schätzbar) — dort ist eine Abweichung kein Fehler, sondern der
 * Befund.
 */

/** R_i-Anker je 100 Ah [mΩ] — CAMP-Modellwerte, erneut deklariert. */
export const REF_RI_100AH: Readonly<Record<string, number>> = {
  LiFePO4: 3,
  AGM: 5,
  Gel: 6,
  Blei: 6,
};

/** Materialwert Kupfer [Ω·mm²/m] bei 20 °C. */
export const REF_RHO_CU = 0.0175;

/** Abschaltvermögen-Raster nach IEC 60898-1 [kA]. */
export const REF_BREAKING_CAPACITY_KA: readonly number[] = [6, 10];

export interface RefBatteryBlock {
  id: string;
  /** Nennkapazität [Ah], > 0. */
  capacityAh: number;
  chemistry: string;
  /** Nennspannung [V]; `undefined` ⇒ Systemspannung. */
  nominalVoltageV?: number;
  /** Rolle; 'starter' wird wie im Produktivmodell ausgeschlossen. */
  role?: string;
  /** Datenblatt-R_i [mΩ], schlägt den Chemie-Anker. */
  internalResistanceMilliOhm?: number;
}

/** Block-Innenwiderstand [mΩ]; Datenblatt schlägt Chemie-Anker. */
export function refBlockRi(block: RefBatteryBlock): number | null {
  if (block.internalResistanceMilliOhm !== undefined) {
    return block.internalResistanceMilliOhm > 0 ? block.internalResistanceMilliOhm : null;
  }
  if (!(block.capacityAh > 0)) return null;
  const anchor = REF_RI_100AH[block.chemistry] ?? REF_RI_100AH['LiFePO4']!;
  return (anchor * 100) / block.capacityAh;
}

/** Haus-Blöcke (ohne Starter). */
export function refHouseBlocks(blocks: readonly RefBatteryBlock[]): RefBatteryBlock[] {
  return blocks.filter((block) => block.role !== 'starter');
}

/**
 * Ersatz-Innenwiderstand der Parallelschaltung [mΩ].
 * Summe der Leitwerte — reihenfolgeunabhängig **per Konstruktion**.
 */
export function refBankRi(blocks: readonly RefBatteryBlock[]): number | null {
  const house = refHouseBlocks(blocks);
  let conductance = 0;
  let counted = 0;
  for (const block of house) {
    const ri = refBlockRi(block);
    if (ri !== null && ri > 0) {
      conductance += 1 / ri;
      counted += 1;
    }
  }
  return counted > 0 && conductance > 0 ? 1 / conductance : null;
}

/**
 * Einheitliche Nennspannung der Bank [V] — oder `null`, wenn die Blöcke
 * unterschiedliche Nennspannungen haben.
 *
 * Das ist die fachliche Kernaussage dieses Moduls: eine Parallelbank aus
 * Blöcken verschiedener Nennspannung ist keine definierte Quelle. Weder
 * „der erste Block gewinnt“ noch „der Durchschnitt“ ist eine Aussage, die man
 * einem Sicherheitsurteil zugrunde legen darf. `null` heißt: **nicht
 * schätzbar** — und das muss der Aufrufer als Datenlücke behandeln.
 */
export function refBankVoltage(blocks: readonly RefBatteryBlock[], systemVoltageV: number): number | null {
  const house = refHouseBlocks(blocks);
  if (house.length === 0) return systemVoltageV;
  const voltages = house.map((block) => block.nominalVoltageV ?? systemVoltageV);
  const unique = [...new Set(voltages)];
  return unique.length === 1 ? unique[0]! : null;
}

/**
 * Kurzschlussstrom der Bank an den Polklemmen [A] — oder `null`, wenn die Bank
 * nicht schätzbar ist (kein R_i, uneinheitliche Nennspannung).
 */
export function refBankShortCircuitCurrent(
  blocks: readonly RefBatteryBlock[],
  systemVoltageV: number
): number | null {
  const ri = refBankRi(blocks);
  const voltage = refBankVoltage(blocks, systemVoltageV);
  if (ri === null || voltage === null) return null;
  return voltage / (ri / 1000);
}

/** Leitungswiderstand Hin+Rück [Ω]. */
export function refCableLoopResistance(lengthM: number, crossSectionMm2: number): number {
  if (!(lengthM >= 0) || !(crossSectionMm2 > 0)) return 0;
  return (2 * lengthM * REF_RHO_CU) / crossSectionMm2;
}

/**
 * Kurzschlussstrom am Sicherungseinbauort [A]:
 * `I_k = U / (R_i,Bank + R_Leitung)`, `null` wenn nicht schätzbar.
 */
export function refShortCircuitAtFuse(
  blocks: readonly RefBatteryBlock[],
  fuseOffsetM: number | undefined,
  crossSectionMm2: number | undefined,
  systemVoltageV: number,
  fallbackCrossSectionMm2 = 16
): number | null {
  const ri = refBankRi(blocks);
  const voltage = refBankVoltage(blocks, systemVoltageV);
  if (ri === null || voltage === null) return null;
  const length = typeof fuseOffsetM === 'number' && fuseOffsetM > 0 ? fuseOffsetM : 0;
  const section =
    typeof crossSectionMm2 === 'number' && crossSectionMm2 > 0 ? crossSectionMm2 : fallbackCrossSectionMm2;
  return voltage / (ri / 1000 + refCableLoopResistance(length, section));
}

/** Reicht das Abschaltvermögen für den Kurzschlussstrom? `null` = nicht bewertbar. */
export function refBreakingCapacitySufficient(
  prospectiveIkA: number | null,
  breakingCapacityKA: number
): boolean | null {
  if (prospectiveIkA === null) return null;
  return prospectiveIkA <= breakingCapacityKA * 1000;
}

/**
 * Alle Permutationen einer Liste — die Prüfmaschine für I-E-11.
 * Bewusst als Generator über Indizes statt Rekursion über Werte (Batterien
 * können dieselben Werte tragen; es geht um Position, nicht um Gleichheit).
 *
 * Bei n! > `limit` wird abgebrochen: lieber eine benannte Teilmenge als ein
 * Test, der Minuten läuft und deshalb abgeschaltet wird.
 */
export function* refPermutations<T>(items: readonly T[], limit = 24): Generator<T[]> {
  const n = items.length;
  let produced = 0;
  const indices = items.map((_, index) => index);
  const counters = new Array<number>(n).fill(0);
  yield indices.map((index) => items[index]!);
  produced += 1;
  let i = 0;
  while (i < n) {
    if (counters[i]! < i) {
      const j = i % 2 === 0 ? 0 : counters[i]!;
      const tmp = indices[j]!;
      indices[j] = indices[i]!;
      indices[i] = tmp;
      yield indices.map((index) => items[index]!);
      produced += 1;
      if (produced >= limit) return;
      counters[i] = counters[i]! + 1;
      i = 0;
    } else {
      counters[i] = 0;
      i += 1;
    }
  }
}
