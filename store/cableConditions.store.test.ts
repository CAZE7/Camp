/** P0-3: Persistenz der Verlegebedingungen im Store. */
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { usePlannerStore } from './usePlannerStore';
import type { CableEdgeData } from '../components/edges/CableEdge';

const edge: Edge<CableEdgeData> = {
  id: 'e-conditions',
  source: 'n1',
  target: 'n2',
  data: { crossSection: 10 },
};

describe('handleChangeCableConditions', () => {
  beforeEach(() => {
    usePlannerStore.setState({ edges: [{ ...edge, data: { ...edge.data } }], waterEdges: [] });
  });

  const data = () => usePlannerStore.getState().edges[0]!.data!;

  it('setzt ein Preset und entfernt alte Zusatzwerte', () => {
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', {
        installationCondition: 'custom',
        ambientC: 60,
      });
    });
    expect(data().ambientC).toBe(60);
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', {
        installationCondition: 'engine-bay',
      });
    });
    expect(data().installationCondition).toBe('engine-bay');
    expect(data().ambientC).toBeUndefined();
  });

  it('setzt eigene Werte und Datenblatt-I_z', () => {
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', {
        installationCondition: 'datasheet',
        manufacturerIzA: 95,
        cableInsulation: 'FLR2X-B',
      });
    });
    expect(data().manufacturerIzA).toBe(95);
    expect(data().cableInsulation).toBe('FLR2X-B');
  });

  it('lehnt unbekannte Presets und nicht-endliche Zahlen ab', () => {
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', {
        installationCondition: 'zauberfaktor',
      });
    });
    expect(data().installationCondition).toBeUndefined();
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', {
        ambientC: Number.NaN,
      });
    });
    expect(data().ambientC).toBeUndefined();
  });

  it('reset entfernt alle Felder und legt eine Undo-Stufe an', () => {
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', {
        installationCondition: 'roof-solar',
      });
    });
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', { reset: true });
    });
    expect(data().installationCondition).toBeUndefined();
    // `withHistoryIfChanged` fasst mehrere Änderungen derselben Kante zu
    // EINER Undo-Stufe zusammen — kein Undo-Schritt je Tastendruck.
    expect(usePlannerStore.getState().historyPast.length).toBeGreaterThan(0);
    expect(usePlannerStore.getState().canUndo).toBe(true);
  });

  it('lehnt Werte außerhalb der Schema-Grenzen ab (kein Feld, das der Import verwirft)', () => {
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', {
        bundledCircuits: 12,
      });
    });
    expect(data().bundledCircuits).toBeUndefined();
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', {
        manufacturerIzA: -5,
      });
    });
    expect(data().manufacturerIzA).toBeUndefined();
    act(() => {
      usePlannerStore.getState().handleChangeCableConditions('e-conditions', {
        ambientC: 500,
      });
    });
    expect(data().ambientC).toBeUndefined();
  });
});
