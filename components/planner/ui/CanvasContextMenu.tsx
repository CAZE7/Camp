import React, { useEffect, useRef } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Maximize2,
  Move,
  Trash2,
  XCircle,
} from 'lucide-react';
import { usePlannerStore } from '../../../store/usePlannerStore';

export type ContextMenuState = {
  /** Bildschirmkoordinaten (clientX/clientY) des Rechtsklicks. */
  x: number;
  y: number;
  targetType: 'node' | 'edge' | 'pane';
  targetId?: string;
  label?: string;
};

const MENU_WIDTH = 232;
// Node menu: label, arm action, 3 × 44 px nudge grid, two target actions,
// separator and two canvas actions, plus container spacing. Keep this slightly
// conservative so the menu remains completely reachable at the viewport edge.
const NODE_MENU_HEIGHT = 456;
const EDGE_MENU_HEIGHT = 244;
const PANE_MENU_HEIGHT = 112;
const NUDGE_STEP = 16;
const ITEM_CLASS =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Gemeinsames Kontextmenü: Rechtsklick mit Maus/Trackpad oder stationärer
 * 500-ms-Long-Press auf Touch. Beide Wege nutzen dieselben Aktionen.
 *
 * Positionierung per `fixed` an den Cursor, mit Clamping an den Viewport,
 * damit das Menü am rechten/unteren Rand nicht abgeschnitten wird.
 */
export function CanvasContextMenu({ state, onClose }: { state: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    // Fokus in das Menü, damit Tab/Escape sofort greifen (Tastatur-Parität).
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);

  const deleteTarget = () => {
    const targetLabel = state.targetType === 'node' ? state.label || 'Dieses Bauteil' : 'Diese Leitung';
    if (
      !window.confirm(
        `${targetLabel} wirklich löschen? Du kannst die Aktion anschließend mit Rückgängig wiederherstellen.`
      )
    )
      return;
    const store = usePlannerStore.getState();
    if (state.targetType === 'node' && state.targetId) {
      const node =
        store.nodes.find((item) => item.id === state.targetId) ||
        store.waterNodes.find((item) => item.id === state.targetId);
      if (node) {
        store.setSelectedNodes([node]);
        store.setSelectedEdges([]);
        store.deleteSelected();
      }
    } else if (state.targetType === 'edge' && state.targetId) {
      const edge =
        store.edges.find((item) => item.id === state.targetId) ||
        store.waterEdges.find((item) => item.id === state.targetId);
      if (edge) {
        store.setSelectedNodes([]);
        store.setSelectedEdges([edge]);
        store.deleteSelected();
      }
    }
    onClose();
  };

  const focusTarget = () => {
    if (state.targetId)
      usePlannerStore.getState().focusElement(state.targetId, state.targetType === 'edge' ? 'edge' : 'node');
    onClose();
  };

  /**
   * A single-tap alternative for fine positioning. It keeps every move on the
   * same 16 px grid as drag-and-drop and goes through the graph slice, so each
   * move is undoable. This is especially useful when a finger cannot perform a
   * precise drag reliably (WCAG 2.5.7).
   */
  const nudgeTarget = (x: number, y: number) => {
    if (state.targetType !== 'node' || !state.targetId) return;
    const store = usePlannerStore.getState();
    const node =
      store.nodes.find((item) => item.id === state.targetId) ||
      store.waterNodes.find((item) => item.id === state.targetId);
    if (!node) return;
    const change = [
      {
        type: 'position' as const,
        id: node.id,
        position: { x: node.position.x + x, y: node.position.y + y },
        dragging: false,
      },
    ];
    if (store.waterNodes.some((item) => item.id === node.id)) store.onWaterNodesChange(change);
    else store.onNodesChange(change);
    navigator.vibrate?.(8);
  };

  const menuHeight =
    state.targetType === 'node'
      ? NODE_MENU_HEIGHT
      : state.targetType === 'edge'
        ? EDGE_MENU_HEIGHT
        : PANE_MENU_HEIGHT;
  const clampedLeft = Math.min(
    state.x,
    (typeof window !== 'undefined' ? window.innerWidth : 1024) - MENU_WIDTH - 8
  );
  const clampedTop = Math.min(
    state.y,
    (typeof window !== 'undefined' ? window.innerHeight : 768) - menuHeight - 8
  );

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Kontextmenü der Arbeitsfläche"
      className="fixed z-[60] rounded-xl border border-border bg-card p-2 shadow-2xl"
      style={{ left: Math.max(8, clampedLeft), top: Math.max(8, clampedTop), width: MENU_WIDTH }}
    >
      {state.label && (
        <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {state.label}
        </p>
      )}

      {state.targetType !== 'pane' && (
        <>
          {state.targetType === 'node' && state.targetId && (
            <button
              type="button"
              role="menuitem"
              className={ITEM_CLASS}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('planner-arm-node', { detail: state.targetId }));
                onClose();
              }}
            >
              <Move className="h-4 w-4" aria-hidden="true" />
              Verschieben aktivieren
            </button>
          )}
          {state.targetType === 'node' && state.targetId && (
            <div className="px-3 py-2">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Fein verschieben</p>
              <div
                className="grid grid-cols-3 gap-1"
                role="group"
                aria-label="Bauteil in 16-Pixel-Schritten verschieben"
              >
                <span aria-hidden="true" />
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => nudgeTarget(0, -NUDGE_STEP)}
                  aria-label={`${state.label || 'Bauteil'} nach oben verschieben`}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <span aria-hidden="true" />
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => nudgeTarget(-NUDGE_STEP, 0)}
                  aria-label={`${state.label || 'Bauteil'} nach links verschieben`}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <span aria-hidden="true" />
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => nudgeTarget(NUDGE_STEP, 0)}
                  aria-label={`${state.label || 'Bauteil'} nach rechts verschieben`}
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <span aria-hidden="true" />
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => nudgeTarget(0, NUDGE_STEP)}
                  aria-label={`${state.label || 'Bauteil'} nach unten verschieben`}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <span aria-hidden="true" />
              </div>
            </div>
          )}
          <button type="button" role="menuitem" className={ITEM_CLASS} onClick={focusTarget}>
            <Crosshair className="h-4 w-4" aria-hidden="true" />
            Ansehen und markieren
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${ITEM_CLASS} text-destructive`}
            onClick={deleteTarget}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Löschen
          </button>
          <div className="my-1 border-t border-border" />
        </>
      )}

      <button
        type="button"
        role="menuitem"
        className={ITEM_CLASS}
        onClick={() => {
          window.dispatchEvent(new CustomEvent('planner-fit-view'));
          onClose();
        }}
      >
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
        Ganzen Plan einpassen
      </button>
      <button
        type="button"
        role="menuitem"
        className={ITEM_CLASS}
        onClick={() => {
          const store = usePlannerStore.getState();
          store.setSelectedNodes([]);
          store.setSelectedEdges([]);
          onClose();
        }}
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
        Auswahl aufheben
      </button>
    </div>
  );
}
