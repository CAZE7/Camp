import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildOrthogonalPath, orthogonalWaypoints } from './orthogonalRouting';
import { ROUTING_SCENARIOS } from './routingScenarios';

/**
 * Visuelle Regression der Routing-Galerie (AGENTS.md K3).
 *
 * `docs/routing-gallery/gallery.json` ist die eingecheckte Referenz aller
 * 25 Szenarien. Dieser Test rechnet sie neu und vergleicht Wegpunkt für
 * Wegpunkt. Damit gilt: **kein Pfad ändert sich unbemerkt.**
 *
 * Ändert ein Pull Request das Routing absichtlich, muss er
 *   1. `npm run routing:gallery` ausführen (JSON + SVGs neu erzeugen),
 *   2. die Änderung im PR begründen (Diff der SVGs ist Teil des Reviews).
 *
 * Ein stillschweigendes Aktualisieren der Referenz ist damit ausgeschlossen —
 * die Datei ist Teil des Diffs und der Test nennt den betroffenen Fall.
 */

const GALLERY = resolve(process.cwd(), 'docs', 'routing-gallery');

type GalleryEntry = {
  id: string;
  title: string;
  obstacleFree: boolean;
  exception: string | null;
  waypoints: { x: number; y: number }[];
  path: string;
  crossings: number;
  label: { x: number; y: number };
  length: number;
  manhattan: number;
};

function loadGallery(): GalleryEntry[] {
  const file = join(GALLERY, 'gallery.json');
  expect(existsSync(file), 'docs/routing-gallery/gallery.json fehlt — npm run routing:gallery').toBe(true);
  return (JSON.parse(readFileSync(file, 'utf8')) as { scenarios: GalleryEntry[] }).scenarios;
}

describe('Routing-Galerie — visuelle Regression', () => {
  const gallery = loadGallery();

  it('enthält genau die Szenarien aus routingScenarios.ts', () => {
    expect(gallery.map((entry) => entry.id)).toEqual(ROUTING_SCENARIOS.map((s) => s.id));
  });

  it('enthält mindestens 20 Szenarien', () => {
    expect(gallery.length).toBeGreaterThanOrEqual(20);
  });

  for (const scenario of ROUTING_SCENARIOS) {
    it(`${scenario.id}: Pfad entspricht der eingecheckten Referenz`, () => {
      const reference = gallery.find((entry) => entry.id === scenario.id);
      expect(reference, `Kein Galerie-Eintrag für ${scenario.id}`).toBeDefined();

      const { waypoints, crossings } = orthogonalWaypoints(scenario.input);
      const { path, labelX, labelY } = buildOrthogonalPath(scenario.input);

      expect(
        waypoints,
        `Routing für ${scenario.id} geändert. Wenn das gewollt ist: ` +
          '"npm run routing:gallery" ausführen und die Änderung im PR begründen.'
      ).toEqual(reference!.waypoints);
      expect(path).toBe(reference!.path);
      expect(crossings).toBe(reference!.crossings);
      expect({ x: labelX, y: labelY }).toEqual(reference!.label);
    });

    it(`${scenario.id}: SVG ist vorhanden und zeichnet den Referenzpfad`, () => {
      const file = join(GALLERY, `${scenario.id}.svg`);
      expect(existsSync(file), `${scenario.id}.svg fehlt`).toBe(true);
      const svg = readFileSync(file, 'utf8');
      const reference = gallery.find((entry) => entry.id === scenario.id)!;

      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('</svg>');
      if (reference.path) {
        expect(svg).toContain(`d="${reference.path}"`);
      }
      // Hindernisse und Fremdleitungen müssen mitgezeichnet sein, sonst ist
      // das Bild als Review-Grundlage wertlos.
      for (const obstacle of scenario.input.obstacles ?? []) {
        expect(svg).toContain(`x="${obstacle.x}" y="${obstacle.y}"`);
      }
    });
  }

  it('die Kennzahlen in der Referenz sind konsistent', () => {
    for (const entry of gallery) {
      expect(entry.length).toBeGreaterThanOrEqual(0);
      expect(entry.manhattan).toBeGreaterThanOrEqual(0);
      expect(entry.crossings).toBeGreaterThanOrEqual(0);
      if (!entry.obstacleFree) {
        expect(entry.exception).toBeTruthy();
      }
    }
  });
});
