import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { verifyMatrix } from '../ci/verify-requirements-matrix.mjs';

const read = (path: string): string => readFileSync(path, 'utf8');
const safetyPath = 'docs/safety/SAFETY-CASE.md';
const matrixPath = 'docs/verification/REQUIREMENTS-MATRIX.md';
const riskPath = 'docs/safety/RISK-REGISTER.md';

/** Dokumentkorrekturen des Audits sind ebenfalls reproduzierbar abgesichert. */
describe('PR-609 — Dokumentation und ausführbare Nachweise bleiben konsistent', () => {
  it('die echte Requirements-Matrix und die offiziellen Sicherheitsregister bestehen M-4/M-8', () => {
    const result = verifyMatrix(matrixPath, safetyPath, riskPath) as { errors: string[] };
    expect(result.errors).toEqual([]);
    expect(read(matrixPath)).toContain('CAMP-REQ-029');
    expect(read(safetyPath)).toContain('| CL-024 |');
    expect(read(riskPath)).toContain('| R-026 |');
  });

  it('R-004 ist im Safety Case nicht länger fälschlich als unimplementiert/offen annotiert', () => {
    const claim = read(safetyPath)
      .split('\n')
      .find((line) => line.startsWith('| CL-002 |'));
    expect(claim).toContain('R-004 (behandelt:');
    expect(claim).toContain('fuse-offset-missing');
    expect(claim).not.toContain('R-004 (offen:');
    expect(read('components/edges/CableEdge.test.tsx')).toContain(
      "describe('fuse-offset-missing (R-004 / S-03)'"
    );
  });

  it('Rule S-1 und der Electrical-Kontext benennen dieselbe aktuelle Stromquelle', () => {
    const rule = read('docs/architecture/ARCHITECTURE-RULES.md')
      .split('### Rule S-1 —')[1]
      ?.split('### Rule S-2 —')[0];
    expect(rule).toContain('`getCableCurrents`');
    expect(read('docs/ai/ELECTRICAL-CONTEXT.md')).toContain(
      '`getCableCurrents(nodes, edges, systemVoltageV?)'
    );
    expect(read('lib/vde-consistency.test.ts')).toContain('getCableCurrents');
    expect(rule).not.toContain(
      'Stromquelle für Dimensionierung, Anzeige und Validierung: `calculateEdgeCurrent`'
    );
  });

  it('die konkreten Markdown-Dokumentverweise der Systemarchitektur existieren', () => {
    const doc = read('docs/architecture/SYSTEM-ARCHITECTURE.md');
    const paths = [...doc.matchAll(/`(docs\/[^`]+\.md)`/g)].map((match) => match[1]!);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(existsSync(path), path).toBe(true);
    expect(doc).toContain('`docs/ai/CODE-MAP.md`');
  });

  it('G2/G4/G6 sind implementiert dokumentiert und zeigen auf echte Testdateien/CI-Aufrufe', () => {
    const doc = read('docs/verification/RELEASE-GATES.md');
    for (const gate of ['G2', 'G4', 'G6']) {
      const row = doc.split('\n').find((line) => line.startsWith('| —') && line.includes(`| ${gate}`));
      expect(row, gate).toContain('umgesetzt');
    }
    for (const path of [
      'test/reference/differential.test.ts',
      'test/invariants/mutation-critical.test.ts',
      'test/invariants/silent-pass-gate.test.ts',
    ]) {
      expect(existsSync(path), path).toBe(true);
      expect(doc).toContain(path.split('/').at(-1));
    }
    const workflow = read('.github/workflows/quality.yml');
    expect(workflow).toContain('run: npm run test:coverage');
    expect(workflow).toContain('run: npm run test:gates');
    expect(workflow).toContain('run: npm run ci:verify-routing');
    expect(read('docs/CI.md')).toContain('M-13');
  });

  it('das bereits aktive Performance-Gate wird in der Strategie nicht als nicht blockierend dargestellt', () => {
    const row = read('docs/verification/VERIFICATION-STRATEGY.md')
      .split('## 6. Abnahmekriterien pro Verifikationsstufe')[1]!
      .split('\n')
      .find((line) => line.startsWith('| Performance '));
    expect(row).toContain('| Ja');
    expect(row).not.toContain('Nein (Gate existiert');
    expect(read('.github/workflows/quality.yml')).toContain('run: npm run perf:edge-routing');
  });

  it('S-03/S-3-Konflikt wird nicht als vollständig erfüllte Sicherheitsgarantie ausgegeben', () => {
    const safety = read(safetyPath);
    for (const id of ['CL-004', 'CL-014']) {
      const row = safety.split('\n').find((line) => line.startsWith(`| ${id} |`));
      expect(row, id).toContain('Teilweise');
      expect(row, id).toContain('R-027');
    }
    expect(
      read(riskPath)
        .split('\n')
        .find((line) => line.startsWith('| R-027 |'))
    ).toContain('Offen');
  });

  it.each([
    'docs/PR-MERGEPLAN.md',
    'docs/ABschlussbericht_PR604.md',
    'docs/AUDIT-ERGEBNISSE.md',
    'docs/default-branch-auf-main-umstellen.md',
  ])('%s kennzeichnet alte Merge-/Default-Branch-Angaben als historisch', (path) => {
    const head = read(path).split('\n').slice(0, 12).join('\n');
    expect(head).toContain('**Historischer Stand');
    expect(head).toContain('1cd4f81d');
    expect(head).toContain('`main`');
  });
});
