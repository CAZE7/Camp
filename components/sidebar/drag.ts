import type React from 'react';
import type { Comp } from './catalog';
import { usePlannerStore } from '../../store/usePlannerStore';

/**
 * Hinzufügen ohne Drag (Mobil / Tastatur): Der Knoten erscheint in einem
 * luftigen zweispaltigen Raster statt alles auf (0,0) — so bleiben die
 * Handles erreichbar, bevor der Nutzer etwas verschoben hat.
 */
export function addAtVisibleCenter(comp: Comp, onMobileAdd?: () => void) {
  const state = usePlannerStore.getState();
  const count = state.viewMode === 'water' ? state.waterNodes.length : state.nodes.length;
  const position = { x: (count % 2) * 160, y: count * 160 };
  state.addNode(comp.type, comp.label, position, comp.watts);
  onMobileAdd?.();
  // React Flow updates its measured-node map one frame after the Zustand
  // render. Fit on the following frame so a newly added off-screen card is
  // included instead of being left unreachable with visible-elements culling.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('planner-fit-view')));
  });
}

/**
 * Pointer-Drag am Desktop: Die Kachel wird als halbtransparenter Ghost-Clone
 * hinter dem Zeiger hergezogen; liegt der Pointer beim Loslassen über dem
 * React-Flow-Pane, wird dort `custom-node-drop` ausgelöst.
 *
 * Unterhalb des Desktop-Layouts wird erst der vollständige Klick ausgewertet
 * (Klick-Logik der Kachel), damit ein Scrollversuch in der Liste nicht
 * versehentlich etwas hinzufügt.
 */
export const handlePointerDown = (event: React.PointerEvent, comp: Comp, onMobileAdd?: () => void) => {
  if (window.innerWidth < 1024) return;
  event.preventDefault();

  const target = event.currentTarget as HTMLElement;
  const clone = target.cloneNode(true) as HTMLElement;
  clone.style.position = 'fixed';
  clone.style.zIndex = '9999';
  clone.style.opacity = '0.85';
  clone.style.pointerEvents = 'none';
  clone.style.width = `${target.offsetWidth}px`;
  clone.style.left = `${event.clientX - target.offsetWidth / 2}px`;
  clone.style.top = `${event.clientY - target.offsetHeight / 2}px`;
  document.body.appendChild(clone);

  const onPointerMove = (moveEvent: PointerEvent) => {
    clone.style.left = `${moveEvent.clientX - target.offsetWidth / 2}px`;
    clone.style.top = `${moveEvent.clientY - target.offsetHeight / 2}px`;
  };

  const cleanup = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', cleanup);
    clone.remove();
  };

  const onPointerUp = (upEvent: PointerEvent) => {
    const isOverCanvas = document.elementsFromPoint(upEvent.clientX, upEvent.clientY)
      .some((element) => element.classList.contains('react-flow__pane'));
    if (isOverCanvas) {
      window.dispatchEvent(new CustomEvent('custom-node-drop', {
        detail: {
          clientX: upEvent.clientX,
          clientY: upEvent.clientY,
          type: comp.type,
          label: comp.label,
          watts: comp.watts,
        },
      }));
    }
    cleanup();
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', cleanup);
};
