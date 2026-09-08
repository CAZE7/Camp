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
 *   branch jeweils die Hälfte) — die kA-Tabelle unten gibt TYPISCHE
 *   Hersteller-Abschaltvermögen je Bauform wieder (UNVERIFIED für das
 *   konkrete Produkt; explizites edge.data.fuseBreakingCapacity schlägt
 *   die Tabelle).
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
 * Typische Nenn-Abschaltvermögen (A) bei ≤ 32 V DC, Hersteller-Kennwerte
 * (z. B. Littelfuse ATO/MIDI/MEGA/ANL-Serien, Blue-Sea-MRBF, Class T/JJN).
 * UNVERIFIED für das konkrete Produkt — das Datenblatt schlägt die Tabelle
 * (edge.data.fuseBreakingCapacity).
 */
export const FUSE_BREAKING_CAPACITY_A: Record<FuseType, number> = {
  ato: 1_000,
  midi: 1_000,
  mega: 2_000,
  anl: 2_500,
  mrbf: 3_000,
  classT: 20_000,
};

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
 */
export function breakingCapacityAOf(fuseType: unknown, explicitA: unknown): number | null {
  const explicit = finitePositive(explicitA);
  if (explicit !== null) return explicit;
  if (isFuseType(fuseType)) return FUSE_BREAKING_CAPACITY_A[fuseType];
  return null;
}
