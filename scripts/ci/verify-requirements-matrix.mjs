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
 * Bei Verstößen gibt das Skript die betroffenen Zeilen aus und beendet sich
 * mit Exit-Code 1 (CI-Job schlägt fehl).
 *
 * Aufruf: node scripts/ci/verify-requirements-matrix.mjs [matrixPath]
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

/**
 * Extrahiert den reinen Ergebnisstatus (ohne Zusatztexte in Klammern).
 * "Teilweise (Annahme nicht messverifiziert)" -> "Teilweise"
 * "Grün (blockierende Specs)" -> "Erfüllt" (Alias)
 */
function extractErgebnisstatus(value) {
  const trimmed = value.trim();
  if (/^Grün/i.test(trimmed)) return 'Erfüllt';
  const match = trimmed.match(/^(Erfüllt|Teilweise|Offen|Nicht zutreffend)/);
  return match ? match[1] : trimmed;
}

/**
 * Prüft, ob ein String ein tatsächlicher Dateipfad ist (enthält / oder . oder beginnt mit lib/|components/|scripts/|tests/|app/|store/|docs/).
 * Beschreibende Texte wie "UI-Komponenten delegieren an lib/" werden ignoriert.
 * Glob-Muster (enthaltend *) sind gültig. Build-Artefakte unter out/ werden ignoriert.
 */
function looksLikeFilePath(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes('*')) return true;
  if (trimmed.startsWith('npm ') || trimmed.startsWith('npx ')) return false;
  if (trimmed.startsWith('out/')) return false; // Build-Artefakt, keine Quelldatei
  return trimmed.includes('/') || /^(lib|components|scripts|tests|app|store|docs)\//.test(trimmed);
}

/**
 * Prüft, ob ein Glob-Muster tatsächlich mindestens eine Datei im
 * Dateisystem trifft. Unterstützt einfache Muster wie "tests/e2e/*.spec.ts".
 *
 * Gibt true zurück, wenn mindestens eine Datei gefunden wurde.
 * Gibt false zurück, wenn keine Datei gefunden wurde oder das Muster
 * nicht auflösbar ist.
 */
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

/**
 * Prüft, ob ein Verzeichnis mindestens eine Datei enthält, die dem
 * Dateinamen-Muster entspricht. Unterstützt ** für rekursive Suche.
 */
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

/**
 * Einfaches Glob-Matching für Dateinamen.
 * Unterstützt * (beliebige Zeichen innerhalb eines Namens).
 */
function matchesGlob(filename, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(filename);
}

/**
 * Prüft, ob eine Datei existiert, mit Fallback auf bekannte Endungen.
 * "lib/validationSeverity" -> prüft auch "lib/validationSeverity.ts", ".tsx", ".mjs", ".js"
 * Glob-Muster müssen tatsächlich mindestens einen Treffer liefern.
 */
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

/**
 * Parst eine Markdown-Tabelle (Text in Erinnerung, nicht Dateipfad) in
 * Zeilen von Zellen. Erste und letzte leere Zelle (Umrandung) werden entfernt,
 * Trennzeilen (|---|) übersprungen.
 */
function parseMarkdownTableRows(text) {
  const rows = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    // Trennzeile überspringen (|---|---|)
    if (/^\s*\|\s*[\s\-:|]+\|\s*$/.test(line)) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((_, idx) => idx > 0 && idx < line.split('|').length - 1);
    if (cells.length >= 1) rows.push(cells);
  }
  return rows;
}

/**
 * Extrahiert aus dem Safety-Case alle Restrisiken, die explizit als „offen\"
 * annotiert sind (Muster im Restrisiko-Zell: „R-004 (offen: …)\").
 * Gibt { claimId, riskId, restrisiko } zurück — generell, ohne harte IDs.
 */
function extractOffenMarkierteRestrisiken(safetyCaseText) {
  const found = [];
  const rows = parseMarkdownTableRows(safetyCaseText);
  // Claims-Tabelle: | ID | Behauptung | Argumentation | Kategorie | Referenz | Ergebnis | Restrisiko |
  for (const row of rows) {
    const claimId = (row[0] || '').trim();
    if (!/^CL-\d{3}$/.test(claimId)) continue;
    const restrisiko = row[6] || '';
    const ergebnis = (row[5] || '').trim();
    const matches = restrisiko.match(/R-\d{3}[^|]*?\([^)]*offen[^)]*\)/gi);
    if (matches) {
      for (const m of matches) {
        const riskId = m.match(/R-\d{3}/)[0];
        found.push({ claimId, riskId, restrisiko, ergebnis });
      }
    }
  }
  return found;
}

/**
 * Extrahiert aus dem Risk Register die Status pro Risiko-ID.
 * Risiko-Tabelle: | ID | ... | Status | Verantwortlich | Datum | (Status = Zelle 9).
 */
function extractRiskStatuses(riskRegisterText) {
  const statuses = new Map();
  const rows = parseMarkdownTableRows(riskRegisterText);
  for (const row of rows) {
    const riskId = (row[0] || '').trim();
    if (/^R-\d{3}$/.test(riskId)) {
      statuses.set(riskId, (row[9] || '').trim());
    }
  }
  return statuses;
}

/**
 * Extrahiert tatsächliche Dateipfade aus einer Test-/Implementierungsreferenz.
 *
 * Extrahiert zuerst alle Backtick-Inhalte (z. B. `lib/electrical.ts` aus
 * "`lib/electrical.ts` `selectFuseSize`"). Von jedem Backtick-Inhalt wird
 * nur der Teil vor dem ersten Leerzeichen genommen (Dateipfad ohne
 * Funktionsname). Glob-Muster (enthaltend *) sind gültig.
 *
 * Trennt bei Semikolon und beschreibt nur echte Dateipfade.
 */
function extractFilePaths(value) {
  if (!value) return [];
  const paths = [];
  const parts = value.split(/[;,]/);
  for (const part of parts) {
    const trimmed = part.trim();
    const backtickMatches = trimmed.match(/`([^`]+)`/g);
    if (backtickMatches) {
      for (const bt of backtickMatches) {
        const content = bt.slice(1, -1); // Backticks entfernen
        const filePath = content.split(/\s+/)[0]; // Nur Teil vor erstem Leerzeichen
        if (filePath && looksLikeFilePath(filePath)) {
          paths.push(filePath);
        }
      }
    } else {
      // Keine Backticks: ganzen Teil als Kandidaten betrachten
      const candidate = trimmed.replace(/`/g, '').split(/\s+/)[0];
      if (candidate && looksLikeFilePath(candidate)) {
        paths.push(candidate);
      }
    }
  }
  // Duplikate entfernen
  return [...new Set(paths)];
}

/**
 * Prüft eine Requirements Matrix und gibt ein Ergebnis-Objekt zurück.
 *
 * @returns {Object} { errors: string[], warnings: string[], classSCount: number, totalCount: number }
 */
function verifyMatrix(matrixPath, safetyCasePath, riskRegisterPath) {
  const errors = [];
  const warnings = [];

  // --- Hilfsfunktionen -------------------------------------------------------

  function readTableRows(path) {
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      return { rows: [], error: `Datei nicht gefunden: ${path}` };
    }
    const rows = [];
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line.startsWith('|')) continue;
      // Trennzeile überspringen (|---|---|)
      if (/^\s*\|[\s\-:|]+\|\s*$/.test(line)) continue;
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((_, idx) => idx > 0 && idx < line.split('|').length - 1);
      if (cells.length >= 1) rows.push(cells);
    }
    return { rows, error: null };
  }

  function extractIds(text, pattern) {
    const ids = new Set();
    let m;
    while ((m = pattern.exec(text)) !== null) {
      ids.add(m[0]);
    }
    return ids;
  }

  function isEmptyOrDash(value) {
    return !value || value === '—' || value === '-' || value === '';
  }

  // --- Dateien einlesen ------------------------------------------------------

  const matrixResult = readTableRows(matrixPath);
  if (matrixResult.error) {
    return { errors: [matrixResult.error], warnings: [], classSCount: 0, totalCount: 0 };
  }
  const matrixRows = matrixResult.rows;

  let safetyCaseText = '';
  let riskRegisterText = '';
  try {
    safetyCaseText = readFileSync(safetyCasePath, 'utf8');
  } catch {
    warnings.push(`Safety-Case nicht gefunden: ${safetyCasePath}`);
  }
  try {
    riskRegisterText = readFileSync(riskRegisterPath, 'utf8');
  } catch {
    warnings.push(`Risk Register nicht gefunden: ${riskRegisterPath}`);
  }

  const existingClaims = extractIds(safetyCaseText, /CL-\d{3}/g);
  const existingRisks = extractIds(riskRegisterText, /R-\d{3}/g);

  // Spaltenindex in der Matrix-Tabelle:
  // 0: Req-ID, 1: Anforderung, 2: Klasse, 3: Fachliche Grundlage,
  // 4: Implementierung, 5: Test, 6: Ergebnis, 7: Release, 8: Claim, 9: Risk

  let classSCount = 0;
  let totalCount = 0;
  const seenReqIds = new Set();

  for (let rowIdx = 0; rowIdx < matrixRows.length; rowIdx++) {
    const row = matrixRows[rowIdx];
    const reqId = row[0];
    if (!reqId || !reqId.startsWith('CAMP-REQ-')) continue;

    totalCount++;

    // Duplicate-ID prüfen
    if (seenReqIds.has(reqId)) {
      errors.push(`Zeile ${rowIdx + 2}: Doppelte Requirement-ID ${reqId} in der Matrix.`);
    }
    seenReqIds.add(reqId);

    const klasseRaw = row[2] || '';
    const anforderung = row[1] || '';
    const grundlage = row[3] || '';
    const implementierung = row[4] || '';
    const test = row[5] || '';
    const ergebnisRaw = row[6] || '';
    const release = row[7] || '';
    const claim = row[8] || '';
    const risk = row[9] || '';

    const zeilenInfo = `Zeile ${rowIdx + 2} (${reqId})`;

    // --- Prüfung 1: Requirement-ID Format -------------------------------
    if (!/^CAMP-REQ-\d{3}$/.test(reqId)) {
      errors.push(`${zeilenInfo}: Ungültige Requirement-ID-Format: "${reqId}". Erwartet: CAMP-REQ-XXX.`);
    }

    // --- Prüfung 2: Requirement-Klasse -------------------------------
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

    // --- Prüfung 3: Fachliche Grundlage -------------------------------
    if (isEmptyOrDash(grundlage)) {
      errors.push(
        `${zeilenInfo}: Keine fachliche Grundlage angegeben. Jede Anforderung benötigt eine Quelle (Norm, Datenblatt, Modellannahme, Architekturentscheidung).`
      );
    }

    // --- Prüfung 4: Implementierungsreferenz -------------------------------
    const implPaths = extractFilePaths(implementierung);
    if (implPaths.length === 0 && !isEmptyOrDash(implementierung)) {
      // Es steht etwas, aber kein erkennbarer Dateipfad - Warnung, kein Fehler
      warnings.push(
        `${zeilenInfo}: Kein erkennbarer Dateipfad in der Implementierungsreferenz: "${implementierung}".`
      );
    }
    for (const implFile of implPaths) {
      if (!fileExistsWithFallback(implFile)) {
        errors.push(
          `${zeilenInfo}: Implementierungsdatei nicht gefunden: "${implFile}" (aus "${implementierung}").`
        );
      }
    }

    // --- Prüfung 5: Testreferenz -------------------------------
    const testPaths = extractFilePaths(test);
    if (testPaths.length === 0 && !isEmptyOrDash(test)) {
      warnings.push(`${zeilenInfo}: Kein erkennbarer Dateipfad in der Testreferenz: "${test}".`);
    }
    for (const testFile of testPaths) {
      if (!fileExistsWithFallback(testFile)) {
        errors.push(`${zeilenInfo}: Testdatei nicht gefunden: "${testFile}" (aus "${test}").`);
      }
    }

    // --- Prüfung 6: Ergebnisstatus -------------------------------
    const ergebnisStatus = extractErgebnisstatus(ergebnisRaw);
    if (!VALID_ERGEBNISSE.has(ergebnisStatus)) {
      errors.push(
        `${zeilenInfo}: Ungültiger Ergebnisstatus "${ergebnisRaw}". Erlaubt: Erfüllt, Teilweise, Offen, Nicht zutreffend.`
      );
    }

    // --- Prüfung 7: Release-Status (Warnung, nicht blockierend) ---------
    if (isEmptyOrDash(release)) {
      warnings.push(`${zeilenInfo}: Kein Release-Status angegeben. Empfohlen: Verweis auf Release/Gate.`);
    }

    // --- Prüfung 8+9: Klasse-S-Anforderungen benötigen Claim + Risk (M-4) --
    if (primareKlasse === 'S') {
      classSCount++;

      // Claim prüfen
      if (isEmptyOrDash(claim)) {
        errors.push(
          `${zeilenInfo}: Klasse-S-Anforderung hat keinen Safety-Case-Claim zugewiesen. Matrix Rule M-4 verlangt einen Claim für jede Klasse-S-Anforderung.`
        );
      } else {
        const claimIds = claim.match(/CL-\d{3}/g) || [];
        if (claimIds.length === 0) {
          errors.push(`${zeilenInfo}: Keine gültige Claim-ID (CL-XXX) in der Claim-Spalte: "${claim}".`);
        }
        for (const cid of claimIds) {
          if (!existingClaims.has(cid)) {
            errors.push(`${zeilenInfo}: Verweist auf nicht existierenden Claim ${cid} im Safety Case.`);
          }
        }
      }

      // Risk prüfen
      if (isEmptyOrDash(risk)) {
        errors.push(
          `${zeilenInfo}: Klasse-S-Anforderung hat keinen Risk-Register-Eintrag zugewiesen. Matrix Rule M-4 verlangt einen Risk-Register-Eintrag für jede Klasse-S-Anforderung.`
        );
      } else {
        const riskIds = risk.match(/R-\d{3}/g) || [];
        if (riskIds.length === 0) {
          errors.push(`${zeilenInfo}: Keine gültige Risk-ID (R-XXX) in der Risk-Spalte: "${risk}".`);
        }
        for (const rid of riskIds) {
          if (!existingRisks.has(rid)) {
            errors.push(`${zeilenInfo}: Verweist auf nicht existierenden Risk-Register-Eintrag ${rid}.`);
          }
        }
      }

      // Prüfung: "Erfüllt" darf nicht ohne vollständigen Nachweis sein
      if (ergebnisStatus === 'Erfüllt') {
        if (isEmptyOrDash(claim) || isEmptyOrDash(risk)) {
          errors.push(
            `${zeilenInfo}: Ergebnis "Erfüllt" ohne vollständigen Claim/Risk-Nachweis. Ein unvollständiger Nachweis darf niemals als erfüllt gelten.`
          );
        }
      }
    }
  }

  // --- Semantischer Abgleich: Safety-Case-Restrisiken vs. Risk-Register-Status (Matrix Rule M-8) ---
  // Ein Risiko, das im Safety Case explizit als "offen" annotiert ist, darf im
  // Risk Register nicht als behandelt/geschlossen/akzeptiert stehen. Generell
  // ohne harte IDs — jeder Claims-/Risiko-Eintrag passt.
  const offenMarkierteRestrisiken = extractOffenMarkierteRestrisiken(safetyCaseText);
  const riskStatuses = extractRiskStatuses(riskRegisterText);
  const behandeltLike = /^(Behandelt|geschlossen|Akzeptiert)/i;
  for (const { claimId, riskId, restrisiko, ergebnis } of offenMarkierteRestrisiken) {
    const status = riskStatuses.get(riskId);
    if (status === undefined) {
      warnings.push(`${claimId}: Restrisiko verweist auf nicht im Risk Register vorhandenes ${riskId}.`);
    } else if (behandeltLike.test(status)) {
      errors.push(
        `Widerspruch Safety Case ↔ Risk Register: Claim ${claimId} (Ergebnis „${ergebnis}\") führt ${riskId} im Restrisiko als „offen" an („${restrisiko}\"), das Risk Register führt ${riskId} als „${status}\". Entweder Restrisiko-Anmerkung im Safety Case oder Risk-Register-Status korrigieren (Matrix Rule M-8).`
      );
    }
  }

  return { errors, warnings, classSCount, totalCount };
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
  console.log(`Klasse-S-Anforderungen: ${result.classSCount}`);
  console.log(`Alle Klasse-S-Anforderungen haben gültige Claims und Risk-Register-Einträge.\n`);
  if (result.warnings.length > 0) {
    console.log(`⚠️  Warnungen (nicht blockierend):`);
    result.warnings.forEach((w) => console.log(`  ${w}`));
    console.log();
  }
  process.exit(0);
}

export { verifyMatrix };
