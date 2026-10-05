import { describe, expect, it } from 'vitest';
import {
  createPlannerError,
  dedupePlannerErrors,
  samePlannerError,
  type PlannerError,
} from './plannerError';

describe('lib/planner/plannerError', () => {
  it('createPlannerError sortiert IDs deterministisch', () => {
    const err = createPlannerError({
      code: 'BMS_CURRENT_EXCEEDED',
      severity: 'critical',
      category: 'bms',
      message: 'Test',
      nodeIds: ['b', 'a'],
      edgeIds: ['e2', 'e1'],
      details: { required: 140, allowed: 100 },
    });
    expect(err.nodeIds).toEqual(['a', 'b']);
    expect(err.edgeIds).toEqual(['e1', 'e2']);
    expect(err.details).toEqual({ required: 140, allowed: 100 });
  });

  it('samePlannerError vergleicht Code, Severity und die (un-)sortierten IDs', () => {
    const a = createPlannerError({
      code: 'VOLTAGE_MISMATCH',
      severity: 'error',
      category: 'voltage',
      message: 'Spannung',
      nodeIds: ['b', 'a'],
    });
    const b = createPlannerError({
      code: 'VOLTAGE_MISMATCH',
      severity: 'error',
      category: 'voltage',
      message: 'Spannung 2',
      nodeIds: ['a', 'b'],
    });
    expect(samePlannerError(a, b)).toBe(true);

    const c = createPlannerError({
      code: 'INVERTER_VOLTAGE_MISMATCH',
      severity: 'error',
      category: 'voltage',
      message: 'Spannung',
      nodeIds: ['a'],
    });
    expect(samePlannerError(a, c)).toBe(false);
  });

  it('dedupePlannerErrors entfernt Duplikate und behält die Reihenfolge', () => {
    const errors: PlannerError[] = [
      createPlannerError({
        code: 'BMS_CURRENT_EXCEEDED',
        severity: 'critical',
        category: 'bms',
        message: 'eins',
        nodeIds: ['a'],
      }),
      createPlannerError({
        code: 'VOLTAGE_MISMATCH',
        severity: 'error',
        category: 'voltage',
        message: 'zwei',
        nodeIds: ['b'],
      }),
      createPlannerError({
        code: 'BMS_CURRENT_EXCEEDED',
        severity: 'critical',
        category: 'bms',
        message: 'eins (duplikat)',
        nodeIds: ['a'],
      }),
    ];
    const unique = dedupePlannerErrors(errors);
    expect(unique).toHaveLength(2);
    expect(unique[0]!.message).toBe('eins');
    expect(unique[1]!.message).toBe('zwei');
  });

  it('PlannerError ist JSON-serialisierbar (Store-/Snapshot-Tauglichkeit)', () => {
    const err = createPlannerError({
      code: 'ROUTING_NOT_CONVERGED',
      severity: 'warning',
      category: 'routing',
      message: 'Routing konvergiert nicht.',
      explanation: 'Zyklus zwischen Messung und Routing.',
      suggestedFix: 'Ein Bauteil um wenige Pixel verschieben.',
      details: { revision: 5 },
    });
    const json = JSON.stringify(err);
    const parsed = JSON.parse(json) as PlannerError;
    expect(parsed.code).toBe('ROUTING_NOT_CONVERGED');
    expect(parsed.details?.revision).toBe(5);
  });
});
