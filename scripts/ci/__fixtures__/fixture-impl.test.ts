import { describe, it, expect } from 'vitest';
import { fixture } from './fixture-impl';

describe('fixture', () => {
  it('returns true', () => {
    expect(fixture()).toBe(true);
  });
});
