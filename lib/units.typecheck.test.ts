import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

/**
 * Compilezeit-Beweis für lib/units.ts (AGENTS.md K1).
 *
 * Unit-Tests können nur zeigen, dass gültige Werte richtig gerechnet werden.
 * Der eigentliche Nutzen der Branded Types liegt darin, dass *falsche*
 * Einheiten gar nicht erst kompilieren. Genau das prüfen diese Tests:
 * echte `tsc`-Läufe über generierte Quelldateien.
 *
 * Vorgehen:
 *   - Die Fixtures werden in ein Temp-Verzeichnis geschrieben (nie ins Repo),
 *     damit weder `npm run typecheck` noch `next build` daran scheitern.
 *   - `tsc` läuft ohne Projektdatei mit denselben strikten Optionen.
 *   - Erwartet wird ein Fehler in *jeder* markierten Zeile — nicht bloß
 *     "irgendein Fehler". Ein Tippfehler im Fixture würde sonst als Beweis
 *     durchgehen.
 *   - Eine Positivprobe stellt sicher, dass korrekter Code fehlerfrei bleibt.
 *
 * Bewusst ohne `any`, `as`-Casts auf fremde Marken oder `@ts-expect-error`:
 * Suppressions würden genau die Eigenschaft verstecken, die belegt werden soll.
 */

const UNITS_MODULE = resolve(process.cwd(), 'lib', 'units');

type TscRun = { code: number; output: string; errorLines: number[] };

function runTsc(source: string): TscRun {
  const dir = mkdtempSync(join(tmpdir(), 'units-typecheck-'));
  const file = join(dir, 'fixture.ts');
  const importPath = relative(dir, UNITS_MODULE).split('\\').join('/');
  writeFileSync(file, source.replace('__UNITS__', importPath));

  try {
    let code = 0;
    let output = '';
    try {
      const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      output = execFileSync(
        npxCommand,
        [
          'tsc',
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--target',
          'ES2020',
          '--module',
          'ESNext',
          '--moduleResolution',
          'bundler',
          file,
        ],
        { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true }
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      code = typeof failure.status === 'number' ? failure.status : 1;
      output = `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
    }

    const errorLines: number[] = [];
    const pattern = /fixture\.ts\((\d+),\d+\): error TS\d+/g;
    let match: RegExpExecArray | null = pattern.exec(output);
    while (match !== null) {
      errorLines.push(Number(match[1]));
      match = pattern.exec(output);
    }
    return {
      code,
      output,
      errorLines: Array.from(new Set(errorLines)).sort((a, b) => a - b),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Zeilennummern (1-basiert) aller mit `// ERWARTET_FEHLER` markierten Zeilen. */
function expectedErrorLines(source: string): number[] {
  return source
    .split('\n')
    .map((line, index) => (line.includes('// ERWARTET_FEHLER') ? index + 1 : 0))
    .filter((line) => line > 0);
}

const INVALID_FIXTURE = `
import {
  amps,
  volts,
  watts,
  mm2,
  meters,
  power,
  currentFromPower,
  conductorResistance,
  addWatts,
  scaleAmps,
  type Amps,
  type Volts,
  type Watts,
  type Mm2,
  type Meters,
} from '__UNITS__';

const current: Amps = amps(30);
const voltage: Volts = volts(12);
const load: Watts = watts(360);
const section: Mm2 = mm2(6);
const length: Meters = meters(4);

// 1) Rohe Zahl darf keine Größe sein.
const a: Amps = 30; // ERWARTET_FEHLER

// 2) Ampere ist kein Volt.
const b: Volts = current; // ERWARTET_FEHLER

// 3) Watt ist kein Meter.
const c: Meters = load; // ERWARTET_FEHLER

// 4) P = U * I mit vertauschten Argumenten.
const d = power(current, voltage); // ERWARTET_FEHLER

// 5) I = P / U mit vertauschten Argumenten.
const e = currentFromPower(voltage, load); // ERWARTET_FEHLER

// 6) Länge und Querschnitt vertauscht.
const f = conductorResistance(section, length, 0.0175); // ERWARTET_FEHLER

// 7) Rohe Zahl an eine typisierte Operation.
const g = addWatts(load, 40); // ERWARTET_FEHLER

// 8) Ampere skalieren, aber mit einer Größe statt einem Faktor.
const h = scaleAmps(current, voltage); // ERWARTET_FEHLER

// 9) Ergebnis einer Operation in die falsche Einheit schreiben.
const i: Mm2 = power(voltage, current); // ERWARTET_FEHLER

// 10) Konstruktor mit String statt Zahl.
const j = amps('30'); // ERWARTET_FEHLER

export { a, b, c, d, e, f, g, h, i, j, section, length };
`;

const VALID_FIXTURE = `
import {
  amps,
  volts,
  watts,
  mm2,
  meters,
  power,
  currentFromPower,
  conductorResistance,
  voltageFromResistance,
  addWatts,
  scaleAmps,
  toNumber,
  dropPercent,
  type Amps,
  type Volts,
  type Watts,
} from '__UNITS__';

const current: Amps = amps(30);
const voltage: Volts = volts(12);
const load: Watts = watts(360);

const computedLoad: Watts = power(voltage, current);
const computedCurrent: Amps = currentFromPower(load, voltage);
const resistance = conductorResistance(meters(4), mm2(6), 0.0175);
const drop: Volts = voltageFromResistance(resistance, current);
const total: Watts = addWatts(load, watts(40));
const derated: Amps = scaleAmps(current, 0.7);
const percent: number = dropPercent(drop, voltage);
const raw: number = toNumber(total);

export { computedLoad, computedCurrent, drop, total, derated, percent, raw };
`;

describe('lib/units — falsche Einheiten sind Compilezeit-Fehler', () => {
  it('korrekte Verwendung kompiliert fehlerfrei (Positivprobe)', () => {
    const result = runTsc(VALID_FIXTURE);
    expect(result.output.trim(), 'Positivprobe darf keine Fehler erzeugen').toBe('');
    expect(result.code).toBe(0);
  }, 120_000);

  it('jede vertauschte oder unmarkierte Einheit wird abgelehnt', () => {
    const result = runTsc(INVALID_FIXTURE);
    expect(result.code, 'tsc muss mit Fehlercode enden').not.toBe(0);
    expect(result.errorLines).toEqual(expectedErrorLines(INVALID_FIXTURE));
  }, 120_000);

  it('meldet Zuweisungs- und Argumentfehler mit den passenden TS-Codes', () => {
    const result = runTsc(INVALID_FIXTURE);
    // TS2322 = nicht zuweisbarer Typ, TS2345 = ungültiges Argument.
    expect(result.output).toMatch(/error TS2322/);
    expect(result.output).toMatch(/error TS2345/);
    // Die Meldung muss die Marke nennen, sonst ist der Fehler nicht sprechend.
    expect(result.output).toMatch(/Amps|Volts|Watts|Mm2|Meters/);
  }, 120_000);

  it('das Repository selbst enthält keine Suppressions in lib/units.ts', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(resolve(process.cwd(), 'lib', 'units.ts'), 'utf8');
    // Kommentare erklären die Regeln ("kein @ts-ignore") und dürfen die
    // Prüfung nicht auslösen — geprüft wird ausschließlich echter Code.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/@ts-ignore/);
    expect(code).not.toMatch(/@ts-expect-error/);
    expect(code).not.toMatch(/:\s*any\b/);
    expect(code).not.toMatch(/\bas\s+any\b/);
    expect(code).not.toMatch(/\beslint-disable\b/);
  });
});
