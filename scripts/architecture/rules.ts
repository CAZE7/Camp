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
 * Findet JEDE Ladeanweisung auf routing-v2/routing-core: `from '…'`,
 * Side-Effect-`import '…'`, `import('…')`, `require('…')` — mit oder ohne
 * abschließenden Slash. Der Slash war die Lücke (AUDIT G2).
 */
export function findRoutingV2Loaders(files: SourceFile[]): string[] {
  const RE =
    /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]*)\b(routing-v2|routing-core)\b(?![-\w])/g;
  const hits: string[] = [];
  for (const file of productionOnly(files)) {
    const text = stripComments(file.text);
    for (const match of text.matchAll(RE)) {
      hits.push(`${file.file} → ${match[1]}${match[2]}`);
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
 * Dateien, die `cableClearance` als **Literalzahl** belegen — Eigenschaft
 * (`cableClearance: 42`) ODER Zuweisung (`const cableClearance = 42`).
 * Die alte Regex verlangte den Doppelpunkt und ließ die Zuweisung durch.
 */
export function findCableClearanceLiterals(files: SourceFile[]): string[] {
  const RE = /\bcableClearance\b\s*[:=]\s*\d/;
  return productionOnly(files)
    .filter((file) => RE.test(stripComments(file.text)))
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
