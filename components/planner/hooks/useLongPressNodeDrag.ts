import { useEffect, useRef, useState } from 'react';
import { LONG_PRESS_MOVE_TOLERANCE, LONG_PRESS_MS } from '../utils/flowInteraction';

/**
 * Langer Druck (200 ms) auf einen Node „entsperrt“ ihn zum Verschieben.
 *
 * Hintergrund (der eigentliche Touch-Konflikt): Ein Finger, der auf einem Node
 * liegt, kann entweder die Karte pannen oder den Node ziehen — nie beides.
 * Deshalb sind Nodes auf Touch nur über ihren Griff (`dragHandle`) beweglich;
 * Wischen über dem Node-Körper pannt. Wer den Griff nicht treffen will, drückt
 * 200 ms lang auf den Node: dieser Hook meldet ihn als „scharfgeschaltet“
 * zurück, FlowCanvas nimmt für genau diesen Node den `dragHandle` weg — er ist
 * dann komplett greifbar, bis die Auswahl wechselt oder das Zeitfenster abläuft.
 *
 * Bewusste Grenze: der bereits laufende Finger-Kontakt kann den Drag nicht mehr
 * starten (d3-drag entscheidet beim pointerdown). Der Nutzer zieht also nach dem
 * Vibrations-/Toast-Feedback erneut. Dafür kollidieren Pan und Drag garantiert
 * nicht — siehe Trade-offs im PR-Text.
 */
export function useLongPressNodeDrag(enabled: boolean): string | null {
  const [armedNodeId, setArmedNodeId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedRef = useRef<string | null>(null);
  armedRef.current = armedNodeId;

  useEffect(() => {
    if (!enabled) {
      setArmedNodeId(null);
      return;
    }

    const clearTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      startRef.current = null;
    };

    const disarmLater = () => {
      if (disarmTimerRef.current) clearTimeout(disarmTimerRef.current);
      // Nach 8 s ohne Ziehen wieder sperren, damit der Node nicht dauerhaft
      // die Pan-Geste blockiert.
      disarmTimerRef.current = setTimeout(() => setArmedNodeId(null), 8000);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const nodeElement = target.closest<HTMLElement>('.react-flow__node');
      if (!nodeElement) {
        setArmedNodeId(null);
        return;
      }
      // Griff und Anschlüsse haben eigene Gesten — kein Long-Press nötig.
      if (target.closest('.node-drag-handle, .react-flow__handle, button, input, select, textarea')) return;

      const nodeId = nodeElement.dataset.id || null;
      if (!nodeId) return;
      if (nodeId !== armedRef.current) setArmedNodeId(null);

      startRef.current = { x: event.clientX, y: event.clientY };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setArmedNodeId(nodeId);
        disarmLater();
        // Kurzes haptisches Signal, wo verfügbar (Android/Chrome).
        navigator.vibrate?.(15);
        window.dispatchEvent(
          new CustomEvent<string>('planner-node-armed', {
            detail: 'Verschieben aktiv: Bauteil jetzt ziehen oder den Griff oben links nutzen.',
          })
        );
      }, LONG_PRESS_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      const start = startRef.current;
      if (!start || !timerRef.current) return;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      // Bewegt sich der Finger, ist es eine Pan-Geste — Long-Press verwerfen.
      if (distance > LONG_PRESS_MOVE_TOLERANCE) clearTimer();
    };

    const onPointerUp = () => clearTimer();

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
      clearTimer();
      if (disarmTimerRef.current) clearTimeout(disarmTimerRef.current);
    };
  }, [enabled]);

  return armedNodeId;
}
