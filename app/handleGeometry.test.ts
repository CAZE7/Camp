/**
 * S-1 (React Flow 12): Anschlusspunkte dürfen keinen Pixel-Offset tragen.
 *
 * Hintergrund — ein Fehler, den nur die Touch-E2E gefunden hat:
 * React Flow 11 positionierte Handles mit einem festen Pixel-Offset
 * (`right: -4px`) und ohne Achsen-Transform. Weil unsere Trefferfläche
 * 44 px statt 6 px groß ist, korrigierte `app/globals.css` das mit
 * `right: -22px`. React Flow 12 setzt stattdessen `right: 0` PLUS
 * `transform: translate(50%, -50%)` und zentriert den Kasten damit selbst
 * auf der Kante — die alte Korrektur addierte sich und schob Trefferfläche
 * und sichtbaren Punkt 22 px nach außen. Folge: Ein Tap auf den Anschluss
 * landete auf der leeren Fläche daneben (`react-flow__pane intercepts
 * pointer events`), Tap-to-Connect war auf Touch-Geräten unbedienbar.
 *
 * Die Pixel-Baselines haben das nicht gemeldet: die einzige Planer-Route im
 * visuellen Gate startet mit leerem Graph, dort gibt es keine Anschlüsse.
 * Deshalb dieser Test — er prüft die Regel an der Quelle statt am Bild und
 * läuft in Sekunden statt in Minuten.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
const ast = postcss.parse(css, { from: 'app/globals.css' });

/** Die vier Positionsklassen, die React Flow je nach Handle-Seite vergibt. */
const HANDLE_SIDES = ['left', 'right', 'top', 'bottom'] as const;
/** Die Kante, die React Flow für die jeweilige Seite selbst setzt. */
const OFFSET_PROP: Record<(typeof HANDLE_SIDES)[number], string> = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
};

const isZero = (value: string): boolean => /^0(px|%|rem|em)?$/.test(value.trim());

describe('React-Flow-Handles (S-1 / RF 12)', () => {
  it('überschreibt den Seiten-Offset nicht — RF 12 zentriert per transform', () => {
    const offenders: string[] = [];
    for (const side of HANDLE_SIDES) {
      ast.walkRules(new RegExp(`\\.react-flow__handle-${side}\\b`), (rule) => {
        rule.walkDecls(OFFSET_PROP[side], (decl) => {
          if (!isZero(decl.value)) {
            offenders.push(`${rule.selector} { ${decl.prop}: ${decl.value} }`);
          }
        });
      });
    }
    expect(
      offenders,
      `Handle-Offsets gefunden:\n${offenders.join('\n')}\n\n` +
        'React Flow 12 setzt bereits transform: translate(±50%, ±50%) und zentriert ' +
        'den Handle-Kasten unabhängig von seiner Größe auf der Kartenkante. Ein ' +
        'zusätzlicher Offset addiert sich, schiebt die Trefferfläche neben die Karte ' +
        'und macht Tap-to-Connect auf Touch-Geräten unbedienbar.'
    ).toEqual([]);
  });

  it('hält die Trefferfläche bei mindestens 44 px (Touch-Ziel, AGENTS.md)', () => {
    let width: string | undefined;
    let height: string | undefined;
    ast.walkRules(/^\.react-flow__handle$/, (rule) => {
      rule.walkDecls('width', (decl) => {
        width = decl.value;
      });
      rule.walkDecls('height', (decl) => {
        height = decl.value;
      });
    });
    // Der Wert ist der Grund für die frühere Offset-Korrektur — er gehört
    // deshalb in denselben Test wie die Offset-Regel.
    expect(width).toMatch(/^44px/);
    expect(height).toMatch(/^44px/);
  });
});
