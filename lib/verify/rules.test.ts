import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FINDING_KINDS,
  INSTALLATION_CONTEXTS,
  PROVENANCES,
  SEVERITY_ORDER,
  VERIFICATION_PROFILES,
} from './types';
import {
  RULE_IDS,
  RULE_MATRIX,
  isVerificationProfile,
  profileCovers,
  ruleSpec,
  rulesForContext,
} from './rules';

const VERIFY_DIR = __dirname;

/**
 * Alle Regel-IDs, die als String-Literal in der Implementierung vorkommen.
 *
 * Die Matrix ist der Vertrag; die Literale sind die Erfüllung. Findet der Test
 * eine ID in der Implementierung, die die Matrix nicht kennt (oder umgekehrt),
 * ist eine der beiden Seiten gedriftet — genau das soll auffallen.
 */
function implementedRuleIds(): Set<string> {
  const found = new Set<string>();
  const declarations = new Set(['types.ts', 'rules.ts']);
  for (const entry of readdirSync(VERIFY_DIR)) {
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue;
    if (declarations.has(entry)) continue;
    const source = readFileSync(join(VERIFY_DIR, entry), 'utf8');
    for (const match of source.matchAll(/'([A-Z]{3,4}-\d{3}-[a-z0-9-]+)'/g)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return found;
}

describe('lib/verify/rules — Matrix-Vertrag', () => {
  it('hat eindeutige IDs und deckt jeden Pass ab', () => {
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length);
    expect(RULE_IDS.length).toBeGreaterThanOrEqual(29);
    const passes = new Set(RULE_MATRIX.map((rule) => rule.pass));
    expect([...passes].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('füllt jedes Pflichtfeld jeder Regel (kein Platzhalter)', () => {
    for (const rule of RULE_MATRIX) {
      expect(rule.title.length, rule.id).toBeGreaterThan(3);
      expect(rule.requirement.length, rule.id).toBeGreaterThan(10);
      expect(rule.standard.length, rule.id).toBeGreaterThan(3);
      expect(rule.formalTest.length, rule.id).toBeGreaterThan(5);
      expect(rule.abortCriterion.length, rule.id).toBeGreaterThan(10);
      expect(SEVERITY_ORDER).toContain(rule.severity);
      expect(FINDING_KINDS).toContain(rule.defaultKind);
      expect(PROVENANCES).toContain(rule.provenance);
      expect(PROVENANCES).toContain(rule.testProvenance);
      expect(VERIFICATION_PROFILES).toContain(rule.profile);
      expect(rule.contexts.length, rule.id).toBeGreaterThan(0);
      for (const context of rule.contexts) expect(INSTALLATION_CONTEXTS).toContain(context);
    }
  });

  it('verlangt für unbewiesene Anforderungen eine ausdrückliche Einschränkung', () => {
    for (const rule of RULE_MATRIX) {
      if (rule.provenance === 'UNVERIFIED' || rule.testProvenance === 'MODEL_ASSUMPTION') {
        expect(rule.limitation, `${rule.id} braucht eine limitation`).toBeTruthy();
      }
    }
  });

  it('belegt Klauselnummern nur dort, wo die Anforderung belegt ist', () => {
    for (const rule of RULE_MATRIX) {
      if (rule.clause !== null) expect(rule.provenance, rule.id).toBe('VERIFIED_NORM');
    }
  });
});

describe('lib/verify/rules — Bijection Matrix ↔ Implementierung', () => {
  it('prüft genau die Regeln, die die Matrix deklariert — keine mehr, keine weniger', () => {
    const implemented = implementedRuleIds();
    const declared = new Set<string>(RULE_IDS);
    const missing = [...declared].filter((id) => !implemented.has(id)).sort();
    const undeclared = [...implemented].filter((id) => !declared.has(id)).sort();
    expect(undeclared, 'implementierte, aber nicht deklarierte Regeln').toEqual([]);
    expect(missing, 'deklarierte, aber nicht implementierte Regeln').toEqual([]);
  });

  it('liefert für jede ID genau eine Spezifikation und wirft bei Unbekanntem', () => {
    for (const id of RULE_IDS) expect(ruleSpec(id).id).toBe(id);
    expect(() => ruleSpec('XXX-999-erfunden' as never)).toThrow(RangeError);
  });
});

describe('lib/verify/rules — Profile und Kontexte', () => {
  it('schaltet Regeln nach Herkunftsstufe frei — niedrigere Stufe ist Teilmenge', () => {
    const norm = rulesForContext('NORM_CORE', 'VEHICLE');
    const camp = rulesForContext('CAMP_MODEL', 'VEHICLE');
    const practice = rulesForContext('PRACTICE', 'VEHICLE');
    for (const rule of norm.applied) {
      expect(
        camp.applied.some((entry) => entry.id === rule.id),
        rule.id
      ).toBe(true);
      expect(
        practice.applied.some((entry) => entry.id === rule.id),
        rule.id
      ).toBe(true);
    }
    expect(camp.applied.length).toBeGreaterThan(norm.applied.length);
    expect(practice.applied.length).toBeGreaterThanOrEqual(camp.applied.length);
    expect(norm.applied.length + norm.skipped.length).toBe(RULE_IDS.length);
    expect(norm.skipped.some((rule) => rule.profile !== 'NORM_CORE')).toBe(true);
  });

  it('filtert nach Installationskontext', () => {
    const vehicle = rulesForContext('PRACTICE', 'VEHICLE');
    const stationary = rulesForContext('PRACTICE', 'STATIONARY');
    expect(vehicle.applied.length).toBeGreaterThan(stationary.applied.length);
    for (const rule of stationary.applied) expect(rule.contexts).toContain('STATIONARY');
  });

  it('prüft die Außenwelt-Eingabe des Profils', () => {
    expect(isVerificationProfile('NORM_CORE')).toBe(true);
    expect(isVerificationProfile('PRACTICE')).toBe(true);
    expect(isVerificationProfile('nope')).toBe(false);
    expect(isVerificationProfile(undefined)).toBe(false);
    expect(profileCovers('PRACTICE', ruleSpec('VDR-001-voltage-drop-edge'))).toBe(true);
    expect(profileCovers('NORM_CORE', ruleSpec('VDR-001-voltage-drop-edge'))).toBe(false);
    expect(profileCovers('CAMP_MODEL', ruleSpec('AMP-001-ib-in-iz'))).toBe(true);
  });
});
