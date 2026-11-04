/**
 * NET-003 — 230-V-Modellgrenzen sind ein prüfbares Gate, kein Kommentar.
 */
import { describe, expect, it } from 'vitest';
import {
  AC_230V_SCOPE_ITEMS,
  AC_ASSESSMENT_LABEL,
  QUALIFIED_PERSONNEL_NOTICE,
  checkAcModelScope,
} from './acScope';
import { ruleSpec } from './rules';
import { ENGINE_LIMITATIONS, verifyPlan } from './pipeline';
import { verificationOptions, type PassContext } from './context';
import { buildConductionGraph } from './graph';
import { healthyDcPlan, shorePlan, type FixturePlan } from './planFixtures';

const contextOf = (plan: FixturePlan): PassContext => ({
  nodes: plan.nodes,
  edges: plan.edges,
  graph: buildConductionGraph(plan.nodes, plan.edges),
  options: verificationOptions(),
});

describe('NET-003 — Datengrundlage der 230-V-Absicherung', () => {
  it('nennt alle drei Bewertungsstufen und belegt sie mit Gegenständen', () => {
    const levels = new Set(AC_230V_SCOPE_ITEMS.map((item) => item.assessment));
    expect([...levels].sort()).toEqual(['assumption-based', 'computed', 'unverifiable']);
    expect(AC_ASSESSMENT_LABEL.computed).toBe('rechnerisch bewertet');
    expect(AC_ASSESSMENT_LABEL['assumption-based']).toBe('mit Annahmen bewertet');
    expect(AC_ASSESSMENT_LABEL.unverifiable).toBe('nicht überprüfbar');
    for (const item of AC_230V_SCOPE_ITEMS) {
      expect(item.basis.length).toBeGreaterThan(20);
      expect(item.remedy.length).toBeGreaterThan(20);
    }
  });

  it('deckt die vom Gutachten genannten Punkte namentlich ab', () => {
    const all = AC_230V_SCOPE_ITEMS.map((i) => `${i.id} ${i.title} ${i.basis}`)
      .join(' ')
      .toLowerCase();
    for (const needle of [
      'l/n/pe',
      'netzform',
      'zweipolige',
      'umschaltung',
      'rückspeisung',
      'karosserie',
      'messwerte',
      'abnahme',
    ]) {
      expect(all).toContain(needle);
    }
  });

  it('ist als Modellgrenze deklariert — kein erfundenes Normzitat', () => {
    const spec = ruleSpec('NET-003-ac-model-scope');
    expect(spec.provenance).toBe('UNVERIFIED');
    expect(spec.clause).toBeNull();
    expect(spec.defaultKind).toBe('UNVERIFIABLE');
    expect(spec.pass).toBe(5);
  });
});

describe('NET-003 — Verhalten im Prüfbericht', () => {
  it('reiner 12-V-Plan: nicht anwendbar, keine künstliche Warnung', () => {
    const check = checkAcModelScope(contextOf(healthyDcPlan()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
    expect(check.events).toEqual([]);
  });

  it('230-V-Plan: drei UNVERIFIABLE-Befunde mit allen neun Einzelpunkten', () => {
    const check = checkAcModelScope(contextOf(shorePlan()));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.evaluatedEntities).toBeGreaterThan(0);
    expect(check.events).toHaveLength(3);
    const items = check.events.flatMap((event) => event.details?.acScopeItems ?? []);
    expect(items).toHaveLength(AC_230V_SCOPE_ITEMS.length);
    expect(new Set(items.map((item) => item.id)).size).toBe(AC_230V_SCOPE_ITEMS.length);
    for (const event of check.events) {
      expect(event.kind).toBe('UNVERIFIABLE');
      expect(event.details?.acAssessment).toBe('unverifiable');
      expect(event.message).toContain('qualifiziertes Personal');
      expect(event.autoFixRemedy.length).toBeGreaterThan(20);
      expect(event.entity.kind).toBe('system');
    }
  });

  it('deterministisch: zwei Läufe liefern identische Befunde', () => {
    const a = checkAcModelScope(contextOf(shorePlan()));
    const b = checkAcModelScope(contextOf(shorePlan()));
    expect(a.events.map((e) => `${e.entity.id}|${e.message}`)).toEqual(
      b.events.map((e) => `${e.entity.id}|${e.message}`)
    );
  });

  it('der Gesamtbericht bleibt INCOMPLETE und nennt die drei Stufen', () => {
    const report = verifyPlan({
      nodes: shorePlan().nodes,
      edges: shorePlan().edges,
      options: { profile: 'PRACTICE' },
    });
    expect(report.verdict).toBe('INCOMPLETE');
    expect(report.coverage.unprovable).toBeGreaterThan(0);
    expect(report.limitations.some((line) => line.includes('[rechnerisch bewertet]'))).toBe(true);
    expect(report.limitations.some((line) => line.includes('[mit Annahmen bewertet]'))).toBe(true);
    expect(report.limitations.some((line) => line.includes('[nicht überprüfbar]'))).toBe(true);
    expect(report.limitations.some((line) => line.includes(QUALIFIED_PERSONNEL_NOTICE))).toBe(true);
    expect(ENGINE_LIMITATIONS.length).toBeGreaterThanOrEqual(7);
  });

  it('ein 12-V-Plan bleibt COMPLIANT (kein unnötiger Vertrauensverlust)', () => {
    const report = verifyPlan({
      nodes: healthyDcPlan().nodes,
      edges: healthyDcPlan().edges,
      options: { profile: 'PRACTICE' },
    });
    expect(report.verdict).toBe('COMPLIANT');
    expect(report.events).toEqual([]);
    expect(report.skippedRules).toContain('NET-003-ac-model-scope');
  });
});
