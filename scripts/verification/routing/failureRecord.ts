/**
 * Routing-Fehlerakte — Schema, Prüfung und Vergleich.
 *
 * Eine Akte ist die **dauerhafte** Form eines Routingfehlers:
 *
 * ```text
 * Fehler beobachtet → Akte geschrieben → Fixture gespeichert
 *                   → Replay läuft bei jeder Änderung mit
 * ```
 *
 * Diese Datei ist absichtlich **rein**: keine Dateizugriffe, kein `node:crypto`,
 * kein Router. Sie beschreibt die Form und das Urteil. Wer die Akte liest,
 * schreibt und den Hash bildet, ist der Replay-Lauf
 * (`scripts/routing/verification/replay.ts`) — dort ist `node` erlaubt.
 *
 * Regeln (docs/ROUTING-QUALITY-AND-VERIFICATION.md §7):
 *
 *  1. Jede Akte hat eine Fixture im Repo. Akte ohne Fixture = ungültig.
 *  2. `inputHash` stammt aus dem Prüflauf, nicht aus einer Schätzung.
 *  3. `failureId` ist monoton und wird nie wiederverwendet.
 *  4. Es gibt **kein** `randomSeed`-Feld: das System ist deterministisch, ein
 *     Seed wäre ein Eingeständnis.
 *  5. Eine Akte, die nicht mehr reproduziert, ist **nicht** erledigt — sie muss
 *     geschlossen werden (Status `fixed`), sonst verrottet die Sammlung.
 */

export type FailureCategory =
  | 'input_invalid'
  | 'node_penetration'
  | 'overlap'
  | 'clearance_violation'
  | 'handle_turn'
  | 'stub_short'
  | 'staircase'
  | 'lane_violation'
  | 'locked_changed'
  | 'port_direction'
  | 'bundle_overflow'
  | 'nondeterminism'
  | 'unreachable_but_unrouted'
  | 'unroutable_without_blocker'
  | 'crossing_budget'
  | 'length_regression'
  | 'bend_regression'
  | 'performance';

/** Kategorie → Invariante, die sie belegt (leer, wenn keine Invariante zutrifft). */
export const CATEGORY_INVARIANT: Partial<
  Record<FailureCategory, 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'I7' | 'I8' | 'I9' | 'I10'>
> = {
  node_penetration: 'I1',
  overlap: 'I2',
  clearance_violation: 'I3',
  handle_turn: 'I4',
  stub_short: 'I5',
  staircase: 'I7',
  lane_violation: 'I8',
  nondeterminism: 'I9',
  crossing_budget: 'I10',
};

export type FailureEngine = 'legacy' | 'core';

export type FailurePlanRef =
  /** Referenzplan aus `knownPlans/` (stabil, klein, im Repo versioniert). */
  | { kind: 'reference'; name: string }
  /** Vollständiger Plan in der Akte — für minimierte Fälle ohne Referenzplan. */
  | { kind: 'inline'; nodes: unknown[]; edges: unknown[] };

export type FailureExpectation =
  /** Mindestens `atLeast` Verletzungen dieser Invariante müssen auftreten. */
  | {
      kind: 'invariant';
      invariant: 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6' | 'I7';
      /**
       * Schwelle. `>= 1` beschreibt einen offenen Fehler, `0` einen
       * **behobenen**: die Akte bleibt als Wächter stehen und wird rot, sobald
       * der Fehler zurückkommt. Eine Akte, die man löscht, sobald sie grün ist,
       * verschwindet genau dann, wenn sie anfängt zu wirken.
       */
      atLeast: number;
    }
  /** Mindestens `atLeast` Kanten ohne Route UND ohne benannten Blocker (R-ERR-3). */
  | { kind: 'unroutable_without_blocker'; atLeast: number }
  /** Mindestens `atLeast` Kanten ohne Route, obwohl das Ziel erreichbar ist (R-ERR-1). */
  | { kind: 'unreachable_but_unrouted'; atLeast: number };

export type FailureRecord = {
  failureId: string;
  category: FailureCategory;
  severity: 'hard' | 'soft';
  engine: FailureEngine;
  plan: FailurePlanRef;
  expect: FailureExpectation;
  firstSeen: string;
  routingVersion: string;
  /** Kanonischer Hash der Eingabe; wird vom Replay-Lauf geprüft. */
  inputHash: string;
  minimized: boolean;
  reproducible: boolean;
  notes?: string;
};

export type RecordProblem = { field: string; message: string };

const ID_PATTERN = /^ROUTE-REG-\d{5}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

/**
 * Prüft die Form einer Akte. Gibt **alle** Probleme zurück, nicht nur das
 * erste: eine Akte wird in einem Zug korrigiert, nicht in fünf Runden.
 */
export function validateRecord(
  value: unknown
): { ok: true; record: FailureRecord } | { ok: false; problems: RecordProblem[] } {
  const problems: RecordProblem[] = [];
  const candidate = value as Partial<FailureRecord> | null;

  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, problems: [{ field: 'root', message: 'Akte ist kein Objekt' }] };
  }

  if (typeof candidate.failureId !== 'string' || !ID_PATTERN.test(candidate.failureId)) {
    problems.push({ field: 'failureId', message: 'erwartet ROUTE-REG-##### (fünfstellig)' });
  }
  if (typeof candidate.category !== 'string') {
    problems.push({ field: 'category', message: 'fehlt' });
  }
  if (candidate.severity !== 'hard' && candidate.severity !== 'soft') {
    problems.push({ field: 'severity', message: 'erwartet hard | soft' });
  }
  if (candidate.engine !== 'legacy' && candidate.engine !== 'core') {
    problems.push({ field: 'engine', message: 'erwartet legacy | core' });
  }
  if (typeof candidate.firstSeen !== 'string' || !DATE_PATTERN.test(candidate.firstSeen)) {
    problems.push({ field: 'firstSeen', message: 'erwartet YYYY-MM-DD' });
  }
  if (typeof candidate.routingVersion !== 'string' || candidate.routingVersion.length === 0) {
    problems.push({ field: 'routingVersion', message: 'fehlt' });
  }
  if (typeof candidate.inputHash !== 'string' || !HASH_PATTERN.test(candidate.inputHash)) {
    problems.push({ field: 'inputHash', message: 'erwartet sha256:<64 Hexzeichen>' });
  }
  if (typeof candidate.minimized !== 'boolean') {
    problems.push({ field: 'minimized', message: 'erwartet true | false (Pflichtfeld, §7.4)' });
  }
  if (typeof candidate.reproducible !== 'boolean') {
    problems.push({ field: 'reproducible', message: 'erwartet true | false' });
  }

  const plan = candidate.plan as FailurePlanRef | undefined;
  if (!plan || (plan.kind !== 'reference' && plan.kind !== 'inline')) {
    problems.push({
      field: 'plan',
      message: 'erwartet { kind: reference, name } | { kind: inline, nodes, edges }',
    });
  } else if (plan.kind === 'reference' && (typeof plan.name !== 'string' || plan.name.length === 0)) {
    problems.push({ field: 'plan.name', message: 'fehlt' });
  } else if (plan.kind === 'inline' && (!Array.isArray(plan.nodes) || !Array.isArray(plan.edges))) {
    problems.push({ field: 'plan.inline', message: 'nodes und edges müssen Arrays sein' });
  }

  const expect = candidate.expect as FailureExpectation | undefined;
  if (!expect || typeof expect !== 'object' || !('kind' in expect)) {
    problems.push({ field: 'expect', message: 'fehlt' });
  } else if (expect.kind === 'invariant') {
    if (!['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'].includes(expect.invariant)) {
      problems.push({ field: 'expect.invariant', message: 'erwartet I1–I7' });
    }
    if (!Number.isInteger(expect.atLeast) || expect.atLeast < 0) {
      problems.push({ field: 'expect.atLeast', message: 'erwartet ganze Zahl ≥ 0 (0 = behoben)' });
    }
  } else if (expect.kind === 'unroutable_without_blocker' || expect.kind === 'unreachable_but_unrouted') {
    if (!Number.isInteger(expect.atLeast) || expect.atLeast < 0) {
      problems.push({ field: 'expect.atLeast', message: 'erwartet ganze Zahl ≥ 0 (0 = behoben)' });
    }
  } else {
    problems.push({ field: 'expect.kind', message: 'unbekannte Erwartungsart' });
  }

  // Kategorie und Erwartung müssen zusammenpassen — sonst prüft die Akte
  // etwas anderes, als sie behauptet.
  if (typeof candidate.category === 'string' && expect && typeof expect === 'object' && 'kind' in expect) {
    const expectedInvariant = CATEGORY_INVARIANT[candidate.category as FailureCategory];
    if (expect.kind === 'invariant' && expectedInvariant && expectedInvariant !== expect.invariant) {
      problems.push({
        field: 'expect.invariant',
        message: `Kategorie ${candidate.category} gehört zu ${expectedInvariant}, nicht zu ${expect.invariant}`,
      });
    }
    if (expect.kind !== 'invariant' && expectedInvariant) {
      problems.push({
        field: 'expect.kind',
        message: `Kategorie ${candidate.category} verlangt eine Invarianten-Erwartung (${expectedInvariant})`,
      });
    }
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, record: candidate as FailureRecord };
}

/** Fachliche Invariante einer Akte (oder `null`, wenn keine zutrifft). */
export function invariantOf(record: FailureRecord): string | null {
  return record.expect.kind === 'invariant'
    ? record.expect.invariant
    : (CATEGORY_INVARIANT[record.category] ?? null);
}

/** Vergleichsergebnis eines Replay-Laufs. */
export type ReplayStatus =
  /** Fehler tritt weiterhin auf — die Akte ist gültig. */
  | 'reproduces'
  /** Fehler tritt nicht mehr auf — Akte schließen, nicht löschen. */
  | 'fixed'
  /** Der Plan hat sich geändert (Hash-Abweichung) — Akte neu vermessen. */
  | 'input-drift'
  /**
   * Ein **behobener** Fehler ist zurück (`atLeast === 0`, beobachtet > 0).
   * Die Akte steht als Wächter da; sie ist rot, sobald der Fehler wieder da ist.
   */
  | 'regressed';

export type ReplayOutcome = {
  failureId: string;
  status: ReplayStatus;
  expected: string;
  observed: string;
  hashMatches: boolean;
  /** Gemessene Zahlen für den Bericht. */
  measured: Record<string, number>;
};

/**
 * Reine Urteilsfunktion: erwartete gegen beobachtete Zahlen.
 *
 * @param observed.becauseOfInvariant Anzahl der Verletzungen der Akten-Invariante
 * @param observed.unroutableWithoutBlocker Kanten ohne Route und ohne Blocker
 * @param observed.unreachableButUnrouted Kanten ohne Route trotz erreichbarem Ziel
 */
export function judgeRecord(
  record: FailureRecord,
  observed: { becauseOfInvariant: number; unroutableWithoutBlocker: number; unreachableButUnrouted: number },
  hashMatches: boolean
): ReplayOutcome {
  const measured = {
    becauseOfInvariant: observed.becauseOfInvariant,
    unroutableWithoutBlocker: observed.unroutableWithoutBlocker,
    unreachableButUnrouted: observed.unreachableButUnrouted,
  };

  const observedValue =
    record.expect.kind === 'invariant'
      ? observed.becauseOfInvariant
      : record.expect.kind === 'unroutable_without_blocker'
        ? observed.unroutableWithoutBlocker
        : observed.unreachableButUnrouted;

  // `atLeast === 0` heißt: behoben, muss 0 bleiben. Die Bedingung ist dann
  // **Gleichheit**, nicht „mindestens" — sonst wäre eine Akte mit Schwelle 0
  // immer grün und würde einen Rückfall nicht bemerken.
  const settled = record.expect.atLeast === 0;
  const satisfied = settled ? observedValue === 0 : observedValue >= record.expect.atLeast;
  const status: ReplayStatus = satisfied
    ? hashMatches
      ? 'reproduces'
      : 'input-drift'
    : settled
      ? 'regressed'
      : 'fixed';

  return {
    failureId: record.failureId,
    status,
    expected: describeExpectation(record),
    observed: `${observedValue}`,
    hashMatches,
    measured,
  };
}

export function describeExpectation(record: FailureRecord): string {
  const suffix = (value: number): string => (value === 0 ? ' = 0 (behoben, muss 0 bleiben)' : ` ≥ ${value}`);
  switch (record.expect.kind) {
    case 'invariant':
      return `${record.expect.invariant}${suffix(record.expect.atLeast)}`;
    case 'unroutable_without_blocker':
      return `unroutable ohne Blocker${suffix(record.expect.atLeast)}`;
    case 'unreachable_but_unrouted':
      return `erreichbar, aber unrouted${suffix(record.expect.atLeast)}`;
  }
}

/** Sortierschlüssel: nach ID, numerisch — `ROUTE-REG-00009` vor `ROUTE-REG-00010`. */
export const compareFailureIds = (a: string, b: string): number => a.localeCompare(b, 'en');
