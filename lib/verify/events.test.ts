import { describe, expect, it } from 'vitest';

import {
  auditEvent,
  checkFromEvents,
  checkOrNotApplicable,
  formatEvent,
  formatNumber,
  highestSeverity,
  passedCheck,
  sortEvents,
  statusOfEvents,
} from './events';
import type { AuditEvent } from './types';

const event = (overrides: Partial<Parameters<typeof auditEvent>[0]> = {}): AuditEvent =>
  auditEvent({
    ruleId: 'AMP-001-ib-in-iz',
    entity: { kind: 'edge', id: 'e1' },
    message: 'Testbefund',
    autoFixRemedy: 'Querschnitt erhöhen.',
    ...overrides,
  });

describe('lib/verify/events — Provenienz kommt aus der Matrix, nicht vom Aufrufer', () => {
  it('stempelt Norm, Klausel, Herkunft und Schwere aus der Regelspezifikation', () => {
    const stamped = event();
    expect(stamped.standard).toContain('IEC 60364-4-43');
    expect(stamped.clause).toBe('§433.1 Bedingung (1)');
    expect(stamped.provenance).toBe('VERIFIED_NORM');
    expect(stamped.severity).toBe('CRITICAL_SAFETY');
    expect(stamped.kind).toBe('VIOLATION');
    expect(stamped.equation.length).toBeGreaterThan(3);
  });

  it('erlaubt Overrides, aber keine leere Remediation (Sackgasse)', () => {
    const overridden = event({ severity: 'EFFICIENCY_WARNING', kind: 'UNVERIFIABLE' });
    expect(overridden.severity).toBe('EFFICIENCY_WARNING');
    expect(overridden.kind).toBe('UNVERIFIABLE');
    expect(() => event({ autoFixRemedy: '   ' })).toThrow(RangeError);
    expect(() => event({ severity: 'UNSINNIG' as never })).toThrow(RangeError);
    expect(() => event({ kind: 'UNSINNIG' as never })).toThrow(RangeError);
  });
});

describe('lib/verify/events — Statusableitung (kein stiller Pass)', () => {
  it('leitet FAIL vor UNPROVABLE ab', () => {
    expect(statusOfEvents([])).toBe('PASS');
    expect(statusOfEvents([event()])).toBe('FAIL');
    expect(statusOfEvents([event({ kind: 'UNVERIFIABLE' })])).toBe('UNPROVABLE');
    expect(statusOfEvents([event({ kind: 'UNVERIFIABLE' }), event()])).toBe('FAIL');
  });

  it('bestätigt einen leeren Test nur mit betrachteten Entitäten', () => {
    expect(checkFromEvents('AMP-001-ib-in-iz', [], 3).status).toBe('PASS');
    const withoutInput = checkFromEvents('AMP-001-ib-in-iz', [], 0);
    expect(withoutInput.status).toBe('UNPROVABLE');
    expect(withoutInput.events).toHaveLength(1);
    expect(withoutInput.events[0]?.autoFixRemedy.length).toBeGreaterThan(10);
  });

  it('unterscheidet »nicht anwendbar« von »nicht beweisbar«', () => {
    const empty = checkOrNotApplicable('AMP-001-ib-in-iz', [], 0);
    expect(empty.status).toBe('PASS');
    expect(empty.evaluatedEntities).toBe(0);
    const withFinding = checkOrNotApplicable('AMP-001-ib-in-iz', [event({ kind: 'UNVERIFIABLE' })], 0);
    expect(withFinding.status).toBe('UNPROVABLE');
    expect(passedCheck('AMP-001-ib-in-iz', 5).status).toBe('PASS');
  });

  it('bestimmt den schwersten Grad und sortiert stabil', () => {
    const warning = event({ severity: 'EFFICIENCY_WARNING' });
    const code = event({ severity: 'CODE_VIOLATION' });
    const critical = event({ severity: 'CRITICAL_SAFETY' });
    expect(highestSeverity([])).toBeNull();
    expect(highestSeverity([warning, code])).toBe('CODE_VIOLATION');
    const sorted = sortEvents([warning, critical, code]);
    expect(sorted.map((entry) => entry.severity)).toEqual([
      'CRITICAL_SAFETY',
      'CODE_VIOLATION',
      'EFFICIENCY_WARNING',
    ]);
  });

  it('formatiert Befunde vollständig (Norm, Werte, Abhilfe)', () => {
    const text = formatEvent(
      event({ calculatedValue: 42.5, allowedLimit: 30, unit: 'A', counterexample: ['a → b'] })
    );
    expect(text).toContain('AMP-001-ib-in-iz');
    expect(text).toContain('42.50');
    expect(text).toContain('30.00');
    expect(text).toContain('Abhilfe:');
    expect(text).toContain('(VERIFIED_NORM)');
    expect(formatNumber(1.005, 2)).toBe('1.00');
    expect(formatNumber(Number.NaN)).toBe('NaN');
  });
});
