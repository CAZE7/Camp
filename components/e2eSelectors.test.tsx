import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Sidebar } from './Sidebar';
import { usePlannerStore } from '../store/usePlannerStore';

/**
 * components/e2eSelectors.test.tsx
 *
 * Vertrag zwischen Anwendung und E2E-Suite (AGENTS.md K5).
 *
 * Die Playwright-Tests brauchen einen echten Browser und laufen deshalb nicht
 * in jedem lokalen Lauf. Damit die Selektoren trotzdem nicht unbemerkt
 * verschwinden, prüft dieser Vitest-Test zwei Dinge **ohne Browser**:
 *
 *   1. Die Komponenten rendern die vereinbarten `data-testid`-Attribute.
 *   2. Jede `getByTestId(...)`-Verwendung in `tests/e2e/` hat eine Entsprechung
 *      im Quellcode der Anwendung.
 *
 * Damit schlägt ein umbenannter Selektor sofort im normalen `npm test` fehl —
 * und nicht erst in der CI-Stufe mit Browser.
 */

const REPO_ROOT = resolve(__dirname, '..');

/** Alle testids, die die E2E-Suite erwartet. */
const REQUIRED_TESTIDS = [
  'planner-shell',
  'planner-canvas-column',
  'inspector-panel',
  'planner-bottom-nav',
  'nav-tab-sidebar',
  'nav-tab-electric',
  'nav-tab-water',
  'nav-tab-inspector',
  'sidebar',
  'sidebar-search',
  'sidebar-item',
  'planner-node',
  'action-autowire',
  'action-more',
  'action-bom',
  'action-check',
] as const;

/** Quellcode der Anwendung (ohne Tests) als ein String. */
function appSources(): string {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  for (const dir of ['components', 'app', 'store']) {
    const full = join(REPO_ROOT, dir);
    if (existsSync(full)) walk(full);
  }
  return files.map((file) => readFileSync(file, 'utf8')).join('\n');
}

describe('E2E-Selektoren — Vertrag mit tests/e2e', () => {
  const sources = appSources();

  it('alle vereinbarten data-testid-Attribute existieren im Anwendungscode', () => {
    const missing = REQUIRED_TESTIDS.filter(
      (id) => !sources.includes(`data-testid="${id}"`) && !sources.includes(`data-testid={'${id}'}`)
    );
    expect(missing, `Fehlende Selektoren: ${missing.join(', ')}`).toEqual([]);
  });

  it('jede getByTestId-Verwendung in tests/e2e ist im Anwendungscode vorhanden', () => {
    const e2eDir = join(REPO_ROOT, 'tests', 'e2e');
    expect(existsSync(e2eDir), 'tests/e2e fehlt').toBe(true);

    const specs = readdirSync(e2eDir)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => readFileSync(join(e2eDir, file), 'utf8'))
      .join('\n');

    const used = new Set<string>();
    const collect = (pattern: RegExp): void => {
      let match: RegExpExecArray | null = pattern.exec(specs);
      while (match !== null) {
        used.add(match[1]!);
        match = pattern.exec(specs);
      }
    };
    collect(/getByTestId\(['"]([^'"]+)['"]\)/g);
    collect(/data-testid="([^"]+)"/g);

    expect(used.size, 'Die E2E-Suite verwendet keine testids?').toBeGreaterThan(5);
    const unknown = Array.from(used).filter((id) => !sources.includes(`data-testid="${id}"`));
    expect(unknown, `In tests/e2e verwendet, aber nirgends gerendert: ${unknown.join(', ')}`).toEqual([]);
  });

  it('die E2E-Suite verwendet kein waitForTimeout', () => {
    const e2eDir = join(REPO_ROOT, 'tests', 'e2e');
    const specs = readdirSync(e2eDir)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => readFileSync(join(e2eDir, file), 'utf8'))
      .join('\n');
    // Kommentare dürfen die Regel benennen, ohne sie zu verletzen.
    const code = specs
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/waitForTimeout/);
  });

  it('die Playwright-Konfiguration testet den gebauten Static Export', () => {
    const config = readFileSync(join(REPO_ROOT, 'playwright.config.ts'), 'utf8');
    expect(config).toMatch(/static-server\.mjs/);
    expect(config).toMatch(/out/);
    // Kein Dev-Server: `next dev` würde andere Bundles ausliefern.
    expect(config).not.toMatch(/next dev/);
  });
});

describe('E2E-Selektoren — tatsächlich gerendert', () => {
  beforeEach(() => {
    vi.spyOn(usePlannerStore, 'getState');
  });

  it('die Sidebar rendert Suchfeld und Bauteil-Kacheln mit Typ-Attribut', () => {
    render(<Sidebar />);

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-search')).toBeInTheDocument();

    // Wie die E2E-Suite: eingeklappte Kategorien zuerst öffnen.
    for (const toggle of screen.getAllByRole('button', { expanded: false })) {
      fireEvent.click(toggle);
    }

    const tiles = screen.getAllByTestId('sidebar-item');
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.getAttribute('data-component-type')).toBeTruthy();
      expect(tile.getAttribute('data-component-label')).toBeTruthy();
    }

    // Die Bauteile, die die E2E-Tests hinzufügen, müssen auffindbar sein.
    const types = tiles.map((tile) => tile.getAttribute('data-component-type'));
    for (const required of ['battery', 'fuse', 'consumer', 'busbar', 'inverter', 'consumer230v']) {
      expect(types, `Kachel für ${required} fehlt`).toContain(required);
    }
  });
});
