import { describe, it, expect } from 'vitest';
import { verifyMatrix } from './verify-requirements-matrix.mjs';

const FIXTURES_DIR = 'scripts/ci/__fixtures__';
type VerifyResult = { errors: string[]; warnings: string[]; classSCount: number; totalCount: number };

function checkMatrixWith(matrix: string, safetyCase: string, riskRegister: string): VerifyResult {
  return verifyMatrix(matrix, safetyCase, riskRegister) as VerifyResult;
}

function errorsContaining(result: VerifyResult, needle: string): string[] {
  return result.errors.filter((e: string) => e.includes(needle));
}

function warningsContaining(result: VerifyResult, needle: string): string[] {
  return result.warnings.filter((w: string) => w.includes(needle));
}

function checkMatrix(matrix: string, safetyCase?: string, riskRegister?: string): VerifyResult {
  return verifyMatrix(
    matrix,
    safetyCase ?? `${FIXTURES_DIR}/safety-case-valid.md`,
    riskRegister ?? `${FIXTURES_DIR}/risk-register-valid.md`
  ) as VerifyResult;
}

describe('verify-requirements-matrix.mjs', () => {
  // --- Grundfunktionen ---

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

  it('doppelte Claim-IDs in der Safety-Case-Tabelle werden erkannt', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-valid.md`,
      `${FIXTURES_DIR}/safety-case-duplicate-claim.md`,
      `${FIXTURES_DIR}/risk-register-valid.md`
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('doppelter Claim'))).toBe(true);
  });

  it('doppelte Risk-IDs in der Risk-Register-Tabelle werden erkannt', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-valid.md`,
      `${FIXTURES_DIR}/safety-case-valid.md`,
      `${FIXTURES_DIR}/risk-register-duplicate-risk.md`
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('doppelter Risk'))).toBe(true);
  });

  it('nur im Fließtext erwähnte ID zählt nicht als gültiger Claim', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-claim-only-in-fließtext.md`,
      `${FIXTURES_DIR}/safety-case-claim-only-in-fließtext.md`,
      `${FIXTURES_DIR}/risk-register-valid.md`
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('CL-888'))).toBe(true);
    expect(result.errors.some((e) => e.includes('nicht existierenden Claim'))).toBe(true);
  });

  it('falsche Tabellenstruktur (keine Kopfzeile) führt zu Fehler', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-no-header.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('keine erkennbare Kopfzeile'))).toBe(true);
  });

  it('fehlende Pflichtspalte führt zu Fehler', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-missing-column.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('fehlende Pflichtspalte'))).toBe(true);
  });

  it('geänderte Spaltenreihenfolge wird korrekt verarbeitet', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-reordered-columns.md`,
      `${FIXTURES_DIR}/safety-case-valid.md`,
      `${FIXTURES_DIR}/risk-register-valid.md`
    );
    expect(result.errors).toEqual([]);
    expect(result.totalCount).toBe(2);
    expect(result.classSCount).toBe(2);
  });

  it('fehlender Status in der Matrix schlägt fehl', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-missing-status.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('Ungültiger Ergebnisstatus'))).toBe(true);
  });

  it('unbekannter Status in der Matrix schlägt fehl', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-unknown-status.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('Ungültiger Ergebnisstatus'))).toBe(true);
  });

  it('escaped Pipes in Tabellenzellen werden korrekt geparst', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-escaped-pipes.md`);
    expect(result.errors).toEqual([]);
    expect(result.totalCount).toBe(1);
  });

  it('Backticks in Tabellenzellen werden korrekt geparst', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-backticks.md`);
    expect(result.errors).toEqual([]);
    expect(result.totalCount).toBe(1);
  });

  it('mehrere Risiken in einem Claim werden alle geprüft', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-multiple-risks.md`,
      `${FIXTURES_DIR}/safety-case-valid.md`,
      `${FIXTURES_DIR}/risk-register-multiple-risks.md`
    );
    expect(result.errors.length).toBeGreaterThan(0);
    // R-501 existiert im Register (kein Fehler), R-502 existiert nicht (Fehler)
    expect(result.errors.some((e) => e.includes('R-502'))).toBe(true);
    expect(result.errors.some((e) => e.includes('nicht existierenden Risk-Register-Eintrag'))).toBe(true);
  });

  it('mehrere Claims mit demselben Risiko sind zulässig', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-multiple-claims-same-risk.md`,
      `${FIXTURES_DIR}/safety-case-multiple-claims-same-risk.md`,
      `${FIXTURES_DIR}/risk-register-valid.md`
    );
    expect(result.errors).toEqual([]);
    expect(result.totalCount).toBe(2);
  });

  // --- Matrix Rule M-8: Semantischer Statusabgleich ---

  it('erkennt Widerspruch: Safety Case führt Risiko als „offen\", Risk Register behandelt es', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-valid.md`,
      `${FIXTURES_DIR}/safety-case-open-restrisiko.md`,
      `${FIXTURES_DIR}/risk-register-treated.md`
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(errorsContaining(result, 'Widerspruch Safety Case ↔ Risk Register')).toHaveLength(1);
    expect(errorsContaining(result, 'R-300')).toHaveLength(1);
    expect(errorsContaining(result, 'Requirements-Matrix-Regel M-8')).toHaveLength(1);
  });

  it('kein Widerspruch: Safety Case führt Risiko als „offen\", Risk Register führt es ebenfalls als „offen\"', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-valid.md`,
      `${FIXTURES_DIR}/safety-case-open-restrisiko.md`,
      `${FIXTURES_DIR}/risk-register-open.md`
    );
    expect(errorsContaining(result, 'Widerspruch Safety Case ↔ Risk Register')).toEqual([]);
  });

  it('kein Widerspruch: Safety Case ohne offen-Annotierung im Restrisiko', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-valid.md`,
      `${FIXTURES_DIR}/safety-case-valid.md`,
      `${FIXTURES_DIR}/risk-register-valid.md`
    );
    expect(errorsContaining(result, 'Widerspruch Safety Case ↔ Risk Register')).toEqual([]);
  });

  it('behandelt gegen offen: Safety Case behandelt Risiko, Risk Register führt es als offen', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-valid.md`,
      `${FIXTURES_DIR}/safety-case-treated-risk.md`,
      `${FIXTURES_DIR}/risk-register-open.md`
    );
    // Safety Case behandelt, Register sagt Offen → nur Warnung, kein harter Fehler
    // (ein behandeltes Risiko kann als offenes Restrisiko akzeptiert sein)
    expect(
      errorsContaining(result, 'Widerspruch Safety Case ↔ Risk Register')
    ).toEqual([]);
  });

  it('akzeptiertes Restrisiko im Safety Case bleibt als solches erkennbar', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-valid.md`,
      `${FIXTURES_DIR}/safety-case-accepted-restrisiko.md`,
      `${FIXTURES_DIR}/risk-register-accepted-restrisiko.md`
    );
    expect(errorsContaining(result, 'Widerspruch Safety Case ↔ Risk Register')).toEqual([]);
    expect(
      warningsContaining(result, 'Akzeptiert als Restrisiko')
    ).toEqual([]);
  });

  it('akzeptiertes Restrisiko gegen technisch behandeltes Risiko wird als Widerspruch erkannt', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-valid.md`,
      `${FIXTURES_DIR}/safety-case-accepted-restrisiko.md`,
      `${FIXTURES_DIR}/risk-register-treated.md`
    );
    // Safety Case: Risiko als akzeptiertes Restrisiko offen annotiert
    // Risk Register: als Behandelt → Widerspruch (akzeptiert ≠ technisch behandelt)
    expect(
      errorsContaining(result, 'Widerspruch Safety Case ↔ Risk Register')
    ).toHaveLength(1);
  });

  it('fehlende offizielle Registry-Einträge werden nicht aus Fließtext angenommen', () => {
    const result = checkMatrixWith(
      `${FIXTURES_DIR}/matrix-id-only-in-fließtext.md`,
      `${FIXTURES_DIR}/safety-case-id-only-in-fließtext.md`,
      `${FIXTURES_DIR}/risk-register-id-only-in-fließtext.md`
    );
    expect(result.errors.length).toBeGreaterThan(0);
    // Kein Claim in der offiziellen Tabelle → muss als nicht existent erkannt werden
    expect(result.errors.some((e) => e.includes('CL-777'))).toBe(true);
    expect(result.errors.some((e) => e.includes('R-777'))).toBe(true);
  });

  it('Teilweise-Offene Klasse-S-Anforderung ohne Claim wird als Fehler erkannt (nicht kaschiert)', () => {
    const result = checkMatrix(`${FIXTURES_DIR}/matrix-missing-claim.md`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('keinen Safety-Case-Claim zugewiesen'))).toBe(true);
  });
});
