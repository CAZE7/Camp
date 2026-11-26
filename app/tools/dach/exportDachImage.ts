/**
 * app/tools/dach/exportDachImage.ts — Dach-Anordnung als PNG-Bild.
 *
 * Dasselbe Ausgabe-Muster wie der Schaltplan-Export
 * (`components/planner/utils/exportPlanImage.ts`): Die ganze Anordnung
 * wird über ihre Knotengrenzen eingerahmt (nicht nur der sichtbare
 * Ausschnitt), Auswahl-Rahmen bleiben draußen, ein dezentes Wasserzeichen
 * unten rechts macht Foren-Bilder zuordenbar. Dynamischer Import von
 * `html-to-image`, damit das Startpaket des Werkzeugs schlank bleibt.
 */

import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

export type DachExportResult = { type: 'success' | 'error'; message: string };

function mountWatermark(target: HTMLElement): () => void {
  const badge = document.createElement('div');
  badge.setAttribute('data-dach-watermark', 'true');
  badge.textContent = 'Erstellt mit dem Dach-Planer · 12v-planer.de';
  Object.assign(badge.style, {
    position: 'absolute',
    right: '16px',
    bottom: '16px',
    padding: '6px 10px',
    background: 'var(--surface-panel)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    opacity: '0.95',
    font: '600 13px system-ui, sans-serif',
    lineHeight: '1.35',
    pointerEvents: 'none',
    zIndex: '9999',
  } satisfies Partial<CSSStyleDeclaration>);
  target.appendChild(badge);
  return () => badge.remove();
}

export async function exportDachImage(nodes: readonly Node[]): Promise<DachExportResult> {
  if (nodes.length === 0) {
    return { type: 'error', message: 'Nichts zu exportieren — platziere zuerst ein Element.' };
  }
  try {
    const { toPng } = await import('html-to-image');
    const reactFlowWrapper = document.querySelector('.react-flow') as HTMLElement | null;
    if (!reactFlowWrapper) throw new Error('Dachfläche nicht gefunden');
    const styles = getComputedStyle(document.documentElement);
    const paper =
      styles.getPropertyValue('--paper').trim() || styles.getPropertyValue('--surface-canvas').trim();
    const viewport = reactFlowWrapper.querySelector<HTMLElement>('.react-flow__viewport');
    const bounds = getNodesBounds(nodes as Node[]);
    const imageWidth = Math.max(640, Math.ceil(bounds.width + 160));
    const imageHeight = Math.max(480, Math.ceil(bounds.height + 160));
    const transform = getViewportForBounds(bounds, imageWidth, imageHeight, 0.5, 2, 0.12);
    const removeWatermark = mountWatermark(viewport || reactFlowWrapper);
    reactFlowWrapper.classList.add('planner-exporting');
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
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
      link.download = 'dachplan.png';
      link.href = dataUrl;
      link.click();
      return {
        type: 'success',
        message: 'Bild exportiert — bereit zum Posten im Forum oder in der Gruppe.',
      };
    } finally {
      reactFlowWrapper.classList.remove('planner-exporting');
      removeWatermark();
    }
  } catch (error) {
    document.querySelector('.react-flow.planner-exporting')?.classList.remove('planner-exporting');
    return {
      type: 'error',
      message:
        error instanceof Error && error.name === 'SecurityError'
          ? 'Export blockiert: Die Ansicht enthält externe Inhalte.'
          : 'Bild-Export fehlgeschlagen. Passe die Ansicht an und versuche es erneut.',
    };
  }
}
