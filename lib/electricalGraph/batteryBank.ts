/**
 * lib/electricalGraph/batteryBank.ts — EXPLIZITES BATTERIEBANK-MODELL.
 *
 * Befund V2-BANK-001: Der Planer kannte keine Bank. Er kannte Batterien und
 * er kannte Kanten — und AutoWire legte jede „passende" weitere Batterie auf
 * dieselben Schienen. Daraus folgte eine stille Behauptung:
 *
 *   zwei Batterien gleicher Spannung und Chemie  ⇒  parallel
 *
 * Das ist keine Ableitung, das ist eine Annahme. Dieselben zwei Batterien
 * können eine 24-V-Serienbank, zwei getrennte Systeme (Aufbau + Starter) oder
 * eine 2s2p-Bank sein. Die Spannung der Anlage, die zulässigen Ströme und
 * jede Sicherung hängen davon ab — eine falsche Annahme ist hier kein
 * Schönheitsfehler, sondern ein falscher Plan.
 *
 * Das Modell dreht die Richtung um: Die Verschaltung wird **erklärt**, nicht
 * erraten. Erklärt wird sie in `node.data`:
 *
 * ```text
 * bankId        string   Zugehörigkeit zu einer Bank
 * bankTopology  'single' | 'series' | 'parallel' | 'series-parallel'
 * bankSeries    number   Zellstränge in Reihe        (nur series-parallel)
 * bankParallel  number   parallele Stränge           (nur series-parallel)
 * ```
 *
 * Fehlt die Erklärung und ist sie nötig (mehr als eine Aufbaubatterie), gibt
 * dieses Modul eine **Frage** aus statt einer Zahl
 * (`BatteryBankQuestion`) — „Wie sollen diese Batterien verwendet werden?".
 * Die Rechenwerte bleiben solange auf der sicheren Seite (kleinste
 * Einzelbatterie, keine addierten Ströme).
 *
 * Reine Domäne, deterministisch, ohne Geometrie: Verschieben einer Karte
 * ändert an einer Bank nichts (Property-Test).
 */

import type { Node } from '../domain/graph';
import { amps, parseQuantity, volts, type Amps, type Volts } from '../units';
import { chemistryKeyOf } from '../autoWire/primitives';
import { isStarterBattery } from '../autoWire/validation';
import { safeText } from '../safeText';
import { compareIds } from '../sortOrder';
import { classifySystemVoltage, type SystemVoltageClass } from './powerSystem';

/** Verschaltung einer Batteriegruppe. */
export type BankTopology = 'single' | 'series' | 'parallel' | 'series-parallel' | 'unassigned';

/** Alle erklärbaren Verschaltungen (ohne den Unentschieden-Zustand). */
export const DECLARABLE_BANK_TOPOLOGIES: readonly Exclude<BankTopology, 'unassigned'>[] = [
  'single',
  'series',
  'parallel',
  'series-parallel',
];

export const isBankTopology = (value: unknown): value is Exclude<BankTopology, 'unassigned'> =>
  typeof value === 'string' && (DECLARABLE_BANK_TOPOLOGIES as readonly string[]).includes(value);

/** Rolle der Bank im Fahrzeug. */
export type BankRole = 'house' | 'starter';

/** Eine Batteriegruppe mit ihren abgeleiteten elektrischen Kennwerten. */
export interface BatteryBank {
  /** Stabile ID: erklärte `bankId`, sonst `bank:<kleinste Batterie-ID>`. */
  id: string;
  role: BankRole;
  /** Mitglieder, aufsteigend nach ID (Determinismus). */
  batteryIds: readonly string[];
  topology: BankTopology;
  /** Stränge in Reihe (1 bei parallel/single). */
  seriesCount: number;
  /** Parallele Stränge (1 bei series/single). */
  parallelCount: number;
  /** Nennspannung der BANK (nicht der Einzelbatterie). */
  nominalVoltage: Volts;
  voltageClass: SystemVoltageClass;
  /** Nutzbare Kapazität der Bank in Ah. */
  capacityAh: number;
  /** BMS-/Bauteilgrenze Laden (A) — `undefined` = nicht angegeben. */
  maxChargeCurrent?: Amps;
  /** BMS-/Bauteilgrenze Entladen (A) — `undefined` = nicht angegeben. */
  maxDischargeCurrent?: Amps;
  /** Normalisierte Chemie, `''` bei gemischt/unbekannt. */
  chemistry: string;
  /** Wurde die Verschaltung im Plan erklärt? */
  declared: boolean;
}

/** Offene Frage an den Nutzer — das Modell rät NICHT. */
export interface BatteryBankQuestion {
  kind:
    | 'ambiguous-topology'
    | 'mixed-chemistry'
    | 'voltage-mismatch'
    | 'missing-counts'
    | 'member-count-mismatch'
    | 'declaration-mismatch';
  bankId: string;
  batteryIds: readonly string[];
  /** Nutzertext (deutsch, ohne Fachjargon). */
  question: string;
  /** Mögliche Antworten, wenn es eine Auswahl gibt. */
  options: readonly Exclude<BankTopology, 'unassigned'>[];
}

export interface BatteryBankModel {
  banks: readonly BatteryBank[];
  questions: readonly BatteryBankQuestion[];
  /** Batterie-ID → Bank-ID. */
  bankOfBattery: ReadonlyMap<string, string>;
}

const numberOrUndefined = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(safeText(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const batteryVoltageOf = (node: Node, fallback: Volts): Volts =>
  parseQuantity((node.data as { nominalVoltage?: unknown } | undefined)?.nominalVoltage, volts) ?? fallback;

const batteryCapacityOf = (node: Node): number =>
  numberOrUndefined((node.data as { capacity?: unknown } | undefined)?.capacity) ?? 0;

const bmsLimitOf = (node: Node, key: 'bmsContinuousCharge' | 'bmsContinuousDischarge'): Amps | undefined => {
  const raw = (node.data as Record<string, unknown> | undefined)?.[key];
  const parsed = parseQuantity(raw, amps);
  return parsed !== null && parsed > 0 ? parsed : undefined;
};

/** Summe nur, wenn JEDER Beitrag bekannt ist — sonst `undefined`. */
function sumIfComplete(values: readonly (Amps | undefined)[]): Amps | undefined {
  let total = 0;
  for (const value of values) {
    if (value === undefined) return undefined;
    total += value;
  }
  return values.length > 0 ? amps(total) : undefined;
}

/** Kleinster bekannter Wert; `undefined`, wenn keiner bekannt ist. */
function minDefined(values: readonly (Amps | undefined)[]): Amps | undefined {
  let best: number | undefined;
  for (const value of values) {
    if (value === undefined) continue;
    if (best === undefined || value < best) best = value;
  }
  return best === undefined ? undefined : amps(best);
}

type BankDraft = {
  id: string;
  role: BankRole;
  members: Node[];
  declaredTopology?: Exclude<BankTopology, 'unassigned'>;
  topologyConflict?: boolean;
  invalidTopology?: boolean;
  declaredSeries?: number;
  declaredParallel?: number;
  countConflict?: boolean;
  invalidSeriesCount?: boolean;
  invalidParallelCount?: boolean;
};

const declaredPositiveInteger = (value: unknown): number | undefined => {
  const raw = typeof value === 'number' ? value : Number(safeText(value).trim().replace(',', '.'));
  return Number.isSafeInteger(raw) && raw > 0 ? raw : undefined;
};

const declarationWasProvided = (value: unknown): boolean =>
  value !== undefined && value !== null && safeText(value).trim() !== '';

/**
 * Batterien zu Bänken gruppieren.
 *
 * Gruppenschlüssel ist ausschließlich die erklärte `bankId`. Batterien ohne
 * `bankId` bilden je eine eigene Gruppe — AUSDRÜCKLICH auch dann, wenn sie
 * technisch zueinander passen würden. Das Zusammenlegen wäre genau die
 * Annahme, die dieses Modul abschafft.
 */
function groupBatteries(batteries: readonly Node[]): BankDraft[] {
  const byKey = new Map<string, BankDraft>();
  for (const battery of batteries) {
    const data = battery.data as Record<string, unknown> | undefined;
    const declaredBankId = safeText(data?.bankId).trim();
    const role: BankRole = isStarterBattery(battery) ? 'starter' : 'house';
    const key = declaredBankId !== '' ? `declared:${declaredBankId}` : `single:${battery.id}`;
    const id = declaredBankId !== '' ? declaredBankId : `bank:${battery.id}`;

    let draft = byKey.get(key);
    if (!draft) {
      draft = { id, role, members: [] };
      byKey.set(key, draft);
    }
    draft.members.push(battery);

    const topology = data?.bankTopology;
    if (declarationWasProvided(topology)) {
      if (!isBankTopology(topology)) {
        draft.invalidTopology = true;
      } else if (draft.declaredTopology !== undefined && draft.declaredTopology !== topology) {
        draft.topologyConflict = true;
      } else {
        draft.declaredTopology = topology;
      }
    }

    const declaredCounts = [
      ['bankSeries', 'declaredSeries', 'invalidSeriesCount'],
      ['bankParallel', 'declaredParallel', 'invalidParallelCount'],
    ] as const;
    for (const [field, valueKey, invalidKey] of declaredCounts) {
      const raw = data?.[field];
      if (!declarationWasProvided(raw)) continue;
      const parsed = declaredPositiveInteger(raw);
      if (parsed === undefined) {
        draft[invalidKey] = true;
        continue;
      }
      const previous = draft[valueKey];
      if (previous !== undefined && previous !== parsed) draft.countConflict = true;
      else draft[valueKey] = parsed;
    }

    // Eine Starterbatterie in einer erklärten Bank macht die ganze Bank zur
    // Starterseite — sie ist nie Teil des Aufbau-Versorgungssystems.
    if (role === 'starter') draft.role = 'starter';
  }

  for (const draft of byKey.values()) {
    draft.members.sort((left, right) => compareIds(left.id, right.id));
  }
  return [...byKey.values()].sort((left, right) => compareIds(left.id, right.id));
}

/**
 * Bänke aus einem Plan ableiten.
 *
 * @param nodes          alle Knoten des Plans (nur `type === 'battery'` zählt)
 * @param fallbackVoltage Nennspannung für Batterien ohne eigene Angabe
 *                        (Vorgabe 12 V — der Aufrufer kennt die bessere Quelle)
 */
export function deriveBatteryBanks(
  nodes: readonly Node[],
  fallbackVoltage: Volts = volts(12)
): BatteryBankModel {
  const batteries = nodes.filter((node) => node.type === 'battery');
  const drafts = groupBatteries(batteries);
  const banks: BatteryBank[] = [];
  const questions: BatteryBankQuestion[] = [];
  const bankOfBattery = new Map<string, string>();

  // Mehrere Aufbaubatterien OHNE erklärte Bank: Das ist der mehrdeutige Fall.
  // Er wird EINMAL gefragt (nicht je Batterie), damit die Oberfläche eine
  // Entscheidung einholen kann statt n gleichlautender Hinweise zu zeigen.
  const undeclaredHouse = drafts.filter(
    (draft) =>
      draft.role === 'house' &&
      draft.members.length === 1 &&
      draft.declaredTopology === undefined &&
      !draft.invalidTopology &&
      !draft.topologyConflict
  );
  const ambiguousHouse = undeclaredHouse.length > 1;

  for (const draft of drafts) {
    const members = draft.members;
    const memberIds = members.map((member) => member.id);
    const voltages = members.map((member) => batteryVoltageOf(member, fallbackVoltage));
    const capacities = members.map(batteryCapacityOf);
    const chargeLimits = members.map((member) => bmsLimitOf(member, 'bmsContinuousCharge'));
    const dischargeLimits = members.map((member) => bmsLimitOf(member, 'bmsContinuousDischarge'));
    const chemistries = new Set(members.map((member) => chemistryKeyOf(member)));
    const chemistry = chemistries.size === 1 ? [...chemistries][0]! : '';

    let topology: BankTopology;
    if (draft.topologyConflict || draft.invalidTopology) {
      topology = 'unassigned';
      questions.push({
        kind: 'declaration-mismatch',
        bankId: draft.id,
        batteryIds: memberIds,
        question: draft.invalidTopology
          ? `Die Batterie-Bank „${draft.id}" enthält eine unbekannte Verschaltungsangabe. Bitte eine gültige Topologie festlegen; bis dahin wird keine Verschaltung angenommen.`
          : `Die Batterien der Bank „${draft.id}" deklarieren unterschiedliche Verschaltungen. Bitte für alle Mitglieder dieselbe Topologie festlegen; bis dahin wird keine Verschaltung angenommen.`,
        options: [],
      });
    } else if (draft.declaredTopology) {
      topology = draft.declaredTopology;
    } else if (members.length === 1) {
      // Eine einzelne Batterie ohne weitere Aufbaubatterie ist eindeutig.
      // Mit Geschwistern ist sie es nicht — dann bleibt sie unentschieden.
      topology = draft.role === 'starter' || !ambiguousHouse ? 'single' : 'unassigned';
    } else {
      topology = 'unassigned';
    }

    let seriesCount = 1;
    let parallelCount = 1;
    let countMismatch: string | undefined;
    if (!draft.topologyConflict && !draft.invalidTopology && topology === 'single') {
      if (members.length !== 1)
        countMismatch = `single verlangt genau 1 Mitglied, vorhanden sind ${members.length}`;
      if (draft.declaredSeries !== undefined && draft.declaredSeries !== 1)
        countMismatch = `bankSeries=${draft.declaredSeries}, für single wird 1 erwartet`;
      if (draft.declaredParallel !== undefined && draft.declaredParallel !== 1)
        countMismatch = `bankParallel=${draft.declaredParallel}, für single wird 1 erwartet`;
    } else if (!draft.topologyConflict && !draft.invalidTopology && topology === 'series') {
      seriesCount = members.length;
      if (draft.declaredSeries !== undefined && draft.declaredSeries !== members.length)
        countMismatch = `bankSeries=${draft.declaredSeries}, aber ${members.length} Mitglieder sind erklärt`;
      if (draft.declaredParallel !== undefined && draft.declaredParallel !== 1)
        countMismatch = `bankParallel=${draft.declaredParallel}, für series wird 1 erwartet`;
    } else if (!draft.topologyConflict && !draft.invalidTopology && topology === 'parallel') {
      parallelCount = members.length;
      if (draft.declaredSeries !== undefined && draft.declaredSeries !== 1)
        countMismatch = `bankSeries=${draft.declaredSeries}, für parallel wird 1 erwartet`;
      if (draft.declaredParallel !== undefined && draft.declaredParallel !== members.length)
        countMismatch = `bankParallel=${draft.declaredParallel}, aber ${members.length} Mitglieder sind erklärt`;
    } else if (!draft.topologyConflict && !draft.invalidTopology && topology === 'series-parallel') {
      seriesCount = draft.declaredSeries ?? 0;
      parallelCount = draft.declaredParallel ?? 0;
      if (seriesCount < 1 || parallelCount < 1) {
        questions.push({
          kind: 'missing-counts',
          bankId: draft.id,
          batteryIds: memberIds,
          question: `Wie ist die Bank „${draft.id}" verschaltet? Bitte Anzahl der Reihen (bankSeries) und der parallelen Stränge (bankParallel) angeben.`,
          options: ['series-parallel'],
        });
        // Ohne Zahlen keine erfundene Matrix: die Bank gilt als unentschieden.
        topology = 'unassigned';
        seriesCount = 1;
        parallelCount = 1;
      } else if (seriesCount * parallelCount !== members.length) {
        countMismatch = `${seriesCount} Reihen × ${parallelCount} parallele Stränge ergeben ${seriesCount * parallelCount} Batterien, vorhanden sind ${members.length}`;
      }
    }

    if (draft.countConflict)
      countMismatch = 'Mitglieder derselben Bank deklarieren unterschiedliche Reihen-/Parallelzahlen';
    if (draft.invalidSeriesCount || draft.invalidParallelCount)
      countMismatch = 'bankSeries und bankParallel müssen positive ganze Zahlen sein';
    if (countMismatch) {
      questions.push({
        kind: 'member-count-mismatch',
        bankId: draft.id,
        batteryIds: memberIds,
        question: `Die Angaben zur Batterie-Bank „${draft.id}" passen nicht zu ihrer Mitgliederzahl: ${countMismatch}. Die Bank bleibt bis zur Korrektur unbewertet.`,
        options: [],
      });
      topology = 'unassigned';
      seriesCount = 1;
      parallelCount = 1;
    }

    // Einzelbatterie-Kennwerte als Bezug. Bei ungleichen Spannungen ist die
    // kleinste maßgeblich und es wird gefragt — addieren wäre eine Behauptung.
    const cellVoltage = volts(Math.min(...voltages));
    const uniformVoltage = voltages.every((value) => value === voltages[0]);
    if (!uniformVoltage && members.length > 1) {
      questions.push({
        kind: 'voltage-mismatch',
        bankId: draft.id,
        batteryIds: memberIds,
        question: `Die Batterien der Bank „${draft.id}" haben unterschiedliche Nennspannungen. Bitte Verschaltung und Spannungen prüfen.`,
        options: ['series', 'parallel', 'series-parallel'],
      });
    }
    if (chemistry === '' && members.length > 1) {
      questions.push({
        kind: 'mixed-chemistry',
        bankId: draft.id,
        batteryIds: memberIds,
        question: `Die Bank „${draft.id}" enthält unterschiedliche Zellchemien. Eine gemeinsame Verschaltung ist fachlich unzulässig.`,
        options: [],
      });
    }

    const cellCapacity = Math.min(...capacities.map((value) => (value > 0 ? value : 0)));
    let nominalVoltage = cellVoltage;
    let capacityAh = cellCapacity;
    let maxChargeCurrent = minDefined(chargeLimits);
    let maxDischargeCurrent = minDefined(dischargeLimits);

    switch (topology) {
      case 'series':
        nominalVoltage = volts(cellVoltage * seriesCount);
        capacityAh = cellCapacity;
        // In Reihe fließt durch jede Zelle derselbe Strom: Die SCHWÄCHSTE
        // Grenze bestimmt die Bank. Addieren wäre hier physikalisch falsch.
        break;
      case 'parallel':
        nominalVoltage = cellVoltage;
        capacityAh = capacities.reduce((sum, value) => sum + value, 0);
        maxChargeCurrent = sumIfComplete(chargeLimits);
        maxDischargeCurrent = sumIfComplete(dischargeLimits);
        break;
      case 'series-parallel':
        nominalVoltage = volts(cellVoltage * seriesCount);
        capacityAh = cellCapacity * parallelCount;
        maxChargeCurrent =
          maxChargeCurrent === undefined ? undefined : amps(maxChargeCurrent * parallelCount);
        maxDischargeCurrent =
          maxDischargeCurrent === undefined ? undefined : amps(maxDischargeCurrent * parallelCount);
        break;
      case 'unassigned':
        // Unentschieden: KEINE Addition. Die Bank zählt wie ihre schwächste
        // Einzelbatterie — die sichere Seite, bis der Nutzer geantwortet hat.
        nominalVoltage = cellVoltage;
        capacityAh = cellCapacity;
        break;
      default:
        break;
    }

    banks.push({
      id: draft.id,
      role: draft.role,
      batteryIds: memberIds,
      topology,
      seriesCount,
      parallelCount,
      nominalVoltage,
      voltageClass: classifySystemVoltage(nominalVoltage),
      capacityAh,
      ...(maxChargeCurrent === undefined ? {} : { maxChargeCurrent }),
      ...(maxDischargeCurrent === undefined ? {} : { maxDischargeCurrent }),
      chemistry,
      declared: draft.declaredTopology !== undefined,
    });
    for (const id of memberIds) bankOfBattery.set(id, draft.id);
  }

  if (ambiguousHouse) {
    const ids = undeclaredHouse.flatMap((draft) => draft.members.map((member) => member.id)).sort(compareIds);
    questions.push({
      kind: 'ambiguous-topology',
      bankId: ids.join('+'),
      batteryIds: ids,
      question:
        'Wie sollen diese Batterien verwendet werden? (Parallel zu einer Bank, in Reihe für eine höhere Spannung oder als getrennte Systeme?)',
      options: ['parallel', 'series', 'series-parallel', 'single'],
    });
  }

  questions.sort((left, right) => compareIds(left.kind, right.kind) || compareIds(left.bankId, right.bankId));
  return { banks, questions, bankOfBattery };
}

/**
 * Versorgungsbank des Plans — die Bank, die das Bordnetz speist.
 * Bei mehreren Hausbänken gewinnt die mit der kleinsten ID (deterministisch);
 * die Mehrdeutigkeit selbst steht als Frage im Modell.
 */
export function primaryHouseBank(model: BatteryBankModel): BatteryBank | undefined {
  return model.banks.find((bank) => bank.role === 'house');
}
