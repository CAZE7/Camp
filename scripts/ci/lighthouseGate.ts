/**
 * scripts/ci/lighthouseGate.ts — Lighthouse-Budget (M11-5, Designkonzept §7/P4).
 *
 * Zwei Teile:
 *   1. `pruefeBudgets()` ist reine Logik und wird von
 *      `lighthouseGate.test.ts` ohne Browser geprüft.
 *   2. `haupt()` baut nichts, sondern vermisst den bereits gebauten Static
 *      Export in `out/` über einen gzip-Server. GitHub Pages liefert ebenfalls
 *      komprimiert aus; ein unkomprimierter lokaler Server würde systematisch
 *      zu schlechte Lab-Werte erzeugen.
 *
 * Ausführung: `npm run perf:lighthouse`
 *   - `LIGHTHOUSE_BIN` kann auf eine lokal installierte CLI zeigen.
 *   - `CHROME_PATH` wird durchgereicht (in CI findet chrome-launcher das
 *     vorinstallierte Google Chrome selbst).
 *
 * Die Budgets sind konservativ und an der gemessenen, komprimierten
 * Auslieferung kalibriert (docs/design-2026-11/VERIFIKATION-2026-11-03.md).
 * Für die Startseite gilt ein höheres CLS-Limit: Dort verschieben sich
 * Navigationselemente beim Laden der selbst gehosteten Schriften um wenige
 * Pixel — ein vorbestehender Befund, der nicht aus dieser Arbeit stammt.
 * Das Limit steht ausdrücklich im Budget, statt den Wert zu beschönigen.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = join(process.cwd(), 'out');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

export type LighthouseBericht = {
  categories: Record<string, { score: number | null } | undefined>;
  audits: Record<string, { numericValue?: number } | undefined>;
};

export type Budget = {
  /** Punkte 0–100. */
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  /** Millisekunden. */
  lcpMs: number;
  /** Einheitenlos. */
  cls: number;
};

export const BUDGETS: Readonly<Record<string, Budget>> = {
  '/camper-elektrik/ladebooster/': {
    performance: 90,
    accessibility: 100,
    bestPractices: 95,
    seo: 100,
    lcpMs: 2500,
    cls: 0.1,
  },
  '/': {
    // M11-5 fordert Performance >= 90. Das Budget stand hier auf 85 und lag
    // damit unter der eigenen Zusage. Gemessen am gebauten Static Export
    // ueber den gzip-Server (npm run perf:lighthouse):
    //   /                             Perf 98 · LCP 1207 ms · CLS 0.063
    //   /camper-elektrik/ladebooster/  Perf 100 · LCP 1515 ms · CLS 0
    //   /impressum/                    Perf 99 · LCP 1063 ms · CLS 0.0003
    // 90 haelt damit 8 Punkte Abstand zum Messwert — genug fuer die
    // Streuung zwischen Laufumgebungen, ohne die Zusage zu unterschreiten.
    performance: 90,
    accessibility: 100,
    bestPractices: 95,
    seo: 100,
    lcpMs: 2500,
    // CLS bleibt bewusst grosszuegig: Beim Laden der selbst gehosteten
    // Schriften verschieben sich Navigationselemente um wenige Pixel
    // (vorbestehender Befund, siehe Dateikopf). Aktuell gemessen 0.063.
    // Das Limit wird erst angezogen, wenn die Ursache behoben ist — nicht
    // weil ein einzelner Lauf gerade gut aussah.
    cls: 0.25,
  },
  '/impressum/': {
    performance: 90,
    accessibility: 100,
    bestPractices: 95,
    seo: 100,
    lcpMs: 2500,
    cls: 0.1,
  },
};

const punkte = (bericht: LighthouseBericht, kategorie: string): number =>
  Math.round((bericht.categories[kategorie]?.score ?? 0) * 100);

/** Leere Rückgabe = alles grün. Jeder Eintrag nennt die Zusage und den Wert. */
export function pruefeBudgets(bericht: LighthouseBericht, budget: Budget): string[] {
  const verstoesze: string[] = [];
  const pruefen = (name: string, wert: number, grenze: number, einheit: string, kleiner: boolean) => {
    const ok = kleiner ? wert <= grenze : wert >= grenze;
    if (!ok)
      verstoesze.push(`${name}: ${wert}${einheit} (Zusage ${kleiner ? '≤' : '≥'} ${grenze}${einheit})`);
  };

  pruefen('Performance', punkte(bericht, 'performance'), budget.performance, '', false);
  pruefen('Accessibility', punkte(bericht, 'accessibility'), budget.accessibility, '', false);
  pruefen('Best Practices', punkte(bericht, 'best-practices'), budget.bestPractices, '', false);
  pruefen('SEO', punkte(bericht, 'seo'), budget.seo, '', false);
  pruefen(
    'LCP',
    bericht.audits['largest-contentful-paint']?.numericValue ?? Infinity,
    budget.lcpMs,
    ' ms',
    true
  );
  pruefen('CLS', bericht.audits['cumulative-layout-shift']?.numericValue ?? Infinity, budget.cls, '', true);
  return verstoesze;
}

/** Statikserver mit gzip, wie ihn die Auslieferung liefert. */
async function starteServer(): Promise<{ origin: string; server: Server }> {
  const server = createServer(async (req, res) => {
    let pfad = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (pfad.endsWith('/')) pfad += 'index.html';
    let datei = join(ROOT, pfad);
    try {
      const info = await stat(datei);
      if (info.isDirectory()) datei = join(datei, 'index.html');
    } catch {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      let inhalt = await readFile(datei);
      const endung = extname(datei);
      const kopf: Record<string, string> = {
        'Content-Type': MIME[endung] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      };
      if (
        /\.(html|css|js|json|svg|txt|xml)$/.test(endung) &&
        (req.headers['accept-encoding'] ?? '').includes('gzip')
      ) {
        inhalt = gzipSync(inhalt, { level: 9 });
        kopf['Content-Encoding'] = 'gzip';
      }
      res.writeHead(200, kopf);
      res.end(inhalt);
    } catch (fehler) {
      res.writeHead(500);
      res.end(String(fehler));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const adresse = server.address();
  if (!adresse || typeof adresse === 'string') throw new Error('Kein Port für den Prüfserver.');
  return { origin: `http://127.0.0.1:${adresse.port}`, server };
}

/**
 * Asynchron — `spawnSync` würde die Eventloop blockieren und damit den
 * eigenen Statikserver lahmlegen: Lighthouse bekäme keine Antwort und bräche
 * mit „Target closed" ab. Der Server MUSS während des Laufs antworten können.
 */
function lighthouseAufruf(ziel: string, ausgabe: string): Promise<number> {
  const args = [
    ziel,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json',
    `--output-path=${ausgabe}`,
    '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage --disable-gpu',
    '--quiet',
  ];
  const bin = process.env.LIGHTHOUSE_BIN;
  const befehl = bin ? process.execPath : 'npx';
  const parameter = bin ? [bin, ...args] : ['-y', 'lighthouse@13.6.0', ...args];
  return new Promise((resolve) => {
    const kind = spawn(befehl, parameter, { stdio: 'inherit', env: process.env });
    kind.on('error', () => resolve(-1));
    kind.on('close', (code) => resolve(code ?? -1));
  });
}

export async function haupt(): Promise<void> {
  const { origin, server } = await starteServer();
  const temporaer = mkdtempSync(join(tmpdir(), 'lh-budget-'));
  let verstoesze = 0;

  try {
    for (const [route, budget] of Object.entries(BUDGETS)) {
      const ausgabe = join(temporaer, `${route.replaceAll('/', '_')}.json`);
      const status = await lighthouseAufruf(`${origin}${route}`, ausgabe);
      if (status !== 0) {
        console.error(`[lighthouse] Lauf für ${route} fehlgeschlagen (exit ${status}).`);
        verstoesze += 1;
        continue;
      }
      const bericht = JSON.parse(readFileSync(ausgabe, 'utf8')) as LighthouseBericht;
      const meldungen = pruefeBudgets(bericht, budget);
      console.log(
        `[lighthouse] ${route.padEnd(36)} Perf ${punkte(bericht, 'performance')} · A11y ${punkte(bericht, 'accessibility')} · SEO ${punkte(bericht, 'seo')} · LCP ${Math.round(bericht.audits['largest-contentful-paint']?.numericValue ?? 0)} ms · CLS ${bericht.audits['cumulative-layout-shift']?.numericValue ?? 0}`
      );
      for (const meldung of meldungen) console.error(`  VERSTOSS ${route}: ${meldung}`);
      verstoesze += meldungen.length;
    }
  } finally {
    server.close();
    rmSync(temporaer, { recursive: true, force: true });
  }

  if (verstoesze > 0) {
    console.error(`[lighthouse] ${verstoesze} Budgetverstoß/-verstöße.`);
    process.exitCode = 1;
  } else {
    console.log('[lighthouse] Alle Budgets eingehalten.');
  }
}

if (process.argv[1] && /lighthouseGate\.ts$/.test(process.argv[1])) {
  haupt().catch((fehler: unknown) => {
    console.error(fehler);
    process.exitCode = 1;
  });
}
