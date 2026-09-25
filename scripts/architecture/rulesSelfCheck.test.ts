import { describe, expect, it } from 'vitest';
import {
  findCableClearanceLiterals,
  findFiniteOverlapValues,
  findForbiddenLayerImports,
  findPersistedGeometryReads,
  findRoutingV2Loaders,
  type SourceFile,
} from './rules';

/**
 * scripts/architecture/rulesSelfCheck.test.ts — **Positivkontrollen für die
 * Architektur-Regeln** (AUDIT Hebel 4, Regel-Erfüllung selbst messen).
 *
 * Ein Gate, das nur „0 Verstöße“ meldet, ist wertlos, solange niemand misst,
 * ob es überhaupt anschlagen KANN. Der Audit hat genau das getan und sechs
 * Formen gefunden, in denen die Verstöße in der Gestalt, in der sie real
 * auftreten, unsichtbar blieben:
 *
 *   · `import { z } from '../planner/routing-v2'` (ohne Slash)
 *   · `overlap: 100000 }` (letzte Objekteigenschaft), `overlap: 1e9`
 *   · `require('…')`, Side-Effect-`import '…'`, jede `.tsx`-Datei
 *   · `const { geometry } = edge.data`
 *   · `const cableClearance = 42`
 *
 * Jede Kontrolle hier schreibt genau so einen Verstoß in einen Puffer. Schlägt
 * die zugehörige Funktion nicht an, fällt dieser Test — nicht erst der
 * Produktcode in drei Monaten.
 */

const prod = (file: string, text: string): SourceFile => ({ file, text, isTest: false });
const test = (file: string, text: string): SourceFile => ({ file, text, isTest: true });

describe('Regel G — routing-v2 darf in keiner Ladeform zurückkehren', () => {
  it.each([
    ["import { z } from '../planner/routing-v2';", 'ohne Slash (die reale Form)'],
    ["import { z } from '../planner/routing-v2/index';", 'mit Slash/Pfad'],
    ["import 'lib/planner/routing-core';", 'Side-Effect-Import'],
    ["const m = await import('../planner/routing-core/engine');", 'dynamischer Import'],
    ["const m = require('lib/planner/routing-v2');", 'require'],
    ['import style from "../planner/routing-v2.css";', 'Import mit Suffix'],
  ])('erkennt %s (%s)', (snippet) => {
    expect(findRoutingV2Loaders([prod('lib/x.ts', snippet)])).toHaveLength(1);
  });

  it('ignoriert Prosa und Testdateien', () => {
    expect(
      findRoutingV2Loaders([
        prod('lib/x.ts', '// routing-v2 wurde bewusst gelöscht\nconst text = "routing-v2";'),
        test('lib/x.test.ts', "import '../planner/routing-v2';"),
      ])
    ).toEqual([]);
  });
});

describe('Regel I — Kollision ist Infinity, jede Zahl ist ein Verstoß', () => {
  it.each([
    ['collision: 100_000', 'Unterstrich-Schreibweise (die alte Form)'],
    ['overlap: 100000', 'einfache Zahl'],
    ['overlap: 100000 }', 'letzte Objekteigenschaft (entkam der alten Regex)'],
    ['overlap: 1e9', 'Exponentialschreibweise (entkam der alten Regex)'],
    ['overlap: 100_000,', 'mit Komma'],
    ['collision: 0', 'Null als „frei“'],
  ])('erkennt %s (%s)', (snippet) => {
    const hits = findFiniteOverlapValues([
      prod('lib/routing/rules/costModel.ts', `const c = { ${snippet} };\n`),
    ]);
    expect(hits, `nicht erkannt: ${snippet}`).toHaveLength(1);
  });

  it('akzeptiert die harte Regel und abgeleitete Werte', () => {
    expect(
      findFiniteOverlapValues([
        prod('a.ts', 'const c = { overlap: Infinity, collision: Infinity };'),
        prod('b.ts', 'const c = { overlap: HARD_OVERLAP };'),
      ])
    ).toEqual([]);
  });
});

describe('Regel G/geometry — persistierte Geometrie bleibt verboten', () => {
  it.each([
    ['const g = edge.data.geometry;', 'Direktzugriff'],
    ['const { geometry } = edge.data;', 'Destrukturierung (entkam der alten Regex)'],
    ['const { geometry, other } = edge.data as CableEdgeData;', 'Destrukturierung mit Typ'],
    ['const x = data?.geometry?.points;', 'Optional Chaining'],
  ])('erkennt %s (%s)', (snippet) => {
    expect(findPersistedGeometryReads([prod('components/x.tsx', snippet)])).toHaveLength(1);
  });

  it('erlaubt lokale Geometrie-Berechnung', () => {
    expect(
      findPersistedGeometryReads([
        prod('lib/routing/geometry.ts', 'export const geometry = computeGeometry(points);'),
      ])
    ).toEqual([]);
  });
});

describe('Regel E — genau eine Datei definiert Abstände', () => {
  it('erkennt Literal per Doppelpunkt UND per Zuweisung', () => {
    expect(findCableClearanceLiterals([prod('a.ts', 'const t = { cableClearance: 42 };')])).toEqual(['a.ts']);
    expect(findCableClearanceLiterals([prod('b.ts', 'const cableClearance = 42;')])).toEqual(['b.ts']);
  });

  it('erlaubt Ableitung aus der Token-Quelle', () => {
    expect(
      findCableClearanceLiterals([prod('c.ts', 'const cableClearance = TOKENS.cableClearance * 2;')])
    ).toEqual([]);
  });
});

describe('Regel A — lib importiert keine App-Schichten, in jeder Importform', () => {
  const layers = ['components/', 'store/', 'app/', 'benchmarks/'];

  it.each([
    ["import { x } from '../components/edges/CableEdge';", 'from-Import'],
    ["import '../components/edges/style.css';", 'Side-Effect-Import (war unsichtbar)'],
    ["const x = require('../store/usePlannerStore');", 'require (war unsichtbar)'],
    ["const m = await import('../app/page');", 'dynamischer Import'],
  ])('erkennt %s (%s)', (snippet) => {
    const hits = findForbiddenLayerImports([prod('lib/x.ts', snippet)], layers);
    expect(hits).toHaveLength(1);
  });

  it('erkennt den Verstoß auch in einer .tsx-Datei unter lib (war unsichtbar)', () => {
    const hits = findForbiddenLayerImports(
      [prod('lib/ui/Something.tsx', "import { useStore } from '../store/usePlannerStore';")],
      layers
    );
    expect(hits).toHaveLength(1);
  });

  it('läßt lib-interne Importe und Testdateien in Ruhe', () => {
    expect(
      findForbiddenLayerImports(
        [
          prod('lib/a.ts', "import { volts } from './units';"),
          test('lib/a.test.ts', "import { CableEdge } from '../components/edges/CableEdge';"),
        ],
        layers
      )
    ).toEqual([]);
  });
});
