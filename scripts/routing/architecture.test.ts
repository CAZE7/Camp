import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Architektur-Gate: EINE Wahrheit je Zuständigkeit (ADR 0014, ADR 0015).
 *
 * ## Warum es diesen Test gibt
 *
 * Nach dem Zusammenführen zweier Entwicklungslinien liefen im Projekt zwei
 * vollständige Routing-Engines gleichzeitig. Beide schrieben in denselben
 * Renderer, und die schwächere gewann: Sie entschied Kreuzungs-Hopping per
 * Edge-ID-Vergleich und behandelte Overlaps als teuer (`collision: 100_000`)
 * statt als verboten. Dieselbe Doppelung gab es bei den Design-Tokens — zwei
 * Dateien, die im Kommentar BEIDE „SINGLE SOURCE OF TRUTH“ beanspruchten.
 *
 * Das Tückische daran war nicht der Fehler selbst, sondern seine
 * Unsichtbarkeit: Die Tests der guten Engine waren durchgehend grün. Sie
 * prüften an dem Renderer vorbei, der ihr Ergebnis verwarf. Ein grünes Gate
 * belegte Verhalten, das beim Nutzer nie ankam.
 *
 * Reviews finden so etwas schlecht — es ist kein falscher Ausdruck in einer
 * Zeile, sondern eine Beziehung zwischen weit entfernten Dateien. Deshalb
 * steht die Regel hier als ausführbarer Test statt als Absatz in einem
 * Dokument, das niemand liest, wenn es darauf ankommt.
 */

const ROOT = resolve(__dirname, '..', '..');
const CODE_DIRS = ['app', 'components', 'lib', 'store', 'scripts'];

function collectSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
  };
  for (const dir of CODE_DIRS) walk(join(ROOT, dir));
  return out;
}

const SOURCES = collectSourceFiles();
const read = (file: string): string => readFileSync(file, 'utf8');
const rel = (file: string): string => relative(ROOT, file);

/** Kommentarzeilen ausblenden — Prosa über die Historie ist erlaubt. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Architektur: eine Quelle für Kabelgeometrie (ADR 0014)', () => {
  /**
   * Der Renderer darf seine Polyline nur aus dem globalen Routing-Pass
   * beziehen. `data.geometry` war das Einfallstor der zweiten Engine.
   */
  it('kein Produktionscode liest edge.data.geometry', () => {
    const offenders = SOURCES.filter((file) => {
      if (/\.test\.tsx?$/.test(file)) return false;
      return /\bdata\??\.\s*geometry\b/.test(stripComments(read(file)));
    }).map(rel);

    expect(
      offenders,
      'Kabelgeometrie kommt ausschließlich aus useCableRoute() / routeAllCables().\n' +
        'Gefunden in:\n  ' +
        offenders.join('\n  ')
    ).toEqual([]);
  });

  /**
   * Der Layout-Adapter darf Knoten platzieren, aber keine Kabel routen.
   * Genau diese Vermischung war der ursprüngliche Fehler.
   */
  it('der Layout-Adapter erzeugt keine Kabelgeometrie', () => {
    const adapter = stripComments(read(join(ROOT, 'lib/planner/routingV2Adapter.ts')));
    expect(adapter).not.toMatch(/\brouteEdgesV2\b/);
    expect(adapter).not.toMatch(/\bgeometry\s*:/);
  });

  /** Die abgeschaltete Engine darf nicht zurückkehren. */
  it('die zweite Routing-Engine ist entfernt und wird nirgends importiert', () => {
    const importers = SOURCES.filter((file) =>
      /(routing-v2|routing-core)\//.test(stripComments(read(file)))
    ).map(rel);

    expect(
      importers,
      'lib/planner/routing-v2 und lib/planner/routing-core sind bewusst gelöscht (ADR 0014).'
    ).toEqual([]);
  });

  it('der Legacy-Orthogonalrouter und sein Cache bleiben außerhalb des Produktionspfads', () => {
    const productionDirs = ['app', 'components', 'lib', 'store'];
    const legacySupportFiles = new Set([
      'components/edges/utils/orthogonalRouting.ts',
      'components/edges/utils/routingCache.ts',
      'components/edges/utils/routingQuality.ts',
      'components/edges/utils/routingScenarios.ts',
    ]);
    const importers = SOURCES.filter((file) => {
      const path = rel(file);
      if (!productionDirs.some((dir) => path.startsWith(`${dir}/`))) return false;
      if (/\.test\.tsx?$/.test(path) || legacySupportFiles.has(path)) return false;
      return /(?:from|import\s*\()\s*['\"][^'\"]*(?:orthogonalRouting|routingCache)(?:\.ts)?['\"]/.test(
        stripComments(read(file))
      );
    }).map(rel);

    expect(
      importers,
      'orthogonalRouting.ts/routingCache.ts sind nur Galerie-/Benchmark-Material; routePlan muss ausschließlich pathfinding.ts verwenden.'
    ).toEqual([]);
  });
});

describe('Architektur: eine Quelle für Abstände und Kosten (ADR 0015)', () => {
  /**
   * Geteilte Abstände kommen aus `lib/routing/tokens.ts`. Layout-Tokens
   * dürfen daraus ableiten, aber keine eigenen Zahlen dafür führen.
   */
  it('es gibt genau eine Token-Datei, die Abstände definiert', () => {
    const definingFiles = SOURCES.filter((file) => {
      if (/\.test\.tsx?$/.test(file)) return false;
      const source = stripComments(read(file));
      // Eine Datei "definiert" Abstände, wenn sie cableClearance mit einer
      // Literalzahl belegt (nicht aus einer anderen Quelle ableitet).
      return /cableClearance\s*:\s*\d/.test(source);
    }).map(rel);

    expect(
      definingFiles,
      'Nur lib/routing/tokens.ts darf Abstandswerte als Zahl festlegen.\n' +
        'Alles andere leitet ab (siehe lib/planner/layout-engine/tokens.ts).\n' +
        'Gefunden in:\n  ' +
        definingFiles.join('\n  ')
    ).toEqual(['lib/routing/tokens.ts']);
  });

  /**
   * Kollision ist verboten, nicht teuer. Eine endliche Zahl als
   * Kollisionsgewicht ist genau der Denkfehler, den ADR 0015 ausschließt:
   * „sehr teuer“ lässt sich überstimmen, `Infinity` nicht.
   */
  it('Kollision wird nirgends als endliche Kostenzahl geführt', () => {
    const offenders = SOURCES.filter((file) => {
      if (/\.test\.tsx?$/.test(file)) return false;
      const source = stripComments(read(file));
      // Beide Schreibweisen der Regel: `collision:` (altes Modell) und
      // `overlap:` (aktives Modell) müssen hart sein.
      for (const match of source.matchAll(/\b(?:collision|overlap)\s*:\s*([^,\n]+)/g)) {
        const value = match[1]!.trim();
        if (value !== 'Infinity' && /^[\d_.]+$/.test(value)) return true;
      }
      return false;
    }).map(rel);

    expect(
      offenders,
      'Overlap/Kollision muss Infinity sein (hart), nicht eine große Zahl (weich).\n' +
        'Gefunden in:\n  ' +
        offenders.join('\n  ')
    ).toEqual([]);
  });

  /** Das aktive Kostenmodell muss die harte Regel tatsächlich führen. */
  it('das aktive Kostenmodell führt overlap als Infinity', () => {
    const costModel = read(join(ROOT, 'lib/routing/rules/costModel.ts'));
    expect(costModel).toMatch(/overlap:\s*Infinity/);
  });

  /**
   * Genau EINE Datei bindet elkjs an (ADR 0016).
   *
   * Dieselbe Geschichte wie beim Routing, nur eine Ebene höher: Es gab zwei
   * elkjs-Anbindungen, und die produktiv verwendete war die schwächere — ohne
   * Timeout, ohne Schutz gegen überholende Antworten, mit einer neuen
   * ELK-Instanz bei jedem einzelnen Layout. Sie importierte zudem `elkjs`
   * statt `elkjs/lib/elk.bundled.js`; die ungebündelte Variante verlangt zur
   * Laufzeit `web-worker` und ließ die Planer-Seite im Dev-Server mit
   * „Module not found“ scheitern.
   *
   * Der Import-Pfad wird deshalb mitgeprüft: Eine einzelne Anbindung ist
   * wertlos, wenn sie das Modul erwischt, das im Browser nicht lädt.
   */
  it('elkjs wird an genau einer Stelle und nur gebündelt eingebunden', () => {
    // Nur echte Ladeanweisungen zaehlen, und nur ausserhalb von Tests: Dieser
    // Test nennt elkjs selbst mehrfach im Prosatext und wuerde sich sonst
    // selbst als Verstoss melden.
    const LOADS_ELKJS = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]elkjs(\/[^'"]*)?['"]/;
    const importers = SOURCES.filter(
      (file) => !/\.test\.tsx?$/.test(file) && LOADS_ELKJS.test(read(file))
    ).map(rel);

    expect(
      importers,
      'elkjs darf nur von lib/routing/elk/runner.ts geladen werden.\n' +
        'Alle anderen Layout-Pfade gehen über layoutWithElk(). Gefunden in:\n  ' +
        importers.join('\n  ')
    ).toEqual(['lib/routing/elk/runner.ts']);

    const runner = read(join(ROOT, 'lib/routing/elk/runner.ts'));
    expect(runner, "Nur 'elkjs/lib/elk.bundled.js' laedt ohne die Abhaengigkeit 'web-worker'.").toMatch(
      /['"]elkjs\/lib\/elk\.bundled\.js['"]/
    );
    expect(runner).not.toMatch(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]elkjs['"]/);
  });
});
