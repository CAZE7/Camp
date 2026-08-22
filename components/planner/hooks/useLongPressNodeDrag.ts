import { useEffect, useRef, useState } from 'react';

/**
 * Touch-Verschieben über den Kontextmenü-Punkt „Verschieben aktivieren“.
 *
 * Hintergrund: Der frühere Long-Press-Timer (750 ms) startete auf dem
 * Node-Körper — genau dort öffnet aber das Touch-Kontextmenü nach 500 ms und
 * brach den Timer über 'planner-touch-context-open' immer ab. Der
 * Long-Press-Pfad war damit toter Code. Halten = Kontextmenü; das Menü
 * schaltet den Node über das 'planner-arm-node'-Event zum Ziehen frei.
 *
 * Bleibt die Entscheidung aus Mission 1/3: Nodes sind auf Touch primär über
 * ihren Griff (`dragHandle`) beweglich; der Menüpunkt ist der zweite Weg.
 * Nach 8 s ohne Ziehen wird der Node wieder gesperrt, damit er nicht dauerhaft
 * die Pan-Geste blockiert.
 */
export function useLongPressNodeDrag(enabled: boolean): string | null {
  const [armedNodeId, setArmedNodeId] = useState<string | null>(null);
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setArmedNodeId(null);
      return;
    }

    const disarmLater = () => {
      if (disarmTimerRef.current) clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = setTimeout(() => setArmedNodeId(null), 8000);
    };

    const onArmFromMenu = (event: Event) => {
      const nodeId = (event as CustomEvent<string>).detail;
      if (!nodeId) return;
      setArmedNodeId(nodeId);
      disarmLater();
      // Kurzes haptisches Signal, wo verfügbar (Android/Chrome).
      navigator.vibrate?.(15);
      window.dispatchEvent(
        new CustomEvent<string>('planner-node-armed', {
          detail: 'Verschieben aktiv: Bauteil jetzt ziehen oder den Griff oben links nutzen.',
        })
      );
    };

    window.addEventListener('planner-arm-node', onArmFromMenu as EventListener);
    return () => {
      window.removeEventListener('planner-arm-node', onArmFromMenu as EventListener);
      if (disarmTimerRef.current) clearTimeout(disarmTimerRef.current);
    };
  }, [enabled]);

  return armedNodeId;
}
