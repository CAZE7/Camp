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
 * - Die Bank wird als reine PARALLELSchaltung modelliert (Ri parallel,
 *   Ik addiert sich). Serien-Strings sind nicht modelliert — wie die
 *   Serien-Grenze in ELE-003 dokumentiert ist; pro Batterie einzeln wäre
 *   Ik dort ohnehin ähnlich, die Parallelschätzung ist konservativ
 *   (größerer Ik → strengere Forderung ans Abschaltvermögen).
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

import type { Node } from './domain/graph';
import { DEFAULT_SYSTEM_VOLTAGE } from './vde-standards';

const COPPER_CONDUCTIVITY = 58;

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
};

const dataOf = (node: Node | undefined): Record<string, unknown> | undefined =>
  node?.data as Record<string, unknown> | undefined;

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
  const chemistry = dataOf(node)?.chemistry;
  const ri100 =
    BATTERY_RI_MILLIOHM_AT_100AH[typeof chemistry === 'string' ? chemistry : 'LiFePO4'] ??
    BATTERY_RI_MILLIOHM_AT_100AH['LiFePO4']!;
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
 * Ersatz-Innenwiderstand (mΩ) der reinen Parallelschaltung aller Blöcke
 * (Haus-Bank; Starterbatterien gehören fachlich nicht in den Haus-Kreis).
 * null, wenn kein Block schätzbar ist.
 */
export function bankEquivalentRiMilliOhm(batteries: readonly Node[]): number | null {
  const house = batteries.filter((b) => {
    const role = dataOf(b)?.role;
    return role !== 'starter';
  });
  let conductance = 0;
  for (const b of house) {
    const ri = internalResistanceMilliOhmOf(b);
    if (ri !== null && ri > 0) conductance += 1 / ri;
  }
  return conductance > 0 ? 1 / conductance : null;
}

/** Systemspannung der Bank fürs Ik-Modell (erster Block oder Systemdefault). */
function bankVoltage(batteries: readonly Node[], systemVoltage: number = DEFAULT_SYSTEM_VOLTAGE): number {
  const house = batteries.filter((b) => dataOf(b)?.role !== 'starter');
  return house.length > 0 ? nominalVoltageOf(house[0]) : systemVoltage;
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
  return bankVoltage(batteries, systemVoltage) / (ri / 1000);
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
  return bankVoltage(batteries, systemVoltage) / rTotal;
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
