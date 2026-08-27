import { describe, it, expect } from 'vitest';
import { vehicleTemplates } from './vehicleTemplates';

describe('vehicleTemplates', () => {
  it('should be an array', () => {
    expect(Array.isArray(vehicleTemplates)).toBe(true);
  });

  it('should not be empty', () => {
    expect(vehicleTemplates.length).toBeGreaterThan(0);
  });

  it('should have unique ids', () => {
    const ids = vehicleTemplates.map((v) => v.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid descriptive fields for all templates', () => {
    vehicleTemplates.forEach((template) => {
      expect(template.id).toBeTruthy();
      expect(typeof template.id).toBe('string');
      expect(template.brand).toBeTruthy();
      expect(typeof template.brand).toBe('string');
      expect(template.model).toBeTruthy();
      expect(typeof template.model).toBe('string');
      expect(template.version).toBeTruthy();
      expect(typeof template.version).toBe('string');
    });
  });

  it('should have positive dimensions for all templates', () => {
    vehicleTemplates.forEach((template) => {
      expect(template.length).toBeGreaterThan(0);
      expect(template.width).toBeGreaterThan(0);
      expect(template.height).toBeGreaterThan(0);
    });
  });

  it('should have reasonable dimensions (sanity check)', () => {
    vehicleTemplates.forEach((template) => {
      // Smallest van is around 2m, largest around 8m
      expect(template.length).toBeGreaterThan(2);
      expect(template.length).toBeLessThan(10);

      // Width is usually between 1.5m and 2.5m
      expect(template.width).toBeGreaterThan(1.5);
      expect(template.width).toBeLessThan(3);

      // Height is usually between 1.5m and 3.5m
      expect(template.height).toBeGreaterThan(1.5);
      expect(template.height).toBeLessThan(4);
    });
  });
});
