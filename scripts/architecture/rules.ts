/**
 * scripts/architecture/rules.ts — die Architektur-Regeln als **prüfbare
 * Funktionen** (AUDIT Hebel 4).
 *
 * Warum eigene Datei? Die Gates in `scripts/routing/architecture.test.ts` und
 * `scripts/architecture/libBoundary.test.ts` waren als Inline-Regexe
 * formuliert — und genau dieselben Regexe waren die Lücke:
 *
 *   · Regel G verlangte `(routing-v2|routing-core)/` **mit** Slash —
 *     `import { z } from '../planner/routing-v2'` (die natürliche Form einer
 *     wiedererweckten Engine) blieb grün.
 *   · Regel I las `[^,\n]+` als Zahlwert — `overlap: 100000 }` als letzte
 *     Objekteigenschaft, `overlap: 1e9` und `overlap: <konstante>` bestanden.
 *   · Regel A sah nur `from '…'` — `require(…)` und Side-Effect-`import '…'`
 *     waren unsichtbar, ebenso jede `.tsx`-Datei (der Walk filterte auf `.ts`).
 *   · Regel G/geometry fand nur das Literal `data.geometry` — die Destruktur-
 *     `const { geometry } = edge.data` kam durch.
 *   · Regel E verlangte `cableClearance:` mit Doppelpunkt — `const
 *     cableClearance = 42` entkam.
 *
 * Indem die Regeln hier als **reine Funktionen über Quelltext** stehen, können
 * sie selbst getestet werden: `rulesSelfCheck.test.ts` schreibt zu jeder Regel
 * einen erfundenen Verstoß in einen Puffer und verlangt, dass die Funktion
 * anschlägt. Eine Regel, die nicht fallen kann, ist keine Regel.
 */

import { ROUTING_TOKENS } from '../../lib/routing/tokens';

export type SourceFile = { file: string; text: string; isTest?: boolean };

/** Kommentare ausblenden — Prosa über die Historie ist erlaubt. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Nur Produktivdateien (Tests dürfen alles zitieren). */
export const productionOnly = (files: SourceFile[]): SourceFile[] =>
  files.filter((f) => f.isTest !== true && !/\.test\.tsx?$/.test(f.file));

// ── Regel G: die abgeschaltete Routing-Engine darf nicht zurückkehren ────────

/**
 * Verzeichnisse, in denen Quelltext beim Nutzer landet oder ihn speist.
 * `scripts/**` ist **nicht** dabei: Werkzeug darf Forschungscode laden,
 * Produktion nicht.
 */
export const PRODUCTION_SOURCE_PREFIXES = ['app/', 'components/', 'lib/', 'store/', 'hooks/', 'types/'];

export const isProductionSource = (file: string): boolean =>
  PRODUCTION_SOURCE_PREFIXES.some((prefix) => file.startsWith(prefix));

/**
 * Findet JEDE Ladeanweisung auf routing-v2/routing-core: `from '…'`,
 * Side-Effect-`import '…'`, `import('…')`, `require('…')` — mit oder ohne
 * abschließenden Slash. Der Slash war die Lücke (AUDIT G2).
 *
 * Regel G hat zwei Adressaten, und sie werden getrennt geprüft:
 *
 *   · **routing-v2** ist gelöscht (ADR 0014) und darf **nirgends** wieder
 *     auftauchen — auch nicht in Werkzeug. Wer die alte Engine zurückholt,
 *     holt den Zustand zurück, in dem zwei Engines um denselben Renderer
 *     konkurrierten.
 *   · **routing-core** ist der Forschungs-Kern (Phase 2). Er liegt deshalb
 *     unter `docs/research/routing-core/kernel/` und darf ausschließlich von
 *     Werkzeugen geladen werden. In Produktionspfaden ist er verboten
 *     (Regel G2: `findResearchKernelImports`).
 */
export function findRoutingV2Loaders(files: SourceFile[]): string[] {
  const RE =
    /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]*)\b(routing-v2|routing-core)\b(?![-\w])/g;
  const hits: string[] = [];
  for (const file of productionOnly(files)) {
    const text = stripComments(file.text);
    for (const match of text.matchAll(RE)) {
      const path = `${match[1] ?? ''}${match[2] ?? ''}`;
      // `docs/research/routing-core/…` ist der Forschungs-Kern, nicht die
      // gelöschte Engine. Für ihn gilt G2 (nur Produktionscode ist verboten).
      // Die Ausnahme steht hier als Bedingung und ist in
      // `rulesSelfCheck.test.ts` in beide Richtungen geprüft.
      if (path.includes('docs/research/')) continue;
      hits.push(`${file.file} → ${path}`);
    }
  }
  return hits;
}

/**
 * Regel G2: kein Produktionspfad lädt den Forschungs-Kern. Der Aufrufer
 * übergibt die Produktionsmenge; die Funktion schlägt aber auch auf jeden
 * anderen Pfad an, damit ein späterer Umzug den Schutz nicht stillschweigend
 * aufhebt.
 */
export function findResearchKernelImports(files: SourceFile[]): string[] {
  const RE =
    /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]*routing-core[^'"]*)['"]/g;
  const hits: string[] = [];
  for (const file of files) {
    const text = stripComments(file.text);
    for (const match of text.matchAll(RE)) {
      hits.push(`${file.file} → ${match[1]}`);
    }
  }
  return hits;
}

// ── Regel I: Kollision ist verboten, nicht teuer ────────────────────────────

/**
 * Endliche Zahlen als Kollisions-/Overlap-Gewicht. Erkennt auch die
 * Schreibweisen, die die alte Regex durchgelassen hat:
 * `overlap: 100000 }` (letzte Objekteigenschaft), `overlap: 1e9`,
 * `overlap: 100_000`, `overlap: 100000;`.
 */
export function findFiniteOverlapValues(files: SourceFile[]): string[] {
  // Der Wert wird als TOKEN gelesen (nicht als „Rest der Zeile“): Nur so sind
  // `overlap: 100000 }` (letzte Objekteigenschaft), `overlap: 1e9` und
  // `overlap: 100_000,` gleich behandelt. Die alte Fassung fraß das `};` in
  // den Wert und scheiterte dann an der Zahlprüfung.
  const RE = /\b(?:collision|overlap)\s*:\s*([^\s,;}\])]+)/g;
  const hits: string[] = [];
  for (const file of productionOnly(files)) {
    const text = stripComments(file.text);
    for (const match of text.matchAll(RE)) {
      const value = match[1]!.trim();
      if (value === 'Infinity') continue;
      // 100000, 100_000, 1e9, 100000.0 — alles endliche Zahlen.
      if (/^[\d_]+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) {
        hits.push(`${file.file}: ${match[0].trim()}`);
      }
    }
  }
  return hits;
}

// ── Regel G/geometry: Kabelgeometrie nur aus dem globalen Routing-Pass ──────

/**
 * Findet Lesezugriffe auf ein persistiertes Geometrie-Feld — auch die
 * Destrukturierung (`const { geometry } = edge.data`), die die alte
 * Regex (Literalsuche `data.geometry`) nicht sah.
 */
export function findPersistedGeometryReads(files: SourceFile[]): string[] {
  const READS = [
    /\bdata\??\.\s*geometry\b/, // data.geometry / data?.geometry
    /\{[^}\n]*\bgeometry\b[^}\n]*\}\s*=\s*[^;\n]*\bdata\b/, // const { geometry } = edge.data
    /\bgeometry\b\s*:\s*[^=,\n]*\bdata\??\.\s*geometry\b/, // alias: geometry: data.geometry
  ];
  const hits: string[] = [];
  for (const file of productionOnly(files)) {
    const text = stripComments(file.text);
    if (READS.some((re) => re.test(text))) hits.push(file.file);
  }
  return hits;
}

// ── Regel E: genau eine Datei definiert Abstände ────────────────────────────

/**
 * Abstands-Werte der Routing-Tokens — die Wert-Klasse, gegen die eine
 * zweitdefinierte Strecken-Konstante auffällt.
 */
const DISTANCE_TOKEN_VALUES: ReadonlySet<number> = new Set(
  Object.values(ROUTING_TOKENS).filter((value): value is number => typeof value === 'number')
);

/**
 * Namen, die semantisch einen Routing-Abstand meinen. Ein GLEICHNAMIGES
 * Literal war schon verboten; ein anders benanntes mit demselben WERT
 * (`MIN_ROUTE_CLEARANCE = 12`) blieb für die namensbasierte Suche unsichtbar
 * und wäre bei einer Token-Änderung still zurückgeblieben (Befund 2026-09-28).
 */
const DISTANCE_NAME_RE = /(?:CLEARANCE|GAP)/;

/** `const NAME = <Zahl>;` — bewusst punktfrei, damit keine Fremdmodule nötig sind. */
const CONST_NUMBER_RE = /\b(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)\s*;/g;

/**
 * Trägt der Quelltext eine Strecken-Konstante, deren Wert exakt einer
 * Token-Größe entspricht? Ableitungen (`= ROUTING_TOKENS.cableClearance`)
 * sind ausdrücklich erlaubt und schlagen hier nicht an.
 */
export function hasTokenValuedDistanceConstant(source: string): boolean {
  CONST_NUMBER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CONST_NUMBER_RE.exec(source)) !== null) {
    const name = match[1];
    const value = match[2];
    if (!name || value === undefined) continue;
    if (!DISTANCE_NAME_RE.test(name)) continue;
    if (DISTANCE_TOKEN_VALUES.has(Number(value))) return true;
  }
  return false;
}

/**
 * Dateien, die einen Abstandswert **zweitdefinieren** — Eigenschaft
 * (`cableClearance: 42`), Zuweisung (`const cableClearance = 42`) ODER eine
 * anders benannte Strecken-Konstante mit dem Wert einer Token-Größe
 * (`const MIN_ROUTE_CLEARANCE = 12`).
 * Die alte Regex verlangte den Doppelpunkt und ließ so die Zuweisung durch;
 * die zweite Erweiterung schließt die Umbenennung.
 */
export function findCableClearanceLiterals(files: SourceFile[]): string[] {
  const RE = /\bcableClearance\b\s*[:=]\s*\d/;
  return productionOnly(files)
    .filter((file) => {
      const text = stripComments(file.text);
      return RE.test(text) || hasTokenValuedDistanceConstant(text);
    })
    .map((file) => file.file);
}

// ── Regel A: lib importiert keine App-Schichten ─────────────────────────────

/** Alle Import-Zielpfade einer Datei — `from`, Side-Effect, dynamisch, `require`. */
export function importTargetsOf(source: string): string[] {
  const targets: string[] = [];
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g, // Side-Effect-Import
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) targets.push(match[1]!);
  }
  return targets;
}

/** Verstöße: lib-Produktivdatei zieht eine App-Schicht (inkl. `.tsx`-Dateien). */
export function findForbiddenLayerImports(
  files: SourceFile[],
  forbiddenLayers: readonly string[]
): { file: string; target: string }[] {
  const hits: { file: string; target: string }[] = [];
  // `lib` enthält (Stand heute) keine .tsx-Dateien; würde eine entstehen, wäre
  // sie in der alten Fassung unsichtbar gewesen (Filter auf `.ts`).
  for (const file of files.filter((f) => f.isTest !== true && !/\.test\.tsx?$/.test(f.file))) {
    for (const target of importTargetsOf(file.text)) {
      if (!forbiddenLayers.some((layer) => target.includes(layer))) continue;
      hits.push({ file: file.file, target });
    }
  }
  return hits;
}
