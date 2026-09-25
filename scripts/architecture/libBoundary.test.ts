import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { findForbiddenLayerImports, type SourceFile } from './rules';

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
 * Type-only-Ausnahmen (`import type` bzw. `{ type X }`) wären nur über
 * eine ALLOWLIST mit Pflichtbegründung und Heilungs-Pfad möglich.
 * STAND 2026-09-08: **leer und vollständig geheilt** — die letzte Typkante
 * (`costModel` → `SegmentSpatialIndex`) wurde durch die Migration der
 * Klasse nach `lib/routing/geometry/segmentSpatialIndex.ts` aufgelöst.
 * Die Leere ist der Sollzustand; jeder neue Eintrag bricht den Verfall-
 * Test und verlangt eine Begründung.
 */

type AllowEntry = { file: string; needle: string; reason: string };

const ALLOWED_TYPE_ONLY_IMPORTS: AllowEntry[] = [];

/** Verbotene App-Schichten als Import-Ziel aus lib-Produktivdateien. */
const FORBIDDEN_LAYERS = ['components/', 'store/', 'app/', 'benchmarks/'];

const LIB_ROOT = 'lib';

/**
 * G2 (AUDIT-Befund): Diese Datei hatte drei blinde Flecken, die zusammen mit
 * einem realen Verstoß gereicht hätten:
 *
 *   · `entry.endsWith('.ts')` — eine lib-Datei mit `.tsx`-Endung wurde nie
 *     gelesen (die README verbietet sie, der Test prüfte es nicht).
 *   · `importTargetsOf` kannte nur `from '…'` und `import('…')` — ein
 *     Side-Effect-`import '…'` oder ein `require('…')` kam durch.
 *   · Der Vergleich lief gegen `replaceAll('\\', '/')`, was auf Windows
 *     ein No-op ist (G1).
 *
 * Die Erkennung liegt jetzt in `./rules` (`findForbiddenLayerImports`) und
 * wird von `rulesSelfCheck.test.ts` mit erfundenen Verstößen geprüft.
 */
function listFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Relativer POSIX-Pfad — identisch auf Windows und POSIX (G1). */
const toPosix = (file: string): string => relative(process.cwd(), file).split(sep).join('/');

describe('ADR-0008 — lib importiert keine App-Schichten (Architektur-Boundary)', () => {
  const files: SourceFile[] = listFiles(LIB_ROOT).map((f) => ({
    file: toPosix(f),
    text: readFileSync(f, 'utf8'),
    isTest: false,
  }));

  it('kein lib-Produktivfile importiert components/store/app/benchmarks — Ausnahmen nur allowgelistet', () => {
    const hits = findForbiddenLayerImports(files, FORBIDDEN_LAYERS);
    const matchedAllowances = new Set<number>();
    const offenders: string[] = [];
    for (const { file, target } of hits) {
      const hit = ALLOWED_TYPE_ONLY_IMPORTS.findIndex((a) => file === a.file && target.includes(a.needle));
      if (hit >= 0) matchedAllowances.add(hit);
      else offenders.push(`${file} → ${target}`);
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

  it('Allowlist ist leer und bleibt es (jeder Eintrag braucht Heilungspfad)', () => {
    // Seit 2026-09-08 ist die Liste leer — der Sollzustand. Sollte je ein
    // Eintrag nötig werden: Begründung mit Heilungspfad ist Pflicht.
    expect(ALLOWED_TYPE_ONLY_IMPORTS).toEqual([]);
    for (const a of ALLOWED_TYPE_ONLY_IMPORTS) {
      expect(a.reason.length).toBeGreaterThan(40);
      expect(a.reason).toContain('Heilungspfad');
    }
  });
});
