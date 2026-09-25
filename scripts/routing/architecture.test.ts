import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import {
  findCableClearanceLiterals,
  findFiniteOverlapValues,
  findPersistedGeometryReads,
  findRoutingV2Loaders,
  type SourceFile,
} from '../architecture/rules';

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

/**
 * G1 (AUDIT-Befund): `path.relative()` liefert auf Windows Backslashes, die
 * Erwartungen dieses Gates sind aber Slash-Literale (`lib/routing/tokens.ts`).
 * Auf Windows war `npm run check` damit dauerhaft rot — und weil der
 * Pre-Push-Hook genau dieses Gate ausführt, musste jeder Windows-Beitragende
 * `--no-verify` benutzen und schaltete damit ALLE Gates ab. Ein Gate, das
 * umgangen werden muss, ist kein Gate.
 */
const rel = (file: string): string => relative(ROOT, file).split(sep).join('/');
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

/**
 * Quelltextmenge für die Regelfunktionen (scripts/architecture/rules.ts).
 * Die Regeln selbst sind dort als reine Funktionen hinterlegt und werden in
 * `scripts/architecture/rulesSelfCheck.test.ts` mit erfundenen Verstößen
 * geprüft — inklusive der Formen, die die frühere Inline-Regex übersah
 * (`import … from '../planner/routing-v2'` ohne Slash, `overlap: 100000 }`,
 * `require(…)`, Destrukturierung von `geometry`).
 */
/**
 * Das Messgerät ist kein Messobjekt: `scripts/architecture/rules.ts` enthält
 * die Suchmuster als TEXT (u. a. die Zeichenfolge `data.geometry` in einer
 * Regex). Ohne Ausnahme meldet es sich selbst als Verstoß. Es wird seinerseits
 * von `rulesSelfCheck.test.ts` geprüft — dort mit erfundenen Verstößen.
 */
const SELF_REFERENTIAL = new Set(['scripts/architecture/rules.ts']);

const SOURCE_FILES: SourceFile[] = SOURCES.map((file) => ({
  file: rel(file),
  text: read(file),
  isTest: /\.test\.tsx?$/.test(file),
})).filter((file) => !SELF_REFERENTIAL.has(file.file));

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
    const offenders = findPersistedGeometryReads(SOURCE_FILES);

    expect(
      offenders,
      'Kabelgeometrie kommt ausschließlich aus useCableRoute() / routeAllCables().\n' +
        'Auch die Destrukturierung (`const { geometry } = edge.data`) zählt als Verstoß.\n' +
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

  /** Die abgeschaltete Engine darf nicht zurückkehren (jede Ladeform). */
  it('die zweite Routing-Engine ist entfernt und wird nirgends importiert', () => {
    const importers = findRoutingV2Loaders(SOURCE_FILES);

    expect(
      importers,
      'lib/planner/routing-v2 und lib/planner/routing-core sind bewusst gelöscht (ADR 0014).\n' +
        'Geprüft werden ALLE Ladeformen — auch ohne abschließenden Slash, als Side-Effect-Import, per require() und dynamisch.\n  ' +
        importers.join('\n  ')
    ).toEqual([]);
  });
});

describe('Architektur: eine Quelle für Abstände und Kosten (ADR 0015)', () => {
  /**
   * Geteilte Abstände kommen aus `lib/routing/tokens.ts`. Layout-Tokens
   * dürfen daraus ableiten, aber keine eigenen Zahlen dafür führen.
   */
  it('es gibt genau eine Token-Datei, die Abstände definiert', () => {
    const definingFiles = findCableClearanceLiterals(SOURCE_FILES);

    expect(
      definingFiles,
      'Nur lib/routing/tokens.ts darf Abstandswerte als Zahl festlegen.\n' +
        'Alles andere leitet ab (siehe lib/planner/layout-engine/tokens.ts).\n' +
        'Geprüft werden Eigenschaft (`cableClearance: 42`) UND Zuweisung (`const cableClearance = 42`).\n' +
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
    const offenders = findFiniteOverlapValues(SOURCE_FILES);

    expect(
      offenders,
      'Overlap/Kollision muss Infinity sein (hart), nicht eine große Zahl (weich).\n' +
        'Auch letzte Objekteigenschaften (`overlap: 100000 }`) und Exponentialschreibweise (`1e9`) zählen.\n' +
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
