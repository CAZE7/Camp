import { describe, expect, it } from 'vitest';

import { isValidHandoff, plannerHandoffHash, plannerHandoffHref } from './handoff';

describe('plannerHandoff (R8-08)', () => {
  it('erzeugt einen lesbaren Uebergabe-Hash mit gerundeten Werten', () => {
    const hash = plannerHandoffHash({ solarWatts: 599.6, quelle: 'Dach-Planer' });
    expect(hash.startsWith('#uebernahme=')).toBe(true);
    const werte = JSON.parse(decodeURIComponent(hash.slice('#uebernahme='.length))) as unknown;
    expect(werte).toEqual({ solarWatts: 600, quelle: 'Dach-Planer' });
  });

  it('verwirft unzulaessige Werte statt sie zu uebergeben', () => {
    expect(plannerHandoffHash({ solarWatts: -5 })).toBe('#uebernahme=%7B%7D');
    expect(plannerHandoffHash({ solarWatts: 999_999 })).toBe('#uebernahme=%7B%7D');
    expect(plannerHandoffHash({ batteryAh: 200, batteryVoltage: 230 })).toBe(
      '#uebernahme=%7B%22batteryAh%22%3A200%7D'
    );
  });

  it('prueft fremde Hashes strikt', () => {
    expect(isValidHandoff({ solarWatts: 600 })).toBe(true);
    expect(isValidHandoff({ solarWatts: 0 })).toBe(false);
    expect(isValidHandoff({ batteryVoltage: 230 })).toBe(false);
    expect(isValidHandoff({})).toBe(false);
  });

  it('baut die Ziel-URL auf /planer/', () => {
    expect(plannerHandoffHref({ batteryAh: 280, quelle: 'Batterierechner' })).toContain(
      '/planer/#uebernahme='
    );
  });
});
