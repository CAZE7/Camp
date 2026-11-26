import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';

import type { RoofNodeData } from '@/components/nodes/types';
import {
  buildDachShareUrl,
  parseDachShareHash,
  parseDachState,
  serializeDachState,
  type DachPlanState,
} from './dachState';

function roofNode(overrides: Partial<Node<RoofNodeData>> = {}): Node<RoofNodeData> {
  return {
    id: 'roofSolar-1',
    type: 'roofSolar',
    position: { x: 90, y: 210 },
    width: 200,
    height: 120,
    data: {
      label: 'Solarpanel',
      watts: 200,
      width: 100,
      height: 60,
      isInvalid: false,
      onNodeResize: () => undefined,
    },
    ...overrides,
  } as Node<RoofNodeData>;
}

const STAND: DachPlanState = {
  version: 1,
  vehicleId: 'vw-t6-l1h1',
  nodes: [
    {
      id: 'roofSolar-1',
      type: 'roofSolar',
      position: { x: 90, y: 210 },
      width: 200,
      height: 120,
      data: { label: 'Solarpanel', watts: 200, width: 100, height: 60 },
    },
    {
      id: 'roofWindow-1',
      type: 'roofWindow',
      position: { x: 40, y: 40 },
      width: 80,
      height: 80,
      data: { label: 'Dachfenster', width: 40, height: 40 },
    },
  ],
};

describe('serializeDachState', () => {
  it('behält nur platzierte Elemente und streift Callbacks/Prüfvermerke ab', () => {
    const background = roofNode({ id: 'background', type: 'roofBackground' as never });
    const state = serializeDachState('vw-t6-l1h1', [background, roofNode()]);
    expect(state.vehicleId).toBe('vw-t6-l1h1');
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]?.data).toEqual({ label: 'Solarpanel', watts: 200, width: 100, height: 60 });
    expect(JSON.stringify(state)).not.toContain('onNodeResize');
    expect(JSON.stringify(state)).not.toContain('isInvalid');
  });
});

describe('parseDachState', () => {
  it('nimmt einen gültigen Stand an und lehnt Fremdes ab', () => {
    expect(parseDachState(STAND)).toEqual(STAND);
    expect(parseDachState(null)).toBeNull();
    expect(parseDachState({ ...STAND, version: 2 })).toBeNull();
    expect(parseDachState({ ...STAND, vehicleId: '' })).toBeNull();
    expect(
      parseDachState({
        ...STAND,
        nodes: [{ id: 'x', type: 'solarPanel', position: { x: 0, y: 0 }, width: 10, height: 10, data: {} }],
      })
    ).toBeNull();
    expect(
      parseDachState({
        ...STAND,
        nodes: [
          { id: 'x', type: 'roofSolar', position: { x: Number.NaN, y: 0 }, width: 10, height: 10, data: {} },
        ],
      })
    ).toBeNull();
  });

  it('rundet den Stand durch Serialisierung verlustfrei', () => {
    const nodes = STAND.nodes.map(
      (saved) =>
        ({
          id: saved.id,
          type: saved.type,
          position: saved.position,
          width: saved.width,
          height: saved.height,
          data: { ...saved.data },
        }) as unknown as Node<RoofNodeData>
    );
    expect(serializeDachState(STAND.vehicleId, nodes)).toEqual(STAND);
  });
});

describe('Teilen-Link', () => {
  it('trägt den Stand im Hash und liest ihn wieder ein', async () => {
    const url = await buildDachShareUrl(STAND, 'https://12v-planer.de/tools/dach/');
    expect(url.startsWith('https://12v-planer.de/tools/dach/#dach=')).toBe(true);
    const hash = url.slice(url.indexOf('#'));
    await expect(parseDachShareHash(hash)).resolves.toEqual(STAND);
  });

  it('gibt ohne Dach-Parameter null und lehnt Müll ab', async () => {
    await expect(parseDachShareHash('#plan=z.xyz')).resolves.toBeNull();
    await expect(parseDachShareHash('#dach=r.!!!')).rejects.toThrow();
    await expect(parseDachShareHash('#dach=x.abc')).rejects.toThrow(/unbekanntes Format/);
  });
});
