import { describe, it, expect } from 'vitest';
import { vehicleTemplates, DEFAULT_VEHICLE_TEMPLATE } from './vehicleTemplates';

/** Abbild der Regel aus `vehicleTemplates.ts`: Dachbreite = Innenbreite − 0,45 m, auf 5 cm gerundet. */
const expectedRoofWidth = (width: number) => Number((Math.round((width - 0.45) / 0.05) * 0.05).toFixed(2));

/** 'L3H2' → { lengthIndex: 3, heightIndex: 2 } */
function parseCode(version: string) {
  const match = /^L(\d)H(\d)/.exec(version);
  if (!match) throw new Error(`Kein L/H-Kürzel in "${version}"`);
  return { lengthIndex: Number(match[1]), heightIndex: Number(match[2]) };
}

function familyKey(template: (typeof vehicleTemplates)[number]) {
  return `${template.brand} ${template.model}`;
}

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
      expect(template.roofLength).toBeGreaterThan(0);
      expect(template.roofWidth).toBeGreaterThan(0);
      expect(template.exteriorLength).toBeGreaterThan(0);
      expect(template.exteriorWidth).toBeGreaterThan(0);
      expect(template.exteriorHeight).toBeGreaterThan(0);
    });
  });

  it('should have reasonable dimensions (sanity check)', () => {
    vehicleTemplates.forEach((template) => {
      // Kleinster Hochdachkombi (Caddy) bis großer Kastenwagen (Daily L4)
      expect(template.length).toBeGreaterThan(1.5);
      expect(template.length).toBeLessThan(5.5);

      // Innenbreite aller gängigen Grundfahrzeuge liegt zwischen 1,6 m und 1,9 m
      expect(template.width).toBeGreaterThan(1.5);
      expect(template.width).toBeLessThan(2);

      // Caddy und Berlingo liegen bei 1,27 m, der Sprinter H3 bei 2,24 m
      expect(template.height).toBeGreaterThan(1);
      expect(template.height).toBeLessThan(2.5);
    });
  });

  it('should derive the roof area from the interior dimensions', () => {
    vehicleTemplates.forEach((template) => {
      expect(template.roofWidth).toBe(expectedRoofWidth(template.width));
      expect(template.roofWidth).toBeLessThanOrEqual(template.width);
      expect(template.roofLength).toBe(template.length);
    });
  });

  it('should keep exterior dimensions larger than the load area', () => {
    vehicleTemplates.forEach((template) => {
      expect(template.exteriorLength).toBeGreaterThan(template.length);
      expect(template.exteriorWidth).toBeGreaterThanOrEqual(template.width);
      expect(template.exteriorHeight).toBeGreaterThanOrEqual(template.height);
    });
  });

  it('should use the scheme `<family>-l<length>h<roof>` for ids', () => {
    vehicleTemplates.forEach((template) => {
      // VW zählt beim Crafter erst ab L3 und bis L5
      expect(template.id).toMatch(/^[a-z]+\d*-l[1-5]h[1-4]$/);
    });
  });

  it('should start every version label with its length and roof code', () => {
    vehicleTemplates.forEach((template) => {
      const code = template.id.slice(template.id.lastIndexOf('-l') + 1).toUpperCase();
      expect(template.version.startsWith(code)).toBe(true);
    });
  });

  it('should offer every length in ascending order within a family', () => {
    const families = new Map<string, Map<number, number[]>>();
    vehicleTemplates.forEach((template) => {
      const key = familyKey(template);
      const { lengthIndex } = parseCode(template.version);
      const lengthsOfFamily = families.get(key) ?? new Map<number, number[]>();
      lengthsOfFamily.set(lengthIndex, [...(lengthsOfFamily.get(lengthIndex) ?? []), template.length]);
      families.set(key, lengthsOfFamily);
    });

    families.forEach((lengthsOfFamily, key) => {
      expect(lengthsOfFamily.size, `${key} hat nur eine Länge`).toBeGreaterThan(1);

      const byLength = [...lengthsOfFamily.entries()]
        .map(([lengthIndex, values]) => ({ lengthIndex, length: Math.min(...values) }))
        .sort((a, b) => a.lengthIndex - b.lengthIndex);

      byLength.slice(1).forEach((entry, index) => {
        const previous = byLength[index];
        if (!previous) return;
        expect(
          entry.length,
          `${key}: L${entry.lengthIndex} ist nicht länger als L${previous.lengthIndex}`
        ).toBeGreaterThan(previous.length);
      });
    });
  });

  it('should offer taller roofs in ascending order within a family', () => {
    const families = new Map<string, Map<number, number[]>>();
    vehicleTemplates.forEach((template) => {
      const key = familyKey(template);
      const { lengthIndex, heightIndex } = parseCode(template.version);
      const heights = families.get(key) ?? new Map<number, number[]>();
      heights.set(lengthIndex, [...(heights.get(lengthIndex) ?? []), heightIndex * 1000 + template.height]);
      families.set(key, heights);
    });

    families.forEach((heights, key) => {
      heights.forEach((values, lengthIndex) => {
        const sorted = [...values].sort((a, b) => a - b);
        sorted.slice(1).forEach((value, index) => {
          const previous = sorted[index];
          if (previous === undefined) return;
          expect(value, `${key} L${lengthIndex}: Dachhöhen nicht aufsteigend`).toBeGreaterThan(previous);
        });
      });
    });
  });

  it('should cover the common camper base vehicles', () => {
    const models = new Set(vehicleTemplates.map((template) => template.model));
    [
      'Ducato/Jumper/Boxer',
      'Sprinter (907)',
      'Crafter/TGE',
      'Transporter (T5/T6/T6.1)',
      'Transit',
      'Transit Custom',
      'Trafic/Vivaro/NV300/Talento',
      'Master/Movano/NV400',
      'Vito (447)',
      'Daily (35S)',
      'Caddy Cargo',
      'Berlingo/Partner/Combo',
    ].forEach((model) => {
      expect(models.has(model), `Baureihe fehlt: ${model}`).toBe(true);
    });
  });

  it('should cover all four lengths for Ducato and Sprinter', () => {
    ['Ducato/Jumper/Boxer', 'Sprinter (907)'].forEach((model) => {
      const lengths = new Set(
        vehicleTemplates
          .filter((template) => template.model === model)
          .map((template) => parseCode(template.version).lengthIndex)
      );
      expect([...lengths].sort()).toEqual([1, 2, 3, 4]);
    });
  });

  it('should keep the Ducato L1H1 as default vehicle', () => {
    expect(DEFAULT_VEHICLE_TEMPLATE.id).toBe('ducato-l1h1');
    expect(vehicleTemplates[0]).toBe(DEFAULT_VEHICLE_TEMPLATE);
  });
});
