/**
 * lib/shortCircuit.ts — Kurzschlussstrom-Schätzung & Abschaltvermögen
 * (AUDIT DOM-002, erster Modellschnitt 2026-09-08).
 *
 * Vorher fehlte jede Aussage zu Kurzschlussstrom (Ik), Batterie-
 * Innenwiderstand (Ri) und Abschaltvermögen (AIC/kA) der Sicherung — die
 * Dimensionierung schützte den Leiter im ÜBERLASTfall, sagte aber nichts
 * darüber, ob die Sicherung den KURZSCHLUSSstrom der Batteriebank überhaupt
 * trennen kann.
 *
 * Modell (bewusst ein erster, ehrlich begrenzter Schnitt):
 * - Ri kommt aus data.internalResistance (mΩ, Datenblatt/BMS-Doku schlägt
 *   Schätzung). Ohne Angabe: Faustformel Ri ≈ CHEMISTRY_WERT(100 Ah) ×
 *   100/Kapazität — typische Größenordnung gängiger 12-V-Blöcke,
 *   UNVERIFIED im Einzelprodukt (Anker: Herstellerangaben typischer
 *   LiFePO4-Drop-ins ≈ 2–5 mΩ gesamt, AGM-Starterbatterien ≈ 3–8 mΩ).
 * - Die Bank wird topologie-konsistent modelliert (data.bankTopology):
 *   `single`/`parallel` → Parallelformel (Ri parallel, Ik addiert sich);
 *   `series` → Innenwiderstände und Nennspannungen addieren sich;
 *   `series-parallel` → (seriesCount × øRi) / parallelCount.
 *   Verschiedene Banken werden parallel kombiniert.
 *   Serien-Strings sind nicht mehr still als Parallel falsch berechnet.
 * - Ik am Sicherungseinbauort: Ik = U_nom / (Ri_bank + R_Leitung(Pol→Sicherung))
 *   mit R_Leitung = 2·L/(58·A) (Kupfer, Hin+Rück). fuseOffset fehlt → 0 m
 *   (Sicherung direkt am Pol = ungünstigster Fall). Spannungsbasis ist die
 *   Nennspannung (Ruhe): der volle Akku liegt wenige Prozent darüber —
 *   als Schätzung ausgewiesen, nicht als Grenzfallrechnung.
 * - Forderung an das Abschaltvermögen: ABYC E-11 AIC-Tabelle (main:
 *   1 500 A bis 750 CCA / 3 000 A bis 1 250 CCA / 5 000 A darüber, 12 V;
 *   branch jeweils die Hälfte) — die kA-Tabelle unten spiegelt
 *   HERSTELLER-DATENBLATTWERTE (Nachpflege 2026-09-08, VERIFIED):
 *   Littelfuse-Blatt (ATO/MINI 1 000 A @32 VDC, MEGA/MIDI 2 000 A @32 VDC)
 *   sowie Blue-Sea-„Quick Guide to Fuses" (ANL 6 000 A @32 VDC,
 *   MIDI/AMI 5 000 A @32 VDC, MRBF/Terminal 10 000 A @14 VDC /
 *   5 000 A @32 VDC / 2 000 A @58 VDC, Class T 20 000 A @160 VDC).
 *   Bei MIDI streuen die Hersteller (Littelfuse 2 000 vs. Blue Sea 5 000) —
 *   der Tabelleneintrag ist der konservative Minimalanker. MRBF ist
 *   explizit SPANNUNGSABHÄNGIG: breakingCapacityAOf wertet die System-
 *   spannung aus. Datenblattwert des konkreten Produkts schlägt die
 *   Tabelle (edge.data.fuseBreakingCapacity).
 * - Ri ist last-/temperaturabhängig: Kälte erhöht Ri (Ik sinkt um bis zu
 *   ~50 % bei Blei-Blöcken, LiFePO4 weniger betroffen) und Entladeende
 *   senkt die Polspannung. Beides wirkt auf die Abschaltbetrachtung nur
 *   ENTLASTEND (höchstes Ik = warm & voll = hier ohnehin angesetzte
 *   Nennwerte) — für das Sicherheitsverbotsschema unkritisch, für die
 *   Verfügbarkeit (Fehlauslösung) relevant; nicht weiter modelliert.
 *
 * Nicht enthalten (weiter offen, im ExpertPanel als Modellgrenze
 * ausgewiesen): temperatur-/Ladezustandsabhängiges Ri, Peukert, I²t/
 * Durchlassenergie (Selektivität), Lichtbogenenergie, AC-seitiges Ik.
 */

import { COPPER_CONDUCTIVITY_MS_PER_MM2 } from './materials';

import type { Node } from './domain/graph';
import { DEFAULT_SYSTEM_VOLTAGE } from './vde-standards';
import { normalizeBatteryChemistry } from './peukert';

/**
 * κ von Kupfer bei 20 °C — eine Quelle (lib/materials.ts, AUDIT ELE-010).
 * Vorher stand hier eine eigene 58, während die Spannungsfall-Seite mit
 * ρ = 0,0175 rechnete (Kehrwert 0,017241): zwei Kupferwerte für denselben
 * Werkstoff in derselben App.
 */
const COPPER_CONDUCTIVITY = COPPER_CONDUCTIVITY_MS_PER_MM2;

/** Bauformen mit typischem DC-Abschaltvermögen — s. Dateikopf (UNVERIFIED). */
export type FuseType = 'ato' | 'midi' | 'mega' | 'anl' | 'mrbf' | 'classT';

export const FUSE_TYPES: readonly FuseType[] = ['ato', 'midi', 'mega', 'anl', 'mrbf', 'classT'];

/**
 * Abschaltvermögen (A) der Bauformen — Hersteller-Datenblattanker à ≤ 32 V DC
 * (Quellenlage im Dateikopf, VERIFIED 2026-09-08: Littelfuse-Datenblätter +
 * Blue-Sea-„Quick Guide to Fuses"). MIDI ist der konservative Minimalanker der
 * Herstellerstreuung (2 000 Littelfuse vs. 5 000 Blue Sea). MRBF ist
 * spannungsabhängig (s. breakingCapacityAOf): der Tabellenwert gilt für den
 * 12-V-Systemkorridor (Nenn 12,8 V, Ladefenster ≤ 14,6 V).
 * Das Datenblatt des konkreten Produkts schlägt die Tabelle
 * (edge.data.fuseBreakingCapacity).
 */
export const FUSE_BREAKING_CAPACITY_A: Record<FuseType, number> = {
  ato: 1_000,
  midi: 2_000,
  mega: 2_000,
  anl: 6_000,
  mrbf: 10_000,
  classT: 20_000,
};

/** MRBF-Abschaltvermögen (A) je Nennspannungskorridor — Blue-Sea-Datenblatt. */
export const MRBF_BREAKING_CAPACITY_BY_VOLTAGE: ReadonlyArray<{ maxVolts: number; capacity: number }> = [
  { maxVolts: 16, capacity: 10_000 }, // 12-V-Systeme inkl. Ladefenster (@14 V DC)
  { maxVolts: 32, capacity: 5_000 }, // 24-V-Systeme (@32 V DC)
  { maxVolts: 58, capacity: 2_000 }, // 48-V-Systeme (@58 V DC)
];

/** Anzeige-Namen der Bauformen (EdgeInspector). */
export const FUSE_TYPE_LABELS: Record<FuseType, string> = {
  ato: 'Flachsicherung (ATO/Blade)',
  midi: 'MIDI-Sicherung',
  mega: 'MEGA-Sicherung',
  anl: 'ANL-Sicherung',
  mrbf: 'Pol-Sicherung (MRBF)',
  classT: 'Class T',
};

export const isFuseType = (value: unknown): value is FuseType =>
  typeof value === 'string' && (FUSE_TYPES as readonly string[]).includes(value);

/**
 * Ri-Kennwert (mΩ) je 100 Ah nach Chemie — Faustformel-Anker, s. Dateikopf.
 * LiFePO4 inkl. typischem BMS-Innenwiderstand.
 */
export const BATTERY_RI_MILLIOHM_AT_100AH: Record<string, number> = {
  LiFePO4: 3,
  AGM: 5,
  Gel: 6,
  // Nassblei: gleicher Blei-Familienanker wie Gel (6 mΩ/100 Ah).
  Blei: 6,
};

const dataOf = (node: Node | undefined): Record<string, unknown> | undefined => node?.data;

const finitePositive = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

/** Datenblatt-Ri (mΩ), wenn eingetragen — sonst null. */
export function explicitInternalResistanceMilliOhmOf(node: Node | undefined): number | null {
  return finitePositive(dataOf(node)?.internalResistance);
}

/**
 * Geschätzter Innenwiderstand (mΩ) EINES Batterieblocks:
 * Datenblatt (internalResistance) schlägt Faustformel
 * RI(100 Ah) × 100 / Kapazität(Ah). null, wenn weder Datenblatt noch
 * Chemie+Kapazität eine Schätzung erlauben (unehrlich raten statt null —
 * der Aufrufer meldet dann „Daten fehlen").
 */
export function internalResistanceMilliOhmOf(node: Node | undefined): number | null {
  const explicit = explicitInternalResistanceMilliOhmOf(node);
  if (explicit !== null) return explicit;
  const capacity = finitePositive(dataOf(node)?.capacity);
  if (capacity === null) return null;
  const chemistry = normalizeBatteryChemistry(dataOf(node)?.chemistry) ?? 'LiFePO4';
  const ri100 = BATTERY_RI_MILLIOHM_AT_100AH[chemistry] ?? BATTERY_RI_MILLIOHM_AT_100AH['LiFePO4']!;
  return (ri100 * 100) / capacity;
}

/** Nennspannung des Blocks (data.nominalVoltage), sonst Systemdefault. */
function nominalVoltageOf(node: Node | undefined): number {
  const v = finitePositive(dataOf(node)?.nominalVoltage);
  return v ?? DEFAULT_SYSTEM_VOLTAGE;
}

/** Kurzschlussstrom (A) eines Blocks an seinen Polklemmen (U_nom / Ri). */
export function batteryShortCircuitCurrentA(node: Node | undefined): number | null {
  const ri = internalResistanceMilliOhmOf(node);
  if (ri === null) return null;
  return nominalVoltageOf(node) / (ri / 1000);
}

/**
 * Ersatz-Innenwiderstand (mΩ) der Haus-Bank, topologie-konsistent.
 *
 * Batterien werden nach `data.bankId` gruppiert (fehlende `bankId` ⇒ jede
 * Batterie ist eine eigene Bank). Innerhalb einer Bank gilt die erklärte
 * `data.bankTopology`:
 *   - `single` / `parallel`: Parallelformel (1/Ri = Σ 1/Ri) — unverändert.
 *   - `series`: Ri addiert sich (Ri_ges = Σ Ri).
 *   - `series-parallel`: (seriesCount × øRi) / parallelCount.
 *
 * Verschiedene Banken werden parallel kombiniert (1/Ri_ges = Σ 1/Ri_bank).
 * null, wenn kein Block schätzbar ist.
 */
export function bankEquivalentRiMilliOhm(batteries: readonly Node[]): number | null {
  const house = batteries.filter((b) => {
    const role = dataOf(b)?.role;
    return role !== 'starter';
  });
  if (house.length === 0) return null;

  // Nach bankId gruppieren; fehlende bankId ⇒ Knoten-Id als Bank-Id
  const byBank = new Map<string, readonly Node[]>();
  for (const b of house) {
    const bankId = (dataOf(b)?.bankId as string | undefined) ?? b.id;
    const group = byBank.get(bankId) ?? [];
    byBank.set(bankId, [...group, b]);
  }

  // Äquivalent-Ri pro Bank, dann parallel kombiniert
  let totalConductance = 0;
  for (const group of byBank.values()) {
    const topology = (dataOf(group[0]!)?.bankTopology as string | undefined) ?? 'single';
    const ris = group
      .map((b) => internalResistanceMilliOhmOf(b))
      .filter((r): r is number => r !== null && r > 0);
    if (ris.length === 0) continue;

    let bankRi: number;
    if (topology === 'series') {
      // Serie: Innenwiderstände addieren sich
      bankRi = ris.reduce((sum, r) => sum + r, 0);
    } else if (topology === 'series-parallel') {
      const seriesRaw = dataOf(group[0]!)?.bankSeries;
      const parallelRaw = dataOf(group[0]!)?.bankParallel;
      const seriesCount = typeof seriesRaw === 'number' && seriesRaw > 0 ? seriesRaw : 1;
      const parallelCount = typeof parallelRaw === 'number' && parallelRaw > 0 ? parallelRaw : 1;
      const avgRi = ris.reduce((sum, r) => sum + r, 0) / ris.length;
      // Ri pro Serien-String = seriesCount × øRi; äquivalent über parallelCount Stränge
      bankRi = (seriesCount * avgRi) / parallelCount;
    } else {
      // single / parallel: Parallelformel (bisheriges Verhalten)
      let conductance = 0;
      for (const r of ris) conductance += 1 / r;
      bankRi = conductance > 0 ? 1 / conductance : 0;
    }

    if (bankRi > 0) totalConductance += 1 / bankRi;
  }

  return totalConductance > 0 ? 1 / totalConductance : null;
}

/**
 * Systemspannung der Bank fürs Ik-Modell — `null`, wenn die Haus-Bank keine
 * EINHEITLICHE Nennspannung hat (BEFUND K-3, Reparatur 2026-11-06).
 *
 * Vorher nahm diese Funktion `house[0]`. Damit hing der Bank-Kurzschlussstrom
 * von der Knotenreihenfolge ab: eine Bank aus 12,8-V- und 12,0-V-Blöcken
 * lieferte 6 826,67 A oder 6 400,00 A, je nachdem, welcher Block zuerst stand —
 * und `AMP-004` (Abschaltvermögen, `CRITICAL_SAFETY`) hängt daran. Ein Urteil,
 * das sich durch Umsortieren der Bauteile ändert, ist kein Urteil.
 *
 * Warum `null` und kein Mittelwert: eine gemischtspannige Bank ist fachlich
 * keine Parallelbank. Ein Mittelwert wäre eine erfundene Zahl; `null` heißt
 * „nicht bewertbar", und genau das muss der Aufrufer melden.
 *
 * Die Toleranz (10 mV) fängt nur die Gleitkommarepräsentation derselben
 * Nennspannung ab — sie ist keine fachliche Bandbreite. Fehlt `nominalVoltage`
 * bei einzelnen Blöcken, greift der Systemdefault (12,8 V): ein nicht
 * deklarierter Block ist nicht „gemischt", sondern undeklariert, und dafür
 * bleibt das bisherige Verhalten erhalten (Golden-Master-neutral).
 */
function bankVoltage(
  batteries: readonly Node[],
  systemVoltage: number = DEFAULT_SYSTEM_VOLTAGE
): number | null {
  const house = batteries.filter((b) => dataOf(b)?.role !== 'starter');
  if (house.length === 0) return systemVoltage;

  // Nach bankId gruppieren; fehlende bankId ⇒ Knoten-Id als Bank-Id
  const byBank = new Map<string, readonly Node[]>();
  for (const b of house) {
    const bankId = (dataOf(b)?.bankId as string | undefined) ?? b.id;
    const group = byBank.get(bankId) ?? [];
    byBank.set(bankId, [...group, b]);
  }

  // Nennspannung pro Bank; Serienbanken addieren die Einzelspannungen
  const bankVoltages: number[] = [];
  for (const group of byBank.values()) {
    const topology = (dataOf(group[0]!)?.bankTopology as string | undefined) ?? 'single';
    const voltages = group.map(nominalVoltageOf);

    if (topology === 'series' || topology === 'series-parallel') {
      // Serie / Series-Parallel: Nennspannung pro String = seriesCount × øSpannung.
      // Fehlt bankSeries, wird es aus der Gruppengröße geschlossen (alle Blöcke
      // der Bank sind in Reihe geschaltet).
      const seriesRaw = dataOf(group[0]!)?.bankSeries;
      const seriesCount =
        typeof seriesRaw === 'number' && seriesRaw > 0 ? seriesRaw : topology === 'series' ? group.length : 1;
      const avgVoltage = voltages.reduce((sum, v) => sum + v, 0) / voltages.length;
      bankVoltages.push(seriesCount * avgVoltage);
    } else {
      // single / parallel: muss einheitlich sein (bisheriges Verhalten)
      const reference = voltages[0]!;
      const uniform = voltages.every((voltage) => Math.abs(voltage - reference) <= 0.01);
      if (!uniform) return null;
      bankVoltages.push(reference);
    }
  }

  // Verschiedene Banken müssen auf derselben Systemspannung liegen
  const reference = bankVoltages[0]!;
  const uniform = bankVoltages.every((voltage) => Math.abs(voltage - reference) <= 0.01);
  return uniform ? reference : null;
}

/**
 * Max. Kurzschlussstrom (A) der Bank unmittelbar an den Polklemmen —
 * konservativ OHNE jede Leitungsdämpfung.
 */
export function bankShortCircuitCurrentA(
  batteries: readonly Node[],
  systemVoltage: number = DEFAULT_SYSTEM_VOLTAGE
): number | null {
  const ri = bankEquivalentRiMilliOhm(batteries);
  if (ri === null) return null;
  const voltage = bankVoltage(batteries, systemVoltage);
  // Gemischtspannige Bank: kein I_k. Nicht raten, nicht mitteln.
  if (voltage === null) return null;
  return voltage / (ri / 1000);
}

/** Leitungswiderstand (Ω) des Leitungspaars Batteriepol → Sicherung (Hin+Rück). */
export function cableLoopResistanceOhm(lengthM: number, crossSectionMm2: number): number {
  if (!(lengthM >= 0) || !(crossSectionMm2 > 0)) return 0;
  return (lengthM * 2) / (COPPER_CONDUCTIVITY * crossSectionMm2);
}

/**
 * Kurzschlussstrom (A) am Sicherungseinbauort: Ik = U / (Ri_bank + R_Leitung).
 * `fuseOffsetM` fehlt → 0 m (Polnähe = ungünstigster Fall, s. Dateikopf).
 * null, wenn die Bank nicht schätzbar ist.
 */
export function shortCircuitAtFuseA(
  batteries: readonly Node[],
  fuseOffsetM: number | undefined,
  crossSectionMm2: number | undefined,
  systemVoltage: number = DEFAULT_SYSTEM_VOLTAGE
): number | null {
  const ri = bankEquivalentRiMilliOhm(batteries);
  if (ri === null) return null;
  const length =
    typeof fuseOffsetM === 'number' && Number.isFinite(fuseOffsetM) && fuseOffsetM > 0 ? fuseOffsetM : 0;
  const cs =
    typeof crossSectionMm2 === 'number' && Number.isFinite(crossSectionMm2) && crossSectionMm2 > 0
      ? crossSectionMm2
      : 16;
  const rTotal = ri / 1000 + cableLoopResistanceOhm(length, cs);
  const voltage = bankVoltage(batteries, systemVoltage);
  if (voltage === null) return null;
  return voltage / rTotal;
}

/**
 * Wirksames Abschaltvermögen (A) einer abgesicherten Kante:
 * explizites Datenfeld (Datenblatt) schlägt Bauform-Tabelle, sonst null
 * (= nicht bewertbar — Aufrufer meldet „Typ angeben", statt zu schweigen).
 * `systemVoltageV` steuert den MRBF-Korridor (Blue-Sea-Datenblatt: 10/5/2 kA
 * für 14/32/58 V DC); ohne Angabe gilt der 12-V-Wert aus der Tabelle.
 */
export function breakingCapacityAOf(
  fuseType: unknown,
  explicitA: unknown,
  systemVoltageV?: number
): number | null {
  const explicit = finitePositive(explicitA);
  if (explicit !== null) return explicit;
  if (!isFuseType(fuseType)) return null;
  if (fuseType === 'mrbf' && typeof systemVoltageV === 'number' && Number.isFinite(systemVoltageV)) {
    const band = MRBF_BREAKING_CAPACITY_BY_VOLTAGE.find((b) => systemVoltageV <= b.maxVolts);
    return band ? band.capacity : null; // > 58 V: außerhalb der Bauform — ehrlich null
  }
  return FUSE_BREAKING_CAPACITY_A[fuseType];
}
