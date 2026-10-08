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

export async function exportPlanImage(): Promise<ExportResult> {
  const [{ toPng }, { usePlannerStore }] = await Promise.all([
    import('html-to-image'),
    import('../../../store/usePlannerStore'),
  ]);
  const state = usePlannerStore.getState();
  const nodes: Node[] =
    state.viewMode === 'water' ? (state.waterNodes as unknown as Node[]) : (state.nodes as unknown as Node[]);

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
    const dataUrl = await toPng(viewport || reactFlowWrapper, {
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
    const link = document.createElement('a');
    link.download = 'werft-schaltplan.png';
    link.href = dataUrl;
    link.click();
    return { type: 'success', message: 'Bild in hoher Auflösung exportiert.' };
  } catch (error) {
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
