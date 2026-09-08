import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * ADR-0008-Boundary-Guard (ARCH-Rest, 2026-09-08):
 *
 * Domänencode in `lib` importiert NICHTS aus den App-Schichten
 * (`components/`, `store/`, `app/`, `benchmarks/`) — die Abhängigkeits-
 * richtung läuft ausschließlich nach unten. Bis 2026-09 importierte
 * `lib/routing/elk/ab-compare.ts` den Bestandsrouter zur Laufzeit aus
 * `components/edges/utils/routeAll` (ARCH-Befund) — ein Verstoß, der
 * unbemerkt jahrelang mitwuchs. Dieser Test scannt alle Produktiv-Dateien
 * unter `lib/**` und verbietet jeden solchen Import; Testdateien
 * (`*.test.ts`) sind ausgenommen, weil Harness-Nutznießer (A/B-Gate,
 * Regression) bewusst beiderlei Seiten ziehen dürfen (Präzedenz:
 * lib/autoWire/placement.test.ts).
 *
 * Type-only-Ausnahmen (`import type` bzw. `{ type X }`) sind nur über
 * die ALLOWLIST unten möglich — mit Pflichtbegründung und Heilungs-Pfad.
 * Der Test meldet sowohl neue Verstöße als auch Allowlist-Einträge, deren
 * Import längst geheilt ist, sodass die Liste nur schrumpfen kann.
 */

type AllowEntry = { file: string; needle: string; reason: string };

const ALLOWED_TYPE_ONLY_IMPORTS: AllowEntry[] = [
  {
    file: 'lib/routing/rules/costModel.ts',
    needle: 'components/edges/utils/segmentSpatialIndex',
    reason:
      'type-only: framework-freie Klasse SegmentSpatialIndex; der Typ wandert mit der ' +
      'Routing-Geometrie-Migration nach lib/routing (gehört zum ROUTE-003-Block), bis ' +
      'dahin bleibt der Import reine Typkante ohne Laufzeit-Effekt.',
  },
];

/** Verbotene App-Schichten als Import-Ziel aus lib-Produktivdateien. */
const FORBIDDEN_LAYERS = ['components/', 'store/', 'app/', 'benchmarks/'];

const LIB_ROOT = 'lib';

function listFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, out);
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** Alle `from '…'` / `import('…')`-Zielpfade einer Datei (Mehrzeilen-robust). */
function importTargetsOf(source: string): string[] {
  const targets: string[] = [];
  const fromRe = /from\s+['"]([^'"]+)['"]/g;
  const dynRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [fromRe, dynRe]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) targets.push(m[1]!);
  }
  return targets;
}

describe('ADR-0008 — lib importiert keine App-Schichten (Architektur-Boundary)', () => {
  const files = listFiles(LIB_ROOT).map((f) => relative(process.cwd(), f));

  it('kein lib-Produktivfile importiert components/store/app/benchmarks — Ausnahmen nur allowgelistet', () => {
    const offenders: string[] = [];
    const matchedAllowances = new Set<number>();
    for (const file of files) {
      const rel = file.replaceAll('\\\\', '/');
      const source = readFileSync(file, 'utf8');
      for (const target of importTargetsOf(source)) {
        if (!FORBIDDEN_LAYERS.some((layer) => target.includes(layer))) continue;
        const hit = ALLOWED_TYPE_ONLY_IMPORTS.findIndex((a) => rel === a.file && target.includes(a.needle));
        if (hit >= 0) {
          matchedAllowances.add(hit);
        } else {
          offenders.push(`${rel} → ${target}`);
        }
      }
    }
    expect(offenders, `Verbotene lib-Imports gefunden:\n${offenders.join('\n')}`).toEqual([]);
    // Allowlist-Verfall: Einträge ohne lebenden Import sind Schuldanzeigen —
    // Heilung muss die Liste kleiner machen, nicht vergammeln lassen.
    const stale = ALLOWED_TYPE_ONLY_IMPORTS.map((a, i) => ({ a, i })).filter(
      ({ i }) => !matchedAllowances.has(i)
    );
    expect(
      stale.map(({ a }) => `${a.file} (${a.needle}) — Import geheilt? Allowlist-Eintrag entfernen.`),
      'Veraltete Allowlist-Einträge'
    ).toEqual([]);
  });

  it('Allowlist-Einträge tragen eine Begründung mit Heilungspfad', () => {
    for (const a of ALLOWED_TYPE_ONLY_IMPORTS) {
      expect(a.reason.length).toBeGreaterThan(40);
      expect(a.reason).toContain('ROUTE-003');
    }
  });
});
