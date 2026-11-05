import { describe, it, expect } from 'vitest';
import { verifyMatrix } from './verify-requirements-matrix.mjs';

const FIXTURES_DIR = 'scripts/ci/__fixtures__';
type VerifyResult = { errors: string[]; warnings: string[]; classSCount: number; totalCount: number };

function checkMatrix(matrix: string, safetyCase?: string, riskRegister?: string): VerifyResult {
  return verifyMatrix(
    matrix,
    safetyCase ?? `${FIXTURES_DIR}/safety-case-valid.md`,
    riskRegister ?? `${FIXTURES_DIR}/risk-register-valid.md`
  ) as VerifyResult;
}

describe('verify-requirements-matrix.mjs', () => {
  it('vollständig korrekte Matrix besteht', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-valid.md`);
    expect(result.errors).toEqual([]);
    expect(result.totalCount).toBe(3);
    expect(result.classSCount).toBe(2);
  });

  it('fehlender Claim bei Klasse S schlägt fehl', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-missing-claim.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('keinen Safety-Case-Claim zugewiesen'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Matrix Rule M-4'))).toBe(true);
  });

  it('fehlender Risk-Eintrag bei Klasse S schlägt fehl', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-missing-risk.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('keinen Risk-Register-Eintrag zugewiesen'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Matrix Rule M-4'))).toBe(true);
  });

  it('nicht existierender Claim wird erkannt', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-nonexistent-claim.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('CL-999'))).toBe(true);
  });

  it('nicht existierender Risk-Eintrag wird erkannt', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-nonexistent-risk.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('R-999'))).toBe(true);
  });

  it('fehlerhafte Dateipfade werden erkannt', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-bad-paths.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('nicht gefunden'))).toBe(true);
  });

  it('nicht auflösbares Glob-Muster wird nicht als existierend akzeptiert', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-bad-glob.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('nicht gefunden'))).toBe(true);
  });

  it('Status "Erfüllt" ohne vollständigen Nachweis schlägt fehl', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-erfullt-ohne-nachweis.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.some((e) => e.includes('Ergebnis "Erfüllt" ohne vollständigen Claim/Risk-Nachweis'))
    ).toBe(true);
  });

  it('fehlerhafte Tabellenzeile (ungültige ID-Format) schlägt fehl', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-bad-row.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('Ungültige Requirement-ID-Format'))).toBe(true);
  });

  it('doppelte Requirement-IDs werden erkannt', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-duplicate-id.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('Doppelte Requirement-ID'))).toBe(true);
  });

  it('Teilweise-Offene Klasse-S-Anforderung ohne Claim wird als Fehler erkannt (nicht kaschiert)', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-missing-claim.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('keinen Safety-Case-Claim zugewiesen'))).toBe(true);
  });
});
