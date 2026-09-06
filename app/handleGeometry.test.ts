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

/**
 * Zweiter Teil derselben Lehre: die Messgrenze muss die EINZIGE Stelle
 * bleiben, die gemessene Geometrie liest.
 *
 * React Flow 12 hat die Messwerte verschoben (`measured.width`,
 * `internals.positionAbsolute`, `internals.handleBounds`); die flachen
 * v11-Felder existieren weiter, bedeuten aber die vom Nutzer GESETZTEN
 * Maße — meist leer. Ein direkter Zugriff kompiliert deshalb anstandslos,
 * fällt still auf Ersatzwerte zurück und verschiebt Layout, Kollisions-
 * prüfung oder Viewport. In S-1 ist genau das an vier Stellen passiert
 * (Auto-Layout, Fokus-Zentrierung, Pan-Grenze, Drag-Kollision) und erst in
 * der Touch-E2E aufgefallen, weil ein Knoten dadurch unter der Controls-
 * Leiste landete.
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SEAM = join('components', 'edges', 'utils', 'nodeGeometry.ts');
const SCAN_ROOTS = ['app', 'components', 'store'];
/**
 * Direktzugriffe auf verschobene Messwerte — außerhalb der Messgrenze
 * verboten. Bewusst nur auf Variablen, die einen React-Flow-Knoten meinen:
 * eine allgemeine `.width`-Regel träfe jedes Rechteck und jede DOM-Box im
 * Projekt und wäre binnen einer Woche mit Ausnahmen durchlöchert.
 */
const RAW_ACCESS = /\b(node|internalNode|rfNode)\.(width|height|positionAbsolute|handleBounds)\b/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

describe('Messgrenze (nodeGeometry) ist die einzige Leseseite', () => {
  it('kein Direktzugriff auf verschobene React-Flow-Messwerte', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of sourceFiles(root)) {
        if (file.endsWith(SEAM)) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
          // Zeilen- und Blockkommentare zählen nicht: sie ERKLÄREN den
          // Unterschied oft, statt ihn zu begehen.
          const code = (line.split('//')[0] ?? '').trim();
          if (code.startsWith('*') || code.startsWith('/*')) return;
          // Nur Variablen, die einen React-Flow-Knoten meinen. `current` &
          // Co. sind Store-Knoten: die tragen die flache Form legitim, weil
          // gespeicherte Pläne und Fixtures so aussehen.
          if (!RAW_ACCESS.test(code)) return;
          offenders.push(`${file}:${index + 1}  ${line.trim()}`);
        });
      }
    }
    expect(
      offenders,
      `Direktzugriff auf React-Flow-Messwerte:\n${offenders.join('\n')}\n\n` +
        'Bitte über components/edges/utils/nodeGeometry.ts lesen ' +
        '(nodeWidth/nodeHeight/measuredWidth/measuredHeight/nodeOrigin/nodeHandleBounds). ' +
        'In RF 12 sind die flachen Felder die GESETZTEN Maße, nicht die gemessenen.'
    ).toEqual([]);
  });
});
