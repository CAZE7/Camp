/** @type {import('./verify-requirements-matrix.mjs').VerifyMatrixOptions} */
/**
 * scripts/ci/verify-requirements-matrix.mjs
 *
 * Automatisierter Konsistenzcheck für die Requirements Matrix.
 *
 * Prüft für jede Klasse-S-Anforderung (CAMP-REQ-XXX) die vollständige
 * Traceability-Kette laut Matrix Rule M-4:
 *
 *   1. Requirement-ID im gültigen Format (CAMP-REQ-XXX)
 *   2. Requirement-Klasse (S, F, D, P, Q; Kombinationen wie "S/F" erlaubt)
 *   3. Fachliche Grundlage (nicht leer, nicht "—")
 *   4. Implementierungsreferenz (tatsächliche Dateipfade müssen existieren)
 *   5. Testreferenz (tatsächliche Dateipfade müssen existieren)
 *   6. Ergebnisstatus (Erfüllt, Teilweise, Offen, Nicht zutreffend; Zusatztexte in Klammern werden ignoriert)
 *   7. Safety-Case-Claim (für Klasse S zwingend, muss im Safety Case existieren)
 *   8. Risk-Register-Eintrag (für Klasse S zwingend, muss im Risk Register existieren)
 *   9. Release-Status (Warnung, nicht blockierend)
 *
 * Zusätzlich prüft Matrix Rule M-8 den semantischen Abgleich:
 * Ein Risiko, das im Safety Case ausdrücklich als unbehandelt offen annotiert
 * ist, darf im Risk Register nicht als technisch behandelt/geschlossen
 * dargestellt werden. Ein akzeptiertes Restrisiko ("Akzeptiert als Restrisiko")
 * bleibt als solches erkennbar und wird nicht mit "Behandelt" gleichgesetzt.
 *
 * Bei Verstößen gibt das Skript die betroffenen Zeilen aus und beendet sich
 * mit Exit-Code 1 (CI-Job schlägt fehl).
 *
 * Aufruf: node scripts/ci/verify-requirements-matrix.mjs [matrixPath] [safetyCasePath] [riskRegisterPath]
 *
 * Wenn matrixPath angegeben wird, wird diese Datei statt der Haupt-Matrix
 * geprüft (für Unit-Tests des Prüfsystems).
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_MATRIX_PATH = 'docs/verification/REQUIREMENTS-MATRIX.md';
const DEFAULT_SAFETY_CASE_PATH = 'docs/safety/SAFETY-CASE.md';
const DEFAULT_RISK_REGISTER_PATH = 'docs/safety/RISK-REGISTER.md';

const VALID_KLASSEN = new Set(['S', 'F', 'D', 'P', 'Q']);
const VALID_ERGEBNISSE = new Set(['Erfüllt', 'Teilweise', 'Offen', 'Nicht zutreffend']);

// Statuswerte, die als "technisch behandelt" gelten (für M-8-Abgleich).
// Prüft auf Präfix-Match, da Register-Status oft Zusätze tragen (z. B. "Behandelt (mit Nachweis)").
const BEHANDELT_LIKE = /^(Behandelt|geschlossen|Akzeptiert als Restrisiko)/i;

// Statuswerte im Risk Register, die als "nicht behandelt" gelten.
// Prüft auf Präfix-Match, da Register-Status oft Zusätze tragen.
const NICHT_BEHANDELT_LIKE = /^(Offen|In Behandlung)/i;

// --- Ergebnis-Typen ----------------------------------------------------------

/**
 * @typedef {Object} VerifyResult
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {number} classSCount
 * @property {number} totalCount
 */

/**
 * @typedef {Object} TableInfo
 * @property {string[]} headers
 * @property {number[][]} cellIndices  // [rowIndex, colIndex] für jede Pflichtspalte
 * @property {string[][]} rows
 */

// --- Markdown-Tabellen-Parsing (robust) --------------------------------------

/**
 * Teilt eine Markdown-Tabellenzeile in Zellen auf und behandelt dabei:
 * - escaped Pipes (\|) innerhalb von Zellen
 * - Backticks (keine Sonderbehandlung nötig, Pipes darin sind kein Trennzeichen)
 * - leere Zellen
 * - unterschiedliche Spaltenbreiten
 *
 * Die führende und abschließende "|"-Umrandung wird entfernt.
 */
function splitTableRow(line) {
  const cells = [];
  let current = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < line.length) {
      // Escaped Zeichen – nächstes Zeichen 1:1 übernehmen
      current += line[i + 1];
      i += 2;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Prüft, ob eine Zeile eine Markdown-Trennzeile ist (|---|:---|).
 */
function isSeparatorLine(line) {
  return /^\s*\|?\s*[\s\-:|]+\s*\|?\s*$/.test(line) && /[-:]/.test(line);
}

/**
 * Parst eine Markdown-Tabelle aus reinem Text.
 *
 * Gibt { headers, rows } zurück, wobei rows Arrays von Zellen-Strings sind.
 * Die erste Datenzeile nach der Trennzeile ist die Kopfzeile (headers).
 * Fehlerhafte Tabellen (ohne Kopfzeile, ohne Trennzeile) ergeben { headers: [], rows: [] }.
 */
function parseMarkdownTable(text) {
  const tables = [];
  let currentTable = null;
  let inTable = false;
  let headerDone = false;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      // Tabellen-Block verlassen
      if (inTable && headerDone && currentTable) {
        tables.push(currentTable);
        currentTable = null;
      }
      inTable = false;
      headerDone = false;
      continue;
    }

    if (isSeparatorLine(trimmed)) {
      if (inTable && !headerDone) {
        headerDone = true;
      }
      continue;
    }

    if (!inTable) {
      inTable = true;
      currentTable = { headers: [], rows: [] };
    }

    const cells = splitTableRow(trimmed);

    if (!headerDone) {
      // Erste Zeile = Kopfzeile
      currentTable.headers.push(...cells);
      headerDone = true;
    } else {
      currentTable.rows.push(cells);
    }
  }

  // Letzte Tabelle abschließen, falls Datei mit Tabelle endet
  if (inTable && headerDone && currentTable) {
    tables.push(currentTable);
  }

  return tables;
}

/**
 * Baut einen Index von Kopfzeilenname → Spaltenindex.
 * Doppelte Kopfzeilen werfen einen Fehler.
 */
function buildHeaderIndex(headers, tableName) {
  const index = new Map();
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim();
    if (!h) continue;
    if (index.has(h)) {
      throw new Error(
        `Tabelle "${tableName}": doppelte Kopfzeile "${h}" (Spaltenindex ${i}). ` +
          'Jede Pflichtspalte muss eindeutig benannt sein.'
      );
    }
    index.set(h, i);
  }
  return index;
}

/**
 * Liest eine Markdown-Datei und extrahiert die erste Tabelle mit Header-Index.
 * Gibt { headers, headerIndex, rows } oder wirft einen Fehler bei ungültiger Struktur.
 */
function readTableWithHeaders(path, requiredHeaders, tableName) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { error: `Datei nicht gefunden: ${path}`, headers: [], headerIndex: new Map(), rows: [] };
  }

  const tables = parseMarkdownTable(text);

  if (tables.length === 0) {
    return {
      error: `Tabelle "${tableName}" in ${path} hat keine erkennbare Kopfzeile.`,
      headers: [],
      headerIndex: new Map(),
      rows: [],
    };
  }

  // Die Tabelle finden, die alle erforderlichen Pflichtspalten enthält.
  // Die erste Tabelle im Dokument ist oft eine Legende, nicht die eigentliche Matrix.
  let selected = null;
  for (const t of tables) {
    const headerIndex = buildHeaderIndex(t.headers, tableName);
    const missing = requiredHeaders.filter((h) => !headerIndex.has(h));
    if (missing.length === 0) {
      selected = { headers: t.headers, headerIndex, rows: t.rows };
      break;
    }
  }

  if (!selected) {
    // Fallback: erste Tabelle nehmen, um eine aussagekräftige Fehlermeldung zu liefern
    const headerIndex = buildHeaderIndex(tables[0].headers, tableName);
    const missing = requiredHeaders.filter((h) => !headerIndex.has(h));
    return {
      error: `Tabelle "${tableName}" in ${path}: fehlende Pflichtspalte(n): ${missing.join(', ')}. Vorhanden: ${tables[0].headers.join(', ')}.`,
      headers: tables[0].headers,
      headerIndex,
      rows: tables[0].rows,
    };
  }

  return { ...selected, error: null };
}

/**
 * Holt den Zellwert einer Zeile über den Header-Namen.
 * Gibt '' zurück, wenn die Spalte nicht existiert oder die Zelle leer ist.
 */
function cellByHeader(row, headerIndex, name) {
  const idx = headerIndex.get(name);
  if (idx === undefined || idx >= row.length) return '';
  return (row[idx] || '').trim();
}

// --- ID-Extraktion nur aus offiziellen Tabellen ------------------------------

/**
 * Extrahiert alle IDs des Musters aus den Zellen einer Tabelle.
 * Nur echte Tabelleneinträge gelten als vorhanden; historische Erwähnungen
 * im Fließtext außerhalb von Tabellen zählen nicht.
 */
function extractIdsFromTable(rows, headerIndex, colName, pattern) {
  const ids = new Set();
  for (const row of rows) {
    const value = cellByHeader(row, headerIndex, colName);
    if (!value) continue;
    let m;
    while ((m = pattern.exec(value)) !== null) {
      ids.add(m[0]);
    }
  }
  return ids;
}

// --- Hilfsfunktionen ---------------------------------------------------------

function extractErgebnisstatus(value) {
  const trimmed = value.trim();
  if (/^Grün/i.test(trimmed)) return 'Erfüllt';
  const match = trimmed.match(/^(Erfüllt|Teilweise|Offen|Nicht zutreffend)/);
  return match ? match[1] : trimmed;
}

function looksLikeFilePath(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes('*')) return true;
  if (trimmed.startsWith('npm ') || trimmed.startsWith('npx ')) return false;
  if (trimmed.startsWith('out/')) return false;
  return trimmed.includes('/') || /^(lib|components|scripts|tests|app|store|docs)\//.test(trimmed);
}

function globMatchesAnyFile(pattern) {
  const trimmed = pattern.trim();
  if (!trimmed.includes('*')) return false;

  const lastSlash = trimmed.lastIndexOf('/');
  const dirPart = lastSlash >= 0 ? trimmed.slice(0, lastSlash + 1) : '';
  const filePart = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;

  if (!dirPart) {
    return dirHasMatch('.', filePart);
  }

  if (!existsSync(dirPart)) return false;
  return dirHasMatch(dirPart, filePart);
}

function dirHasMatch(dirPath, filePattern) {
  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return false;
  }

  const isRecursive = filePattern.includes('**');

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (isRecursive && dirHasMatch(fullPath, filePattern)) return true;
      continue;
    }

    if (entry.isFile() && matchesGlob(entry.name, filePattern)) {
      return true;
    }
  }

  return false;
}

function matchesGlob(filename, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(filename);
}

function fileExistsWithFallback(filePath) {
  if (filePath.includes('*')) {
    return globMatchesAnyFile(filePath);
  }
  if (existsSync(filePath)) return true;
  const knownExtensions = ['.ts', '.tsx', '.mjs', '.js', '.json'];
  for (const ext of knownExtensions) {
    if (!filePath.endsWith(ext) && existsSync(filePath + ext)) return true;
  }
  return false;
}

function extractFilePaths(value) {
  if (!value) return [];
  const paths = [];
  const parts = value.split(/[;,]/);
  for (const part of parts) {
    const trimmed = part.trim();
    const backtickMatches = trimmed.match(/`([^`]+)`/g);
    if (backtickMatches) {
      for (const bt of backtickMatches) {
        const content = bt.slice(1, -1);
        const filePath = content.split(/\s+/)[0];
        if (filePath && looksLikeFilePath(filePath)) {
          paths.push(filePath);
        }
      }
    } else {
      const candidate = trimmed.replace(/`/g, '').split(/\s+/)[0];
      if (candidate && looksLikeFilePath(candidate)) {
        paths.push(candidate);
      }
    }
  }
  return [...new Set(paths)];
}

function isEmptyOrDash(value) {
  return !value || value === '—' || value === '-' || value === '';
}

// --- Hauptprüfunktion --------------------------------------------------------

/**
 * Prüft eine Requirements Matrix und gibt ein Ergebnis-Objekt zurück.
 *
 * @param {string} matrixPath
 * @param {string} safetyCasePath
 * @param {string} riskRegisterPath
 * @returns {VerifyResult} { errors, warnings, classSCount, totalCount }
 */
function verifyMatrix(matrixPath, safetyCasePath, riskRegisterPath) {
  const errors = [];
  const warnings = [];

  // --- Requirements Matrix einlesen ------------------------------------------

  const MATRIX_HEADERS = [
    'Req-ID',
    'Anforderung',
    'Klasse',
    'Fachliche Grundlage',
    'Implementierung',
    'Test',
    'Ergebnis',
    'Release',
    'Claim',
    'Risk',
  ];

  const matrixTable = readTableWithHeaders(matrixPath, MATRIX_HEADERS, 'Requirements Matrix');
  if (matrixTable.error) {
    return { errors: [matrixTable.error], warnings: [], classSCount: 0, totalCount: 0 };
  }

  const { headerIndex: mIdx, rows: matrixRows } = matrixTable;

  let safetyCaseText = '';
  let riskRegisterText = '';

  // --- Safety Case einlesen (nur Tabellen, keine Fließtext-Erwähnungen) ------
  const safetyCaseTable = readTableWithHeaders(
    safetyCasePath,
    ['Claim', 'Ergebnis', 'Restrisiko'],
    'Safety Case'
  );
  if (safetyCaseTable.error) {
    warnings.push(`Safety-Case-Tabelle nicht lesbar: ${safetyCaseTable.error}`);
  } else {
    safetyCaseText = readFileSync(safetyCasePath, 'utf8');
  }

  // --- Risk Register einlesen (nur Tabellen) ---------------------------------
  const riskRegisterTable = readTableWithHeaders(
    riskRegisterPath,
    ['ID', 'Status'],
    'Risk Register'
  );
  if (riskRegisterTable.error) {
    warnings.push(`Risk-Register-Tabelle nicht lesbar: ${riskRegisterTable.error}`);
  } else {
    riskRegisterText = readFileSync(riskRegisterPath, 'utf8');
  }

  // Claim- und Risk-IDs nur aus den offiziellen Tabellen extrahieren
  const existingClaims = extractIdsFromTable(
    safetyCaseTable.rows,
    safetyCaseTable.headerIndex,
    'Claim',
    /CL-\d{3}/g
  );
  const existingRisks = extractIdsFromTable(
    riskRegisterTable.rows,
    riskRegisterTable.headerIndex,
    'ID',
    /R-\d{3}/g
  );

  // Doppelte Claim- und Risk-IDs in den offiziellen Tabellen erkennen
  const duplicateClaims = findDuplicateIds(safetyCaseTable.rows, safetyCaseTable.headerIndex, 'Claim', /CL-\d{3}/g);
  const duplicateRisks = findDuplicateIds(riskRegisterTable.rows, riskRegisterTable.headerIndex, 'ID', /R-\d{3}/g);
  for (const dup of duplicateClaims) {
    errors.push(`Safety Case: doppelter Claim ${dup} mehrfach in der Tabelle eingetragen.`);
  }
  for (const dup of duplicateRisks) {
    errors.push(`Risk Register: doppelter Risk ${dup} mehrfach in der Tabelle eingetragen.`);
  }

  // Risiko-Status aus dem Risk Register extrahieren (nur aus offizieller Tabelle)
  const riskStatuses = new Map();
  for (const row of riskRegisterTable.rows) {
    const riskId = cellByHeader(row, riskRegisterTable.headerIndex, 'ID');
    if (/^R-\d{3}$/.test(riskId)) {
      riskStatuses.set(riskId, cellByHeader(row, riskRegisterTable.headerIndex, 'Status'));
    }
  }

  // Offen-markierte Restrisiken aus dem Safety Case extrahieren (aus offizieller Tabelle)
  const offenMarkierteRestrisiken = extractOffenMarkierteRestrisikenFromTable(
    safetyCaseTable.rows,
    safetyCaseTable.headerIndex
  );

  // --- Matrix-Zeilen prüfen ---------------------------------------------------

  let classSCount = 0;
  let totalCount = 0;
  const seenReqIds = new Set();

  for (let rowIdx = 0; rowIdx < matrixRows.length; rowIdx++) {
    const row = matrixRows[rowIdx];
    const reqId = cellByHeader(row, mIdx, 'Req-ID');
    if (!reqId || !reqId.startsWith('CAMP-REQ-')) continue;

    totalCount++;

    // Doppelte Requirement-ID
    if (seenReqIds.has(reqId)) {
      errors.push(`Zeile ${rowIdx + 2}: Doppelte Requirement-ID ${reqId} in der Matrix.`);
    }
    seenReqIds.add(reqId);

    const claimRaw = cellByHeader(row, mIdx, 'Claim');
    const claimIds = claimRaw.match(/CL-\d{3}/g) || [];

    const riskRaw = cellByHeader(row, mIdx, 'Risk');
    const riskIds = riskRaw.match(/R-\d{3}/g) || [];

    const klasseRaw = cellByHeader(row, mIdx, 'Klasse');
    const grundlage = cellByHeader(row, mIdx, 'Fachliche Grundlage');
    const implementierung = cellByHeader(row, mIdx, 'Implementierung');
    const test = cellByHeader(row, mIdx, 'Test');
    const ergebnisRaw = cellByHeader(row, mIdx, 'Ergebnis');
    const release = cellByHeader(row, mIdx, 'Release');

    const zeilenInfo = `Zeile ${rowIdx + 2} (${reqId})`;

    // Prüfung 1: Requirement-ID Format
    if (!/^CAMP-REQ-\d{3}$/.test(reqId)) {
      errors.push(`${zeilenInfo}: Ungültige Requirement-ID-Format: "${reqId}". Erwartet: CAMP-REQ-XXX.`);
    }

    // Prüfung 2: Requirement-Klasse
    const klassenTeile = klasseRaw.split('/').map((k) => k.trim());
    let klasseUngueltig = false;
    for (const k of klassenTeile) {
      if (!VALID_KLASSEN.has(k)) {
        klasseUngueltig = true;
        break;
      }
    }
    if (klasseUngueltig || klassenTeile.length === 0) {
      errors.push(
        `${zeilenInfo}: Ungültige Klasse "${klasseRaw}". Erlaubt: S, F, D, P, Q (Kombinationen wie "S/F" möglich).`
      );
    }

    const primareKlasse = klassenTeile[0];

    // Prüfung 3: Fachliche Grundlage
    if (isEmptyOrDash(grundlage)) {
      errors.push(
        `${zeilenInfo}: Keine fachliche Grundlage angegeben. Jede Anforderung benötigt eine Quelle (Norm, Datenblatt, Modellannahme, Architekturentscheidung).`
      );
    }

    // Prüfung 4: Implementierungsreferenz
    const implPaths = extractFilePaths(implementierung);
    if (implPaths.length === 0 && !isEmptyOrDash(implementierung)) {
      warnings.push(`${zeilenInfo}: Kein erkennbarer Dateipfad in der Implementierungsreferenz: "${implementierung}".`);
    }
    for (const implFile of implPaths) {
      if (!fileExistsWithFallback(implFile)) {
        errors.push(
          `${zeilenInfo}: Implementierungsdatei nicht gefunden: "${implFile}" (aus "${implementierung}").`
        );
      }
    }

    // Prüfung 5: Testreferenz
    const testPaths = extractFilePaths(test);
    if (testPaths.length === 0 && !isEmptyOrDash(test)) {
      warnings.push(`${zeilenInfo}: Kein erkennbarer Dateipfad in der Testreferenz: "${test}".`);
    }
    for (const testFile of testPaths) {
      if (!fileExistsWithFallback(testFile)) {
        errors.push(`${zeilenInfo}: Testdatei nicht gefunden: "${testFile}" (aus "${test}").`);
      }
    }

    // Prüfung 6: Ergebnisstatus
    const ergebnisStatus = extractErgebnisstatus(ergebnisRaw);
    if (!VALID_ERGEBNISSE.has(ergebnisStatus)) {
      errors.push(
        `${zeilenInfo}: Ungültiger Ergebnisstatus "${ergebnisRaw}". Erlaubt: Erfüllt, Teilweise, Offen, Nicht zutreffend.`
      );
    }

    // Prüfung 7: Release-Status (Warnung)
    if (isEmptyOrDash(release)) {
      warnings.push(`${zeilenInfo}: Kein Release-Status angegeben. Empfohlen: Verweis auf Release/Gate.`);
    }

    // Prüfung 8+9: Klasse-S-Anforderungen benötigen Claim + Risk (M-4)
    if (primareKlasse === 'S') {
      classSCount++;

      if (isEmptyOrDash(claimRaw)) {
        errors.push(
          `${zeilenInfo}: Klasse-S-Anforderung hat keinen Safety-Case-Claim zugewiesen. Matrix Rule M-4 verlangt einen Claim für jede Klasse-S-Anforderung.`
        );
      } else {
        if (claimIds.length === 0) {
          errors.push(`${zeilenInfo}: Keine gültige Claim-ID (CL-XXX) in der Claim-Spalte: "${claimRaw}".`);
        }
        for (const cid of claimIds) {
          if (!existingClaims.has(cid)) {
            errors.push(`${zeilenInfo}: Verweist auf nicht existierenden Claim ${cid} im Safety Case.`);
          }
        }
      }

      if (isEmptyOrDash(riskRaw)) {
        errors.push(
          `${zeilenInfo}: Klasse-S-Anforderung hat keinen Risk-Register-Eintrag zugewiesen. Matrix Rule M-4 verlangt einen Risk-Register-Eintrag für jede Klasse-S-Anforderung.`
        );
      } else {
        if (riskIds.length === 0) {
          errors.push(`${zeilenInfo}: Keine gültige Risk-ID (R-XXX) in der Risk-Spalte: "${riskRaw}".`);
        }
        for (const rid of riskIds) {
          if (!existingRisks.has(rid)) {
            errors.push(`${zeilenInfo}: Verweist auf nicht existierenden Risk-Register-Eintrag ${rid}.`);
          }
        }
      }

      // "Erfüllt" darf nicht ohne vollständigen Nachweis sein
      if (ergebnisStatus === 'Erfüllt') {
        if (isEmptyOrDash(claimRaw) || isEmptyOrDash(riskRaw)) {
          errors.push(
            `${zeilenInfo}: Ergebnis "Erfüllt" ohne vollständigen Claim/Risk-Nachweis. Ein unvollständiger Nachweis darf niemals als erfüllt gelten.`
          );
        }
      }
    }
  }

  // --- Matrix Rule M-8: Semantischer Abgleich Safety Case ↔ Risk Register ---

  // Regel R1: Ein Risiko, das im Safety Case ausdrücklich als unbehandelt offen
  // annotiert ist ("R-XXX (offen: …)" oder "R-XXX (Akzeptiert als Restrisiko: …)"),
  // darf im Risk Register nicht als behandelt/geschlossen stehen.
  // "Akzeptiert als Restrisiko" (Safety Case) vs "Behandelt" (Register) sind
  // semantisch verschiedene Zustände (M-8: nicht gleichsetzen).
  // Wenn beide Seiten "Akzeptiert als Restrisiko" sagen, ist das konsistent.
  for (const { claimId, riskId, restrisiko, ergebnis, restrisikoTyp } of offenMarkierteRestrisiken) {
    const status = riskStatuses.get(riskId);
    if (status === undefined) {
      warnings.push(`${claimId}: Restrisiko verweist auf nicht im Risk Register vorhandenes ${riskId}.`);
    } else if (restrisikoTyp === 'offen' && BEHANDELT_LIKE.test(status)) {
      // Offen annotiert, aber Register sagt behandelt/geschlossen/akzeptiert → Widerspruch
      errors.push(
        `Widerspruch Safety Case ↔ Risk Register: Claim ${claimId} (Ergebnis "${ergebnis}") führt ${riskId} im Restrisiko als "offen" an ("${restrisiko}"), das Risk Register führt ${riskId} als "${status}". Entweder Restrisiko-Anmerkung im Safety Case oder Risk-Register-Status korrigieren (Requirements-Matrix-Regel M-8).`
      );
    } else if (
      restrisikoTyp === 'akzeptiert' &&
      /^(Behandelt|geschlossen)/i.test(status)
    ) {
      // Als Restrisiko akzeptiert, aber Register sagt technisch behandelt → Widerspruch
      errors.push(
        `Widerspruch Safety Case ↔ Risk Register: Claim ${claimId} (Ergebnis "${ergebnis}") führt ${riskId} im Restrisiko als "Akzeptiert als Restrisiko" an ("${restrisiko}"), das Risk Register führt ${riskId} als "${status}". "Akzeptiert als Restrisiko" ist nicht dasselbe wie "Behandelt" (Requirements-Matrix-Regel M-8).`
      );
    }
  }

  // Regel R2: Ein im Safety Case als behandelt/geschlossen dargestelltes Risiko
  // darf nicht ohne nachvollziehbare Begründung im Risk Register als unbehandelt
  // offen stehen. Das prüfen wir über Claims mit Ergebnis "Erfüllt", die auf
  // ein Risiko verweisen, das im Register "Offen" ist.
  for (let rowIdx = 0; rowIdx < matrixRows.length; rowIdx++) {
    const row = matrixRows[rowIdx];
    const reqId = cellByHeader(row, mIdx, 'Req-ID');
    if (!reqId || !reqId.startsWith('CAMP-REQ-')) continue;
    const ergebnisStatus = extractErgebnisstatus(cellByHeader(row, mIdx, 'Ergebnis'));
    if (ergebnisStatus !== 'Erfüllt') continue;

    const claimRaw = cellByHeader(row, mIdx, 'Claim');
    const riskRaw = cellByHeader(row, mIdx, 'Risk');
    const riskIds = riskRaw.match(/R-\d{3}/g) || [];

    // Finde den zugehörigen Claim im Safety Case, um dessen Restrisiko-Status zu prüfen
    for (const rid of riskIds) {
      const registerStatus = riskStatuses.get(rid);
      if (registerStatus && NICHT_BEHANDELT_LIKE.test(registerStatus)) {
        warnings.push(
          `${reqId}: Ergebnis "Erfüllt" verweist auf ${rid}, das im Risk Register als "${registerStatus}" geführt wird. Wenn der Claim erfüllt ist, sollte der Risiko-Status konsistent sein (Behandelt oder Akzeptiert als Restrisiko mit Begründung).`
        );
      }
    }
  }

  return { errors, warnings, classSCount, totalCount };
}

/**
 * Findet doppelte IDs in einer Tabellenspalte.
 */
function findDuplicateIds(rows, headerIndex, colName, pattern) {
  const counts = new Map();
  for (const row of rows) {
    const value = cellByHeader(row, headerIndex, colName);
    if (!value) continue;
    let m;
    while ((m = pattern.exec(value)) !== null) {
      counts.set(m[0], (counts.get(m[0]) || 0) + 1);
    }
  }
  const dups = [];
  for (const [id, count] of counts) {
    if (count > 1) dups.push(id);
  }
  return dups;
}

/**
 * Extrahiert aus dem Safety-Case alle Restrisiken, die explizit als "offen"
 * oder als "Akzeptiert als Restrisiko" annotiert sind
 * (Muster im Restrisiko-Zell: "R-004 (offen: …)" oder "R-004 (Akzeptiert als Restrisiko: …)").
 * Gibt { claimId, riskId, restrisiko, ergebnis, restrisikoTyp } zurück —
 * restrisikoTyp ist 'offen' oder 'akzeptiert'.
 * Liest nur aus der offiziellen Claims-Tabelle (nicht aus Fließtext).
 */
function extractOffenMarkierteRestrisikenFromTable(rows, headerIndex) {
  const found = [];
  const claimIdx = headerIndex.get('Claim');
  const ergebnisIdx = headerIndex.get('Ergebnis');
  const restrisikoIdx = headerIndex.get('Restrisiko');

  if (claimIdx === undefined || restrisikoIdx === undefined) return found;

  for (const row of rows) {
    const claimId = (row[claimIdx] || '').trim();
    if (!/^CL-\d{3}$/.test(claimId)) continue;
    const restrisiko = (row[restrisikoIdx] || '').trim();
    const ergebnis = ergebnisIdx !== undefined ? (row[ergebnisIdx] || '').trim() : '';

    // "offen"-Annotierung
    const offenMatches = restrisiko.match(/R-\d{3}[^|]*?\([^)]*offen[^)]*\)/gi);
    if (offenMatches) {
      for (const m of offenMatches) {
        const riskId = m.match(/R-\d{3}/)[0];
        found.push({ claimId, riskId, restrisiko, ergebnis, restrisikoTyp: 'offen' });
      }
    }

    // "Akzeptiert als Restrisiko"-Annotierung (semantisch ebenfalls unbehandelt)
    const akzeptiertMatches = restrisiko.match(/R-\d{3}[^|]*?\([^)]*Akzeptiert als Restrisiko[^)]*\)/gi);
    if (akzeptiertMatches) {
      for (const m of akzeptiertMatches) {
        const riskId = m.match(/R-\d{3}/)[0];
        found.push({ claimId, riskId, restrisiko, ergebnis, restrisikoTyp: 'akzeptiert' });
      }
    }
  }
  return found;
}

// --- CLI-Einstieg ----------------------------------------------------------

const scriptPath = import.meta.url.replace(/^file:\/\//, '');
const isMainModule = scriptPath === process.argv[1];

if (isMainModule) {
  const matrixPath = process.argv[2] || DEFAULT_MATRIX_PATH;
  const safetyCasePath = process.argv[3] || DEFAULT_SAFETY_CASE_PATH;
  const riskRegisterPath = process.argv[4] || DEFAULT_RISK_REGISTER_PATH;

  const result = verifyMatrix(matrixPath, safetyCasePath, riskRegisterPath);

  if (result.errors.length > 0) {
    console.error(`\n❌ REQUIREMENTS-MATRIX KONSISTENZCHECK FEHLGESCHLAGEN\n`);
    console.error(`Geprüfte Datei: ${matrixPath}`);
    console.error(`Anforderungen insgesamt: ${result.totalCount}`);
    console.error(`Klasse-S-Anforderungen: ${result.classSCount}\n`);
    result.errors.forEach((e) => console.error(`  ${e}`));
    if (result.warnings.length > 0) {
      console.error(`\n⚠️  Warnungen (nicht blockierend):`);
      result.warnings.forEach((w) => console.error(`  ${w}`));
    }
    console.error(`\n${result.errors.length} Fehler gefunden.`);
    process.exit(1);
  }

  console.log(`\n✅ REQUIREMENTS-MATRIX KONSISTENZCHECK BESTANDEN\n`);
  console.log(`Geprüfte Datei: ${matrixPath}`);
  console.log(`Anforderungen insgesamt: ${result.totalCount}`);
  console.log(`Klasse-S-Anforderungen: ${result.classSCount}\n`);
  if (result.warnings.length > 0) {
    console.log(`⚠️  Warnungen (nicht blockierend):`);
    result.warnings.forEach((w) => console.log(`  ${w}`));
    console.log();
  }
  process.exit(0);
}

export { verifyMatrix };

// Typ-Export für TypeScript-Tests
export const VerifyMatrixOptions = undefined;
