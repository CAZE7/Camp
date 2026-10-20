import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Keine Modulnamen, die sich nur in der Groß-/Kleinschreibung unterscheiden.
 *
 * Anlass (Befund 2026-10-20, rot laufendes Quality-Gate auf Windows):
 * `components/planner/PlanerSeoContent.tsx` (Komponente) und
 * `components/planner/planerSeoContent.ts` (Textdaten) unterschieden sich nur
 * im Anfangsbuchstaben. Der Import `@/components/planner/PlanerSeoContent` lief
 * auf case-insensitiven Dateisystemen (Windows/macOS) gegen die **`.ts`-Daten**-
 * datei, weil die Auflösung `.ts` vor `.tsx` probiert und das Dateisystem beide
 * Namen zurückgibt. Ergebnis: `PlanerSeoContent` war `undefined`, React meldete
 * „Element type is invalid“, `app/planer/page.test.tsx` fiel mit sieben Tests
 * durch — während dasselbe Gate auf Linux (case-sensitiv) grün war.
 *
 * Die Kollision ist also plattformabhängig: Sie ist auf dem Rechner des
 * Beitragenden rot und im CI grün (oder umgekehrt). Genau deshalb wird sie hier
 * maschinell geprüft und nicht durch Aufmerksamkeit.
 */

const REPO_ROOT = resolve(__dirname, '..', '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.swc',
  'out',
  'coverage',
  'dist',
  'playwright-report',
]);
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** Alle Quelldateinamen (ohne Erweiterung) je Verzeichnis, rekursiv. */
function sourceNamesByDir(
  dir: string,
  into = new Map<string, Map<string, string[]>>()
): Map<string, Map<string, string[]>> {
  const byBase = new Map<string, string[]>();
  for (const entry of readdirSync(dir).sort()) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      sourceNamesByDir(full, into);
      continue;
    }
    const extension = SOURCE_EXTENSIONS.find((candidate) => entry.endsWith(candidate));
    if (!extension) continue;
    const base = entry.slice(0, entry.length - extension.length);
    byBase.set(base, [...(byBase.get(base) ?? []), entry]);
  }
  if (byBase.size > 0) into.set(dir.slice(REPO_ROOT.length + 1).replace(/\\/g, '/'), byBase);
  return into;
}

describe('Modulnamen ohne Case-Kollision (Gate-Integrität)', () => {
  const byDir = sourceNamesByDir(REPO_ROOT);

  it('kein Verzeichnis hat zwei Modulnamen, die sich nur in der Schreibweise unterscheiden', () => {
    const collisions: string[] = [];
    for (const [dir, byBase] of byDir) {
      const byLower = new Map<string, string[]>();
      for (const base of byBase.keys()) {
        byLower.set(base.toLowerCase(), [...(byLower.get(base.toLowerCase()) ?? []), base]);
      }
      for (const [lower, bases] of byLower) {
        if (bases.length > 1)
          collisions.push(
            `${dir}: ${bases.join(' vs. ')} (gleicher Name, unterschiedliche Schreibweise → „${lower}“)`
          );
      }
    }
    expect(collisions, `Case-Kollisionen:\n${collisions.join('\n')}`).toEqual([]);
  });
});
