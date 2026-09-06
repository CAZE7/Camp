import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOLDEN_PLANS } from './plans';
import { captureGoldenMaster, stableStringify, type GoldenMaster } from './pipeline';

/**
 * WP-0b (#402): Vergleichs-Harness — Golden-Master-Baseline.
 *
 * Läuft die Pipeline (AutoWire → Electrical → Routing) für jeden Referenzplan
 * und diffet gegen die eingefrorenen Fixtures in `knownPlans/`.
 *
 * Schlägt der Test fehl, gibt es genau zwei legitime Ausgänge:
 *  1. Regression → Code fixen (Fixtures NICHT anfassen).
 *  2. Bewusste Verbesserung → `npm run goldenmaster:capture`, Diff im PR
 *     zeigen, Begründung „bewusst besser, weil …“ im PR-Body und Eintrag im
 *     Change Ledger (`docs/ARCHITECTURE-CHANGES.md`).
 *
 * Zusätzlich abgesichert: Determinismus (Doppellauf byte-identisch, ADR 0010)
 * und Fixture-Vollständigkeit (jeder Plan hat ein Fixture und umgekehrt).
 */

const fixtureDir = resolve(process.cwd(), 'knownPlans');

const readFixture = (name: string): GoldenMaster =>
  JSON.parse(readFileSync(join(fixtureDir, `${name}.json`), 'utf8')) as GoldenMaster;

describe('Golden Master (knownPlans/)', () => {
  it('Fixture-Satz und Planliste decken sich', () => {
    const fixtures = readdirSync(fixtureDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
    expect(fixtures).toEqual(Object.keys(GOLDEN_PLANS).sort());
  });

  for (const [name, plan] of Object.entries(GOLDEN_PLANS)) {
    describe(name, () => {
      it('Pipeline-Ergebnis ist identisch zur eingefrorenen Baseline', () => {
        const actual = captureGoldenMaster(plan);
        const expected = readFixture(name);
        // Stufenweise Vergleiche zuerst — der Fehlerbericht zeigt dann die
        // Stufe, nicht nur "irgendwo im JSON".
        expect(actual.autoWire.nodes.map((n) => `${n.id}:${n.type}`)).toEqual(
          expected.autoWire.nodes.map((n) => `${n.id}:${n.type}`)
        );
        expect(actual.autoWire.edges.map((e) => e.id)).toEqual(expected.autoWire.edges.map((e) => e.id));
        expect(actual.electrical).toEqual(expected.electrical);
        expect(actual.routing).toEqual(expected.routing);
        // Vollständiger byte-genauer Abgleich als letzte Instanz.
        expect(stableStringify(actual)).toBe(stableStringify(expected));
      });

      it('Doppellauf ist byte-identisch (Determinismus, ADR 0010)', () => {
        const first = stableStringify(captureGoldenMaster(plan));
        const second = stableStringify(captureGoldenMaster(plan));
        expect(second).toBe(first);
      });
    });
  }
});
