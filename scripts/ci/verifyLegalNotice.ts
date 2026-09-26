/**
 * Impressum-Wächter (AUDIT „Impressum-Placeholder").
 *
 * `app/impressum/page.tsx` wird öffentlich ausgeliefert (Static Export auf
 * GitHub Pages). Solange `SITE_LEGAL` Platzhalter trägt, ist die
 * Anbieterkennzeichnung nach § 5 DDG unvollständig — und ein unvollständiges
 * Impressum ist abmahnfähig. Der Befund des Dritt-Audits war genau das: Die
 * Seite stand seit dem Relaunch als Placeholder im Baum, und nichts hat es
 * gemeldet.
 *
 * Dieser Wächter macht den Mangel laut: Er läuft im **Deploy**-Workflow
 * (`.github/workflows/deploy.yml`, Job `build`, nach `npm ci`, vor dem Build)
 * und schreibt die offenen Felder in Log, Run-Annotation und Step-Summary.
 *
 * Stufe — Entscheidung des Betreibers (2026-09-26):
 *   `LEGAL_NOTICE_GATE=warn`  (Default) meldet und lässt den Deploy laufen.
 *   `LEGAL_NOTICE_GATE=block` stoppt den Deploy bei offenen Angaben.
 * Begründung für `warn`: Die Angaben kann nur der Betreiber liefern, und ein
 * Block stoppt die gesamte Veröffentlichung für ein Dokument, das er selbst
 * nachtragen muss. Der Mangel bleibt trotzdem sichtbar an der Stelle, an der
 * aus ihm ein Rechtsrisiko wird — und `block` ist eine Env-Variable entfernt.
 * Im Quality Gate läuft der Wächter bewusst nicht: Ein Pull Request ist keine
 * Veröffentlichung.
 *
 * Auszufüllen: `SITE_LEGAL` in `lib/siteLegal.ts` (fünf Felder, ein Ort).
 *
 * Aufruf (CI):  npx tsx scripts/ci/verifyLegalNotice.ts
 * Aufruf (lokal): npm run ci:verify-legal-notice
 * Exit 0 = melden (oder alles vollständig), Exit 1 = nur bei `block`.
 */
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGAL_FIELD_LABELS, SITE_LEGAL, missingLegalFields, type SiteLegal } from '../../lib/siteLegal';

/** Ort der Angaben — in jeder Meldung genannt, damit sie handhabbar ist. */
export const LEGAL_SOURCE_PATH = 'lib/siteLegal.ts';

/**
 * `warn` meldet, `block` stoppt den Deploy. Default ist `warn`
 * (Betreiber-Entscheidung, s. Header) — ein unbekannter Wert fällt auf den
 * Default zurück und sagt das, statt still eine andere Stufe zu wählen.
 */
export type GateMode = 'warn' | 'block';

export type LegalNoticeCheck = {
  /** Offene Felder (leer = Impressum vollständig). */
  missing: Array<keyof SiteLegal>;
  ok: boolean;
  /** Klartext für CI-Log — immer mit Grund und nächstem Schritt, nie ein nacktes „fail". */
  message: string;
};

export type GateDecision = {
  exitCode: 0 | 1;
  /** GitHub-Actions-Annotation (`::warning::`), damit es in der Run-Übersicht steht. */
  annotation: string | null;
  /** Markdown für `$GITHUB_STEP_SUMMARY`. */
  summary: string;
};

/**
 * Prüft die Anbieterangaben auf Vollständigkeit.
 *
 * Ein halb ausgefülltes Impressum zählt als unvollständig: Jedes Feld wird
 * einzeln geprüft, weil die Seite sonst vollständig aussieht und niemand mehr
 * nachsieht (dasselbe Muster wie `ok-with-assumption` ohne Hinweis, AUDIT N1).
 */
export function checkLegalNotice(legal: SiteLegal = SITE_LEGAL): LegalNoticeCheck {
  const missing = missingLegalFields(legal);
  const total = Object.keys(LEGAL_FIELD_LABELS).length;

  if (missing.length === 0) {
    return {
      missing,
      ok: true,
      message: `Impressum vollständig: alle ${total} Pflichtangaben sind in ${LEGAL_SOURCE_PATH} eingetragen.`,
    };
  }

  const fields = missing.map((field) => `  - ${LEGAL_FIELD_LABELS[field]} → \`${field}\``).join('\n');
  return {
    missing,
    ok: false,
    message:
      `Impressum unvollständig: ${missing.length} von ${total} Pflichtangaben fehlen in ${LEGAL_SOURCE_PATH}.\n` +
      `${fields}\n` +
      `Die Seite wird öffentlich ausgeliefert (GitHub Pages); ohne diese Angaben ist die\n` +
      `Anbieterkennzeichnung nach § 5 DDG unvollständig und abmahnfähig.\n` +
      `Beheben: SITE_LEGAL in ${LEGAL_SOURCE_PATH} ausfüllen (Betreiber-Angaben, nicht\n` +
      `erfinden). Die Seite zeigt bis dahin ihre Aufforderungstexte statt einer halben\n` +
      `Anschrift.`,
  };
}

/** Liest die Stufe aus der Umgebung; Unbekanntes fällt auf `warn` (mit Hinweis). */
export function gateModeFromEnv(env: Record<string, string | undefined> = process.env): {
  mode: GateMode;
  /** Nur gesetzt, wenn der Env-Wert nicht erkannt wurde. */
  notice: string | null;
} {
  const raw = (env.LEGAL_NOTICE_GATE ?? '').trim().toLowerCase();
  if (raw === 'block') return { mode: 'block', notice: null };
  if (raw === '' || raw === 'warn') return { mode: 'warn', notice: null };
  return {
    mode: 'warn',
    notice: `LEGAL_NOTICE_GATE='${raw}' ist unbekannt (erwartet: warn | block) — gemeldet wird mit 'warn'.`,
  };
}

/**
 * Übersetzt Prüfergebnis + Stufe in das, was der Runner tun soll.
 *
 * Pur gehalten (kein `process`, keine Datei-I/O), damit die Entscheidung
 * testbar ist — ein Wächter, dessen Verhalten nur im CI-Lauf sichtbar ist,
 * ist selbst ein unbelegtes Versprechen.
 */
export function decideLegalNoticeGate(params: { result: LegalNoticeCheck; mode: GateMode }): GateDecision {
  const { result, mode } = params;

  if (result.ok) {
    return {
      exitCode: 0,
      annotation: null,
      summary: `### Impressum\n\n✅ Vollständig — alle Pflichtangaben stehen in \`${LEGAL_SOURCE_PATH}\`.\n`,
    };
  }

  const list = result.missing.map((field) => `- ${LEGAL_FIELD_LABELS[field]} (\`${field}\`)`).join('\n');
  const consequence =
    mode === 'block'
      ? '🛑 **Deploy gestoppt** (`LEGAL_NOTICE_GATE=block`): Angaben eintragen und erneut deployen.'
      : '⚠️ Deploy läuft weiter (`LEGAL_NOTICE_GATE=warn`) — die öffentliche Seite zeigt bis dahin die Platzhalter-Texte. Scharf schaltbar mit `LEGAL_NOTICE_GATE=block`.';

  return {
    exitCode: mode === 'block' ? 1 : 0,
    annotation: `::warning title=Impressum unvollständig::${result.missing.length} Pflichtangabe(n) fehlen (${result.missing.join(', ')}) — auszufüllen in ${LEGAL_SOURCE_PATH}`,
    summary:
      `### Impressum\n\n` +
      `❗ Unvollständig — ${result.missing.length} Pflichtangabe(n) fehlen in \`${LEGAL_SOURCE_PATH}\`:\n\n` +
      `${list}\n\n` +
      `Die Seite wird öffentlich ausgeliefert; ohne diese Angaben ist die Anbieterkennzeichnung\n` +
      `nach § 5 DDG unvollständig und abmahnfähig.\n\n${consequence}\n`,
  };
}

/** CLI-Teil: nur bei direktem Aufruf, damit Tests die Funktionen pur nutzen. */
function main(): void {
  const { mode, notice } = gateModeFromEnv();
  const result = checkLegalNotice();
  const decision = decideLegalNoticeGate({ result, mode });

  if (notice) console.log(`[legal-notice] ${notice}`);
  console.log(`[legal-notice] ${result.message}`);
  if (decision.annotation) console.log(decision.annotation);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, `${decision.summary}\n`);
  }

  process.exitCode = decision.exitCode;
}

// `process.argv[1]` ist beim `tsx`-Aufruf das Skript selbst; beim Import aus
// einem Test bleibt der Block aus (die Prüflogik ist dann pur nutzbar).
const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main();
}
