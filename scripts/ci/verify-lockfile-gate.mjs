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
 *   2. In der Kopie eine Dependency-Version verfälschen (nur package.json).
 *   3. `npm ci --dry-run` ausführen und erwarten, dass es mit EUSAGE scheitert.
 *   4. Zur Gegenprobe: unverändertes Paar muss die Prüfung bestehen.
 *
 * Aufruf:  npm run ci:verify-lockfile-gate
 * Exit 0 = Gate greift, Exit 1 = Gate ist wirkungslos.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Führt `npm ci --dry-run` in `cwd` aus und liefert Exit-Code + Ausgabe. */
function npmCiDryRun(cwd) {
  try {
    const stdout = execFileSync('npm', ['ci', '--dry-run', '--no-audit', '--no-fund'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, output: stdout };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    return { code: typeof error.status === 'number' ? error.status : 1, output };
  }
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
  entry.version = '0.0.0-desynchronisiert';
  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const broken = npmCiDryRun(brokenDir);
  check(
    `Desynchronisiertes Lockfile (${depName}) lässt npm ci scheitern`,
    broken.code !== 0,
    `exit ${broken.code}`
  );
  check(
    'Fehlermeldung nennt die fehlende Synchronität',
    /can only install packages when your package\.json and package-lock\.json/i.test(broken.output),
    broken.output
      .split('\n')
      .find((line) => line.includes('does not satisfy') || line.includes('npm error code')) ??
      '(keine Meldung)'
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
