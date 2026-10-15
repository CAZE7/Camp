import { describe, expect, it } from 'vitest';
import { repairClearanceClusters } from './globalLaneRepair';
import { validateFinalRouting } from './finalValidation';
import { preservesPortDirections } from './geometry';
import type { RoutedEdge } from './invariants';

// Reduced from complex: individually moving any of the upper lanes creates a
// new clearance violation; only a JOINT move frees the fan-out corridor.
const route = (id: string, values: number[][]): RoutedEdge => ({
  id,
  source: `${id}-source`,
  target: `${id}-target`,
  waypoints: values.map(([x, y]) => ({ x: x!, y: y! })),
});
const cluster = (): RoutedEdge[] => [
  route('a', [
    [514.4, 688],
    [514.4, 656],
    [668, 656],
    [668, 344],
    [814.4, 344],
    [814.4, 320],
  ]),
  route('b', [
    [514.4, 688],
    [514.4, 644],
    [924, 644],
    [924, 204],
    [1114.4, 204],
    [1114.4, 180],
  ]),
  route('c', [
    [514.4, 180],
    [514.4, 226],
    [598, 226],
    [598, 664],
    [514.4, 664],
    [514.4, 688],
  ]),
  route('d', [
    [514.4, 360],
    [514.4, 482],
    [586, 482],
    [586, 632],
    [514.4, 632],
    [514.4, 688],
  ]),
];
describe('joint lane constraints', () => {
  it('repairs the cluster without buying clearance by deleting a port stub', () => {
    const input = cluster();
    const original = JSON.stringify(input);
    expect(validateFinalRouting(input, []).status).toBe('INVALID');
    const repaired = repairClearanceClusters(input, []);
    expect(repaired).toBeDefined();
    const result = input.map((edge) => ({ ...edge, waypoints: repaired!.get(edge.id)! }));
    expect(validateFinalRouting(result, []).status).toBe('VALID');
    for (const edge of result)
      expect(
        preservesPortDirections(input.find((before) => before.id === edge.id)!.waypoints, edge.waypoints)
      ).toBe(true);
    expect(JSON.stringify(input)).toBe(original);
    expect(repairClearanceClusters(result, [])).toBeUndefined();
  });
  it('is independent of input order and does not mutate fixed snapshots', () => {
    const input = cluster();
    expect(repairClearanceClusters([...input].reverse(), [])).toEqual(repairClearanceClusters(input, []));
    const fixed = new Set(input.map((edge) => edge.id));
    expect(repairClearanceClusters(input, [], fixed)).toBeUndefined();
  });
  it('rejects zeroing or reversing a stub even if the new route is orthogonal', () => {
    const original = [
      { x: 0, y: 0 },
      { x: 0, y: -24 },
      { x: 100, y: -24 },
      { x: 100, y: 0 },
    ];
    expect(
      preservesPortDirections(original, [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ])
    ).toBe(false);
    expect(
      preservesPortDirections(original, [
        { x: 0, y: 0 },
        { x: 0, y: 24 },
        { x: 100, y: 24 },
        { x: 100, y: 0 },
      ])
    ).toBe(false);
  });
});
