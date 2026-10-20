import { describe, expect, it } from 'vitest';
import {
  designatorForIndex,
  designatorMapFor,
  nodesWithUniqueDesignators,
  resolvedDesignator,
} from './designators';

/**
 * Nachtest 2026-10-16: „G1, G2, W1 doppelt, E1 dreifach“ — jedes Bauteil
 * im Plan braucht eine eigene Bezeichnung.
 */
describe('designatorMapFor (Nachtest: keine doppelten Kürzel)', () => {
  it('nummeriert gleiche Arten durch und lässt die erste bei der Basis', () => {
    const map = designatorMapFor([
      { id: 'b1', type: 'battery' },
      { id: 'c1', type: 'consumer' },
      { id: 'b2', type: 'battery' },
      { id: 'c2', type: 'consumer' },
      { id: 'c3', type: 'consumer' },
    ]);
    expect(map.get('b1')).toBe('G1');
    expect(map.get('b2')).toBe('G1.2');
    expect(map.get('c1')).toBe('E1');
    expect(map.get('c2')).toBe('E1.2');
    expect(map.get('c3')).toBe('E1.3');
  });

  it('zählt Ladegeräte-Arten (MPPT, Booster …) in einer G2-Reihe', () => {
    const map = designatorMapFor([
      { id: 'm1', type: 'mpptController' },
      { id: 'd1', type: 'dcdcCharger' },
    ]);
    expect(map.get('m1')).toBe('G2');
    expect(map.get('d1')).toBe('G2.2');
  });

  it('ignoriert unbekannte Typen statt zu raten', () => {
    const map = designatorMapFor([
      { id: 'w1', type: 'pump' },
      { id: 'x1', type: undefined },
    ]);
    expect(map.size).toBe(0);
  });

  it('designatorForIndex hängt erst ab dem zweiten Bauteil an', () => {
    expect(designatorForIndex('W1', 0)).toBe('W1');
    expect(designatorForIndex('W1', 1)).toBe('W1.2');
  });

  it('schreibt eindeutige Bezeichnungen auf Vorlagen und doppelte Altpläne', () => {
    const stamped = nodesWithUniqueDesignators([
      { id: 'starter', type: 'battery', data: { label: 'Starterbatterie', designator: 'G1' } },
      { id: 'lithium', type: 'battery', data: { label: 'Lithium', designator: 'G1' } },
      { id: 'mppt', type: 'mpptController', data: { label: 'MPPT' } },
      { id: 'booster', type: 'dcdcCharger', data: { label: 'Ladebooster' } },
    ]);
    const labels = stamped.map((node) => (node.data as { designator: string }).designator);
    expect(labels).toEqual(['G1', 'G1.2', 'G2', 'G2.2']);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('fällt ohne Kontext auf die gespeicherte Bezeichnung zurück', () => {
    expect(resolvedDesignator(new Map(), 'bat', { designator: 'G1.2' })).toBe('G1.2');
    expect(resolvedDesignator(new Map([['bat', 'G1']]), 'bat', { designator: 'G9' })).toBe('G1');
  });
});
