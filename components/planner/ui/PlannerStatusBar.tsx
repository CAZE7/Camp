'use client';

import React, { useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { useShallow } from 'zustand/react/shallow';
import { usePlannerStore } from '../../../store/usePlannerStore';

export interface PlannerStatusBarProps {
  /** Aktueller Canvas-Zoomfaktor (1 = 100 %). */
  zoom: number;
}

/**
 * Mission 7 (M7-3): Statuszeile des Planers — Cursor-Koordinaten im
 * Flow-System, Zoom und Planumfang, wie in CAD-Werkzeugen üblich.
 *
 * Die Koordinaten werden bewusst per `textContent` direkt in den DOM
 * geschrieben statt über React-State: Ein `mousemove`-State würde bei
 * jeder Mausbewegung den gesamten Canvas neu rendern. `aria-hidden` hält
 * die Zeile aus dem Accessibility-Tree — dieselben Infos liefert die
 * Kennzahlen-Karte, und rollende Koordinaten wären Screen-Reader-Rauschen.
 */
export function PlannerStatusBar({ zoom }: PlannerStatusBarProps) {
  const coordsRef = useRef<HTMLSpanElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const { nodeCount, edgeCount } = usePlannerStore(
    useShallow((state) => ({
      nodeCount: state.nodes.length,
      edgeCount: state.edges.length,
    }))
  );

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const el = coordsRef.current;
      if (!el || typeof screenToFlowPosition !== 'function') return;
      const { x, y } = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      el.textContent = `x ${Math.round(x)} · y ${Math.round(y)}`;
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [screenToFlowPosition]);

  return (
    <div className="planner-statusbar" aria-hidden="true">
      <span ref={coordsRef}>x — · y —</span>
      <span>Zoom {Math.round(zoom * 100)} %</span>
      <span>
        {nodeCount} Bauteile · {edgeCount} Leitungen
      </span>
    </div>
  );
}
