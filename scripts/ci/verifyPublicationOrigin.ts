/**
 * Wächter der Veröffentlichungsadresse (2026-10-16).
 *
 * Die Auslieferung ist ein statischer Export ohne Server: Es gibt keine
 * Rewrite-Regel, die eine Adresse auf eine andere spiegelt, und keine
 * .htaccess-Datei. Deshalb entstehen Canonical, Sitemap, `robots.txt` und die
 * Asset-Pfade aus genau zwei Angaben — der Herkunft (`SITE_ORIGIN`) und dem
 * Basis-Pfad (`NEXT_PUBLIC_BASE_PATH`). Werden die beiden verkehrt
 * kombiniert, ist der Schaden nicht sichtbar, sondern still:
 *
 *   - Herkunft mit Unterpfad (`https://elektroplaner-camper.de/Camp`) bei
 *     tatsächlicher Auslieferung an der Wurzel → jeder Canonical zeigt auf
 *     eine Adresse, die 404 liefert; die Seiten fallen aus dem Index.
 *   - Basis-Pfad gesetzt, Custom Domain nicht eingerichtet → die Assets
 *     werden unter `/Camp/_next/…` gesucht, die Seite selbst liegt an der
 *     Wurzel: eine weiße Seite ohne JavaScript-Bundle.
 *
 * Beide Fälle sieht man erst, wenn die Seite live ist. Dieser Wächter macht
 * sie vorher sichtbar: Er läuft im Quality Gate (Pull Request) und im Deploy
 * (vor dem Build) und bricht bei Abweichung ab — die Kombination ist eine
 * Sache des Betreibers, keine Konfigurationsfrage des Codes.
 *
 * Die Prüfung ist als reine Funktion geschrieben, damit sie ohne Build und
 * ohne Netz prüfbar bleibt (Tests: `verifyPublicationOrigin.test.ts`).
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE_ORIGIN } from '../../lib/site';

/** Ort der CNAME-Datei — GitHub Pages liest sie als Custom Domain. */
export const CNAME_PATH = 'public/CNAME';

export type OriginCheckInput = {
  /** Herkunft der Auslieferung (ohne abschließenden Schrägstrich). */
  origin: string;
  /** Basis-Pfad der Auslieferung (leer = Auslieferung an der Wurzel). */
  basePath: string;
  /** Inhalt von `public/CNAME`; `null`, wenn die Datei fehlt. */
  cname: string | null;
};

export type OriginProblem = {
  /** Kurzname der Regel — für Tests und Protokoll. */
  rule: string;
  message: string;
};

export type OriginCheckResult = {
  ok: boolean;
  problems: OriginProblem[];
  message: string;
};

/**
 * Prüft die Veröffentlichungsadresse.
 *
 * Drei Zusagen: Die Herkunft ist HTTPS, sie steht an der Wurzel (die
 * Custom Domain liefert `/` aus), und der Basis-Pfad passt dazu. Dazu kommt
 * die CNAME-Datei, weil GitHub Pages die Custom Domain von dort liest — ohne
 * sie publishen die Pages weiterhin unter `caze7.github.io/Camp`.
 */
export function checkPublicationOrigin(input: OriginCheckInput): OriginCheckResult {
  const problems: OriginProblem[] = [];

  let parsed: URL | null = null;
  try {
    parsed = new URL(input.origin);
  } catch {
    problems.push({
      rule: 'origin-ungueltig',
      message: `SITE_ORIGIN ist keine gültige Adresse: "${input.origin}".`,
    });
  }

  if (parsed) {
    if (parsed.protocol !== 'https:') {
      problems.push({
        rule: 'origin-https',
        message: `SITE_ORIGIN ist nicht HTTPS: "${input.origin}".`,
      });
    }
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      problems.push({
        rule: 'origin-wurzel',
        message: `SITE_ORIGIN enthält einen Pfad ("${parsed.pathname}") — die Auslieferung läuft an der Wurzel.`,
      });
    }
  }

  const basePath = input.basePath.replace(/^\/+|\/+$/g, '');
  if (basePath !== '') {
    problems.push({
      rule: 'basis-pfad',
      message:
        `Basis-Pfad "${basePath}" passt nicht zur Custom Domain an der Wurzel. ` +
        `Richte in den GitHub-Pages-Einstellungen die Custom Domain "${hostOf(input.origin)}" ein ` +
        `(dann ist der Basis-Pfad leer) oder setze NEXT_PUBLIC_BASE_PATH auf "".`,
    });
  }

  const cname = input.cname?.trim() ?? '';
  if (cname === '') {
    problems.push({
      rule: 'cname-fehlt',
      message: `${CNAME_PATH} fehlt oder ist leer — GitHub Pages veröffentlicht dann nicht unter "${hostOf(input.origin)}".`,
    });
  } else if (hostOf(input.origin) !== cname) {
    problems.push({
      rule: 'cname-abweichung',
      message: `${CNAME_PATH} nennt "${cname}", SITE_ORIGIN nennt "${hostOf(input.origin)}".`,
    });
  }

  if (problems.length === 0) {
    return {
      ok: true,
      problems,
      message: `Veröffentlichungsadresse stimmt: ${input.origin} (Basis-Pfad leer, CNAME passt).`,
    };
  }

  return {
    ok: false,
    problems,
    message:
      `Veröffentlichungsadresse stimmt nicht (${problems.length} Befund(e)):\n` +
      problems.map((problem) => `  - [${problem.rule}] ${problem.message}`).join('\n'),
  };
}

/** Host einer Herkunft (ohne Port, ohne Pfad). */
function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/** CLI-Teil: nur bei direktem Aufruf, damit Tests die Funktionen pur nutzen. */
function main(): void {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const cnamePath = join(process.cwd(), CNAME_PATH);
  const cname = existsSync(cnamePath) ? readFileSync(cnamePath, 'utf8') : null;

  const result = checkPublicationOrigin({ origin: SITE_ORIGIN, basePath, cname });
  console.log(`[publication-origin] ${result.message}`);

  for (const problem of result.problems) {
    console.log(`::error title=Veröffentlichungsadresse::${problem.message}`);
  }

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = result.ok
      ? `### Veröffentlichungsadresse\n\n✅ ${result.message}\n`
      : `### Veröffentlichungsadresse\n\n❗ ${result.message}\n`;
    appendFileSync(summaryPath, lines);
  }

  process.exitCode = result.ok ? 0 : 1;
}

// `process.argv[1]` ist beim `tsx`-Aufruf das Skript selbst; beim Import aus
// einem Test bleibt der Block aus (die Prüflogik ist dann pur nutzbar).
const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main();
}
