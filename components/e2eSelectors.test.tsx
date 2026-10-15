import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Sidebar } from './Sidebar';
import { usePlannerStore } from '../store/usePlannerStore';
import { ROUTING_STATUS_TESTID, ROUTING_TERMINAL_PHASES } from './planner/ui/RoutingStatusBadge';

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
  // 'planner-node' ist am 2026-09-28 entfernt: Der Eintrag wurde NUR von der
  // toten `components/nodes/BaseNode.tsx` erfüllt (sie trug das Attribut, wurde
  // aber von keiner Seite gerendert) — die E2E-Suite zählt Knoten über
  // `.react-flow__node:not(.react-flow__node-backboneGroup)`
  // (`tests/e2e/helpers.ts`) und hat den Selektor nie benutzt. Der Vertrag
  // forderte damit ein Attribut, das in der App nirgends ankam.
  'action-autowire',
  'action-more',
  'action-bom',
  'action-check',
] as const;

/**
 * Ein Selektor gilt als vorhanden, wenn er entweder als literales Attribut im
 * JSX steht (`data-testid="action-bom"`) oder als Deklaration im
 * Aktionsmodell (`testId: 'action-bom'`). Menüeinträge tragen die Kennung im
 * Datenobjekt; gerendert wird sie über `data-testid={item.testId}` — für die
 * E2E-Suite ist beides gleichwertig, weil im DOM dasselbe Attribut entsteht.
 */
function hasTestId(sources: string, id: string): boolean {
  return (
    sources.includes(`data-testid="${id}"`) ||
    sources.includes(`data-testid={'${id}'}`) ||
    sources.includes(`testId: '${id}'`)
  );
}

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
    const missing = REQUIRED_TESTIDS.filter((id) => !hasTestId(sources, id));
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
    const unknown = Array.from(used).filter((id) => !hasTestId(sources, id));
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

/**
 * UI-AUDIT 2026-10-13 — Routing-Phasen sind Teil des E2E-Vertrags.
 *
 * Das Routing-Badge hat seit RS-002 sechs Lebenszyklus-Zustände. Die
 * Playwright-Specs laufen nicht in jedem lokalen Lauf (echter Browser), und
 * `routing-stability.spec.ts` wartet auf einen ABGESCHLOSSENEN Lauf. Wäre eine
 * neue Phase ohne Selektor geblieben — oder hätte der Wait nur `valid|invalid`
 * abgedeckt —, wäre die Spec ins Zeitlimit gelaufen, obwohl die App einen
 * korrekten Zustand zeigt. Deshalb wird die Kopplung hier ohne Browser geprüft.
 */
describe('Routing-Phasen ↔ E2E-Selektoren (RS-002)', () => {
  const badgeSource = readFileSync(
    join(REPO_ROOT, 'components', 'planner', 'ui', 'RoutingStatusBadge.tsx'),
    'utf8'
  );
  const stabilitySpec = readFileSync(join(REPO_ROOT, 'tests', 'e2e', 'routing-stability.spec.ts'), 'utf8');

  it('jede Routing-Phase hat einen data-testid, der im Badge gerendert wird', () => {
    const phases = Object.keys(ROUTING_STATUS_TESTID);
    // Vollständigkeit gegen die Phasen-Definition des Stores — sonst könnte
    // die Tabelle hier schrumpfen, ohne dass es auffällt.
    expect(phases.sort()).toEqual(['idle', 'routing', 'valid', 'invalid', 'not-converged', 'error'].sort());
    const missing = phases.filter((phase) => {
      const id = ROUTING_STATUS_TESTID[phase as keyof typeof ROUTING_STATUS_TESTID];
      return !badgeSource.includes(`data-testid="${id}"`);
    });
    expect(missing, `Phase ohne gerenderten Selektor: ${missing.join(', ')}`).toEqual([]);
  });

  it('der Wait auf einen abgeschlossenen Lauf deckt jede Terminal-Phase ab', () => {
    const missing = ROUTING_TERMINAL_PHASES.filter(
      (phase) => !stabilitySpec.includes(`data-testid="${ROUTING_STATUS_TESTID[phase]}"`)
    );
    expect(missing, `routing-stability.spec.ts wartet nicht auf: ${missing.join(', ')}`).toEqual([]);
  });

  it('der Wait wartet NICHT auf die nicht-terminalen Phasen', () => {
    // `idle` und `routing` bedeuten „noch nicht fertig". Ständen sie im Wait,
    // würde die Spec sofort weiterlaufen und den eigentlichen Zustand nie prüfen.
    const waitForBlock = stabilitySpec.slice(
      stabilitySpec.indexOf('await expect('),
      stabilitySpec.indexOf('.toBeVisible();')
    );
    expect(waitForBlock).not.toContain(ROUTING_STATUS_TESTID.idle);
    expect(waitForBlock).not.toContain(ROUTING_STATUS_TESTID.routing);
  });
});
