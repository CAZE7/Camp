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
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
// Echte CSS-Grammatik (postcss) statt handgezählter Klammern/Regex: Werte
// dürfen '{'/'}' in Strings, Kommentare und Semikolons in Deklarationen
// enthalten, ohne den Token-Scan durcheinanderzubringen.
const ast = postcss.parse(css, { from: 'app/globals.css' });

/** Custom Properties (--name: wert) des Blocks mit exakt diesem Selector. */
function tokensBySelector(selector: ':root' | '.dark'): Map<string, string> {
  const map = new Map<string, string>();
  ast.walkRules((rule) => {
    if (rule.selector !== selector) return;
    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith('--')) return;
      const name = decl.prop.slice(2);
      // erste Definition gewinnt — innerhalb eines Blocks keine Kaskade nötig
      if (!map.has(name)) map.set(name, decl.value.trim());
    });
  });
  if (map.size === 0) throw new Error(`kein ${selector}-Block in globals.css gefunden`);
  return map;
}

const rootTokens = tokensBySelector(':root');
const darkTokens = tokensBySelector('.dark');

/** löst hex-|var()-Ketten innerhalb eines Blocks (Rückfall: `:root`). */
function colorOf(block: Map<string, string>, name: string): string {
  let value: string | undefined = block.get(name) ?? rootTokens.get(name);
  if (!value) throw new Error(`Token --${name} fehlt`);
  for (let i = 0; i < 10; i++) {
    const refMatch: RegExpMatchArray | null = value.match(/^var\(--([\w-]+)\)$/);
    const refName: string | undefined = refMatch?.[1] ?? undefined;
    if (refName !== undefined) {
      value = block.get(refName) ?? rootTokens.get(refName) ?? '';
      continue;
    }
    break;
  }
  const hexValue = value.match(/^#([0-9a-fA-F]{6})$/)?.[1];
  if (hexValue === undefined) throw new Error(`--${name} = "${value}" ist kein 6er-Hex`);
  return hexValue;
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
  const sorted = [lum(fg), lum(bg)].sort((x, y) => y - x);
  const a = sorted[0] ?? 0;
  const b = sorted[1] ?? 0;
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
    const rem = radius.match(/^([\d.]+)rem$/)?.[1];
    const px = rem !== undefined ? parseFloat(rem) * 16 : parseFloat(radius);
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
    // Seit dem Design-Audit-Fix gilt die Regel auch für die Dach-Tool-Controls
    // (gemeinsame Selektorenliste vor der öffnenden Klammer). Gescannt wird
    // deshalb über alle `.react-flow__controls-button`-Regeln hinweg; die
    // maßgebliche ist die erste mit width+height und muss den Planer-Selektor tragen.
    const sized = [...css.matchAll(/[^{}]*\.react-flow__controls-button[^{]*\{([^}]*)\}/g)].filter(
      (m) => /width\s*:/.test(m[1] ?? '') && /height\s*:/.test(m[1] ?? '')
    );
    expect(sized.length).toBeGreaterThan(0);
    const rule = sized[0]!;
    expect(rule[0]).toContain('.planner-shell');
    const sizes = [...(rule[1] ?? '').matchAll(/(?:width|height):\s*([\d.]+)rem/g)].map(
      (m) => parseFloat(m[1] ?? '0') * 16
    );
    expect(sizes).toHaveLength(2);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(28);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(32);
  });
});
