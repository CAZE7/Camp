#!/usr/bin/env node
/**
 * Reproduzierbarer Beleg für das Lockfile-Gate (AGENTS.md K6).
 *
 * Der Workflow installiert ausschließlich mit `npm ci` — ohne Fallback auf
 * `npm install` und ohne das Lockfile zu löschen. Dieses Skript beweist, dass
 * ein desynchronisiertes Lockfile dadurch tatsächlich zu einem Fehlschlag
 * führt (und nicht heimlich "repariert" wird).
 *
 * Ablauf:
 *   1. package.json + package-lock.json in ein temporäres Verzeichnis kopieren.
 *   2. In der Kopie die im Lockfile festgeschriebene Version einer Dependency
 *      verfälschen — sie passt danach nicht mehr zur Range in `package.json`.
 *   3. `npm ci --dry-run` ausführen, erwarten, dass es scheitert, und dass die
 *      Meldung genau diese Dependency als Ursache nennt (siehe Schritt 2 unten:
 *      npm meldet den Widerspruch mit zwei verschiedenen Codes).
 *   4. Zur Gegenprobe: unverändertes Paar muss die Prüfung bestehen.
 *
 * Aufruf:  npm run ci:verify-lockfile-gate
 * Exit 0 = Gate greift, Exit 1 = Gate ist wirkungslos.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Die im Lockfile verfälschte Version. Sie existiert in keiner Registry — damit
 * ist sie in jeder Meldung, die npm zum Scheitern bringt, wiederzufinden.
 */
const FAKE_VERSION = '0.0.0-desynchronisiert';

/**
 * Führt `npm ci --dry-run` in `cwd` aus und liefert Exit-Code + Ausgabe.
 *
 * `spawnSync` statt `execFileSync`: seit den Node-Sicherheitspatches (18.20.2 /
 * 20.12.2 / 21.7.2) darf eine `.cmd`-Datei auf Windows nicht mehr ohne
 * `shell: true` gestartet werden — `execFileSync('npm.cmd', …)` warf dort
 * `EINVAL`. Der Fehler wurde als „npm ci ist gescheitert" gelesen, der
 * Hauptfall dieses Skripts meldete also GRÜN, obwohl npm nie gelaufen war.
 * Ein Gate, das aus einem falschen Grund besteht, ist ärger als ein fehlendes.
 */
function npmCiDryRun(cwd) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  // Ein einzelner Befehlsstring statt args-Array: vermeidet Node DEP0190
  // (Argumente werden bei `shell: true` nur konkateniert, nicht escaped).
  // Die Argumente sind hier fest — keine benutzerkontrollierte Zeichenkette.
  const result = spawnSync(`${npmCommand} ci --dry-run --no-audit --no-fund`, {
    cwd,
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    // Ein nicht startbares npm ist kein Testergebnis, sondern ein Abbruch.
    throw new Error(`npm ci --dry-run konnte nicht gestartet werden in ${cwd}: ${result.error.message}`);
  }
  return {
    code: typeof result.status === 'number' ? result.status : 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'lockfile-gate-'));
  cpSync(join(repoRoot, 'package.json'), join(dir, 'package.json'));
  cpSync(join(repoRoot, 'package-lock.json'), join(dir, 'package-lock.json'));
  return dir;
}

const results = [];
let failed = false;

function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) failed = true;
}

// ── 1) Gegenprobe: unverändertes Paar ist installierbar ─────────────────────
const cleanDir = makeSandbox();
try {
  const clean = npmCiDryRun(cleanDir);
  check(
    'Unverändertes package.json/package-lock.json ist synchron',
    clean.code === 0,
    clean.code === 0 ? 'npm ci --dry-run: exit 0' : clean.output.split('\n').slice(0, 3).join(' ')
  );
} finally {
  rmSync(cleanDir, { recursive: true, force: true });
}

// ── 2) Kaputtes Lockfile muss scheitern ─────────────────────────────────────
const brokenDir = makeSandbox();
try {
  const lockPath = join(brokenDir, 'package-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const pkg = JSON.parse(readFileSync(join(brokenDir, 'package.json'), 'utf8'));
  const [depName] = Object.keys(pkg.dependencies ?? {});
  if (!depName) {
    throw new Error('Keine Dependencies in package.json — Beleg nicht durchführbar.');
  }
  const entryKey = `node_modules/${depName}`;
  const entry = lock.packages?.[entryKey];
  if (!entry) {
    throw new Error(`Lockfile-Eintrag ${entryKey} nicht gefunden — Beleg nicht durchführbar.`);
  }
  // Die im Lockfile festgeschriebene Version passt danach nicht mehr zur
  // Range in package.json — exakt der Zustand nach einem Merge-Konflikt oder
  // einem manuell editierten package.json.
  entry.version = FAKE_VERSION;
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const broken = npmCiDryRun(brokenDir);
  check(
    `Desynchronisiertes Lockfile (${depName}) lässt npm ci scheitern`,
    broken.code !== 0,
    `exit ${broken.code}`
  );

  /**
   * Der Fehlschlag muss aus der Verfälschung stammen — nicht aus einem
   * Registry- oder Netzzufall, der auch einen gesunden Stand umbringt.
   *
   * Geprüft wird deshalb die Ursache statt eines Wortlauts. Die Gegenprobe aus
   * Schritt 1 trägt die halbe Beweislast: gleiche Umgebung, gleicher Befehl,
   * beide Kopien frisch — den Unterschied macht allein die eine verfälschte
   * Lockfile-Version. Zusätzlich muss die Meldung eine der drei Spuren tragen,
   * die nur diese Verfälschung erzeugen kann:
   *
   *   EUSAGE   `Invalid: lock file's <dep>@0.0.0-desynchronisiert does not
   *            satisfy <dep>@3.0.129` — npm hat den Widerspruch im Lockfile
   *            selbst erkannt.
   *   ETARGET  `No matching version found for <dep>@…` — npm hat gegen den
   *            Registry-Index aufgelöst. Diese Auflösung findet nur statt, weil
   *            die verfälschte Version die Range aus `package.json` nicht mehr
   *            erfüllt; der unverfälschte Lauf fragt den Index nicht.
   *   Klartext `can only install packages when your package.json and
   *            package-lock.json … are in sync`, gefolgt von der Liste der
   *            betroffenen Pakete.
   *
   * Beide Codes sind am selben Commit mit derselben npm-Version (10.9.9)
   * aufgetreten: Quality Gate erst EUSAGE (Run 38783421907, 18:11 UTC), sieben
   * Minuten später ETARGET (Run 38784500652, 18:18 UTC). Eine Prüfung auf den
   * genauen Wortlaut hätte daraus einen Flake gemacht, obwohl die Ursache beide
   * Male dieselbe war.
   */
  const code = broken.output.match(/npm error code ([A-Z_]+)/)?.[1] ?? '(kein Code)';
  const nenntSyncWortlaut = /can only install packages when your package\.json and package-lock\.json/i.test(
    broken.output
  );
  const nenntFakeVersion = broken.output.includes(FAKE_VERSION);
  // Was NICHT genügt: eine Meldung, die nur den Paketnamen nennt. Ein
  // Netzausfall (`ENOTFOUND`) tut das auch — er würde den Beleg sonst
  // stillschweigend bestehen.
  const istBeleg = code === 'EUSAGE' || code === 'ETARGET' || nenntSyncWortlaut || nenntFakeVersion;
  // Die ersten npm-Fehlerzeilen landen im CI-Log. Ohne sie ist ein roter Lauf
  // wie der vom 2026-10-15 („npm error code ETARGET") nicht diagnostizierbar:
  // Der Code allein sagt nicht, welches Paket npm nicht auflösen konnte.
  const npmFehlerzeilen = broken.output
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) => line.startsWith('npm error') && line !== 'npm error' && !line.startsWith('npm error code')
    )
    .slice(0, 3);
  check(
    'Fehlermeldung nennt die Ursache in der verfälschten Kopie',
    istBeleg,
    `${code}${nenntSyncWortlaut ? ' (mit Synchronitäts-Hinweis)' : ''}${
      nenntFakeVersion ? `, nennt ${FAKE_VERSION}` : ''
    } — ${npmFehlerzeilen.join(' | ') || '(keine npm-Fehlerzeile)'}`
  );
} finally {
  rmSync(brokenDir, { recursive: true, force: true });
}

for (const { name, ok, detail } of results) {
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

if (failed) {
  console.error('\nLockfile-Gate greift NICHT wie dokumentiert.');
  process.exit(1);
}
console.log('\nLockfile-Gate greift: npm ci scheitert bei desynchronisiertem Lockfile.');
