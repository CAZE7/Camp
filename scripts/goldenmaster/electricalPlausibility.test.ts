import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DERATE_FACTOR, FUSE_MAP, FUSE_MAX_UNPROTECTED_SOURCE, VDE_AMPACITY } from '../../lib/electrical';
import type { GoldenMaster } from './pipeline';

/**
 * scripts/goldenmaster/electricalPlausibility.test.ts — die **Physik-Schicht
 * über den eingefrorenen Fixtures** (AUDIT E2).
 *
 * ## Warum diese Datei existiert
 *
 * `goldenMaster.test.ts` vergleicht Byte-Identität: Es stellt sicher, dass die
 * Pipeline morgen dasselbe rechnet wie heute — nicht, dass das Ergebnis
 * *richtig* ist. Genau diese Lücke war real: Der Referenzplan `acdc` enthält
 * Kanten, auf denen der Laststrom (152 A) über der design-Belastbarkeit des
 * Querschnitts (70 mm² → 0,7 × 172 = 120,4 A) liegt. Ein byte-genaues Fixture
 * schreibt so etwas fest, ohne rot zu werden.
 *
 * Diese Datei prüft deshalb die Invarianten, die unabhängig von der
 * Implementierung gelten müssen — direkt gegen die eingefrorenen Fixtures:
 *
 *  1. **Thermik:** `I_B ≤ I_z,design` ODER die Kante trägt den Marker
 *     `fuseWarning` (dann ist die Nicht-Ausführbarkeit bekannt und sichtbar).
 *     Kein Plan darf eine Überlast stillschweigend speichern.
 *  2. **Marker-Wahrheit:** `fuseWarning` darf nicht „aus Gewohnheit“ gesetzt
 *     sein — er muss durch eine echte Grenzverletzung gedeckt sein.
 *  3. **Sicherung trägt die Last:** Auf automatisch erzeugten Kanten ist
 *     `I_B ≤ I_n` — sonst löst die Sicherung im Normalbetrieb aus.
 *  4. **Sicherung schützt den Leiter:** `I_n ≤ FUSE_MAP[Querschnitt]`
 *     (abgeleitet aus derselben Iz-Wahrheit, AUDIT ELE-001).
 *  5. **Kein erfundenes Schutzorgan:** AC-Kanten tragen nur dann einen
 *     `acProtection`-Block, wenn der Eingabeplan ihn mitbrachte (AUDIT ELE-004:
 *     Die Pipeline stempelte `{mcb, 'B', 6 kA}` auf jede AC-Kante — eine
 *     Charakteristik, die niemand gewählt hat, und ausgerechnet B ist für die
 *     Abschaltbedingung die optimistische Annahme).
 *
 * Die Quelle der Ströme ist `electrical.edgeCurrents` — exakt der Wert, den
 * die Pipeline berechnet und die UI anzeigt.
 */

const fixtureDir = resolve(process.cwd(), 'knownPlans');

type Edge = GoldenMaster['autoWire']['edges'][number];

const readFixtures = (): [string, GoldenMaster][] =>
  readdirSync(fixtureDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => [
      file.replace(/\.json$/, ''),
      JSON.parse(readFileSync(join(fixtureDir, file), 'utf8')) as GoldenMaster,
    ]);

const designAmpacity = (crossSection: number): number => (VDE_AMPACITY[crossSection] ?? 0) * DERATE_FACTOR;

/** Marker `fuseWarning` auf der Kante — nur DC-Kanten tragen ihn. */
const marked = (edge: Edge): boolean => edge.data?.fuseWarning === true;

const crossSectionOf = (edge: Edge): number | undefined => {
  const value = edge.data?.crossSection;
  return typeof value === 'number' && value > 0 ? value : undefined;
};

const fuseOf = (edge: Edge): number | undefined => {
  const value = edge.data?.fuseSize;
  return typeof value === 'number' && value > 0 ? value : undefined;
};

describe('Golden-Master: elektrische Plausibilität (AUDIT E2)', () => {
  const fixtures = readFixtures();

  it('deckt jeden Referenzplan ab', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it('jede Kante hat einen endlichen, nicht-negativen Strom', () => {
    const problems: string[] = [];
    for (const [plan, fixture] of fixtures) {
      for (const edge of fixture.autoWire.edges) {
        const current = fixture.electrical.edgeCurrents[edge.id];
        if (typeof current !== 'number' || !Number.isFinite(current) || current < 0) {
          problems.push(`${plan}/${edge.id}: Strom = ${String(current)}`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  for (const [plan, fixture] of readFixtures()) {
    describe(plan, () => {
      const inputEdgeIds = new Set(fixture.input.edges.map((edge) => edge.id));
      const inputProtection = new Map(
        fixture.input.edges.map((edge) => [edge.id, edge.data?.acProtection !== undefined])
      );

      it('keine unmarkierte Überlast: I_B ≤ I_z,design ODER fuseWarning', () => {
        const problems: string[] = [];
        for (const edge of fixture.autoWire.edges) {
          const crossSection = crossSectionOf(edge);
          const current = fixture.electrical.edgeCurrents[edge.id];
          if (crossSection === undefined || current === undefined) continue;
          const iz = designAmpacity(crossSection);
          if (iz <= 0) continue;
          if (current > iz + 1e-9 && !marked(edge)) {
            problems.push(
              `${edge.id}: I = ${current} A > I_z = ${iz.toFixed(1)} A (${crossSection} mm²) ohne Marker`
            );
          }
        }
        expect(problems, `Unmarkierte Überlast in ${plan}:\n${problems.join('\n')}`).toEqual([]);
      });

      it('Marker sind gedeckt (keine Gewohnheits-Marker)', () => {
        const problems: string[] = [];
        for (const edge of fixture.autoWire.edges) {
          if (!marked(edge)) continue;
          const crossSection = crossSectionOf(edge);
          const current = fixture.electrical.edgeCurrents[edge.id];
          if (crossSection === undefined || current === undefined) {
            problems.push(`${edge.id}: fuseWarning ohne prüfbaren Strom/Querschnitt`);
            continue;
          }
          const iz = designAmpacity(crossSection);
          const maxFuse = FUSE_MAP[crossSection] ?? 0;
          const justified = current > iz + 1e-9 || current > maxFuse + 1e-9;
          if (!justified) {
            problems.push(
              `${edge.id}: Marker, aber I = ${current} A ≤ min(I_z ${iz.toFixed(1)}, I_n,max ${maxFuse}) A`
            );
          }
        }
        expect(problems, `Unbegründete Marker in ${plan}:\n${problems.join('\n')}`).toEqual([]);
      });

      it('automatisch gewählte Sicherungen tragen den Laststrom (I_B ≤ I_n)', () => {
        const problems: string[] = [];
        for (const edge of fixture.autoWire.edges) {
          if (inputEdgeIds.has(edge.id)) continue; // Nutzer-Vorgabe, nicht AutoWire
          const fuse = fuseOf(edge);
          const current = fixture.electrical.edgeCurrents[edge.id];
          if (fuse === undefined || current === undefined) continue;
          // Ausnahme: markierte, nicht ausführbare Dimensionierung — sie ist
          // ausdrücklich als „so nicht schutzfähig“ gekennzeichnet.
          if (current > fuse + 1e-9 && !marked(edge)) {
            problems.push(`${edge.id}: I = ${current} A > I_n = ${fuse} A ohne Marker`);
          }
        }
        expect(problems, `Sicherung zu klein in ${plan}:\n${problems.join('\n')}`).toEqual([]);
      });

      it('Sicherungen schützen den Leiter (I_n ≤ FUSE_MAP[Querschnitt])', () => {
        const problems: string[] = [];
        for (const edge of fixture.autoWire.edges) {
          if (inputEdgeIds.has(edge.id)) continue;
          const fuse = fuseOf(edge);
          const crossSection = crossSectionOf(edge);
          if (fuse === undefined || crossSection === undefined) continue;
          const maxFuse = FUSE_MAP[crossSection];
          if (maxFuse === undefined) continue; // Nicht-Normquerschnitt (Import)
          if (fuse > maxFuse + 1e-9) {
            problems.push(`${edge.id}: I_n = ${fuse} A > FUSE_MAP[${crossSection}] = ${maxFuse} A`);
          }
        }
        expect(
          problems,
          `Sicherung über der Leiterbelastbarkeit in ${plan}:\n${problems.join('\n')}`
        ).toEqual([]);
      });

      it('AC-Kanten tragen nur Schutzorgan-Daten aus dem Eingabeplan (kein Stempel)', () => {
        const problems: string[] = [];
        for (const edge of fixture.autoWire.edges) {
          if (edge.data?.edgeDomain !== 'AC_230V') continue;
          const declared = inputProtection.get(edge.id) ?? false;
          if (edge.data?.acProtection !== undefined && !declared) {
            problems.push(`${edge.id}: acProtection wurde von der Pipeline erfunden`);
          }
        }
        expect(problems, `Erfundenes Schutzorgan in ${plan}:\n${problems.join('\n')}`).toEqual([]);
      });
    });
  }

  it('FUSE_MAX_UNPROTECTED_SOURCE nennt die Normquellen (keine erfundene VDE-Klausel)', () => {
    // AGENTS.md §5: Normaussagen brauchen eine Quelle im Text.
    expect(FUSE_MAX_UNPROTECTED_SOURCE).toMatch(/ISO 10133/);
    expect(FUSE_MAX_UNPROTECTED_SOURCE).toMatch(/ABYC E-11/);
  });
});
