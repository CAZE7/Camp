import type React from 'react';
import type { Comp } from './catalog';

/** The catalogue has room for mouse drag-and-drop at this layout width. */
export const DESKTOP_CATALOG_DRAG_MIN_WIDTH = 1024;

/**
 * A viewport width describes available layout space, not the user's input
 * device. In particular, an iPad in landscape is often 1024 px wide, so only
 * a real mouse starts the desktop ghost drag. Touch and pen always retain the
 * reliable one-tap add path.
 */
export function shouldStartCatalogDrag(pointerType: string | undefined, viewportWidth: number): boolean {
  return (pointerType || 'mouse') === 'mouse' && viewportWidth >= DESKTOP_CATALOG_DRAG_MIN_WIDTH;
}

/**
 * Adds a catalogue item at the centre of the visible canvas, not at a fixed
 * world coordinate. The event is delayed by two frames so a mobile tab switch
 * can paint the canvas before FlowCanvas reads its bounds. This preserves the
 * user's current zoom/pan context and avoids a disorienting fitView jump.
 */
export function addAtVisibleCenter(comp: Comp, onMobileAdd?: () => void) {
  onMobileAdd?.();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('planner-add-at-canvas-center', {
          detail: { type: comp.type, label: comp.label, watts: comp.watts },
        })
      );
    });
  });
}

/**
 * Pointer-Drag on sufficiently wide mouse layouts: The tile is represented by
 * a translucent ghost under the pointer and, when released over the React
 * Flow pane, dispatches `custom-node-drop`.
 *
 * Returning whether a drag was started lets ComponentTile suppress the click
 * fallback only for an actual desktop-drag attempt. A touch tap on a 1024-px
 * tablet therefore remains a tap-to-add instead of being swallowed by the
 * desktop interaction.
 */
export const handlePointerDown = (event: React.PointerEvent, comp: Comp): boolean => {
  if (!shouldStartCatalogDrag(event.pointerType, window.innerWidth)) return false;
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
    const isOverCanvas = document
      .elementsFromPoint(upEvent.clientX, upEvent.clientY)
      .some((element) => element.classList.contains('react-flow__pane'));
    if (isOverCanvas) {
      window.dispatchEvent(
        new CustomEvent('custom-node-drop', {
          detail: {
            clientX: upEvent.clientX,
            clientY: upEvent.clientY,
            type: comp.type,
            label: comp.label,
            watts: comp.watts,
          },
        })
      );
    }
    cleanup();
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', cleanup);
  return true;
};
