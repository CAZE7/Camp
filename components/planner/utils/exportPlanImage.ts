import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

/**
 * Bild-Export des Plans (`Datei → Plan als Bild exportieren`).
 *
 * Ausgelagert aus der Chrome-Leiste, weil die Funktion nichts über Menüs weiß:
 * Sie liest den DOM-Canvas, rechnet die Bounds und meldet Ergebnis oder Grund.
 * Die Meldungstexte sind Teil der Oberfläche (der Nutzer sieht sie), die Klasse
 * des Fehlers bleibt im Text erhalten (AUDIT M6-4: statt `console.error`).
 */
export type ExportResult = { type: 'success' | 'error' | 'info'; message: string };

/**
 * Wasserzeichen des Foren-Exports. Jedes Bild, das ein Nutzer zur Kontrolle
 * seines Schaltplans in Forum oder Gruppe lädt, nennt die Quelle — dezent
 * unten rechts, ohne den Plan zu überdecken.
 */
export const PLAN_WATERMARK_TEXT = 'Erstellt mit 12v-planer.de';
export const PLAN_WATERMARK_SUBTEXT = 'Kostenloser 12V/24V Online-Planer';

/** Badge-Geometrie in Fluss-Koordinaten (unten rechts in den Plan-Bounds). */
export function watermarkBadgeLayout(bounds: { x: number; y: number; width: number; height: number }): {
  left: number;
  top: number;
  width: number;
} {
  const width = 340;
  return { left: bounds.x + bounds.width - width, top: bounds.y + bounds.height - 52, width };
}

/**
 * Baut das Badge als DOM-Knoten in die Zeichenfläche ein (nur für die Dauer
 * der Aufnahme) und liefert das Aufräumen. Als DOM statt als Nachzeichnen auf
 * ein Canvas: `html-to-image` übernimmt den Knoten exakt wie Bauteile und
 * Leitungen, und der Export bleibt ohne Canvas-Taint-Grenzen testbar.
 */
function mountWatermark(
  target: HTMLElement,
  bounds: { x: number; y: number; width: number; height: number }
) {
  const layout = watermarkBadgeLayout(bounds);
  const badge = document.createElement('div');
  badge.setAttribute('data-plan-watermark', 'true');
  badge.textContent = `${PLAN_WATERMARK_TEXT} – ${PLAN_WATERMARK_SUBTEXT}`;
  Object.assign(badge.style, {
    position: 'absolute',
    left: `${layout.left}px`,
    top: `${layout.top}px`,
    width: `${layout.width}px`,
    padding: '8px 10px',
    // Farben nur als Token-Verweise: Farbwerte gehören ausschließlich in
    // app/globals.css (Wächter lib/designTokens.test.ts).
    background: 'var(--surface-panel)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    opacity: '0.95',
    font: '600 13px system-ui, sans-serif',
    lineHeight: '1.35',
    textAlign: 'right',
    pointerEvents: 'none',
    zIndex: '9999',
  } satisfies Partial<CSSStyleDeclaration>);
  target.appendChild(badge);
  return () => badge.remove();
}

export async function exportPlanImage(): Promise<ExportResult> {
  const [{ toPng }, { usePlannerStore }] = await Promise.all([
    import('html-to-image'),
    import('../../../store/usePlannerStore'),
  ]);
  const state = usePlannerStore.getState();
  const nodes: Node[] =
    state.viewMode === 'water' ? (state.waterNodes as unknown as Node[]) : (state.nodes as unknown as Node[]);

  // QA B-17: Auswahl-Rahmen gehören nicht ins Bild. Auswahl vor dem Rendern
  // lösen und danach wiederherstellen.
  const previousSelection = {
    nodeIds: state.nodes.filter((n) => n.selected).map((n) => n.id),
    edgeIds: state.edges.filter((e) => e.selected).map((e) => e.id),
  };
  const clearedSelection = previousSelection.nodeIds.length > 0 || previousSelection.edgeIds.length > 0;
  if (clearedSelection) {
    usePlannerStore.setState((s) => ({
      nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
      selectedNodes: [],
      selectedEdges: [],
    }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }
  try {
    return await renderAndDownload(toPng, nodes);
  } finally {
    if (clearedSelection) {
      usePlannerStore.setState((s) => {
        const nodes = s.nodes.map((n) =>
          previousSelection.nodeIds.includes(n.id) ? { ...n, selected: true } : n
        );
        const edges = s.edges.map((e) =>
          previousSelection.edgeIds.includes(e.id) ? { ...e, selected: true } : e
        );
        return {
          nodes,
          edges,
          selectedNodes: nodes.filter((n) => n.selected),
          selectedEdges: edges.filter((e) => e.selected),
        };
      });
    }
  }
}

async function renderAndDownload(
  toPng: typeof import('html-to-image').toPng,
  nodes: Node[]
): Promise<ExportResult> {
  try {
    const reactFlowWrapper = document.querySelector('.react-flow') as HTMLElement | null;
    if (!reactFlowWrapper) throw new Error('Planfläche nicht gefunden');
    const styles = getComputedStyle(document.documentElement);
    const paper =
      styles.getPropertyValue('--surface-canvas').trim() || styles.getPropertyValue('--paper').trim();
    const viewport = reactFlowWrapper.querySelector<HTMLElement>('.react-flow__viewport');
    const bounds =
      nodes.length > 0
        ? getNodesBounds(nodes)
        : { x: 0, y: 0, width: reactFlowWrapper.clientWidth, height: reactFlowWrapper.clientHeight };
    const imageWidth = Math.max(640, Math.ceil(bounds.width + 160));
    const imageHeight = Math.max(480, Math.ceil(bounds.height + 160));
    const transform = getViewportForBounds(bounds, imageWidth, imageHeight, 0.5, 2, 0.12);
    // Wasserzeichen nur für die Aufnahme einhängen und in jedem Fall wieder
    // entfernen — auf der Zeichenfläche selbst hat es nichts zu suchen.
    const removeWatermark = mountWatermark(viewport || reactFlowWrapper, bounds);
    // Nachtest Bug 13: Auswahlrahmen nicht mit ins PNG rendern.
    reactFlowWrapper.classList.add('planner-exporting');
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    let dataUrl: string;
    try {
      dataUrl = await toPng(viewport || reactFlowWrapper, {
        backgroundColor: paper,
        pixelRatio: 2,
        cacheBust: true,
        width: imageWidth,
        height: imageHeight,
        style: viewport
          ? {
              width: `${imageWidth}px`,
              height: `${imageHeight}px`,
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
            }
          : undefined,
        filter: (node) =>
          !(
            node?.classList?.contains('react-flow__panel') ||
            node?.classList?.contains('react-flow__controls') ||
            node?.classList?.contains('react-flow__minimap')
          ),
      });
    } finally {
      reactFlowWrapper.classList.remove('planner-exporting');
      removeWatermark();
    }
    const link = document.createElement('a');
    link.download = '12v-planer-schaltplan.png';
    link.href = dataUrl;
    link.click();
    return {
      type: 'success',
      message: 'Bild mit Wasserzeichen exportiert — bereit zum Posten im Forum oder in der Gruppe.',
    };
  } catch (error) {
    document.querySelector('.react-flow.planner-exporting')?.classList.remove('planner-exporting');
    const message =
      nodes.length === 0
        ? 'Nichts zu exportieren — platziere zuerst Komponenten.'
        : error instanceof Error && error.name === 'SecurityError'
          ? 'Export blockiert: Der Plan enthält externe Inhalte.'
          : `Bild-Export fehlgeschlagen${
              error instanceof Error && error.name ? ` (${error.name})` : ''
            }. Passe die Ansicht an und versuche es erneut.`;
    return { type: 'error', message };
  }
}
