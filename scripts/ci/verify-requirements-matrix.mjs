/**
 * scripts/ci/verify-requirements-matrix.mjs
 *
 * Automatisierter Konsistenzcheck für die Requirements Matrix.
 *
 * Prüft für jede Klasse-S-Anforderung (CAMP-REQ-XXX):
 *   1. Ein Safety-Case-Claim (CL-XXX) ist in der Spalte "Claim" zugeordnet.
 *   2. Ein Risk-Register-Eintrag (R-XXX) ist in der Spalte "Risk" zugeordnet.
 *   3. Der referenzierte Claim existiert in docs/safety/SAFETY-CASE.md.
 *   4. Der referenzierte Risk-Eintrag existiert in docs/safety/RISK-REGISTER.md.
 *
 * Bei Verstößen gibt das Skript die betroffenen Zeilen aus und beendet sich
 * mit Exit-Code 1 (CI-Job schlägt fehl).
 *
 * Aufruf: node scripts/ci/verify-requirements-matrix.mjs
 */

import { readFileSync } from 'node:fs';

const MATRIX_PATH = 'docs/verification/REQUIREMENTS-MATRIX.md';
const SAFETY_CASE_PATH = 'docs/safety/SAFETY-CASE.md';
const RISK_REGISTER_PATH = 'docs/safety/RISK-REGISTER.md';

const errors = [];

// --- Hilfsfunktionen -------------------------------------------------------

function readTableRows(path) {
  const text = readFileSync(path, 'utf8');
  const rows = [];
  const tableRe = /^\s*\|(.+)\|\s*$/m;
  let match;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) continue;
    // Trennzeile überspringen (|---|---|)
    if (/^\s*\|[\s\-:|]+\|\s*$/.test(line)) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx) => idx > 0 && idx < line.split('|').length - 1);
    if (cells.length >= 1) rows.push(cells);
  }
  return rows;
}

function extractIds(text, pattern) {
  const ids = new Set();
  let m;
  while ((m = pattern.exec(text)) !== null) {
    ids.add(m[0]);
  }
  return ids;
}

// --- Hauptprüfung ----------------------------------------------------------

const matrixRows = readTableRows(MATRIX_PATH);

// Spaltenindex in der Matrix-Tabelle:
// 0: Req-ID, 1: Anforderung, 2: Klasse, 3: Fachliche Grundlage, 4: Implementierung,
// 5: Test, 6: Ergebnis, 7: Release, 8: Claim, 9: Risk

const safetyCaseText = readFileSync(SAFETY_CASE_PATH, 'utf8');
const riskRegisterText = readFileSync(RISK_REGISTER_PATH, 'utf8');

const existingClaims = extractIds(safetyCaseText, /CL-\d{3}/g);
const existingRisks = extractIds(riskRegisterText, /R-\d{3}/g);

let classSCount = 0;

for (const row of matrixRows) {
  const reqId = row[0];
  if (!reqId || !reqId.startsWith('CAMP-REQ-')) continue;

  const klasse = row[2];
  const claim = row[8];
  const risk = row[9];

  if (klasse !== 'S') continue;

  classSCount++;

  // Prüfung 1: Klasse-S-Anforderung muss einen Claim haben (Matrix Rule M-4)
  if (!claim || claim === '—' || claim === '') {
    errors.push(
      `FEHLER: ${reqId} (Klasse S) hat keinen Safety-Case-Claim zugewiesen (Spalte "Claim" ist leer). ` +
        `Matrix Rule M-4 verlangt einen Claim für jede Klasse-S-Anforderung.`
    );
    continue; // Weitere Prüfungen für diesen Eintrag überspringen, da Claim fehlt
  }

  // Prüfung 2: Klasse-S-Anforderung muss einen Risk-Register-Eintrag haben (Matrix Rule M-4)
  if (!risk || risk === '—' || risk === '') {
    errors.push(
      `FEHLER: ${reqId} (Klasse S) hat keinen Risk-Register-Eintrag zugewiesen (Spalte "Risk" ist leer). ` +
        `Matrix Rule M-4 verlangt einen Risk-Register-Eintrag für jede Klasse-S-Anforderung.`
    );
    continue;
  }

  // Prüfung 3: Referenzierter Claim muss im Safety Case existieren
  const claimIds = claim.match(/CL-\d{3}/g) || [];
  for (const cid of claimIds) {
    if (!existingClaims.has(cid)) {
      errors.push(`FEHLER: ${reqId} verweist auf nicht existierenden Claim ${cid} im Safety Case.`);
    }
  }

  // Prüfung 4: Referenzierter Risk-Eintrag muss im Risk Register existieren
  const riskIds = risk.match(/R-\d{3}/g) || [];
  for (const rid of riskIds) {
    if (!existingRisks.has(rid)) {
      errors.push(`FEHLER: ${reqId} verweist auf nicht existierenden Risk-Register-Eintrag ${rid}.`);
    }
  }
}

// --- Ergebnis --------------------------------------------------------------

if (errors.length > 0) {
  console.error(`\n❌ REQUIREMENTS-MATRIX KONSISTENZCHECK FEHLGESCHLAGEN\n`);
  console.error(`Geprüfte Klasse-S-Anforderungen: ${classSCount}\n`);
  errors.forEach((e) => console.error(`  ${e}`));
  console.error(`\n${errors.length} Fehler gefunden.`);
  process.exit(1);
}

console.log(`\n✅ REQUIREMENTS-MATRIX KONSISTENZCHECK BESTANDEN\n`);
console.log(`Geprüfte Klasse-S-Anforderungen: ${classSCount}`);
console.log(`Alle Klasse-S-Anforderungen haben gültige Claims und Risk-Register-Einträge.\n`);
process.exit(0);
