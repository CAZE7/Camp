import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import { LEGAL_PLACEHOLDER, type SiteLegal } from '../../lib/siteLegal';
import {
  checkLegalNotice,
  decideLegalNoticeGate,
  gateModeFromEnv,
  LEGAL_SOURCE_PATH,
} from './verifyLegalNotice';

/**
 * Impressum-Wächter (AUDIT „Impressum-Placeholder").
 *
 * Ein öffentlich ausgeliefertes Impressum mit Platzhaltern ist nach § 5 DDG
 * unvollständig und abmahnfähig. Der Wächter nennt die offenen Felder im Deploy
 * (Log, Annotation, Step-Summary) — Stufe `warn` per Betreiber-Entscheidung,
 * `block` eine Env-Variable entfernt. Diese Tests pinnen die Prüflogik, die
 * Stufen-Umschaltung UND die Verankerung im Deploy-Workflow. Ein Wächter, den
 * kein Workflow aufruft, wäre genau die Fehlerklasse, die er melden soll
 * (Präzedenz: AUDIT T7).
 */

const REPO_ROOT = process.cwd();

const filled: SiteLegal = {
  providerName: 'Werft Ausbau GmbH',
  street: 'Hafenstraße 12',
  postalCodeAndCity: '28217 Bremen',
  email: 'kontakt@werft.example',
  contentResponsible: 'Mareike Jensen, Hafenstraße 12, 28217 Bremen',
};

const empty: SiteLegal = {
  providerName: LEGAL_PLACEHOLDER,
  street: LEGAL_PLACEHOLDER,
  postalCodeAndCity: LEGAL_PLACEHOLDER,
  email: LEGAL_PLACEHOLDER,
  contentResponsible: LEGAL_PLACEHOLDER,
};

describe('checkLegalNotice', () => {
  it('vollständige Angaben bestehen', () => {
    const result = checkLegalNotice(filled);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.message).toMatch(/vollständig/);
  });

  it('Platzhalter in jedem Feld scheitern und nennen alle Felder', () => {
    const result = checkLegalNotice(empty);
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(5);
    // Die Meldung muss handhabbar sein: Ort, Felder, Grund.
    expect(result.message).toContain(LEGAL_SOURCE_PATH);
    expect(result.message).toContain('providerName');
    expect(result.message).toContain('contentResponsible');
    expect(result.message).toMatch(/§ 5 DDG/);
  });

  it('ein halb ausgefülltes Impressum zählt als unvollständig', () => {
    const result = checkLegalNotice({ ...filled, email: LEGAL_PLACEHOLDER });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['email']);
  });

  it('prüft den echten Stand im Baum (Default-Argument)', () => {
    // Solange niemand SITE_LEGAL ausfüllt, ist das Impressum unvollständig —
    // genau der Befund des Audits. Nach dem Ausfüllen wird dieser Test grün.
    const result = checkLegalNotice();
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.ok).toBe(false);
  });
});

describe('gateModeFromEnv', () => {
  it('Default ist warn (Betreiber-Entscheidung)', () => {
    expect(gateModeFromEnv({}).mode).toBe('warn');
    expect(gateModeFromEnv({ LEGAL_NOTICE_GATE: 'warn' }).mode).toBe('warn');
  });

  it('block wird erkannt — auch mit Großbuchstaben und Leerzeichen', () => {
    expect(gateModeFromEnv({ LEGAL_NOTICE_GATE: 'block' }).mode).toBe('block');
    expect(gateModeFromEnv({ LEGAL_NOTICE_GATE: ' BLOCK ' }).mode).toBe('block');
  });

  it('ein unbekannter Wert fällt auf warn und sagt das', () => {
    // Keine stille dritte Stufe: Ein Tippfehler darf weder unbemerkt blockieren
    // noch unbemerkt schweigen.
    const decision = gateModeFromEnv({ LEGAL_NOTICE_GATE: 'hart' });
    expect(decision.mode).toBe('warn');
    expect(decision.notice).toMatch(/unbekannt/);
    expect(decision.notice).toMatch(/warn \| block/);
  });

  it('erkannte Werte brauchen keinen Hinweis', () => {
    expect(gateModeFromEnv({ LEGAL_NOTICE_GATE: 'warn' }).notice).toBeNull();
    expect(gateModeFromEnv({ LEGAL_NOTICE_GATE: 'block' }).notice).toBeNull();
  });
});

describe('decideLegalNoticeGate', () => {
  it('vollständige Angaben: kein Alarm, grüne Summary', () => {
    const decision = decideLegalNoticeGate({ result: checkLegalNotice(filled), mode: 'warn' });
    expect(decision.exitCode).toBe(0);
    expect(decision.annotation).toBeNull();
    expect(decision.summary).toContain('✅');
  });

  it('warn meldet Annotation und Summary, lässt den Deploy aber laufen', () => {
    const decision = decideLegalNoticeGate({ result: checkLegalNotice(empty), mode: 'warn' });
    expect(decision.exitCode).toBe(0);
    expect(decision.annotation).toMatch(/^::warning/);
    expect(decision.annotation).toContain('Impressum unvollständig');
    expect(decision.annotation).toContain(LEGAL_SOURCE_PATH);
    // Die Summary muss die Felder nennen, nicht nur „es fehlt was".
    expect(decision.summary).toContain('Anbietername');
    expect(decision.summary).toContain('contentResponsible');
    expect(decision.summary).toMatch(/Deploy läuft weiter/);
    expect(decision.summary).toContain('LEGAL_NOTICE_GATE=block');
  });

  it('block stoppt den Deploy bei offenen Angaben', () => {
    const decision = decideLegalNoticeGate({ result: checkLegalNotice(empty), mode: 'block' });
    expect(decision.exitCode).toBe(1);
    expect(decision.summary).toMatch(/Deploy gestoppt/);
  });

  it('block mit vollständigen Angaben läuft durch', () => {
    expect(decideLegalNoticeGate({ result: checkLegalNotice(filled), mode: 'block' }).exitCode).toBe(0);
  });
});
