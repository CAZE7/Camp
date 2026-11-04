import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * AP-3 / Aufgabe #17: gemalte Touchziele und Tastaturfokus im Planer messen.
 *
 * Die Messung läuft gegen den gebauten Export und prüft die sechs in der
 * Designspezifikation festgelegten Breiten in beiden Themen. Normale Bediener
 * werden über ihre tatsächlich gemalte DOM-Box bewertet. Canvas-Ports und
 * -Kanten stehen separat: ihre sichtbare Geometrie ist absichtlich klein,
 * ihre Trefferlage wird über ::before bzw. den unsichtbaren SVG-Stroke auf
 * Bildschirm-Pixel zurückgerechnet.
 *
 * Nutzung:
 *   npm run build
 *   node scripts/e2e/static-server.mjs 4173 out
 *   node scripts/design-audit/vermessung-touch-fokus.mjs <name>
 *
 * Ausgabe:
 *   scripts/design-audit/ergebnis/touch-fokus-<name>.json
 */

const name = process.argv[2];
if (!name) {
  console.error('Nutzung: node scripts/design-audit/vermessung-touch-fokus.mjs <name>');
  process.exit(1);
}

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ergebnis');
const MIN_TOUCH = 44;
const MIN_FOCUS_CONTRAST = 3;
const viewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  executablePath: executablePath || undefined,
  args: executablePath ? ['--no-sandbox', '--no-zygote'] : [],
});

const faelle = [];

for (const schema of ['light', 'dark']) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ colorScheme: schema, viewport });

    // Das Solardaten-Banner gehört zur Zeichenfläche, erscheint aber nur nach
    // einem Besuch im Dachplaner. Der reproduzierbare Zustand stellt sicher,
    // dass auch sein Schließknopf in jeder Breite wirklich gemessen wird.
    await context.addInitScript(() => {
      localStorage.setItem(
        'elektroplaner-preferences-v1',
        JSON.stringify({ state: { calculatedSolarWatts: 500, hasOnboarded: true }, version: 2 })
      );
    });

    const page = await context.newPage();
    await page.goto(`${BASE}/planer/?template=kastenwagen`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.react-flow__node', { timeout: 30_000 });
    await page.waitForSelector('button[aria-label="Hinweis schließen"]', { timeout: 15_000 });
    await page.waitForTimeout(300);

    const dom = await page.evaluate(
      ({ minTouch }) => {
        const ordinarySelector = [
          'button',
          'a[href]',
          'input:not([type="hidden"])',
          'select',
          'textarea',
          'summary',
          '[role="button"]',
          '[role="menuitem"]',
          '[role="tab"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="switch"]',
          '[tabindex]:not([tabindex="-1"])',
        ].join(',');

        const round = (n) => Math.round(n * 100) / 100;
        const visible = (el) => {
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            Number(style.opacity) > 0.01 &&
            box.width > 0 &&
            box.height > 0 &&
            box.right > 0 &&
            box.bottom > 0 &&
            box.left < innerWidth &&
            box.top < innerHeight
          );
        };
        const nameOf = (el) =>
          (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 140);
        const kennung = (el) => ({
          tag: el.tagName.toLowerCase(),
          testId: el.getAttribute('data-testid'),
          rolle: el.getAttribute('role'),
          name: nameOf(el),
          klasse:
            typeof el.className === 'string'
              ? el.className.slice(0, 160)
              : (el.className?.baseVal ?? '').slice(0, 160),
        });

        let auditId = 0;
        document.querySelectorAll('*').forEach((el) => {
          el.setAttribute('data-touch-fokus-audit-id', String(auditId));
          auditId += 1;
        });

        const bediener = [...document.querySelectorAll(`.planner-shell ${ordinarySelector}`)]
          .filter((el, index, all) => all.indexOf(el) === index)
          .filter(visible)
          // Ports und Kanten haben keine rechteckige DOM-Trefferbox und werden
          // deshalb im eigenen Messblock weiter unten bewertet.
          .filter((el) => !el.closest('.react-flow__handle, .react-flow__edge'))
          .map((el) => {
            const box = el.getBoundingClientRect();
            const visibleWidth = Math.max(0, Math.min(innerWidth, box.right) - Math.max(0, box.left));
            const visibleHeight = Math.max(0, Math.min(innerHeight, box.bottom) - Math.max(0, box.top));
            return {
              id: el.getAttribute('data-touch-fokus-audit-id'),
              ...kennung(el),
              deaktiviert: el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true',
              box: {
                x: round(box.x),
                y: round(box.y),
                breite: round(box.width),
                hoehe: round(box.height),
                sichtbareBreite: round(visibleWidth),
                sichtbareHoehe: round(visibleHeight),
              },
              besteht: box.width + 0.01 >= minTouch && box.height + 0.01 >= minTouch,
            };
          });

        const focusErwartet = [...document.querySelectorAll('.planner-shell [data-touch-fokus-audit-id]')]
          .filter(visible)
          .filter(
            (el) =>
              el.tabIndex >= 0 && !el.matches(':disabled') && el.getAttribute('aria-disabled') !== 'true'
          )
          .map((el) => el.getAttribute('data-touch-fokus-audit-id'));

        const root = document.querySelector('.react-flow');
        const zoom = Number.parseFloat(
          root ? getComputedStyle(root).getPropertyValue('--planner-viewport-zoom') : '1'
        );
        const sichereZoomstufe = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;

        const ports = [...document.querySelectorAll('.react-flow__handle.connectable')]
          .filter(visible)
          .map((handle) => {
            const box = handle.getBoundingClientRect();
            const marker = handle.querySelector(':scope > div')?.getBoundingClientRect();
            const hit = getComputedStyle(handle, '::before');
            const hitWidth = Number.parseFloat(hit.width);
            const hitHeight = Number.parseFloat(hit.height);
            return {
              ...kennung(handle),
              sichtbareBox: { breite: round(box.width), hoehe: round(box.height) },
              sichtbarerMarker: marker ? { breite: round(marker.width), hoehe: round(marker.height) } : null,
              treffzonePlanPx: { breite: round(hitWidth), hoehe: round(hitHeight) },
              treffzoneBildschirmPx: {
                breite: round(hitWidth * sichereZoomstufe),
                hoehe: round(hitHeight * sichereZoomstufe),
              },
              pointerEventsPseudo: hit.pointerEvents,
              besteht:
                hitWidth * sichereZoomstufe + 0.01 >= minTouch &&
                hitHeight * sichereZoomstufe + 0.01 >= minTouch,
            };
          });

        const kanten = [...document.querySelectorAll('.planner-edge-hit-target')]
          .filter(visible)
          .map((edge) => {
            const style = getComputedStyle(edge);
            const strokeWidth = Number.parseFloat(style.strokeWidth);
            return {
              ...kennung(edge),
              strokePlanPx: round(strokeWidth),
              strokeBildschirmPx: round(strokeWidth * sichereZoomstufe),
              pointerEvents: style.pointerEvents,
              besteht: strokeWidth * sichereZoomstufe + 0.01 >= minTouch,
            };
          });

        return {
          themaKlasse: document.documentElement.className,
          zoom: round(sichereZoomstufe),
          bediener,
          focusErwartet,
          ports,
          kanten,
        };
      },
      { minTouch: MIN_TOUCH }
    );

    // Erreichbarkeit und sichtbarer Fokus werden bewusst getrennt gemessen:
    // Tab durchläuft die echte Browser-Reihenfolge. Ein programmatisches
    // element.focus() würde gerade die Tastatur-Erreichbarkeit nicht beweisen.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      document.body.focus();
    });

    const alleBesucht = new Set();
    const planerBesucht = new Map();
    let tabRundeAbgeschlossen = false;

    for (let schritt = 0; schritt < 500; schritt += 1) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => {
        const el = document.activeElement;
        if (!(el instanceof HTMLElement || el instanceof SVGElement)) return null;
        const id = el.getAttribute('data-touch-fokus-audit-id');
        if (!id) return null;
        const imPlaner = Boolean(el.closest('.planner-shell'));
        if (!imPlaner) return { id, imPlaner };

        const parseColor = (value) => {
          const match = value.match(/rgba?\(([^)]+)\)/);
          if (!match) return null;
          const parts = (match[1] ?? '')
            .split(/[,\s/]+/)
            .filter(Boolean)
            .map(Number);
          return {
            r: parts[0] ?? 0,
            g: parts[1] ?? 0,
            b: parts[2] ?? 0,
            a: parts.length > 3 ? (parts[3] ?? 1) : 1,
          };
        };
        const composite = (front, back) => {
          const alpha = front.a + back.a * (1 - front.a);
          if (alpha <= 0) return { r: 255, g: 255, b: 255, a: 1 };
          return {
            r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha,
            g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha,
            b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha,
            a: alpha,
          };
        };
        const hintergrund = (start) => {
          const layers = [];
          for (let node = start; node; node = node.parentElement) {
            const color = parseColor(getComputedStyle(node).backgroundColor);
            if (color && color.a > 0) layers.push(color);
          }
          let result = { r: 255, g: 255, b: 255, a: 1 };
          for (let index = layers.length - 1; index >= 0; index -= 1) {
            result = composite(layers[index], result);
          }
          return result;
        };
        const luminanz = (color) =>
          [color.r, color.g, color.b]
            .map((value) => {
              const channel = value / 255;
              return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const kontrast = (a, b) => {
          const x = luminanz(a);
          const y = luminanz(b);
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        };
        const round = (n) => Math.round(n * 100) / 100;
        const style = getComputedStyle(el);
        const outline = parseColor(style.outlineColor);
        const back = hintergrund(el.parentElement);
        const outlineSignal =
          Number.parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== 'none' && outline?.a > 0.01;
        const shadowSignal =
          style.boxShadow !== 'none' &&
          [...style.boxShadow.matchAll(/rgba?\(([^)]+)\)/g)].some((match) => {
            const color = parseColor(`rgba(${match[1]})`);
            return color && color.a > 0.01;
          });
        const box = el.getBoundingClientRect();

        return {
          id,
          imPlaner,
          tag: el.tagName.toLowerCase(),
          testId: el.getAttribute('data-testid'),
          rolle: el.getAttribute('role'),
          name: (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 140),
          focusVisible: el.matches(':focus-visible'),
          outline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
          boxShadow: style.boxShadow,
          outlineKontrast: outlineSignal && outline ? round(kontrast(outline, back)) : null,
          focusSignal: Boolean(outlineSignal || shadowSignal),
          imViewport:
            box.width > 0 &&
            box.height > 0 &&
            box.right > 0 &&
            box.bottom > 0 &&
            box.left < innerWidth &&
            box.top < innerHeight,
        };
      });

      if (!focus) continue;
      if (alleBesucht.has(focus.id)) {
        tabRundeAbgeschlossen = true;
        break;
      }
      alleBesucht.add(focus.id);
      if (focus.imPlaner) planerBesucht.set(focus.id, focus);
    }

    const erwartet = new Set(dom.focusErwartet);
    const nichtErreichbar = [...erwartet].filter((id) => !planerBesucht.has(id));
    const focusMessungen = [...planerBesucht.values()];
    const ohneSichtbarenFocus = focusMessungen.filter(
      (item) =>
        !item.focusVisible ||
        !item.focusSignal ||
        (item.outlineKontrast !== null && item.outlineKontrast + 0.01 < MIN_FOCUS_CONTRAST)
    );

    const fall = {
      schema,
      viewport,
      themaKlasse: dom.themaKlasse,
      zoom: dom.zoom,
      touch: {
        anzahlBediener: dom.bediener.length,
        unter44: dom.bediener.filter((item) => !item.besteht),
        bediener: dom.bediener,
      },
      fokus: {
        erwarteteSichtbareTabstopps: dom.focusErwartet.length,
        erreichtePlanerTabstopps: focusMessungen.length,
        tabRundeAbgeschlossen,
        nichtErreichbar,
        ohneSichtbarenFocus,
        messungen: focusMessungen,
      },
      canvasTrefferzonen: {
        ports: dom.ports,
        kanten: dom.kanten,
        portsUnter44: dom.ports.filter((item) => !item.besteht).length,
        kantenUnter44: dom.kanten.filter((item) => !item.besteht).length,
      },
    };
    faelle.push(fall);

    console.log(
      `${schema.padEnd(5)} ${String(viewport.width).padStart(4)} px | ` +
        `Bediener ${String(fall.touch.anzahlBediener).padStart(3)}, <44: ${fall.touch.unter44.length} | ` +
        `Tab ${fall.fokus.erreichtePlanerTabstopps}/${fall.fokus.erwarteteSichtbareTabstopps}, ` +
        `Fokusbefunde: ${fall.fokus.ohneSichtbarenFocus.length} | ` +
        `Ports/Kanten <44: ${fall.canvasTrefferzonen.portsUnter44}/${fall.canvasTrefferzonen.kantenUnter44}`
    );

    await context.close();
  }
}

await browser.close();

const zusammenfassung = {
  faelle: faelle.length,
  touchBefunde: faelle.reduce((sum, fall) => sum + fall.touch.unter44.length, 0),
  focusNichtErreichbar: faelle.reduce((sum, fall) => sum + fall.fokus.nichtErreichbar.length, 0),
  focusNichtSichtbar: faelle.reduce((sum, fall) => sum + fall.fokus.ohneSichtbarenFocus.length, 0),
  portsUnter44: faelle.reduce((sum, fall) => sum + fall.canvasTrefferzonen.portsUnter44, 0),
  kantenUnter44: faelle.reduce((sum, fall) => sum + fall.canvasTrefferzonen.kantenUnter44, 0),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(OUT_DIR, `touch-fokus-${name}.json`);
fs.writeFileSync(
  file,
  `${JSON.stringify(
    {
      erfasst: new Date().toISOString(),
      basis: BASE,
      schwellen: { touchPx: MIN_TOUCH, focusKontrast: MIN_FOCUS_CONTRAST },
      viewports,
      zusammenfassung,
      faelle,
    },
    null,
    2
  )}\n`
);
console.log(`\nZusammenfassung: ${JSON.stringify(zusammenfassung)}`);
console.log(`Geschrieben: ${path.relative(process.cwd(), file)}`);
