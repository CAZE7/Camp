import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PIPE_COLORS, WIRE_COLORS } from './edgeColors';

/**
 * WÄCHTER · Statusfarbe nie auf der Zeichenfläche (Spezifikation §3.3).
 *
 * §3.3 trennt die beiden Farbräume: Signalrollen der Oberfläche gehören nicht
 * in eine Zeichnung, Leiterfarben nicht in die Oberfläche. Der Grund ist nicht
 * Geschmacksache — gemessen (AP-3, `scripts/design-audit/vermessung-
 * leiterdomaenen.ts`):
 *
 *   1. Ein ungültiges Routing malt die Leitung in `--error`. Hell ist das
 *      `#b3261e`, und `#b3261e` ist zugleich `--de-pipe-hot`. Eine
 *      Fehler-Halbung und ein Warmwasserrohr wären dieselbe Farbe.
 *   2. Die Engstellen-Halbung malt in `--oxide` `#a34a24` — nach dem eigenen
 *      Kommentar in globals.css:810 liegt dieser Wert zur Plus-Leitung
 *      `#c62f21` bei 1,08:1.
 *
 * Die vier Kollisionen aus der Tabelle der Spezifikation (#a34a24, #1e6b4f,
 * #8a5a0a, #b3261e) treffen dagegen Domänen, die das Produkt nicht erzeugt:
 * `edgeDomain` wird in Quelltext und Vorlagen nur als `DC_12V`, `AC_230V` und
 * `Solar` gesetzt. DC_24V, DC_48V, AC_PE, CAN, SENSOR und die Rohre sind
 * Farb-Vokabular ohne Zeichnung.
 *
 * ALTBESTAND: Die zwei Halos bleiben so lange geduldet, bis die Freigabe zu
 * §3.3 entschieden ist. Alles NEUE fällt durch.
 */

const STATUS_ROLLEN = ['ok', 'warn', 'error', 'oxide', 'destructive', 'success', 'warning'] as const;
const LEITER_TOKEN = [...Object.values(WIRE_COLORS), ...Object.values(PIPE_COLORS)];

/**
 * Altbestand, gebunden an die EXAKTE Zeile — nicht an eine Zeilennummer und
 * nicht an einen Teilstring. Beides hat im Selbsttest durchgelassen: eine
 * Nummer erlaubt beliebiges Nachrüsten in die Zeile, ein Teilstring beliebigen
 * Zusatz daran. Nur die ganze Zeile ist eine Ausnahmegrenze.
 */
const ALTBESTAND: Array<{ datei: string; exakte_zeile: string; grund: string }> = [
  {
    datei: 'components/edges/CableEdge.tsx',
    exakte_zeile: 'const stroke = hasDropError ? WIRE_COLORS.error : getWireColor({ edgeDomain, isPlus });',
    grund: 'Spannungsfall-Verletzung färbt die Leitung — wartet auf Freigabe zu §3.3',
  },
  {
    datei: 'components/edges/CableEdge.tsx',
    exakte_zeile: "stroke={routeInvalid ? 'var(--error)' : 'var(--oxide)'}",
    grund: 'Routing-Halo unter der Leitung — wartet auf Freigabe zu §3.3',
  },
];

const QUELLEN_DER_ZEICHENFLAECHE = [
  'components/edges/CableEdge.tsx',
  'components/edges/WaterPipeEdge.tsx',
  'components/edges/utils/edgeColors.ts',
];

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

describe('Zeichenfläche nutzt keine Statusrollen (§3.3)', () => {
  it('die Leiterpalette zeigt keine Statusrolle', () => {
    const fehler: string[] = [];
    for (const [name, wert] of Object.entries({ ...WIRE_COLORS, ...PIPE_COLORS })) {
      const token = wert.match(/var\(--([\w-]+)\)/)?.[1];
      if (!token) continue;
      if ((STATUS_ROLLEN as readonly string[]).includes(token)) {
        fehler.push(`${name} → --${token} ist eine Statusrolle`);
      }
    }
    expect(fehler, fehler.join('\n')).toEqual([]);
  });

  it('die Oberfläche malt keine Leiterrolle', () => {
    // Leiterfarben leben in edgeColors.ts und in den Canvas-Quellen. Alles,
    // was außerhalb davon `--wire-*` oder `--de-wire-*` als Farbe setzt, hat
    // die Räume vermischt.
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

  it('kein neuer Statusverstoß auf der Zeichenfläche', () => {
    const neu: string[] = [];
    for (const datei of QUELLEN_DER_ZEICHENFLAECHE) {
      lies(datei)
        .split('\n')
        .forEach((zeile, i) => {
          const nutztStatusrolle = new RegExp(`stroke[^;\\n]*var\\(--(${STATUS_ROLLEN.join('|')})\\)`).test(
            zeile
          );
          const nutztFarbeDerRolle = /stroke[^;\n]*WIRE_COLORS\.error/.test(zeile);
          if (!nutztStatusrolle && !nutztFarbeDerRolle) return;
          const gedeckt = ALTBESTAND.some((alt) => alt.datei === datei && alt.exakte_zeile === zeile.trim());
          if (!gedeckt) neu.push(`${datei}:${i + 1}  ${zeile.trim().slice(0, 100)}`);
        });
    }
    expect(neu, `Statusfarbe auf der Zeichenfläche, nicht im Altbestand:\n${neu.join('\n')}`).toEqual([]);
  });

  it('der Altbestand ist vollständig und noch da', () => {
    // Jeder Eintrag muss vorkommen. Ist die Stelle repariert oder umgezogen,
    // fällt der Test — dann darf die Liste kleiner werden, nicht still
    // mitlaufen.
    for (const alt of ALTBESTAND) {
      const text = lies(alt.datei);
      expect(
        text.split('\n').some((zeile) => zeile.trim() === alt.exakte_zeile),
        `${alt.datei}: „${alt.grund}“ ist nicht mehr die markierte Zeile`
      ).toBe(true);
    }
  });

  it('Leiterrollen haben je Thema einen Wert, der nicht mit einer Statusrolle zusammenfällt', () => {
    // Gezeichnete Domänen des Produkts: DC_12V +/−, AC_230V L, Solar. Diese
    // Rechnung prüft genau die, weil nur sie in ausgelieferten Plänen malen.
    const relevant = [
      { name: 'dcPlus', erwartet: { hell: '#c62f21', dunkel: '#ff6b6b' } },
      { name: 'dcMinus', erwartet: { hell: '#3f4750', dunkel: '#8e9aaf' } },
      { name: 'acL', erwartet: { hell: '#2563eb', dunkel: '#6aa6ff' } },
      { name: 'solar', erwartet: { hell: '#b45309', dunkel: '#ffc857' } },
    ];
    for (const { name } of relevant) {
      const token = (WIRE_COLORS as Record<string, string>)[name]?.match(/var\(--([\w-]+)\)/)?.[1];
      expect(token, `${name} hat kein var(--…)`).toBeTruthy();
      expect(LEITER_TOKEN.some((wert) => wert.includes(`--${token}`))).toBe(true);
    }
  });
});
