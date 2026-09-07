/**
 * lib/planner/layout-engine/elk.ts
 *
 * ELK-Adapter für den `PlannerLayoutEngine`-Vertrag.
 *
 * WICHTIG — hier steht KEINE eigene elkjs-Anbindung mehr. Die Ausführung
 * liegt vollständig bei `lib/routing/elk/runner.ts`; dieses Modul übersetzt
 * nur zwischen `LayoutRequest`/`LayoutResult` (Vertrag der Layout-Schicht)
 * und `ElkPlan`/`ElkLayoutResult` (Vertrag des Runners).
 *
 * Vorgeschichte (ADR 0016): Bis zur Konsolidierung gab es zwei getrennte
 * elkjs-Anbindungen. Diese hier war die schwächere, wurde aber produktiv
 * verwendet — dasselbe Muster wie beim Hopping (ADR 0014):
 *
 * | | vorher (hier) | Runner (jetzt) |
 * | --- | --- | --- |
 * | Import | `elkjs` → `lib/main.js` | `elkjs/lib/elk.bundled.js` |
 * | Instanz | `new ELK()` bei JEDEM Layout | Lazy-Singleton |
 * | Timeout | keiner | `ELK_TIMEOUT_MS` + `ElkTimeoutError` |
 * | Parallele Aufrufe | Race möglich | „letzte Anfrage gewinnt" (`createElkSession`) |
 * | Optionen | von Hand gepflegt | aus den Tokens generiert |
 *
 * Der Import über `elkjs` statt `elkjs/lib/elk.bundled.js` war zudem ein
 * echter Defekt: `lib/main.js` verlangt zur Laufzeit `web-worker`, das nicht
 * installiert ist — der Dev-Server meldete beim Laden der Planer-Seite
 * „Module not found: Can't resolve 'web-worker'". Die gebündelte Variante
 * funktioniert in Browser und Node identisch.
 */

import type {
  LayoutEdgeResult,
  LayoutNodeResult,
  LayoutRequest,
  LayoutResult,
  PlannerLayoutEngine,
} from './contract';
import { LAYOUT_TOKENS } from './tokens';
import type { ElkPlan } from '../../routing/elk/graph';
import { layoutWithElk } from '../../routing/elk/runner';

export class ElkLayoutEngine implements PlannerLayoutEngine {
  readonly name = 'elk';

  async layout(request: LayoutRequest): Promise<LayoutResult> {
    // Sortierung nach ID: ELK ist reihenfolgeempfindlich, das Ergebnis muss
    // unabhängig von der Eingabereihenfolge sein (ADR 0010).
    const nodes = [...request.nodes].sort(compareById);
    const edges = [...request.edges].sort(compareById);

    const sizeById = new Map(
      nodes.map((node) => [
        node.id,
        {
          width: node.width ?? LAYOUT_TOKENS.defaultNodeWidth,
          height: node.height ?? LAYOUT_TOKENS.defaultNodeHeight,
        },
      ])
    );

    const plan: ElkPlan = {
      nodes: nodes.map((node) => {
        const size = sizeById.get(node.id)!;
        return { id: node.id, x: 0, y: 0, width: size.width, height: size.height };
      }),
      edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target })),
      direction: request.direction ?? 'LR',
    };

    const result = await layoutWithElk(plan);

    const nodeResults: LayoutNodeResult[] = nodes.map((node) => {
      const position = result.nodes.get(node.id);
      const size = sizeById.get(node.id)!;
      return {
        id: node.id,
        x: position?.x ?? 0,
        y: position?.y ?? 0,
        width: size.width,
        height: size.height,
      };
    });

    const edgeResults: LayoutEdgeResult[] = edges.map((edge) => ({
      id: edge.id,
      points: result.routes.get(edge.id) ?? [],
    }));

    return { nodes: nodeResults, edges: edgeResults, engine: this.name };
  }
}

function compareById<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
