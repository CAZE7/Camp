import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const MODULE_EXT_RE = /\.(tsx?|jsx?|mts|cts)$/i;

function listTrackedFiles(): string[] {
  const out = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

describe('Dateinamen ohne Groß-/Kleinschreibungs-Kollision (Windows/macOS)', () => {
  it('enthält keine zwei Dateien mit identischem Kleinbuchstaben-Pfad', () => {
    const byLowerPath = new Map<string, string[]>();
    for (const file of listTrackedFiles()) {
      const key = file.toLowerCase();
      const group = byLowerPath.get(key) ?? [];
      group.push(file);
      byLowerPath.set(key, group);
    }
    const collisions = [...byLowerPath.values()].filter((group) => group.length > 1);
    expect(collisions).toEqual([]);
  });

  it('enthält keine zwei TS/JS-Module mit identischem endungslosem Kleinbuchstaben-Pfad (TS1149)', () => {
    const byModuleBase = new Map<string, string[]>();
    for (const file of listTrackedFiles()) {
      if (!MODULE_EXT_RE.test(file) || file.endsWith('.d.ts')) continue;
      const key = file.replace(MODULE_EXT_RE, '').toLowerCase();
      const group = byModuleBase.get(key) ?? [];
      group.push(file);
      byModuleBase.set(key, group);
    }
    const collisions = [...byModuleBase.values()].filter((group) => group.length > 1);
    expect(collisions).toEqual([]);
  });
});
