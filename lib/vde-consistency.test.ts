/**
 * lib/vde-consistency.test.ts
 *
 * KRITISCH: Verhindert, dass VDE-Magic-Numbers wieder in die Module
 * zurückwandern, die auf vde-standards.ts umgestellt wurden.
 *
 * Geprüfte Dateien:
 *   - components/planner/hooks/useDashboardMetrics.ts
 *   - components/edges/CableEdge.tsx
 *   - components/nodes/ConduitNode.tsx
 *   - components/Inspector.tsx
 *
 * Verbotene Patterns (außerhalb von Kommentaren):
 *   - [/]\s*0\.85\b     Inverter-Effizienz
 *   - 58\s*\*\s*0\.\d+  Kupfer-Leitfähigkeit * Drop-Konstante
 *   - >\s*60\s*[\);,]   Leerrohr-Füllgrad 60%
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as vde from './vde-standards';
import * as electrical from './electrical';

const REPO_ROOT = path.join(__dirname, '..');

const FILES_TO_SCAN = [
  'components/planner/hooks/useDashboardMetrics.ts',
  'components/edges/CableEdge.tsx',
  'components/nodes/ConduitNode.tsx',
  'components/Inspector.tsx',
] as const;

const FORBIDDEN_PATTERNS: Array<{ name: string; pattern: RegExp; hint: string }> = [
  {
    name: 'hardcoded inverter efficiency 0.85',
    pattern: /[/]\s*0\.85\b/,
    hint: 'Ersetze / 0.85 durch / VDE_INVERTER_EFFICIENCY (aus @/lib/vde-standards).',
  },
  {
    name: 'hardcoded copper formula 58 * 0.x',
    pattern: /58\s*\*\s*0\.\d+/,
    hint: 'Ersetze 58 * 0.xx durch hasVoltageDropError (components/edges/utils/voltageDrop.ts) bzw. edgeVoltageDrop (lib/autoWire.ts).',
  },
  {
    name: 'hardcoded 60% conduit fill',
    pattern: />\s*60\s*[);,]/,
    hint: 'Ersetze > 60 durch > VDE_MAX_CONDUIT_FILL_PERCENT (aus @/lib/vde-standards).',
  },
];

function isCommentOrStringOnly(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return true;
  }
  return false;
}

function findViolations(relPath: string): Array<{ line: number; text: string; name: string; hint: string }> {
  const fullPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Konsistenz-Test: Datei fehlt: ${relPath}`);
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  const violations: Array<{ line: number; text: string; name: string; hint: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentOrStringOnly(line)) continue;
    // Skip template-string prompt lines in route.ts (Faktor 0.85 in Fließtext)
    if (line.includes('Faktor 0.85') && !/[/]\s*0\.85\b/.test(line.replace(/Faktor 0\.85/g, ''))) {
      // still run other patterns
    }
    for (const { name, pattern, hint } of FORBIDDEN_PATTERNS) {
      if (pattern.test(line) && !line.includes('VDE_')) {
        violations.push({
          line: i + 1,
          text: line.trim(),
          name,
          hint,
        });
      }
    }
  }
  return violations;
}

describe('VDE-Konsistenz: keine hardcoded Magic-Numbers', () => {
  it.each(FILES_TO_SCAN)('%s enthält keine hardcoded VDE-Magic-Numbers (0.85, 58*0.x, >60)', (relPath) => {
    const violations = findViolations(relPath);
    if (violations.length > 0) {
      const details = violations
        .map((v) => `  ${relPath}:${v.line}  [${v.name}]\n    ${v.text}\n    → ${v.hint}`)
        .join('\n');
      throw new Error(
        `Hardcoded VDE-Wert in ${relPath} gefunden.\n` +
          `Alle VDE-Werte MÜSSEN in lib/vde-standards.ts definiert und von dort importiert werden.\n\n` +
          details
      );
    }
    expect(violations).toEqual([]);
  });

  it('useDashboardMetrics.ts importiert die zentralen VDE-Konstanten', () => {
    const content = fs.readFileSync(
      path.join(REPO_ROOT, 'components/planner/hooks/useDashboardMetrics.ts'),
      'utf-8'
    );
    expect(content).toMatch(/VDE_INVERTER_EFFICIENCY/);
    expect(content).toMatch(/VDE_BATTERY_DOD/);
    expect(content).toMatch(/VDE_SOLAR_WINTER_REDUCTION/);
    expect(content).toMatch(/VDE_SOLAR_VMP_VOLTAGE/);
    expect(content).toMatch(/VDE_CHARGE_DERATING_FACTOR/);
  });

  it('CableEdge.tsx bezieht alle Ströme aus den zentralen Funktionen (DC + AC)', () => {
    // Seit der AC-Strom-Berechnung braucht CableEdge die Konstanten nicht
    // mehr selbst zu importieren — es delegiert an calculateEdgeCurrent (DC)
    // und calculateAcEdgeCurrent (230 V) aus lib/vde-standards.ts. Genau
    // diese Delegation wird hier erzwungen, damit keine Magic Numbers
    // (0.85, 18 V, 230 V) in die Anzeige zurückwandern.
    const content = fs.readFileSync(path.join(REPO_ROOT, 'components/edges/CableEdge.tsx'), 'utf-8');
    expect(content).toMatch(/calculateEdgeCurrent/);
    expect(content).toMatch(/calculateAcEdgeCurrent/);
    expect(content).not.toMatch(/[/]\s*0\.85\b/);
  });

  it('ConduitNode.tsx rechnet über die zentrale Füllgrad-Funktion statt mit eigenen Tabellen', () => {
    const content = fs.readFileSync(path.join(REPO_ROOT, 'components/nodes/ConduitNode.tsx'), 'utf-8');
    expect(content).not.toMatch(/const\s+CONDUIT_SIZES\s*=/);
    expect(content).not.toMatch(/const\s+CABLE_OUTER_DIAMETERS\s*=/);
    expect(content).toMatch(/calculateConduitFillPercent/);
    expect(content).toMatch(/recommendConduitType/);
    expect(content).toMatch(/VDE_MAX_CONDUIT_FILL_PERCENT/);
  });
});

describe('VDE-Konsistenz: vde-standards exportiert alle wichtigen Konstanten', () => {
  const requiredExports = [
    'VDE_SIZES',
    'VDE_CROSS_SECTIONS',
    'VDE_AMPACITY_RAW',
    'DERATE_FACTOR',
    'VDE_FUSE_MAP',
    'calculateMaxFuseBase',
    'lookupThermalCrossSectionBase',
    'calculateCrossSectionBase',
    'calculateStrokeWidth',
    'getEdgeDomain',
    'getHandleDomain',
    'VDE_CONDUIT_INNER_DIAMETERS',
    'VDE_MAX_CONDUIT_FILL_PERCENT',
    'VDE_CABLE_OUTER_DIAMETERS',
    'VDE_INVERTER_EFFICIENCY',
    'VDE_SOLAR_WINTER_REDUCTION',
    'VDE_SOLAR_VMP_VOLTAGE',
    'VDE_CHARGE_DERATING_FACTOR',
    'VDE_BATTERY_DOD',
    'calculateConduitFillPercent',
    'recommendConduitType',
  ] as const;

  it('exportiert alle erforderlichen Konstanten und Funktionen', () => {
    const missing = requiredExports.filter((name) => (vde as Record<string, unknown>)[name] === undefined);
    expect(missing).toEqual([]);
  });

  it('exportiert die entfernte Legacy-Validierungs-API nicht mehr (Mission 4)', () => {
    // Die zweite Validierungs-API und die parallelen Sicherungstabellen waren
    // toter Code und widersprachen der aktiven Logik (selectFuseSize/FUSE_MAP).
    const removed = [
      'VDE_CURRENT_CAPACITY',
      'VDE_STANDARD_FUSES',
      'VDE_CONSERVATIVE_FUSES',
      'calculateWire',
      'calculateMinCrossSection',
      'calculateVoltageDrop',
      'validateSchematic',
      'validateCableEdge',
      'validateBatteryNode',
      'validateShorePowerNode',
      'validateInverterNode',
    ];
    const present = removed.filter((name) => (vde as Record<string, unknown>)[name] !== undefined);
    expect(present).toEqual([]);
  });
});

describe('VDE-Konsistenz: Re-Exports aus electrical.ts', () => {
  it('VDE_SIZES ist dieselbe Referenz wie in electrical.ts', () => {
    expect(vde.VDE_SIZES).toBe(electrical.VDE_SIZES);
  });

  it('VDE_CROSS_SECTIONS ist ein Alias für electrical.VDE_SIZES', () => {
    expect(vde.VDE_CROSS_SECTIONS).toBe(electrical.VDE_SIZES);
    expect(vde.VDE_CROSS_SECTIONS).toEqual(electrical.VDE_SIZES);
  });

  it('VDE_AMPACITY_RAW ist dieselbe Referenz wie VDE_AMPACITY', () => {
    expect(vde.VDE_AMPACITY_RAW).toBe(electrical.VDE_AMPACITY);
  });

  it('VDE_FUSE_MAP ist dieselbe Referenz wie FUSE_MAP', () => {
    expect(vde.VDE_FUSE_MAP).toBe(electrical.FUSE_MAP);
  });

  it('DERATE_FACTOR stimmt mit electrical.ts überein', () => {
    expect(vde.DERATE_FACTOR).toBe(electrical.DERATE_FACTOR);
    expect(vde.DERATE_FACTOR).toBe(0.7);
  });

  it('calculateMaxFuseBase delegiert an electrical.calculateMaxFuse', () => {
    expect(vde.calculateMaxFuseBase(2.5)).toBe(electrical.calculateMaxFuse(2.5));
    expect(vde.calculateMaxFuseBase(2.5)).toBe(20);
  });

  it('lookupThermalCrossSectionBase delegiert an electrical.lookupThermalCrossSection', () => {
    expect(vde.lookupThermalCrossSectionBase(10)).toBe(electrical.lookupThermalCrossSection(10));
  });

  it('calculateCrossSectionBase delegiert an electrical.calculateCrossSection', () => {
    expect(vde.calculateCrossSectionBase(10, 3)).toBe(electrical.calculateCrossSection(10, 3));
  });

  it('getEdgeDomain / getHandleDomain / calculateStrokeWidth sind Re-Exports', () => {
    expect(vde.getEdgeDomain).toBe(electrical.getEdgeDomain);
    expect(vde.getHandleDomain).toBe(electrical.getHandleDomain);
    expect(vde.calculateStrokeWidth).toBe(electrical.calculateStrokeWidth);
  });
});
