import { describe, expect, it } from 'vitest';
import { validateRouteContract } from './routeContract';
import { validateFinalRouting } from './finalValidation';

const expected = [{ id: 'e', source: { x: 0, y: 0 }, target: { x: 100, y: 0 } }];
describe('complete routing contract', () => {
  it('rejects absent routes instead of validating an empty subset', () => {
    expect(validateRouteContract(expected, new Map())[0]?.code).toBe('ROUTE-MISSING');
  });
  it.each([
    [],
    [{ x: 0, y: 0 }],
    [
      { x: 0, y: 0 },
      { x: 100, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: NaN, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  ])('rejects malformed geometry %j', (...waypoints) => {
    expect(validateRouteContract(expected, new Map([['e', { waypoints }]]))[0]?.code).toBe('ROUTE-SHAPE');
  });
  it('rejects detached endpoints on unlocked edges too', () => {
    expect(
      validateRouteContract(
        expected,
        new Map([
          [
            'e',
            {
              waypoints: [
                { x: 1, y: 0 },
                { x: 100, y: 0 },
              ],
            },
          ],
        ])
      )[0]?.code
    ).toBe('ROUTE-ENDPOINT');
  });
  it('accepts a complete exact route', () => {
    expect(
      validateRouteContract(
        expected,
        new Map([['e', { waypoints: [expected[0]!.source, expected[0]!.target] }]])
      )
    ).toEqual([]);
  });
  it('does not declare a diagonal valid in the lower-level final validator', () => {
    expect(
      validateFinalRouting(
        [
          {
            id: 'e',
            source: 'a',
            target: 'b',
            waypoints: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
          },
        ],
        []
      ).status
    ).toBe('INVALID');
  });
});

it('checks outward direction even when the route starts at the exact port', () => {
  const ports = [
    {
      id: 'e',
      source: { x: 0, y: 0, position: 'top' as const },
      target: { x: 100, y: 0, position: 'left' as const },
    },
  ];
  const routes = new Map([
    [
      'e',
      {
        waypoints: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
    ],
  ]);
  expect(validateRouteContract(ports, routes).some((violation) => violation.code === 'ROUTE-DIRECTION')).toBe(
    true
  );
});
