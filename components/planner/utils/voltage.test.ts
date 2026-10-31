import { describe, it, expect } from 'vitest';
import { getSystemVoltage } from './voltage';
import { type Node } from '@xyflow/react';

describe('getSystemVoltage', () => {
  it('should return 12.8V when no batteries are present', () => {
    const nodes: Node[] = [
      { id: '1', type: 'solar', data: {}, position: { x: 0, y: 0 } },
      { id: '2', type: 'consumer', data: {}, position: { x: 0, y: 0 } },
    ];
    expect(getSystemVoltage(nodes)).toBe(12.8);
  });

  it('should return 12.8V when nodes array is empty', () => {
    expect(getSystemVoltage([])).toBe(12.8);
  });

  it('should use the explicit nominalVoltage of the priority battery (not any battery)', () => {
    // Regression: Eine nachrangige 24-V-Batterie darf die Auslegung einer
    // 12,8-V-Vorrangbatterie nicht überschreiben.
    const nodes: Node[] = [
      { id: '1', type: 'battery', data: { chemistry: 'lifepo4' }, position: { x: 0, y: 0 } },
      { id: '2', type: 'battery', data: { nominalVoltage: 24, chemistry: 'agm' }, position: { x: 0, y: 0 } },
    ];
    expect(getSystemVoltage(nodes)).toBe(12.8);

    const firstIs24: Node[] = [
      { id: '1', type: 'battery', data: { nominalVoltage: 24 }, position: { x: 0, y: 0 } },
      { id: '2', type: 'battery', data: { nominalVoltage: 12 }, position: { x: 0, y: 0 } },
    ];
    expect(getSystemVoltage(firstIs24)).toBe(24);
  });

  it('should return 12.0V for AGM chemistry when no explicit voltage is set', () => {
    const nodes: Node[] = [
      { id: '1', type: 'battery', data: { chemistry: 'agm' }, position: { x: 0, y: 0 } },
    ];
    expect(getSystemVoltage(nodes)).toBe(12.0);
  });

  it('should return 12.0V for Lead chemistry when no explicit voltage is set', () => {
    const nodes: Node[] = [
      { id: '1', type: 'battery', data: { chemistry: 'lead' }, position: { x: 0, y: 0 } },
    ];
    expect(getSystemVoltage(nodes)).toBe(12.0);
  });

  it('should return 12.0V for Gel chemistry when no explicit voltage is set', () => {
    const nodes: Node[] = [
      { id: '1', type: 'battery', data: { chemistry: 'gel' }, position: { x: 0, y: 0 } },
    ];
    expect(getSystemVoltage(nodes)).toBe(12.0);
  });

  it('should handle uppercase chemistry values correctly', () => {
    const nodes: Node[] = [
      { id: '1', type: 'battery', data: { chemistry: 'AGM' }, position: { x: 0, y: 0 } },
    ];
    expect(getSystemVoltage(nodes)).toBe(12.0);
  });

  it('should return 12.8V for LiFePO4 chemistry when no explicit voltage is set', () => {
    const nodes: Node[] = [
      { id: '1', type: 'battery', data: { chemistry: 'lifepo4' }, position: { x: 0, y: 0 } },
    ];
    expect(getSystemVoltage(nodes)).toBe(12.8);
  });

  it('should return 12.8V for unknown chemistry when no explicit voltage is set', () => {
    const nodes: Node[] = [
      { id: '1', type: 'battery', data: { chemistry: 'unknown' }, position: { x: 0, y: 0 } },
    ];
    expect(getSystemVoltage(nodes)).toBe(12.8);
  });

  it('should return 12.8V when chemistry is undefined and no explicit voltage is set', () => {
    const nodes: Node[] = [{ id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } }];
    expect(getSystemVoltage(nodes)).toBe(12.8);
  });
});
