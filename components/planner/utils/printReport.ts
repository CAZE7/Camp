/**
 * Druckbericht des Planers (PDF über den Druckdialog des Browsers).
 *
 * Es entsteht kein eigenes PDF-Format: Der Bericht ist ein eigenständiges,
 * druckoptimiertes HTML-Dokument. Der Nutzer speichert es im Druckdialog als
 * PDF. So bleibt die Anwendung ohne Backend und ohne zusätzliche Abhängigkeit.
 *
 * Grundregeln:
 *  - Alle Zahlen und Befunde stammen aus EINEM Snapshot (Stückliste, Prüfbericht,
 *    Planstand). Der Bericht kombiniert keine Stände.
 *  - Ein gesperrter Plan erzeugt KEINEN Bericht mit Stückliste; nur die
 *    kritischen Befunde werden ausgegeben.
 *  - Jeder Bericht trägt Entwurf/Softwareprüfung-Status, Planstand, Engine-Version,
 *    Modellgrenzen und den Hinweis, dass dies keine normative Abnahme ist.
 */
import type { BomData } from './bom';
import { componentTypeInfo, lengthsDiverge } from './bom';
import type { ReleaseAssessment } from './releaseStatus';
import type { VerificationSummary } from './verificationWarnings';
import { toPlainGerman } from './plainGerman';

export interface PrintReportInput {
  bom: BomData;
  summary: VerificationSummary | null;
  assessment: ReleaseAssessment;
  /** Zeitpunkt der Erzeugung (ISO), nur zur Anzeige. */
  generatedAt: string;
  projectName: string;
}

/** HTML-Escaping für jede Nutzer- oder Engine-Zeichenkette. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function num(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

const DISCLAIMER =
  'Dieser Bericht ist eine Software-Auswertung des Planungsstands. Er ersetzt keine Prüfung durch eine qualifizierte Elektrofachkraft, keine normative Abnahme und keine Herstellerfreigabe. Offene Angaben und Modellgrenzen sind unten ausgewiesen.';

function statusBlock(assessment: ReleaseAssessment): string {
  const cls = assessment.status === 'gesperrt' ? 'status status-blocked' : 'status';
  return `<section class="${cls}">
    <h2>Dokumentstatus: ${escapeHtml(assessment.label)}</h2>
    <p>${escapeHtml(assessment.explanation)}</p>
  </section>`;
}

function blockersBlock(assessment: ReleaseAssessment): string {
  if (assessment.blockers.length === 0) return '';
  return `<section>
    <h2>Kritische Befunde (sperren das Dokument)</h2>
    <ul>${assessment.blockers.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>
  </section>`;
}

function bomBlock(bom: BomData): string {
  const components = Object.entries(bom.counts)
    .map(
      ([type, count]) =>
        `<tr><td>${escapeHtml(componentTypeInfo(type).label)}</td><td class="num">${count}</td><td>Stk</td></tr>`
    )
    .join('');
  const cables = Object.entries(bom.cableLengths)
    .map(
      ([cs, meters]) =>
        `<tr><td>Leitung ${escapeHtml(cs)} mm²</td><td class="num">${num(meters)}</td><td>m</td></tr>`
    )
    .join('');
  const pipes = Object.entries(bom.pipeLengths)
    .map(
      ([type, meters]) =>
        `<tr><td>${type === 'gray' ? 'Abwasserrohr' : 'Frischwasserrohr'}</td><td class="num">${num(meters)}</td><td>m</td></tr>`
    )
    .join('');
  const rows = components + cables + pipes;
  const assumptions = bom.lengthAssumptions
    .map((entry) => {
      const text =
        entry.source === 'fallback'
          ? `${num(entry.meters)} m Platzhalter (keine Länge eingetragen, keine Route)`
          : `${num(entry.meters)} m verwendet (eingetragen ${entry.storedM !== undefined ? num(entry.storedM) : '–'} m, geroutet ${entry.routedM !== undefined ? num(entry.routedM) : '–'} m${lengthsDiverge(entry) ? ', Abweichung > 10 %' : ''})`;
      return `<li><strong>${escapeHtml(entry.label)}</strong>: ${escapeHtml(text)}</li>`;
    })
    .join('');
  return `<section>
    <h2>Stückliste</h2>
    ${rows ? `<table><thead><tr><th>Position</th><th class="num">Menge</th><th>Einheit</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>Keine Bauteile oder Leitungen im Plan.</p>'}
    ${assumptions ? `<h3>Längenhinweise</h3><ul>${assumptions}</ul>` : ''}
  </section>`;
}

function verificationBlock(summary: VerificationSummary | null): string {
  if (summary === null) return '<section><h2>Prüfbericht</h2><p>Keine Prüfung vorhanden.</p></section>';
  const findings = summary.findings
    .map(
      (finding) =>
        `<li>${escapeHtml(toPlainGerman(finding.message))}${finding.source ? ` <em>(${escapeHtml(finding.source)})</em>` : ''}</li>`
    )
    .join('');
  return `<section>
    <h2>Prüfbericht</h2>
    <p>${escapeHtml(summary.headline)}</p>
    <table>
      <tbody>
        <tr><th>Regeln angewandt</th><td class="num">${summary.exercised}</td></tr>
        <tr><th>bestanden</th><td class="num">${summary.passed}</td></tr>
        <tr><th>nicht erfüllt</th><td class="num">${summary.failed}</td></tr>
        <tr><th>Angaben fehlen (nicht prüfbar)</th><td class="num">${summary.unprovable}</td></tr>
        <tr><th>nicht zutreffend (kein Gegenstand im Plan)</th><td class="num">${summary.notApplicable}</td></tr>
      </tbody>
    </table>
    ${findings ? `<h3>Befunde</h3><ul>${findings}</ul>` : '<p>Keine offenen Befunde.</p>'}
    <h3>Modellgrenzen und Annahmen</h3>
    <ul>${summary.limitations.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
  </section>`;
}

/**
 * Baut das vollständige HTML-Dokument. Die Funktion ist rein: gleicher Input,
 * gleiches Ergebnis (bis auf nichts — der Zeitstempel kommt von außen).
 */
export function buildPrintReportHtml(input: PrintReportInput): string {
  const { assessment, bom, summary } = input;
  const blocked = assessment.status === 'gesperrt';
  const planRef = assessment.planFingerprintHash ?? 'kein Planstand (leerer Plan)';
  const body = [
    statusBlock(assessment),
    blockersBlock(assessment),
    blocked
      ? '<section><p><strong>Stückliste und Dokument werden nicht ausgegeben, solange kritische Befunde offen sind.</strong></p></section>'
      : bomBlock(bom),
    verificationBlock(summary),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.projectName)} – Planungsbericht</title>
<style>
  /* Monochromer Druckstil: Der Bericht läuft in einem eigenen Fenster ohne
     App-CSS und ist für Schwarz-Weiß-Druck gedacht. Farbliterale sind hier
     bewusst vermieden (Design-Token-Regel D-1); der gesperrte Status ist durch
     Text und doppelten Rahmen gekennzeichnet, nicht nur durch Farbe. */
  @page { size: A4; margin: 16mm; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; color: black; font-size: 11pt; line-height: 1.4; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  h2 { font-size: 13pt; margin: 14pt 0 6pt; border-bottom: 1px solid gray; padding-bottom: 2pt; }
  h3 { font-size: 11pt; margin: 10pt 0 4pt; }
  table { width: 100%; border-collapse: collapse; margin: 4pt 0; }
  th, td { border: 1px solid gray; padding: 3pt 5pt; text-align: left; vertical-align: top; }
  th { background: whitesmoke; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .meta { color: dimgray; font-size: 9pt; }
  .status { border: 1px solid black; padding: 6pt 8pt; margin-top: 8pt; }
  .status-blocked { border: 4px double black; }
  .disclaimer { font-size: 9pt; color: dimgray; border-top: 1px solid gray; margin-top: 16pt; padding-top: 6pt; }
  /* Nachtest Bug 8: break-inside:avoid-page auf JEDER Sektion drückte
     die lange Stückliste komplett auf Seite 2+ — Seite 1 zeigte nur die
     Statusbox. Jetzt: nur Status/Zeilen unzertrennlich, Tabellen dürfen
     umbrechen und ihr Kopf wiederholt sich auf jeder Seite. */
  .status { break-inside: avoid-page; }
  thead { display: table-header-group; }
  tr { break-inside: avoid-page; }
  h2, h3 { break-after: avoid-page; }
  .print-actions { margin: 12pt 0; }
  .print-actions button { font-size: 12pt; padding: 8pt 16pt; cursor: pointer; }
  @media print { .print-actions { display: none; } }
</style>
</head>
<body>
<h1>${escapeHtml(input.projectName)} – Planungsbericht</h1>
<p class="meta">Erzeugt: ${escapeHtml(input.generatedAt)} · Planstand: <code>${escapeHtml(planRef)}</code>${summary ? ` · Engine ${escapeHtml(summary.engineVersion)} · Zertifikat ${escapeHtml(summary.certificateHash)}` : ''}</p>
${body}
<p class="disclaimer">${escapeHtml(DISCLAIMER)}</p>
<div class="print-actions"><button type="button" onclick="window.print()">Diesen Bericht drucken / als PDF speichern</button></div>
</body>
</html>`;
}

/**
 * Öffnet den Bericht in einem neuen Fenster und startet den Druckdialog.
 * Gibt `false` zurück, wenn der Browser das Fenster blockiert.
 */
export function openPrintReport(html: string): boolean {
  // Kein `noopener` im Feature-String: Dann liefert `window.open` immer `null`.
  // Stattdessen die Verbindung nach dem Öffnen kappen.
  const win = window.open('', '_blank');
  if (!win) return false;
  win.opener = null;
  // Nachtest Bug 8: Titel vor dem Schreiben, Druck genau einmal nach load.
  // Ein fester Timer druckte bei langsamem Rendern „about:blank“.
  const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1];
  if (title) win.document.title = title.replace(/&amp;/g, '&');
  let printed = false;
  const printOnce = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus?.();
    } catch {
      /* Fokus ist Komfort; der Druck darf daran nicht scheitern. */
    }
    try {
      win.print();
    } catch {
      /* Der Knopf im Dokument bleibt als manueller Ausweg. */
    }
  };
  win.document.open();
  win.document.write(html);
  win.document.close();
  if (win.document.readyState === 'complete') printOnce();
  else win.addEventListener('load', printOnce, { once: true });
  // Absicherung, falls `load` nicht mehr feuert.
  win.setTimeout(printOnce, 1500);
  return true;
}
