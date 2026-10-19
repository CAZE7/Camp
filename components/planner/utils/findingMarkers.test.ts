import { describe, it, expect } from 'vitest';
import { findingNodeIdSet } from './findingMarkers';

/** QA B-21 (Regression): Prüfmodus markiert Bauteile mit Befund — sonst nicht. */
describe('findingNodeIdSet (B-21)', () => {
  const errors = [
    { severity: 'error' as const, nodeIds: ['fuse-1'] },
    { severity: 'warning' as const, nodeIds: ['consumer-2'] },
    { severity: 'info' as const, nodeIds: ['battery-3'] },
  ];

  it('markiert im Modus Prüfung Bauteile mit Warnung oder Fehler', () => {
    expect([...findingNodeIdSet('pruefung', errors)].sort()).toEqual(['consumer-2', 'fuse-1']);
  });

  it('markiert im Planungsmodus nichts', () => {
    expect(findingNodeIdSet('planung', errors).size).toBe(0);
  });

  it('markiert Info-Hinweise nicht', () => {
    expect(findingNodeIdSet('pruefung', errors).has('battery-3')).toBe(false);
  });
});
