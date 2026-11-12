/**
 * test/invariants/failure-record.test.ts — V3: DIE FEHLERAKTEN.
 *
 * Drei Eigenschaften werden geprüft, und alle drei sind Verträge:
 *
 *   1. **Form**: Jede Akte in `test/regression/routing/` erfüllt das Schema.
 *   2. **Reproduktion**: Jede Akte reproduziert ihren Fehler — heute, auf
 *      diesem Commit. Eine Akte, die nicht mehr reproduziert, ist rot und muss
 *      geschlossen werden (§7, Regel 5).
 *   3. **Minimierung**: Jede Akte ist minimiert. Ein Fehlerfall, der aus 23
 *      Kanten besteht, erklärt nichts.
 *
 * Dazu die Gegenprobe zum Detektor: eine verstümmelte Akte MUSS abgelehnt
 * werden. Ein Schema, das alles akzeptiert, prüft nichts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CATEGORY_INVARIANT,
  describeExpectation,
  judgeRecord,
  validateRecord,
  type FailureRecord,
} from '../../lib/routing/verification/failureRecord';
import { replayRecord, namesBlocker } from '../../scripts/routing/verification/replay';
import { minimizePlan } from '../../scripts/routing/verification/minimize';

const RECORD_DIR = join(process.cwd(), 'test', 'regression', 'routing');
const FILES = readdirSync(RECORD_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort();

const loadRecord = (file: string): FailureRecord => {
  const validated = validateRecord(JSON.parse(readFileSync(join(RECORD_DIR, file), 'utf8')) as unknown);
  if (!validated.ok) {
    throw new Error(
      `${file}: ${validated.problems.map((problem) => `${problem.field}: ${problem.message}`).join('; ')}`
    );
  }
  return validated.record;
};

describe('1 — Form aller Fehlerakten', () => {
  it('es gibt Akten (leere Sammlung wäre kein Nachweis)', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  for (const file of FILES) {
    it(`${file}: Schema gültig, kein Seed, minimiert`, () => {
      const raw = JSON.parse(readFileSync(join(RECORD_DIR, file), 'utf8')) as Record<string, unknown>;
      const validated = validateRecord(raw);
      expect(validated.ok ? [] : validated.problems).toEqual([]);
      if (!validated.ok) return;

      // Ein deterministisches System braucht keinen Seed (§7.1).
      expect(raw.randomSeed).toBeUndefined();
      expect(raw.seed).toBeUndefined();

      // Minimierung ist Pflicht, nicht Empfehlung (§7.4).
      expect(validated.record.minimized).toBe(true);

      // Kategorie und Erwartung widersprechen sich nicht.
      const invariant = CATEGORY_INVARIANT[validated.record.category];
      if (invariant && validated.record.expect.kind === 'invariant') {
        expect(validated.record.expect.invariant).toBe(invariant);
      }
    });
  }
});

describe('2 — Reproduktion: jede Akte tritt heute noch auf', () => {
  for (const file of FILES) {
    it(`${file}: Status reproduces`, () => {
      const record = loadRecord(file);
      const outcome = replayRecord(record);
      expect(
        `${outcome.failureId}: ${outcome.status} (erwartet ${outcome.expected}, beobachtet ${outcome.observed})`
      ).toBe(
        `${record.failureId}: reproduces (erwartet ${describeExpectation(record)}, beobachtet ${outcome.observed})`
      );
      expect(outcome.hashMatches).toBe(true);
    });
  }
});

describe('3 — Schema-Gegenprobe: verstümmelte Akten werden abgelehnt', () => {
  const valid = loadRecord(FILES[0] as string);

  it('falsche ID', () => {
    const result = validateRecord({ ...valid, failureId: 'ROUTE-1' });
    expect(result.ok).toBe(false);
  });

  it('fehlender Hash', () => {
    const result = validateRecord({ ...valid, inputHash: '' });
    expect(result.ok).toBe(false);
  });

  it('fehlendes minimized (Pflichtfeld)', () => {
    const { minimized: _ignored, ...withoutFlag } = valid;
    expect(validateRecord(withoutFlag).ok).toBe(false);
  });

  it('Kategorie passt nicht zur Invariante', () => {
    const result = validateRecord({
      ...valid,
      category: 'clearance_violation',
      expect: { kind: 'invariant', invariant: 'I1', atLeast: 1 },
    });
    expect(result.ok).toBe(false);
  });

  it('unbekannte Erwartungsart', () => {
    const result = validateRecord({ ...valid, expect: { kind: 'hoffentlich-gruen', atLeast: 1 } });
    expect(result.ok).toBe(false);
  });
});

describe('4 — Urteilsfunktion', () => {
  const record = loadRecord(FILES[0] as string);

  it('fehlende Reproduktion ergibt fixed', () => {
    const outcome = judgeRecord(
      record,
      { becauseOfInvariant: 0, unroutableWithoutBlocker: 0, unreachableButUnrouted: 0 },
      true
    );
    expect(outcome.status).toBe('fixed');
  });

  it('Reproduktion mit abweichendem Hash ergibt input-drift', () => {
    const outcome = judgeRecord(
      record,
      { becauseOfInvariant: 99, unroutableWithoutBlocker: 99, unreachableButUnrouted: 99 },
      false
    );
    expect(outcome.status).toBe('input-drift');
  });
});

describe('5 — R-ERR-3: ein Blocker muss benannt sein', () => {
  it('Bauteil-ID im Text zählt als benannt', () => {
    expect(namesBlocker('Kollision mit battery-1', ['battery-1', 'shunt'])).toBe(true);
  });

  it('Anschluss-Stub im Text zählt als benannt', () => {
    expect(namesBlocker('Stub-Anschluss gesperrt', ['battery-1'])).toBe(true);
  });

  it('reine Gitterangabe zählt NICHT als benannt', () => {
    expect(namesBlocker('keine kollisionsfreie Route im Gitter (55×70)', ['battery-1', 'shunt'])).toBe(false);
  });
});

describe('6 — Minimierung ist deterministisch und idempotent', () => {
  const edges = ['a', 'b', 'c', 'd'].map((id) => ({ id, source: 'n1', target: 'n2' }));
  const nodes = [{ id: 'n1' }, { id: 'n2' }];
  const predicate = (candidate: { edges: unknown[] }) => candidate.edges.length >= 2;

  it('entfernt bis zur Kleinstform', () => {
    const result = minimizePlan({ nodes, edges }, predicate);
    expect(result.plan.edges.length).toBe(2);
    expect(result.removed.edges).toBe(2);
  });

  it('zweiter Lauf ändert nichts', () => {
    const first = minimizePlan({ nodes, edges }, predicate);
    const second = minimizePlan(first.plan, predicate);
    expect(second.plan.edges.length).toBe(first.plan.edges.length);
    expect(second.removed.edges).toBe(0);
  });

  it('liefert bei gleicher Eingabe dasselbe Ergebnis', () => {
    const a = minimizePlan({ nodes, edges }, predicate);
    const b = minimizePlan({ nodes, edges }, predicate);
    expect(JSON.stringify(a.plan)).toBe(JSON.stringify(b.plan));
  });
});
