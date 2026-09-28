import { describe, expect, it } from 'vitest';
import { reachableNodeIds } from './graph';

/**
 * `reachableNodeIds` ist die gemeinsame Erreichbarkeits-Suche der Plan-Ebene
 * (AC-Insel, MPPT-Strings, Ladebooster-Pfad). Der Test hält die drei
 * Eigenschaften fest, auf die sich die Aufrufer verlassen: Undirektionalität,
 * Insel-Trennung und Terminierung bei Zyklen.
 */
describe('reachableNodeIds', () => {
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'x', target: 'y' },
  ];

  it('läuft undirektional: Quelle und Ziel sind gleichwertig', () => {
    // Eine Sammelschiene verbindet — die Zeichenrichtung der Kante sagt nichts
    // über den elektrischen Zusammenhang.
    expect([...reachableNodeIds('a', edges)].sort()).toEqual(['a', 'b', 'c']);
    expect([...reachableNodeIds('c', edges)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('bleibt in der eigenen Insel', () => {
    expect([...reachableNodeIds('y', edges)].sort()).toEqual(['x', 'y']);
  });

  it('startet immer beim Startknoten — auch ohne Kanten', () => {
    expect([...reachableNodeIds('a', [])]).toEqual(['a']);
    expect([...reachableNodeIds('unbekannt', edges)]).toEqual(['unbekannt']);
  });

  it('terminiert bei Zyklen', () => {
    const cycle = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
    ];
    expect([...reachableNodeIds('a', cycle)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('filtert Kanten vor dem Betreten (z. B. nur AC-Kanten)', () => {
    const mixed = [
      { source: 'inv', target: 'ac1', domain: 'AC_230V' },
      { source: 'inv', target: 'dc1', domain: 'DC_12V' },
      { source: 'dc1', target: 'dc2', domain: 'DC_12V' },
    ];
    const onlyAc = reachableNodeIds('inv', mixed, (edge) => edge.domain === 'AC_230V');
    expect([...onlyAc].sort()).toEqual(['ac1', 'inv']);
  });
});
