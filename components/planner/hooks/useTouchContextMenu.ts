import { useEffect, useRef } from 'react';
import { LONG_PRESS_MOVE_TOLERANCE } from '../utils/flowInteraction';
import type { ContextMenuState } from '../ui/CanvasContextMenu';

export const TOUCH_CONTEXT_MENU_MS = 500;

/** Opens the desktop context menu after a stationary 500 ms touch hold. */
export function useTouchContextMenu(
  enabled: boolean,
  onOpen: (state: ContextMenuState) => void
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const cancel = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      start.current = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('button, input, select, textarea, .react-flow__handle, .node-drag-handle')) return;

      const node = target.closest<HTMLElement>('.react-flow__node:not(.planner-backbone-group-node)');
      const edge = target.closest<HTMLElement>('.react-flow__edge');
      if (!node && !edge) return;

      const id = (node || edge)?.dataset.id;
      if (!id) return;
      const x = event.clientX;
      const y = event.clientY;
      start.current = { x, y };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const label = node
          ? node.querySelector<HTMLElement>('[role="group"]')?.getAttribute('aria-label')?.split('.')[0] || 'Bauteil'
          : 'Leitung';
        navigator.vibrate?.(15);
        window.dispatchEvent(new CustomEvent('planner-touch-context-open'));
        onOpen({ x, y, targetType: node ? 'node' : 'edge', targetId: id, label });
        timer.current = null;
      }, TOUCH_CONTEXT_MENU_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!start.current || !timer.current) return;
      if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > LONG_PRESS_MOVE_TOLERANCE) cancel();
    };

    const preventNativeMenu = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest('.react-flow')) event.preventDefault();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', cancel, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('contextmenu', preventNativeMenu, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', cancel, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('contextmenu', preventNativeMenu, true);
      cancel();
    };
  }, [enabled, onOpen]);
}
