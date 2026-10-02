import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

/**
 * Wächter über die Trennung von blockierendem und meldendem E2E-Lauf.
 *
 * `quality.yml` zerlegt die Playwright-Suite in zwei Jobs: der blockierende
 * `e2e` fährt die funktionalen Szenarien, der meldende `visual` die
 * Pixelvergleiche (`continue-on-error`). Getrennt wird über `--grep` mit einem
 * Titeltext. Diese Prüfung hält genau diesen Text an drei Stellen zusammen —
 * Konstante, Specs, Workflow.
 *
 * Anlass: `visual-de.spec.ts` wurde am 02.10.2026 mit Pixelvergleichen ergänzt,
 * ohne die Kennzeichnung zu übernehmen. Ohne `--grep-invert`-Treffer landeten
 * die Bildvergleiche im blockierenden Lauf und stoppten den Deploy —
 * dieselbe Wirkung, die der meldende Job seit dem 16-Tage-Deploy-Stopp vom
 * 25.09.2026 ausschließen soll.
 */

const E2E_DIR = join(process.cwd(), 'tests', 'e2e');
const WORKFLOW = join(process.cwd(), '.github', 'workflows', 'quality.yml');

function pixelMarker(): string {
  const source = readFileSync(join(E2E_DIR, 'pixelMarker.ts'), 'utf8');
  const literal = source.match(/export const PIXEL_MARKER = '([^']+)'/)?.[1];
  if (!literal) throw new Error('pixelMarker.ts exportiert kein String-Literal PIXEL_MARKER');
  return literal;
}

/** Tests einer Spec mit ihrem Titel und dem Textabschnitt ihres Körpers. */
function tests(source: string): Array<{ title: string; body: string }> {
  const re = /\btest(?:\.(?:only|skip|fixme))?\(\s*(?:`([^`]*)`|'([^']*)'|"([^"]*)")/g;
  const found = [...source.matchAll(re)].map((match) => ({
    title: (match[1] ?? match[2] ?? match[3] ?? '').trim(),
    start: match.index ?? 0,
  }));
  return found.map((entry, index) => ({
    title: entry.title,
    body: source.slice(entry.start, found[index + 1]?.start ?? source.length),
  }));
}

type Step = { name?: string; run?: string };
type Job = { name?: string; 'continue-on-error'?: boolean; steps?: Step[] };

function grepArgs(job: Job): string[] {
  return (job.steps ?? [])
    .filter((step) => /playwright test/.test(step.run ?? ''))
    .flatMap((step) => step.run!.match(/--grep(?:-invert)?\s+"([^"]+)"/g) ?? []);
}

/** Die beiden E2E-Läufe aus quality.yml; fehlt einer, ist das Gate unvollständig. */
function gateJobs(): { blocking: Job; reporting: Job } {
  const workflow = load(readFileSync(WORKFLOW, 'utf8')) as { jobs?: Record<string, Job> };
  const blocking = workflow.jobs?.e2e;
  const reporting = workflow.jobs?.visual;
  if (!blocking) throw new Error('quality.yml hat keinen Job `e2e` (blockierender Lauf)');
  if (!reporting) throw new Error('quality.yml hat keinen Job `visual` (meldender Lauf)');
  return { blocking, reporting };
}

const MARKER = pixelMarker();

describe('E2E-Gate: blockierender und meldender Lauf', () => {
  it('Pixelvergleich und Kennzeichnung decken sich in jedem Test', () => {
    const specs = readdirSync(E2E_DIR).filter((file) => file.endsWith('.spec.ts'));
    expect(specs.length, 'keine E2E-Specs gefunden').toBeGreaterThan(0);
    for (const file of specs) {
      for (const entry of tests(readFileSync(join(E2E_DIR, file), 'utf8'))) {
        const marked = entry.title.includes(MARKER) || entry.title.includes('PIXEL_MARKER');
        const comparesPixels = entry.body.includes('toHaveScreenshot(');
        if (comparesPixels && !marked) {
          expect(
            false,
            `${file}: der Test „${entry.title}” vergleicht Pixel, trägt die Kennzeichnung „${MARKER}” ` +
              `aber nicht. Er läuft damit im blockierenden Job und kann den Deploy stoppen — Titel ` +
              `ergänzen oder den Pixelvergleich in eine eigene Pixel-Spec verschieben.`
          ).toBe(true);
        }
        if (marked && !comparesPixels) {
          expect(
            false,
            `${file}: der Test „${entry.title}” trägt die Kennzeichnung „${MARKER}” ohne Pixelvergleich. ` +
              `Er fiele aus dem blockierenden Job heraus, obwohl er Verhalten prüft.`
          ).toBe(true);
        }
      }
    }
  });

  it('quality.yml trennt mit demselben Text wie die Specs', () => {
    const { blocking, reporting } = gateJobs();
    expect(grepArgs(blocking), 'Job e2e filtert nicht mit --grep-invert').toEqual([
      `--grep-invert "${MARKER}"`,
    ]);
    expect(grepArgs(reporting), 'Job visual filtert nicht mit --grep').toEqual([`--grep "${MARKER}"`]);
  });

  it('nur der meldende Lauf darf den Deploy nicht aufhalten', () => {
    const { blocking, reporting } = gateJobs();
    expect(reporting['continue-on-error'], 'Job visual muss continue-on-error tragen').toBe(true);
    expect(blocking['continue-on-error'], 'Job e2e darf nicht fortfahren').toBeFalsy();
  });
});
