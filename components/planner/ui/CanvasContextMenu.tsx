import React, { useEffect, useRef } from 'react';
import { Crosshair, Maximize2, Trash2, XCircle } from 'lucide-react';
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
const ITEM_CLASS =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Rechtsklick-Kontextmenü (nur Maus/Trackpad — Touch-Geräte lösen kein
 * contextmenu-Event mit sinnvoller Position aus und haben stattdessen den
 * Inspector als Slide-over).
 *
 * Positionierung per `fixed` an den Cursor, mit Clamping an den Viewport,
 * damit das Menü am rechten/unteren Rand nicht abgeschnitten wird.
 */
export function CanvasContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState;
  onClose: () => void;
}) {
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
    if (state.targetId) usePlannerStore.getState().focusElement(state.targetId, state.targetType === 'edge' ? 'edge' : 'node');
    onClose();
  };

  const clampedLeft = Math.min(state.x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - MENU_WIDTH - 8);
  const clampedTop = Math.min(state.y, (typeof window !== 'undefined' ? window.innerHeight : 768) - 200);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Kontextmenü der Arbeitsfläche"
      className="fixed z-[60] rounded-xl border border-border bg-card p-2 shadow-2xl"
      style={{ left: Math.max(8, clampedLeft), top: Math.max(8, clampedTop), width: MENU_WIDTH }}
    >
      {state.label && (
        <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{state.label}</p>
      )}

      {state.targetType !== 'pane' && (
        <>
          <button type="button" role="menuitem" className={ITEM_CLASS} onClick={focusTarget}>
            <Crosshair className="h-4 w-4" aria-hidden="true" />
            Ansehen und markieren
          </button>
          <button type="button" role="menuitem" className={`${ITEM_CLASS} text-destructive`} onClick={deleteTarget}>
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
