import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { PIPE_COLORS, WIRE_COLORS } from './edgeColors';

/**
 * WÄCHTER · §3.4 in der präzisierten Fassung (Freigabe 2026-11-04).
 *
 * Die Regel lautet nicht mehr „keine Statusfarbe im Canvas" (das war §3.3),
 * sondern:
 *
 *   Statusfarben dürfen als eindeutige lokale Statusmarker oder Overlays
 *   erscheinen, aber niemals die funktionale Domänenfarbe einer Leitung
 *   ersetzen.
 *
 * Warum die Verschärfung nötig war, ist gemessen (AP-3, `scripts/design-audit/
 * vermessung-leiterdomaenen.ts`, Ausgabe `ergebnis/leiterdomaenen.json`): Das
 * absolute Verbot hätte Fehler- und Engstellen-Markierung von der Zeichenfläche
 * entfernt, während die eigentliche Verwechslung an der Leitungsfarbe selbst
 * saß. `--error` ist hell `#b3261e` und damit farbgleich mit `--de-pipe-hot`;
 * der Engstellen-Halo in `--oxide` `#a34a24` liegt zur Plus-Leitung `#c62f21`
 * bei 1,08:1 (globals.css:810).
 *
 * Daraus folgt für den Code:
 *
 *   · Die Leitung bekommt immer `getWireColor(...)`; `WIRE_COLORS.error` ist
 *     aus der Palette geflogen. Der Spannungsfall bleibt als Strichmuster
 *     `8 6`, Laufanimation und Label-Chip sichtbar.
 *   · Overlays unter der Leitung dürfen weiter in einer Statusrolle malen. Sie
 *     sind namentlich registriert (OVERLAY_MARKIERUNGEN), damit jeder neue Halo
 *     eine Entscheidung ist — gebunden an die EXAKTE Zeile. Eine Zeilennummer
 *     ließ beliebiges Nachrüsten in dieselbe Zeile zu, ein Teilstring beliebigen
 *     Zusatz daran (im Selbsttest geprüft).
 *   · Der Engstellen-Halo ist neutral (`--text-high`). `--wire-selected` ist
 *     verboten: der Token zeigt im Hellmodus auf `--oxide` (globals.css:161),
 *     also auf dieselbe Farbe, die §3.4 von der Leitung nimmt.
 *
 * Die vier Kollisionswerte aus §3.3 (#a34a24, #1e6b4f, #8a5a0a, #b3261e)
 * treffen Domänen, die das Produkt nicht zeichnet (DC_24V, DC_48V, AC_PE,
 * PIPE_HOT). Gezeichnet werden genau vier — die prüft der Kollisionstest, in
 * beiden Themen.
 */

const STATUS_ROLLEN = ['ok', 'warn', 'error', 'oxide', 'destructive', 'success', 'warning'] as const;

/** Die vier Domänen, die in ausgelieferten Plänen tatsächlich malen (AP-3, §1). */
const GEZEICHNETE_DOMAENEN = ['de-wire-dc-12v-plus', 'de-wire-dc-12v-minus', 'de-wire-ac-l', 'de-wire-solar'];

/** Farben, mit denen die Halos unter den Leitungen malen. */
const HALO_FARBEN = ['text-high', 'error'];

const OVERLAY_MARKIERUNGEN: Array<{ datei: string; exakte_zeile: string; grund: string }> = [
  {
    datei: 'components/edges/CableEdge.tsx',
    exakte_zeile: "stroke={routeInvalid ? 'var(--error)' : 'var(--text-high)'}",
    grund: 'Halo unter der Leitung (§3.4): Engstelle neutral, Routing-Verletzung in der Fehlerrolle',
  },
];

const QUELLEN_DER_ZEICHENFLAECHE = [
  'components/edges/CableEdge.tsx',
  'components/edges/WaterPipeEdge.tsx',
  'components/edges/utils/edgeColors.ts',
];

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/**
 * Token-Werte je Thema, aus beiden CSS-Quellen. postcss, nicht Regex: der
 * `.dark`-Block enthält verschachtelte Regeln, `[^}]*` bricht am ersten
 * `::selection`. Altketten (`--destructive: var(--error)`) werden aufgelöst,
 * sonst bleibt die Kollision unsichtbar.
 */
function werteJeThema(): Record<'hell' | 'dunkel', Map<string, string>> {
  const deklariert: Record<'hell' | 'dunkel', Map<string, string>> = {
    hell: new Map(),
    dunkel: new Map(),
  };
  for (const datei of ['app/globals.css', 'app/dark-engineering.css']) {
    const ast = postcss.parse(lies(datei), { from: datei });
    ast.walkRules((regel) => {
      const selektoren = regel.selector.split(',').map((s) => s.trim());
      const istHell = selektoren.some((s) => s === ':root' || s.endsWith(':root'));
      const istDunkel = selektoren.some(
        (s) => s === '.dark' || s.endsWith('.dark') || s.includes("data-theme='dark")
      );
      if (!istHell && !istDunkel) return;
      regel.walkDecls((decl) => {
        if (!decl.prop.startsWith('--')) return;
        const name = decl.prop.slice(2);
        if (istHell && !deklariert.hell.has(name)) deklariert.hell.set(name, decl.value.trim());
        if (istDunkel && !deklariert.dunkel.has(name)) deklariert.dunkel.set(name, decl.value.trim());
      });
    });
  }
  const aufloesen = (block: Map<string, string>, name: string, tiefe = 0): string => {
    const wert = block.get(name);
    if (!wert) return '';
    const ziel = wert.match(/^var\(--([\w-]+)\)$/)?.[1];
    if (!ziel) return wert;
    return tiefe > 8 ? wert : aufloesen(block, ziel, tiefe + 1);
  };
  return {
    hell: new Map([...deklariert.hell.keys()].map((n) => [n, aufloesen(deklariert.hell, n)])),
    dunkel: new Map([...deklariert.dunkel.keys()].map((n) => [n, aufloesen(deklariert.dunkel, n)])),
  };
}

const THEMEN = werteJeThema();

describe('Zeichenfläche nach §3.4 — Domänenfarbe bleibt, Status nur als Overlay', () => {
  it('die Leiterpalette enthält keine Statusrolle', () => {
    const fehler: string[] = [];
    for (const [name, wert] of Object.entries({ ...WIRE_COLORS, ...PIPE_COLORS })) {
      const token = wert.match(/var\(--([\w-]+)\)/)?.[1];
      if (token && (STATUS_ROLLEN as readonly string[]).includes(token)) {
        fehler.push(`${name} → --${token} ist eine Statusrolle`);
      }
    }
    expect(fehler, fehler.join('\n')).toEqual([]);
  });

  it('die Palette hat keine Fehler-Farbe — sie kann nichts mehr ersetzen', () => {
    // Solange `error` in der Palette liegt, ist `stroke = WIRE_COLORS.error`
    // eine Zeile weit entfernt. §3.4 entscheidet die Leitung, nicht das Overlay.
    expect(Object.keys(WIRE_COLORS)).not.toContain('error');
    for (const datei of QUELLEN_DER_ZEICHENFLAECHE) {
      expect(lies(datei), `${datei} nutzt WIRE_COLORS.error`).not.toMatch(/WIRE_COLORS\.error/);
    }
  });

  it('die Leitungsfarbe kommt immer aus der Domäne', () => {
    expect(lies('components/edges/CableEdge.tsx')).toContain(
      'const stroke = getWireColor({ edgeDomain, isPlus });'
    );
  });

  it('kein Status-Gemälde außerhalb der registrierten Overlays', () => {
    const neu: string[] = [];
    for (const datei of QUELLEN_DER_ZEICHENFLAECHE) {
      lies(datei)
        .split('\n')
        .forEach((zeile, i) => {
          const maltStatusrolle = new RegExp(
            `stroke[^;\\n]*var\\(--(${[...STATUS_ROLLEN, 'wire-error'].join('|')})\\)`
          ).test(zeile);
          if (!maltStatusrolle) return;
          const gedeckt = OVERLAY_MARKIERUNGEN.some(
            (alt) => alt.datei === datei && alt.exakte_zeile === zeile.trim()
          );
          if (!gedeckt) neu.push(`${datei}:${i + 1}  ${zeile.trim().slice(0, 100)}`);
        });
    }
    expect(neu, `Statusfarbe ohne registriertes Overlay:\n${neu.join('\n')}`).toEqual([]);
  });

  it('der Engstellen-Halo ist neutral und meidet --wire-selected', () => {
    const quelle = lies('components/edges/CableEdge.tsx');
    expect(quelle).not.toMatch(/stroke[^;\n]*var\(--wire-selected\)/);
    expect(quelle).toContain("stroke={routeInvalid ? 'var(--error)' : 'var(--text-high)'}");
  });

  it('die registrierten Overlays sind noch da', () => {
    // Ist eine Stelle repariert oder umgezogen, fällt der Test — die Liste darf
    // kleiner werden, nicht still mitlaufen.
    for (const alt of OVERLAY_MARKIERUNGEN) {
      expect(
        lies(alt.datei)
          .split('\n')
          .some((zeile) => zeile.trim() === alt.exakte_zeile),
        `${alt.datei}: „${alt.grund}“ ist nicht mehr die markierte Zeile`
      ).toBe(true);
    }
  });

  it('gezeichnete Domänen haben in beiden Themen einen Wert ohne Kollision', () => {
    const fehler: string[] = [];
    for (const thema of ['hell', 'dunkel'] as const) {
      const block = THEMEN[thema];
      for (const domaene of GEZEICHNETE_DOMAENEN) {
        const hex = block.get(domaene);
        if (!hex) {
          fehler.push(`${thema}: --${domaene} ist nicht definiert`);
          continue;
        }
        for (const rolle of [...STATUS_ROLLEN, ...HALO_FARBEN]) {
          const rollenHex = block.get(rolle);
          // Leere Werte ignorieren: manche Rollen existieren nur in einem Thema.
          if (rollenHex && rollenHex === hex) {
            fehler.push(`${thema}: --${domaene} ${hex} == --${rolle}`);
          }
        }
      }
    }
    expect(fehler, fehler.join('\n')).toEqual([]);
  });

  it('die Oberfläche malt keine Leiterrolle', () => {
    // Leiterfarben leben in edgeColors.ts und in den Canvas-Quellen. Alles, was
    // außerhalb davon `--wire-*` oder `--de-wire-*` als Farbe setzt, hat die
    // Räume vermischt.
    const dateien = ['app/page.tsx', 'components/brand/PlanPreview.tsx', 'components/Inspector.tsx'];
    const fehler: string[] = [];
    for (const datei of dateien) {
      lies(datei)
        .split('\n')
        .forEach((zeile, i) => {
          if (/var\(--(de-)?wire-/.test(zeile) && !/aria|title|comment/.test(zeile)) {
            fehler.push(`${datei}:${i + 1} ${zeile.trim().slice(0, 80)}`);
          }
        });
    }
    expect(fehler, `Leiterfarben in der Oberfläche:\n${fehler.join('\n')}`).toEqual([]);
  });
});
