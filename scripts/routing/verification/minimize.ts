/**
 * scripts/routing/verification/minimize.ts — Delta Debugging für Routingfehler.
 *
 * Ein Fehlerfall, der aus 14 Kanten besteht, ist als Regressionstest teuer und
 * als Erklärung wertlos: man sieht nicht, *welche* zwei Kanten das Problem
 * erzeugen. Die Minimierung entfernt Kanten und Bauteile, solange der Fehler
 * reproduziert wird.
 *
 * Determinismus (§6): Die Entfernungsreihenfolge ist fest — Kanten in
 * Dateireihenfolge, danach Bauteile in Dateireihenfolge, jeweils Neustart nach
 * jeder erfolgreichen Entfernung (klassisches ddmin in der einfachen Form).
 * Kein Zufall, keine Zeit, kein Abbruchkriterium über die Laufzeit. Gleiche
 * Eingabe ⇒ gleiches Minimum.
 *
 * Aufruf (aus `replay.ts`):
 *
 *   npm run test:replay -- --minimize --only ROUTE-REG-00002
 *
 * Ergebnis: Die Akte wird auf `plan: { kind: 'inline', … }` umgestellt,
 * `minimized: true` gesetzt und der Hash neu geschrieben. Die Aussage der Akte
 * (`expect`) bleibt unverändert — sie wird durch die Minimierung nicht
 * abgeschwächt, nur ihr Träger verkleinert.
 */

export type MinimizePlan = { nodes: unknown[]; edges: unknown[] };

export type MinimizeResult = {
  plan: MinimizePlan;
  /** Wie viele Kanten/Bauteile entfernt wurden — für den Bericht. */
  removed: { edges: number; nodes: number };
  /** Anzahl der Prüfläufe (Aufwandsnachweis). */
  evaluations: number;
};

type NodeLike = { id?: string };
type EdgeLike = { source?: string; target?: string };

/**
 * Entfernt Kanten und Bauteile deterministisch, solange `stillFails` gilt.
 *
 * `stillFails` bekommt den Kandidatenplan und muss **denselben** Fehler
 * melden wie die Akte (Vergleich über `judgeRecord`), nicht irgendeinen Fehler.
 * Das ist der Unterschied zwischen Minimierung und Verfälschung.
 */
export function minimizePlan(
  initial: MinimizePlan,
  stillFails: (candidate: MinimizePlan) => boolean,
  options: { maxEvaluations?: number } = {}
): MinimizeResult {
  const maxEvaluations = options.maxEvaluations ?? 2000;
  let nodes = [...initial.nodes];
  let edges = [...initial.edges];
  let evaluations = 0;
  const initialCounts = { edges: edges.length, nodes: nodes.length };

  const evaluate = (candidate: MinimizePlan): boolean => {
    if (candidate.edges.length === 0) return false; // ein Fehler ohne Kante ist kein Routingfehler
    if (evaluations >= maxEvaluations) return false;
    evaluations += 1;
    return stillFails(candidate);
  };

  let changed = true;
  while (changed && evaluations < maxEvaluations) {
    changed = false;

    for (const edge of [...edges]) {
      const candidateEdges = edges.filter((candidate) => candidate !== edge);
      if (candidateEdges.length === 0) continue;
      if (evaluate({ nodes, edges: candidateEdges })) {
        edges = candidateEdges;
        changed = true;
        break;
      }
    }
    if (changed) continue;

    for (const node of [...nodes]) {
      const id = (node as NodeLike).id;
      const candidateNodes = nodes.filter((candidate) => candidate !== node);
      if (candidateNodes.length === 0) continue;
      const candidateEdges = edges.filter(
        (edge) => (edge as EdgeLike).source !== id && (edge as EdgeLike).target !== id
      );
      if (evaluate({ nodes: candidateNodes, edges: candidateEdges })) {
        nodes = candidateNodes;
        edges = candidateEdges;
        changed = true;
        break;
      }
    }
  }

  return {
    plan: { nodes, edges },
    removed: { edges: initialCounts.edges - edges.length, nodes: initialCounts.nodes - nodes.length },
    evaluations,
  };
}
