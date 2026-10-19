import { describe, expect, it } from 'vitest';
import { TEMPLATES_DICT } from './templates';

/**
 * Nachtest 2026-10-16: „Vorlage: 0 h / 0 V / Nicht bestanden“ — alle
 * Verbraucher standen auf 0 h/Tag, das Solarmodul auf 0 V / 0 A. Eine
 * Vorlage muss mit vollständigen Startwerten beginnen, sonst ist sie
 * kein Startpunkt, sondern eine Baustelle voller „fehlende Angabe“-
 * Befunde, die der Nutzer nicht verursacht hat.
 */
describe('Vorlagen tragen vollständige Startwerte (Nachtest)', () => {
  const entries = Object.entries(TEMPLATES_DICT);

  it('kennt die drei Wizard-Vorlagen', () => {
    expect(Object.keys(TEMPLATES_DICT).sort()).toEqual(['allrounder', 'autark', 'minimalist']);
  });

  for (const [name, template] of entries) {
    it(`${name}: jeder Verbraucher hat Leistung und Nutzungsdauer > 0`, () => {
      const consumers = template.nodes.filter(
        (node) => node.type === 'consumer' || node.type === 'consumer230v'
      );
      expect(consumers.length).toBeGreaterThan(0);
      for (const node of consumers) {
        const data = node.data as { watts?: number; hours?: number; label?: string };
        expect(data.watts ?? 0, `${data.label} watts`).toBeGreaterThan(0);
        expect(data.hours ?? 0, `${data.label} hours`).toBeGreaterThan(0);
        expect(data.hours ?? 0, `${data.label} hours ≤ 24`).toBeLessThanOrEqual(24);
      }
    });

    it(`${name}: Solarmodule haben Arbeitsspannung/-strom, Batterien eine Nennspannung`, () => {
      for (const node of template.nodes) {
        const data = node.data as Record<string, number | string | undefined>;
        if (node.type === 'solar') {
          expect(Number(data.voltage ?? 0), 'solar voltage').toBeGreaterThan(0);
          expect(Number(data.amps ?? 0), 'solar amps').toBeGreaterThan(0);
          expect(Number(data.watts ?? 0), 'solar watts').toBeGreaterThan(0);
        }
        if (node.type === 'battery') {
          expect(Number(data.nominalVoltage ?? 0), 'battery nominalVoltage').toBeGreaterThan(0);
          expect(Number(data.capacity ?? 0), 'battery capacity').toBeGreaterThan(0);
        }
        if (node.type === 'mpptController') {
          expect(Number(data.maxPvVoltage ?? 0), 'mppt maxPvVoltage').toBeGreaterThan(0);
        }
      }
    });

    it(`${name}: Knoten-IDs sind eindeutig und Kanten zeigen auf vorhandene Knoten`, () => {
      const ids = template.nodes.map((node) => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      const idSet = new Set(ids);
      for (const edge of template.edges) {
        expect(idSet.has(edge.source), `source ${edge.source}`).toBe(true);
        expect(idSet.has(edge.target), `target ${edge.target}`).toBe(true);
      }
    });
  }
});
