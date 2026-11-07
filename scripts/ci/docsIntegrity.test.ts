import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Doku-Integrität: Der ADR-Index darf nicht auseinanderlaufen.
 *
 * Anlass (Befund 2026-09-28): `AGENTS.md` nannte „ADRs 0001–0021“, während
 * `docs/adr/` bereits 0022–0025 und 0027–0029 enthielt; und es gab **keinen**
 * Test, der eine Lücke in der Nummerierung überhaupt sichtbar macht. Genau die
 * Sorte Zahl, die still veraltet — deshalb hier maschinell geprüft statt
 * gepflegt.
 *
 * Die Prüfung ist bewusst schmal: Sie verlangt nicht „lückenlos“ (ADR 0026 ist
 * nummerierungshistorisch nicht vergeben), sondern **dokumentierte**
 * Lücken — eine Lücke ohne Vermerk in `AGENTS.md` ist der Fehler.
 */

const REPO_ROOT = resolve(__dirname, '..', '..');
const ADR_DIR = join(REPO_ROOT, 'docs', 'adr');

const adrFiles = readdirSync(ADR_DIR)
  .filter((file) => file.endsWith('.md'))
  .sort();
const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
const agents = readFileSync(join(REPO_ROOT, 'AGENTS.md'), 'utf8');

const numberOf = (file: string): number => Number(file.slice(0, 4));

describe('ADR-Index (Doku-Integrität)', () => {
  it('jede ADR-Datei trägt eine eindeutige vierstellige Nummer', () => {
    expect(adrFiles.length).toBeGreaterThan(20);
    for (const file of adrFiles) {
      expect(file, `ADR-Dateiname ohne Nummer: ${file}`).toMatch(/^\d{4}-[a-z0-9-]+\.md$/);
    }
    const numbers = adrFiles.map(numberOf);
    expect(new Set(numbers).size, 'doppelte ADR-Nummer').toBe(numbers.length);
  });

  it('jede ADR ist im README verlinkt — und jeder README-Link existiert', () => {
    const linked = [...readme.matchAll(/docs\/adr\/(\d{4}-[a-z0-9-]+\.md)/g)].map((match) => match[1]!);
    const uniqueLinked = [...new Set(linked)].sort();

    const notLinked = adrFiles.filter((file) => !uniqueLinked.includes(file));
    const deadLinks = uniqueLinked.filter((file) => !adrFiles.includes(file));

    expect(notLinked, `ADR ohne README-Zeile: ${notLinked.join(', ')}`).toEqual([]);
    expect(deadLinks, `README verlinkt fehlende ADR: ${deadLinks.join(', ')}`).toEqual([]);
  });

  it('Lücken in der Nummerierung sind in AGENTS.md benannt', () => {
    const numbers = adrFiles.map(numberOf).sort((a, b) => a - b);
    const first = numbers[0]!;
    const last = numbers[numbers.length - 1]!;
    const gaps: number[] = [];
    for (let n = first; n <= last; n += 1) {
      if (!numbers.includes(n)) gaps.push(n);
    }
    for (const gap of gaps) {
      const label = String(gap).padStart(4, '0');
      expect(agents, `ADR ${label} fehlt in docs/adr/, ist aber in AGENTS.md nicht vermerkt`).toContain(
        label
      );
    }
  });
});

/**
 * AUD-010 — die Agenten-Dokus nannten eine tote Stromquelle.
 *
 * `AGENTS.md` §4 und `ELECTRICAL-CONTEXT.md` verlangten „eine Stromquelle:
 * calculateEdgeCurrent (DC) bzw. acCurrentA (AC)". Beide sind durch das
 * Topologie-Strommodell ersetzt: `calculateEdgeCurrent` hat keine Produktiv-
 * Aufrufer mehr, `acCurrentA` ist entfernt. Ein Agent, der nur nach Doku
 * arbeitet, hätte die tote Funktion reaktiviert oder einen zweiten Strompfad
 * gebaut — genau das, was die Regel verhindern soll.
 *
 * Dieser Wächter hält die Doku an den Code, statt sie von Hand zu pflegen.
 */
describe('Stromquelle in der Doku (AUD-010)', () => {
  const electricalContext = readFileSync(join(REPO_ROOT, 'docs', 'ai', 'ELECTRICAL-CONTEXT.md'), 'utf8');

  it('AGENTS.md §4 nennt getCableCurrents als die eine Stromquelle', () => {
    expect(agents).toContain('getCableCurrents');
    // Die alten Namen dürfen nur noch als „ersetzt/veraltet" auftauchen,
    // nicht als Handlungsaufforderung.
    expect(agents).not.toMatch(/\*\*Eine\*\* Stromquelle: `calculateEdgeCurrent`/);
  });

  it('ELECTRICAL-CONTEXT nennt getCableCurrents und markiert die alten Namen als veraltet', () => {
    expect(electricalContext).toContain('getCableCurrents');
    expect(electricalContext).toMatch(/Veraltet:\*\* `calculateEdgeCurrent`/);
    // Die Rechenkette darf nicht mehr auf die tote Funktion zeigen.
    expect(electricalContext).not.toMatch(/→ calculateEdgeCurrent\(\)/);
  });

  it('die Produktiv-Konsumenten nutzen tatsächlich getCableCurrents', () => {
    const consumers = [
      'components/edges/CableEdge.tsx',
      'components/planner/hooks/useLiveValidation.ts',
      'components/planner/utils/bom.ts',
      'lib/verify/graph.ts',
      'lib/autoWire/sizing.ts',
    ];
    for (const file of consumers) {
      const source = readFileSync(join(REPO_ROOT, file), 'utf8');
      expect(source, `${file} nutzt nicht die eine Stromquelle`).toContain('getCableCurrents');
    }
  });
});
