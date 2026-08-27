/**
 * Mission 7 (M7-1/M7-5): Design-Token-Hygiene des Engineering-Themes.
 *
 * Der Test liest `app/globals.css` als Quelle der Wahrheit und prüft
 * 1. Vollständigkeit: alle Planer-Tokens existieren in `:root` UND `.dark`,
 * 2. Radius-Grenze ≤ 4 px für die Ingenieurs-Oberfläche,
 * 3. WCAG-Kontraste ≥ 4,5:1 für Text und ≥ 3:1 für Leitungen (grafisches
 *    Objekt, WCAG 1.4.11) — in hell wie dunkel.
 * Damit kann niemand das Theme umbiegen, ohne dass die Kontrastgrenzen
 * stillschweigend mitwandern.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

/** Body eines Blocks `anchorName { ... }` mit Verschachtelungs-Zähler. */
function blockBody(openAt: number): string {
  let depth = 0;
  for (let i = openAt; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(openAt + 1, i);
    }
  }
  throw new Error('unbalancierte Klammer in globals.css');
}
function blockBySelector(selector: RegExp): string {
  const m = css.match(selector);
  if (!m || m.index === undefined) throw new Error(`Block nicht gefunden: ${selector}`);
  return blockBody(css.indexOf('{', m.index));
}

const rootBlock = blockBySelector(/:root\s*\{/);
const darkBlock = blockBySelector(/(^|\n)\s*\.dark\s*\{/);

function tokens(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    if (!map.has(m[1])) map.set(m[1], m[2].trim()); // erste Def = letzte Kaskade hier nicht nötig
  }
  return map;
}
const rootTokens = tokens(rootBlock);
const darkTokens = tokens(darkBlock);

/** löst hex-|var()-Ketten innerhalb eines Blocks (Rückfall: `:root`). */
function colorOf(block: Map<string, string>, name: string): string {
  let value = block.get(name) ?? rootTokens.get(name);
  if (!value) throw new Error(`Token --${name} fehlt`);
  for (let i = 0; i < 10; i++) {
    const ref: RegExpMatchArray | null = value.match(/^var\(--([\w-]+)\)$/);
    if (ref) {
      value = block.get(ref[1]) ?? rootTokens.get(ref[1]) ?? '';
      continue;
    }
    break;
  }
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (!hex) throw new Error(`--${name} = "${value}" ist kein 6er-Hex`);
  return hex[1];
}

function channelLuminance(c8: number): number {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function contrastRatio(fg: string, bg: string): number {
  const lum = (hex: string) =>
    0.2126 * channelLuminance(parseInt(hex.slice(0, 2), 16)) +
    0.7152 * channelLuminance(parseInt(hex.slice(2, 4), 16)) +
    0.0722 * channelLuminance(parseInt(hex.slice(4, 6), 16));
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const PLANNER_TOKENS = [
  'surface-0',
  'surface-1',
  'surface-2',
  'border',
  'text-high',
  'text-med',
  'text-low',
  'accent-line',
  'ok',
  'warn',
  'error',
] as const;

describe('M7-1 — Planer-Design-Tokens', () => {
  it.each(PLANNER_TOKENS)('--%s ist in hell und dunkel definiert', (name) => {
    expect(rootTokens.has(name)).toBe(true);
    expect(darkTokens.has(name)).toBe(true);
  });

  it('hält den Radius der Ingenieurs-Oberfläche ≤ 4 px', () => {
    const radius = rootTokens.get('radius') ?? '';
    const rem = radius.match(/^([\d.]+)rem$/);
    const px = rem ? parseFloat(rem[1]) * 16 : parseFloat(radius);
    expect(Number.isFinite(px)).toBe(true);
    expect(px).toBeLessThanOrEqual(4);
  });

  it('definiert die Marken-Fallbacks --danger und --canvas-bg', () => {
    expect(rootTokens.has('danger')).toBe(true);
    expect(rootTokens.has('canvas-bg')).toBe(true);
    expect(darkTokens.has('canvas-bg')).toBe(true);
  });
});

describe('M7-5 — Kontraste WCAG ≥ 4,5:1 (Text) bzw. ≥ 3:1 (Leitungen)', () => {
  const textPairs = [
    ['text-high', 'surface-0'],
    ['text-high', 'surface-1'],
    ['text-med', 'surface-1'],
    ['text-med', 'surface-2'],
    ['text-low', 'surface-0'],
    ['accent-line', 'surface-0'],
    ['ok', 'surface-1'],
    ['warn', 'surface-1'],
    ['error', 'surface-1'],
  ] as const;

  for (const theme of ['hell', 'dunkel'] as const) {
    const block = theme === 'hell' ? rootTokens : darkTokens;
    it.each(textPairs)(`[${theme}] %s auf %s ≥ 4,5:1`, (fg, bg) => {
      const ratio = contrastRatio(colorOf(block, fg), colorOf(block, bg));
      expect(ratio, `--${fg} auf --${bg} (${theme})`).toBeGreaterThanOrEqual(4.5);
    });

    it.each(['wire-dc', 'wire-dc-minus', 'wire-ac', 'wire-solar', 'wire-error'])(
      `[${theme}] Leitung %s auf Canvas ≥ 3:1`,
      (fg) => {
        const ratio = contrastRatio(colorOf(block, fg), colorOf(block, 'surface-0'));
        expect(ratio, `--${fg} auf --surface-0 (${theme})`).toBeGreaterThanOrEqual(3);
      }
    );
  }
});

describe('M7 — Struktur der Planer-Oberfläche', () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

  it('nutzt das Punkt-Raster im Canvas (M7-3)', () => {
    expect(read('components/planner/FlowCanvas.tsx')).toContain('variant={BackgroundVariant.Dots}');
  });

  it('selektiert Bauteile mit 1 px Akzent-Linie (M7-3)', () => {
    expect(read('components/nodes/BaseNode.tsx')).toContain('ring-1 ring-[color:var(--accent-line)]');
  });

  it('bindet Inter als Planer-Schrift ein und begrenzt Fraunces aufs Marketing (M7-2)', () => {
    expect(read('app/layout.tsx')).toContain("@fontsource-variable/inter'");
    expect(css).toMatch(/\.planner-shell\s*\{[^}]*--font-sans:\s*'Inter Variable'/);
    expect(css).toMatch(/\.planner-shell\s*\{[^}]*--font-display:\s*'Inter Variable'/);
  });

  it('setzt tabular-nums für Mono-Werte und rechtsbündige Inspector-Zahlen (M7-2/M7-4)', () => {
    expect(css).toMatch(/\.font-mono\s*\{\s*font-variant-numeric:\s*tabular-nums/);
    expect(css).toMatch(/\.planner-shell input\[type='number'\]\s*\{[^}]*text-align:\s*right/);
  });

  it('hält die React-Flow-Controls im Dichte-Fenster 28–32 px (M7-4)', () => {
    const rule = css.match(/\.planner-shell \.react-flow__controls-button\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    const sizes = [...rule![1].matchAll(/(?:width|height):\s*([\d.]+)rem/g)].map(
      (m) => parseFloat(m[1]) * 16
    );
    expect(sizes).toHaveLength(2);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(28);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(32);
  });
});
