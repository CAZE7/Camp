import { describe, expect, it } from 'vitest';
import {
  CURRENT_LIMIT_LABEL,
  CURRENT_LIMIT_PRECEDENCE,
  LOAD_HEADROOM_FRACTION,
  computeCurrentBudget,
  evaluateLoadFeasibility,
  type CurrentLimits,
} from './currentBudget';
import { amps } from '../units';

describe('V2-BUDGET — Strombudget aus allen bekannten Grenzen', () => {
  it('jede Quelle hat einen Namen und einen Rang (Tabellen bleiben synchron)', () => {
    expect(Object.keys(CURRENT_LIMIT_LABEL).sort()).toEqual([...CURRENT_LIMIT_PRECEDENCE].sort());
    // Das BMS steht ganz vorn: Bei Gleichstand gewinnt die Abschaltschwelle.
    expect(CURRENT_LIMIT_PRECEDENCE[0]).toBe('bms');
  });

  it('wählt die kleinste Grenze und benennt sie', () => {
    const budget = computeCurrentBudget({
      bms: amps(100),
      component: amps(150),
      fuse: amps(80),
      cable: amps(120),
    });
    expect(budget.allowedCurrent).toBe(amps(80));
    expect(budget.limitedBy).toBe('fuse');
    expect(budget.limits).toEqual({
      bms: amps(100),
      component: amps(150),
      fuse: amps(80),
      cable: amps(120),
    });
  });

  it('bei Gleichstand gewinnt die Quelle mit dem höheren Rang (BMS vor Sicherung)', () => {
    const budget = computeCurrentBudget({ bms: amps(100), fuse: amps(100), cable: amps(100) });
    expect(budget.limitedBy).toBe('bms');
  });

  it('ohne jede Grenze: unknown + Warnung, niemals „in Ordnung“', () => {
    const budget = computeCurrentBudget({});
    expect(budget.allowedCurrent).toBeUndefined();
    expect(budget.limitedBy).toBe('unknown');

    const verdict = evaluateLoadFeasibility(amps(120), budget, 'Wechselrichter „Test“');
    expect(verdict.severity).toBe('warning');
    expect(verdict.limitedBy).toBe('unknown');
    expect(verdict.message).toContain('nicht bewertbar');
  });

  it('verwirft unbrauchbare Grenzen (0, negativ, NaN) statt sie zu übernehmen', () => {
    const budget = computeCurrentBudget({
      bms: amps(0.0001),
      component: 0 as unknown as CurrentLimits['component'],
      fuse: -10 as unknown as CurrentLimits['fuse'],
      cable: Number.NaN as unknown as CurrentLimits['cable'],
      system: amps(50),
    });
    expect(budget.limits.component).toBeUndefined();
    expect(budget.limits.fuse).toBeUndefined();
    expect(budget.limits.cable).toBeUndefined();
    expect(budget.limitedBy).toBe('bms');
  });

  describe('evaluateLoadFeasibility', () => {
    const budget = computeCurrentBudget({ bms: amps(100) });

    it('über der Grenze ⇒ kritisch und NICHT machbar (keine „dimensionierte“ Anlage)', () => {
      const verdict = evaluateLoadFeasibility(amps(150), budget, 'Wechselrichter „2000 W“');
      expect(verdict.feasible).toBe(false);
      expect(verdict.severity).toBe('critical');
      expect(verdict.allowedCurrent).toBe(amps(100));
      expect(verdict.limitedBy).toBe('bms');
      expect(verdict.message).toContain('BMS-Grenze');
      expect(verdict.message).toContain('150 A');
    });

    it('über 90 % ⇒ Warnung ohne Reserve, aber machbar', () => {
      const verdict = evaluateLoadFeasibility(amps(95), budget, 'Last');
      expect(verdict.feasible).toBe(true);
      expect(verdict.severity).toBe('warning');
      expect(verdict.message).toContain('keine Reserve');
    });

    it('genau auf der Reservegrenze ist noch in Ordnung', () => {
      const verdict = evaluateLoadFeasibility(amps(100 * LOAD_HEADROOM_FRACTION), budget, 'Last');
      expect(verdict.severity).toBe('ok');
    });

    it('genau auf der Grenze ist machbar, aber ohne Reserve', () => {
      const verdict = evaluateLoadFeasibility(amps(100), budget, 'Last');
      expect(verdict.feasible).toBe(true);
      expect(verdict.severity).toBe('warning');
    });

    it('deutlich darunter ⇒ ok mit nachvollziehbarer Meldung', () => {
      const verdict = evaluateLoadFeasibility(amps(40), budget, 'Kühlschrank');
      expect(verdict.severity).toBe('ok');
      expect(verdict.message).toBe('Kühlschrank: ≈40 A von 100 A (BMS-Grenze).');
    });
  });
});
