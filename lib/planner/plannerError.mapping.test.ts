/**
 * Tests für die Zuordnung ValidationWarning → PlannerError (Spec #36
 * Migration). Jede Regel-ID aus useLiveValidation muss auf einen
 * spezifischen PlannerErrorCode abgebildet werden — sonst gehen die
 * strukturierten Meldungen wieder auf den generischen Fallback zurück.
 */

import { describe, expect, it } from 'vitest';
import {
  plannerErrorCodeFromRuleId,
  plannerErrorCategoryFromValidation,
} from './plannerError';

describe('plannerErrorCodeFromRuleId — Mapping ist spezifisch', () => {
  it('mappt BMS-Regeln auf BMS_CURRENT_EXCEEDED', () => {
    expect(plannerErrorCodeFromRuleId('BMS-001')).toBe('BMS_CURRENT_EXCEEDED');
    expect(plannerErrorCodeFromRuleId('bms-discharge')).toBe('BMS_CURRENT_EXCEEDED');
  });

  it('mappt Bauteilgrenzen auf COMPONENT_CURRENT_EXCEEDED', () => {
    expect(plannerErrorCodeFromRuleId('ELE-010-component-limit')).toBe('COMPONENT_CURRENT_EXCEEDED');
    expect(plannerErrorCodeFromRuleId('overload-inv')).toBe('COMPONENT_CURRENT_EXCEEDED');
  });

  it('mappt Solar-Direktanschluss auf CONNECTION_SHORT_CIRCUIT', () => {
    expect(plannerErrorCodeFromRuleId('SOLAR-DIRECT')).toBe('CONNECTION_SHORT_CIRCUIT');
  });

  it('mappt RCD-Fehler auf AC_RCD_MISSING', () => {
    expect(plannerErrorCodeFromRuleId('RCD-001')).toBe('AC_RCD_MISSING');
  });

  it('mappt ambivalente AC-Quelle auf AC_AMBIGUOUS_SOURCE', () => {
    expect(plannerErrorCodeFromRuleId('ambiguous-ac-source')).toBe('AC_AMBIGUOUS_SOURCE');
  });

  it('mappt unklare Batterie-Topologie auf BANK_AMBIGUOUS_TOPOLOGY', () => {
    expect(plannerErrorCodeFromRuleId('ambiguous-bank')).toBe('BANK_AMBIGUOUS_TOPOLOGY');
  });

  it('mappt Kabel-/Querschnittsregeln auf CABLE_OVERLOAD', () => {
    expect(plannerErrorCodeFromRuleId('CBL-003')).toBe('CABLE_OVERLOAD');
    expect(plannerErrorCodeFromRuleId('cross-section-too-small')).toBe('CABLE_OVERLOAD');
  });

  it('mappt Shunt-Bypass auf CONNECTION_SHUNT_BYPASS', () => {
    expect(plannerErrorCodeFromRuleId('shunt-bypass')).toBe('CONNECTION_SHUNT_BYPASS');
  });

  it('fällt auf PLAN_INCOMPLETE zurück bei leerer/unknown Regel-ID', () => {
    expect(plannerErrorCodeFromRuleId(undefined)).toBe('PLAN_INCOMPLETE');
    expect(plannerErrorCodeFromRuleId('')).toBe('PLAN_INCOMPLETE');
    expect(plannerErrorCodeFromRuleId('IRGENDWAS-NEUARTIGES')).toBe('PLAN_INCOMPLETE');
  });
});

describe('plannerErrorCategoryFromValidation', () => {
  it('ordnet BMS-Regeln der Kategorie "bms" zu', () => {
    expect(plannerErrorCategoryFromValidation('safety', 'BMS-001')).toBe('bms');
  });
  it('ordnet AC/RCD-Regeln der Kategorie "ac" zu', () => {
    expect(plannerErrorCategoryFromValidation('safety', 'RCD-001')).toBe('ac');
  });
  it('ordnet Sicherungsregeln der Kategorie "fuse" zu', () => {
    expect(plannerErrorCategoryFromValidation('safety', 'FUSE-SMALL')).toBe('fuse');
  });
  it('ordnet Topologie-Befunden der Kategorie "connection" zu (ohne ruleId)', () => {
    expect(plannerErrorCategoryFromValidation('topology', undefined)).toBe('connection');
  });
  it('ordnet alles Weitere "general" zu', () => {
    expect(plannerErrorCategoryFromValidation('estimation', undefined)).toBe('general');
  });
});
