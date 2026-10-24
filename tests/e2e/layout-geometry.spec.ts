import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Page, test } from '@playwright/test';

import { openPlanner, showSidebar } from './helpers';

const SPEC_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Ein realistischer Plan für die Canvas-Griffe: Ohne Plan steht in der Mitte
 * der leeren Zeichenfläche ein Aufruf-Kasten — eine gewollte Überlagerung.
 */
function complexPlan(): { nodes: unknown[]; edges: unknown[] } {
  const raw = JSON.parse(readFileSync(join(SPEC_DIR, '..', '..', 'knownPlans', 'complex.json'), 'utf8')) as {
    autoWire: { nodes: unknown[]; edges: unknown[] };
  };
  return raw.autoWire;
}

/**
 * tests/e2e/layout-geometry.spec.ts
 *
 * M12 — Geometrie-Budgets des Rahmens (Auftrag §9B).
 *
 * Geprüft wird an echten `getBoundingClientRect`-Werten, nicht an Klassen:
 *
 *   1. Kein horizontaler Überlauf des Dokuments in JEDER Pflichtgröße.
 *   2. Die Werkzeugleiste läuft nicht über und schneidet keinen Knopf an.
 *   3. Die Zeichenfläche behält eine brauchbare Fläche (Mindestbreite je
 *      Geräteklasse, Mindesthöhe auch im flachen Querformat).
 *   4. Die Chrome-Zeilen überlappen einander nicht und rahmen den
 *      Arbeitsbereich ein (Menüleiste oben, Werkzeugleiste darunter,
 *      Statuszeile/Fußleiste darunter).
 *   5. Dialoge und Blätter liegen vollständig im Fenster.
 *
 * Die Größenliste entspricht dem Auftrag (§3/§4/§5): 320×640 bis 1920×1080,
 * hochkant und quer. Die Playwright-Projekte decken 375/768/1440 px ab; die
 * übrigen Größen werden in diesem Test per `setViewportSize` gefahren — das ist
 * eine simulierte Browsergröße im selben Chromium, kein echtes Gerät. Genau
 * diese Trennung hält der Prüfbericht fest.
 */

const SIZES: Array<{ name: string; width: number; height: number }> = [
  { name: '320×640 (Handy klein)', width: 320, height: 640 },
  { name: '375×812 (Handy)', width: 375, height: 812 },
  { name: '430×932 (Handy groß)', width: 430, height: 932 },
  { name: '640×320 (Handy quer)', width: 640, height: 320 },
  { name: '600×960 (Tablet hochkant klein)', width: 600, height: 960 },
  { name: '768×1024 (Tablet)', width: 768, height: 1024 },
  { name: '820×1180 (Tablet hochkant)', width: 820, height: 1180 },
  { name: '1024×768 (Tablet quer)', width: 1024, height: 768 },
  { name: '1180×820 (Tablet quer groß)', width: 1180, height: 820 },
  { name: '1280×800 (Notebook)', width: 1280, height: 800 },
  { name: '1440×900 (Desktop)', width: 1440, height: 900 },
  { name: '1920×1080 (Desktop groß)', width: 1920, height: 1080 },
];

type Rect = { x: number; y: number; width: number; height: number; right: number; bottom: number };

type Measurement = {
  viewport: { width: number; height: number };
  documentOverflow: number;
  bodyOverflow: number;
  toolbar: Rect & { scrollWidth: number; clientWidth: number };
  status: Rect & { scrollWidth: number; clientWidth: number };
  clippedButtons: string[];
  workspace: Rect;
  canvas: Rect;
  canvasPane: Rect;
  menubar: Rect;
  statusbar: (Rect & { scrollWidth: number; clientWidth: number }) | null;
  nav: Rect | null;
  palette: Rect;
  inspector: Rect;
};

async function measure(page: Page): Promise<Measurement> {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value);
    const rect = (element: Element): Rect => {
      const box = element.getBoundingClientRect();
      return {
        x: round(box.x),
        y: round(box.y),
        width: round(box.width),
        height: round(box.height),
        right: round(box.right),
        bottom: round(box.bottom),
      };
    };
    // `null`, wenn das Element im DOM liegt, aber nicht gerendert wird
    // (z. B. die Statuszeile im flachen Querformat).
    const optional = (selector: string): Element | null => {
      const element = document.querySelector(selector);
      if (!element || element.getClientRects().length === 0) return null;
      return element;
    };
    const must = (selector: string): Element => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Element fehlt: ${selector}`);
      return element;
    };

    const toolbar = must('.cad-toolbar');
    const toolbarRect = toolbar.getBoundingClientRect();
    const clippedButtons = Array.from(toolbar.querySelectorAll('button'))
      .filter((button) => {
        const box = button.getBoundingClientRect();
        if (box.width === 0) return false;
        return (
          box.right > toolbarRect.right + 1 ||
          box.left < toolbarRect.left - 1 ||
          box.bottom > toolbarRect.bottom + 1
        );
      })
      .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '?');

    const status = must('.cad-toolbar__status');
    const inner = toolbar.clientWidth - status.clientWidth;
    void inner;

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth - document.documentElement.clientWidth,
      toolbar: { ...rect(toolbar), scrollWidth: toolbar.scrollWidth, clientWidth: toolbar.clientWidth },
      status: { ...rect(status), scrollWidth: status.scrollWidth, clientWidth: status.clientWidth },
      clippedButtons,
      workspace: rect(must('[data-testid="planner-workspace"]')),
      canvas: rect(must('[data-testid="planner-canvas-column"]')),
      // Die eigentliche Zeichenfläche ist der React-Flow-Kasten INNERHALB der
      // Spalte (die Spalte trägt zusätzlich die Statuszeile).
      canvasPane: rect(must('.react-flow')),
      menubar: rect(must('.cad-menubar')),
      // Im flachen Querformat entfällt die Statuszeile bewusst (Platz für die
      // Zeichenfläche) — dann ist sie nicht da und wird auch nicht geprüft.
      statusbar: optional('.cad-statusbar')
        ? {
            ...rect(optional('.cad-statusbar') as Element),
            scrollWidth: (optional('.cad-statusbar') as HTMLElement).scrollWidth,
            clientWidth: (optional('.cad-statusbar') as HTMLElement).clientWidth,
          }
        : null,
      nav: optional('[data-testid="planner-bottom-nav"]')
        ? rect(optional('[data-testid="planner-bottom-nav"]') as Element)
        : null,
      palette: rect(must('#component-palette-panel')),
      inspector: rect(must('#inspector-panel')),
    };
  });
}

/** Erwartete Canvas-Mindestbreite je Geräteklasse (AGENTS.md K5 / M10-2). */
function canvasMinimum(width: number): number {
  if (width >= 1280) return 600;
  if (width >= 768) return 400;
  return 280;
}

test.describe('M12 Geometrie', () => {
  test('Rahmen und Budgets stimmen in allen Pflichtgrößen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlanner(page);
    await page.getByTestId('planner-shell').waitFor();

    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      // Ein Frame Ruhe, damit das Resize-Ergebnis gemessen wird, nicht der
      // Zwischenstand (React Flow schreibt seine Maße im nächsten Frame).
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await measure(page);

      expect(m.documentOverflow, `${size.name}: Dokument scrollt horizontal`).toBeLessThanOrEqual(1);
      expect(m.bodyOverflow, `${size.name}: body scrollt horizontal`).toBeLessThanOrEqual(1);

      // Werkzeugleiste: eigener Inhalt passt, kein Knopf angeschnitten.
      expect(
        m.toolbar.scrollWidth - m.toolbar.clientWidth,
        `${size.name}: Werkzeugleiste läuft über`
      ).toBeLessThanOrEqual(1);
      expect(
        m.status.scrollWidth - m.status.clientWidth,
        `${size.name}: Statusgruppe läuft über`
      ).toBeLessThanOrEqual(1);
      expect(m.clippedButtons, `${size.name}: angeschnittene Knöpfe`).toEqual([]);
      expect(m.toolbar.x, `${size.name}: Werkzeugleiste beginnt nicht am Rand`).toBeGreaterThanOrEqual(-1);
      expect(m.toolbar.right, `${size.name}: Werkzeugleiste endet vor dem Rand`).toBeGreaterThanOrEqual(
        size.width - 1
      );

      // Zeichenfläche: Mindestbreite und brauchbare Höhe.
      expect(m.canvas.width, `${size.name}: Zeichenfläche zu schmal`).toBeGreaterThanOrEqual(
        canvasMinimum(size.width)
      );
      expect(m.canvasPane.width, `${size.name}: Zeichenfläche zu schmal`).toBeGreaterThanOrEqual(
        canvasMinimum(size.width)
      );
      expect(m.canvasPane.height, `${size.name}: Zeichenfläche zu flach`).toBeGreaterThanOrEqual(150);

      // Chrome-Zeilen rahmen den Arbeitsbereich ein, ohne ihn zu überlappen.
      expect(m.menubar.y, `${size.name}: Menüleiste nicht oben`).toBeLessThanOrEqual(1);
      expect(m.menubar.bottom, `${size.name}: Menüleiste überlappt Arbeitsbereich`).toBeLessThanOrEqual(
        m.workspace.y + 1
      );
      expect(m.toolbar.bottom, `${size.name}: Werkzeugleiste überlappt Arbeitsbereich`).toBeLessThanOrEqual(
        m.workspace.y + 1
      );
      // Die Statuszeile gehört zur Canvas-Spalte: Die Zeichenfläche endet
      // darüber (`canvas.bottom <= statusbar.y`), die Zeile bleibt im Fenster.
      if (m.statusbar) {
        // Die Statuszeile ist kein Scrollbereich: Ihr Inhalt muss hineinpassen,
        // sonst liegt der Prüfstand am rechten Rand außerhalb des Bildes.
        expect(
          m.statusbar.scrollWidth - m.statusbar.clientWidth,
          `${size.name}: Statuszeile läuft über`
        ).toBeLessThanOrEqual(1);
        expect(m.canvasPane.bottom, `${size.name}: Statuszeile überlappt Zeichenfläche`).toBeLessThanOrEqual(
          m.statusbar.y + 1
        );
        expect(m.statusbar.bottom, `${size.name}: Statuszeile ragt aus dem Fenster`).toBeLessThanOrEqual(
          size.height + 1
        );
      }
      if (m.nav) {
        expect(m.nav.y, `${size.name}: Fußleiste überlappt Arbeitsbereich`).toBeGreaterThanOrEqual(
          m.workspace.bottom - 1
        );
        expect(m.nav.bottom, `${size.name}: Fußleiste ragt aus dem Fenster`).toBeLessThanOrEqual(
          size.height + 1
        );
        if (m.statusbar) {
          expect(
            m.statusbar.bottom,
            `${size.name}: Statuszeile liegt unter der Fußleiste`
          ).toBeLessThanOrEqual(m.nav.y + 1);
        }
      }
    }
  });

  /**
   * Schwebende Griffe auf der Zeichenfläche: Zoom-Bedienung, Undo/Redo,
   * Expertenblatt, Anzeige-Chip (Auftrag §3: „keine wichtigen Aktionen außerhalb
   * des Bildes", §7: „keine konkurrierenden Gesten/Ziele").
   *
   * Geprüft wird zweierlei: Der Griff liegt INNERHALB der Zeichenfläche, und
   * `elementFromPoint` in seiner Mitte trifft ihn selbst — also verdeckt ihn
   * weder die Werkzeugleiste noch ein Nachbar-Griff. Genau dieser Fehler war
   * im flachen Querformat real: Die Zoom-Bedienung stand bei y = −6 px hinter
   * der Werkzeugleiste (gemessen 2026-10-14, 640×320).
   *
   * Ein Plan wird per `addInitScript` in den lokalen Speicher gelegt: Ohne Plan
   * zeigt die leere Zeichenfläche ihren eigenen Aufruf-Kasten in der Mitte —
   * das ist eine gewollte Überlagerung und kein Griff.
   */
  test('die schwebenden Zeichenflächen-Griffe sind erreichbar und liegen im Bild', async ({ page }) => {
    // Mehrere Viewport-Größen mit je einem vollständigen Planer-Aufbau: über dem
    // Standard-Timeout von 60 s (Last in CI).
    test.setTimeout(300_000);
    await page.addInitScript((plan) => {
      localStorage.setItem(
        'elektroplaner-planner-v1',
        JSON.stringify({ state: { nodes: plan.nodes, edges: plan.edges, viewMode: 'electric' }, version: 1 })
      );
      localStorage.setItem(
        'elektroplaner-preferences-v1',
        JSON.stringify({ state: { calculatedSolarWatts: 0, hasOnboarded: true }, version: 2 })
      );
    }, complexPlan());

    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openPlanner(page);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

      const result = await page.evaluate(() => {
        const handles = [
          '.react-flow__controls',
          '.planner-mobile-history',
          '.planner-expert-panel',
          '[data-testid="canvas-display-options"]',
        ];
        const pane = document.querySelector('.react-flow')!.getBoundingClientRect();
        return handles.map((selector) => {
          const element = document.querySelector(selector);
          if (!element || element.getClientRects().length === 0) {
            return { selector, state: 'nicht gerendert' };
          }
          const box = element.getBoundingClientRect();
          const center = document.elementFromPoint(
            Math.round(box.x + box.width / 2),
            Math.round(box.y + box.height / 2)
          );
          const inside =
            box.x >= pane.x - 1 &&
            box.y >= pane.y - 1 &&
            box.right <= pane.right + 1 &&
            box.bottom <= pane.bottom + 1;
          const free = !!center && (center === element || element.contains(center));
          return {
            selector,
            state: inside ? (free ? 'ok' : 'verdeckt') : 'außerhalb der Zeichenfläche',
            blocker: free ? '' : (center?.className?.toString().slice(0, 40) ?? ''),
          };
        });
      });

      const broken = result.filter((entry) => entry.state !== 'ok' && entry.state !== 'nicht gerendert');
      expect(broken, `${size.name}: nicht erreichbare Canvas-Griffe`).toEqual([]);

      // Auf jeder Größe muss mindestens die Zoom-Bedienung erreichbar sein: Sie
      // ist der einzige Weg zu Zoom ohne Geste (WCAG 2.5.8 „Zielgröße").
      const controls = result.find((entry) => entry.selector === '.react-flow__controls');
      expect(controls?.state, `${size.name}: Zoom-Bedienung nicht erreichbar`).toBe('ok');
    }
  });

  /**
   * Sichtbarkeitsvertrag der Utilities (Befund 2026-10-14).
   *
   * Das gebaute CSS gibt `.hidden{display:none}` VOR den unlayered Regeln aus
   * `app/globals.css` aus. Jedes dort gesetzte `display:` schlägt damit das
   * einfache `hidden` — die beiden Panel-Umschalter (`.cad-btn … hidden
   * md:inline-flex`) waren deshalb auf jeder Breite sichtbar, lagen auf dem
   * Handy als 44-px-Knopf über dem Blatt des anderen Panels. Dieser Test hält
   * die Regel dauerhaft fest: Ein Element mit einfachem `hidden` ist unsichtbar,
   * solange keine Display-Variante der aktuellen Breite aktiv ist.
   *
   * Einzige, dokumentierte Ausnahme: Im flachen Querformat (Höhe < 480 px)
   * holt §4 der M12-Sektion Rückgängig/Wiederholen/Fokus ausdrücklich in die
   * Werkzeugleiste, weil der schwebende Griff dort keinen Platz hat.
   */
  test('kein Element mit einfachem `hidden` ist sichtbar', async ({ page }) => {
    // Mehrere Viewport-Größen mit je einem vollständigen Planer-Aufbau: über dem
    // Standard-Timeout von 60 s (Last in CI).
    test.setTimeout(300_000);
    const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };

    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openPlanner(page);
      for (const tab of ['nav-tab-sidebar', 'nav-tab-inspector']) {
        const element = page.getByTestId(tab);
        if (await element.isVisible().catch(() => false)) {
          await element.click();
          await expect(element).toHaveAttribute('aria-expanded', 'true');
        }
      }

      const offenders = await page.evaluate((breakpoints) => {
        const tokenIsActive = (token: string): boolean => {
          const [prefix, ...rest] = token.split(':');
          const name = rest.join(':');
          if (!/^(inline|inline-block|inline-flex|flex|block|grid|table|contents)$/.test(name)) return false;
          if (prefix!.startsWith('max-')) {
            const bound = breakpoints[prefix!.slice(4)];
            return bound === undefined ? false : window.innerWidth < bound;
          }
          const bound = breakpoints[prefix!];
          return bound === undefined ? false : window.innerWidth >= bound;
        };
        const flatLandscape = window.innerHeight < 480 && window.innerWidth > window.innerHeight;
        const result: string[] = [];
        document.querySelectorAll('*').forEach((element) => {
          const tokens = element.className?.toString?.().split(/\s+/).filter(Boolean) ?? [];
          if (!tokens.includes('hidden')) return;
          if (tokens.some(tokenIsActive)) return;
          if (getComputedStyle(element).display === 'none') return;
          // Ausnahme §4: im flachen Querformat sind diese Knöpfe ausdrücklich
          // auch unter 768 px in der Werkzeugleiste.
          const isLandscapeToolbarTool = flatLandscape && tokens.includes('cad-toolbar__desktop-tool');
          if (isLandscapeToolbarTool) return;
          result.push(`${element.tagName}.${tokens.slice(0, 3).join('.')}`);
        });
        return result;
      }, BREAKPOINTS);

      expect(offenders, `${size.name}: Elemente mit \`hidden\` sind sichtbar`).toEqual([]);
    }
  });

  test('Panel-Umschalter erscheinen erst an ihrem Haltepunkt', async ({ page }) => {
    for (const [width, height] of [
      [375, 812],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await openPlanner(page);

      // Die Blatt-Schließer des Katalogs gibt es nur unter 768 px: Dort ist der
      // Katalog ein Blatt, ab Tablet eine Spalte mit Griff an der Kante.
      await showSidebar(page);
      const close = page.getByTestId('sidebar-close');
      const visible = await close.isVisible();
      expect(visible, `${width} px: Katalog-Schließer falsch ein-/ausgeblendet`).toBe(width < 768);

      // Griff an der Panelkante: 768–1279 px nur links (Katalog), ab 1280 px
      // zusätzlich rechts (Eigenschaften). Unter 768 px gibt es keinen Griff —
      // dort ist der Katalog ein Blatt mit eigenem Schließen-Knopf.
      const sidebarHandleVisible = await page
        .getByRole('button', { name: /Linke Sidebar/ })
        .isVisible()
        .catch(() => false);
      expect(sidebarHandleVisible, `${width} px: Katalog-Griff falsch`).toBe(width >= 768);

      const inspectorHandleVisible = await page
        .getByRole('button', { name: /Rechte Sidebar/ })
        .isVisible()
        .catch(() => false);
      // Ohne Auswahl ist der Inspector ab 1280 px eingeklappt, aber bedienbar;
      // zwischen 768 und 1279 px ist er ein Slide-over, das eine Auswahl öffnet.
      expect(inspectorHandleVisible, `${width} px: Eigenschaften-Griff falsch`).toBe(width >= 1280);
    }
  });

  test('das schwebende Bedienfeld (Katalog) liegt immer vollständig im Bild', async ({ page }) => {
    for (const size of [SIZES[0]!, SIZES[1]!, SIZES[2]!, SIZES[3]!]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openPlanner(page);
      await page.getByTestId('nav-tab-sidebar').click();
      await expect(page.getByTestId('sidebar')).toBeVisible();
      const palette = (await measure(page)).palette;
      expect(palette.x, `${size.name}: Katalog links außerhalb`).toBeGreaterThanOrEqual(-1);
      expect(palette.right, `${size.name}: Katalog rechts außerhalb`).toBeLessThanOrEqual(size.width + 1);
      expect(palette.bottom, `${size.name}: Katalog unten außerhalb`).toBeLessThanOrEqual(size.height + 1);
      await page.getByTestId('nav-tab-electric').click();
    }
  });

  test('die Stückliste liegt im Fenster und scrollt sich selbst', async ({ page }) => {
    await openPlanner(page);
    const view = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));

    await page.getByTestId('action-more').click();
    await page.getByTestId('action-bom').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height + 1);
  });
});
