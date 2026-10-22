/**
 * S-1 (React Flow 12): Anschlusspunkte dürfen keinen Pixel-Offset tragen.
 *
 * Hintergrund — ein Fehler, den nur die Touch-E2E gefunden hat:
 * React Flow 11 positionierte Handles mit einem festen Pixel-Offset
 * (`right: -4px`) und ohne Achsen-Transform. React Flow 12 setzt stattdessen
 * `right: 0` plus `transform: translate(50%, -50%)`. Der Planer hält diese
 * Seiten-Offsets bei null und setzt nur die gemessene 60-plan-px-Portbox nach
 * außen. Eine separate, inverse Zoom-Trefferschicht liefert 44 Bildschirm-px,
 * ohne die Router-Geometrie oder den sichtbaren Polpunkt zu verschieben.
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
import { HANDLE_HIT_TARGET_SCREEN_PX } from '../components/planner/utils/handleHitTargets';

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
  it('lässt Seiten-Offsets bei null — die Trefferfläche wird nur per transform verlegt', () => {
    const offenders: string[] = [];
    for (const side of HANDLE_SIDES) {
      ast.walkRules((rule) => {
        if (rule.selector.trim() !== `.react-flow__handle-${side}`) return;
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
        'React Flow 12 setzt die Seitenkante und zentriert per transform. Der Planer ' +
        'darf den Transform für die außenliegende Trefferfläche überschreiben, aber ' +
        'keinen zusätzlichen left/right/top/bottom-Offset addieren.'
    ).toEqual([]);
  });

  it('hält die 60-plan-px-Portbox und legt eine zoomfeste 44-px-Trefferschicht darüber', () => {
    let width: string | undefined;
    let height: string | undefined;
    let portSize: string | undefined;
    let screenSize: string | undefined;
    let targetWidth: string | undefined;
    let targetHeight: string | undefined;
    let targetPointerEvents: string | undefined;
    let handlePointerEvents: string | undefined;

    ast.walkRules(/^\.react-flow__handle$/, (rule) => {
      rule.walkDecls('width', (decl) => {
        width = decl.value;
      });
      rule.walkDecls('height', (decl) => {
        height = decl.value;
      });
      rule.walkDecls('--planner-handle-hit-size', (decl) => {
        portSize = decl.value;
      });
    });
    ast.walkRules(/^\.planner-shell \.react-flow$/, (rule) => {
      rule.walkDecls('--planner-hit-target-screen-size', (decl) => {
        screenSize = decl.value;
      });
    });
    ast.walkRules(/^\.planner-shell \.react-flow__handle\.connectable::before$/, (rule) => {
      rule.walkDecls('width', (decl) => {
        targetWidth = decl.value;
      });
      rule.walkDecls('height', (decl) => {
        targetHeight = decl.value;
      });
      rule.walkDecls('pointer-events', (decl) => {
        targetPointerEvents = decl.value;
      });
    });
    ast.walkRules(/^\.planner-shell \.react-flow__handle\.connectable$/, (rule) => {
      rule.walkDecls('pointer-events', (decl) => {
        handlePointerEvents = decl.value;
      });
    });

    expect(width).toBe('var(--planner-handle-hit-size)');
    expect(height).toBe('var(--planner-handle-hit-size)');
    expect(portSize).toBe('60px');
    expect(screenSize).toBe(`${HANDLE_HIT_TARGET_SCREEN_PX}px`);
    expect(targetWidth).toBe('calc(var(--planner-hit-target-screen-size) / var(--planner-viewport-zoom, 1))');
    expect(targetHeight).toBe(
      'calc(var(--planner-hit-target-screen-size) / var(--planner-viewport-zoom, 1))'
    );
    expect(targetPointerEvents).toBe('auto');
    expect(handlePointerEvents).toBe('none');
  });

  it('hält auch den transparenten SVG-Kanten-Trefferstrich bei jedem Zoom 44 px breit', () => {
    let targetWidth: string | undefined;
    let targetStroke: string | undefined;
    let pointerEvents: string | undefined;
    ast.walkRules(/^\.planner-shell \.planner-edge-hit-target$/, (rule) => {
      rule.walkDecls('stroke', (decl) => {
        targetStroke = decl.value;
      });
      rule.walkDecls('stroke-width', (decl) => {
        targetWidth = decl.value;
      });
      rule.walkDecls('pointer-events', (decl) => {
        pointerEvents = decl.value;
      });
    });
    expect(targetStroke).toBe('transparent');
    expect(targetWidth).toBe('calc(var(--planner-hit-target-screen-size) / var(--planner-viewport-zoom, 1))');
    expect(pointerEvents).toBe('stroke');
  });

  it('lässt die zoomfeste Trefferschicht an der sichtbaren Portkante um 1 Bildschirm-px überlappen', () => {
    const expectedInsets: Record<(typeof HANDLE_SIDES)[number], string> = {
      left: 'calc(-1px / var(--planner-viewport-zoom, 1))',
      right: 'calc(-1px / var(--planner-viewport-zoom, 1))',
      top: 'calc(-1px / var(--planner-viewport-zoom, 1))',
      bottom: 'calc(-1px / var(--planner-viewport-zoom, 1))',
    };
    const insets: Partial<Record<(typeof HANDLE_SIDES)[number], string>> = {};
    for (const side of HANDLE_SIDES) {
      const property =
        side === 'left' ? 'right' : side === 'right' ? 'left' : side === 'top' ? 'bottom' : 'top';
      ast.walkRules(
        new RegExp(`^\\.planner-shell \\.react-flow__handle-${side}\\.connectable::before$`),
        (rule) => {
          rule.walkDecls(property, (decl) => {
            insets[side] = decl.value;
          });
        }
      );
    }
    expect(insets).toEqual(expectedInsets);
  });

  it('legt den transparenten Trefferbereich außerhalb ab und lässt Plus/Minus getrennt', () => {
    const expectedTransforms: Record<(typeof HANDLE_SIDES)[number], string> = {
      left: 'translate(-100%, -50%)',
      right: 'translate(100%, -50%)',
      top: 'translate(-50%, -100%)',
      bottom: 'translate(-50%, 100%)',
    };
    const transforms: Partial<Record<(typeof HANDLE_SIDES)[number], string>> = {};
    for (const side of HANDLE_SIDES) {
      ast.walkRules(new RegExp(`^\\.react-flow__handle-${side}$`), (rule) => {
        rule.walkDecls('transform', (decl) => {
          transforms[side] = decl.value;
        });
      });
    }
    expect(transforms).toEqual(expectedTransforms);

    const portPositions = new Map<string, string>();
    ast.walkRules((rule) => {
      if (rule.selector === ".react-flow__handle[data-handleid*='plus']") {
        rule.walkDecls('top', (decl) => {
          portPositions.set('plus', decl.value);
        });
      }
      if (rule.selector === ".react-flow__handle[data-handleid*='minus']") {
        rule.walkDecls('top', (decl) => {
          portPositions.set('minus', decl.value);
        });
      }
    });
    expect(portPositions.get('plus')).toBe('20%');
    expect(portPositions.get('minus')).toBe('80%');
  });

  it('gibt dem React-Flow-Attributionslink auf kleinen Displays 44 px Zielhöhe', () => {
    let minHeight: string | undefined;
    ast.walkRules(/^\.react-flow__attribution a$/, (rule) => {
      rule.walkDecls('min-height', (decl) => {
        minHeight = decl.value;
      });
    });
    expect(minHeight).toBe('44px');
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
