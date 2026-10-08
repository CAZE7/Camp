'use client';

import React, { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { PLANNER_SNAP_GRID } from '../constants';

export interface PlannerStatusBarProps {
  /** Aktueller Canvas-Zoomfaktor (1 = 100 %). */
  zoom: number;
}

/**
 * Statuszeile des Planers — der technische Zustand in einer Zeile.
 *
 * Aufbau wie in Konstruktionswerkzeugen: links der Planumfang und die Domäne,
 * in der Mitte Raster/Zoom/Snap, rechts der Prüfstatus; ganz rechts der Cursor.
 * Die Koordinaten werden bewusst per `textContent` direkt in den DOM
 * geschrieben statt über React-State: Ein `mousemove`-State würde bei jeder
 * Mausbewegung den gesamten Canvas neu rendern.
 *
 * `aria-hidden`: Alles, was hier steht, ist redundant — Prüfstatus kommt aus der
 * Warnzentrale (Live-Region), Umfang und Speicherzustand aus der Menüleiste.
 * Rollende Koordinaten und doppelte Ansagen wären für Screenreader-Rauschen.
 */
export function PlannerStatusBar({ zoom }: PlannerStatusBarProps) {
  const coordsRef = useRef<HTMLSpanElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const { nodeCount, edgeCount, viewMode, criticalCount, warningCount } = usePlannerStore(
    useShallow((state) => ({
      nodeCount: state.viewMode === 'water' ? state.waterNodes.length : state.nodes.length,
      edgeCount: state.viewMode === 'water' ? state.waterEdges.length : state.edges.length,
      viewMode: state.viewMode,
      // „kritisch“ umfasst beide harten Stufen der Domäne (`error`, `critical`).
      criticalCount: state.plannerErrors.filter(
        (error) => error.severity === 'error' || error.severity === 'critical'
      ).length,
      warningCount: state.plannerErrors.filter(
        (error) => error.severity !== 'error' && error.severity !== 'critical'
      ).length,
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

  const gridMm = PLANNER_SNAP_GRID[0];

  return (
    <div
      data-testid="planner-statusbar"
      className="planner-statusbar cad-statusbar"
      aria-hidden="true"
      role="presentation"
    >
      {/* Erstes Kind bleibt der Koordinaten-Span (Vertrag des Komponententests
          und der Ort, an dem der Zeigerwert ohne Re-render landet). */}
      <span ref={coordsRef} data-testid="statusbar-coords">
        x — · y —
      </span>
      <span className="cad-statusbar__sep" />
      <span>
        {nodeCount} Bauteile · {edgeCount} Leitungen
      </span>
      {/* Spannungsdomäne und Raster sind auf dem Handy nicht platzrelevant —
          dort bleibt die Zeile einzeilig (Zoom und Prüfstand zuerst). */}
      <span className="cad-statusbar__sep hidden md:inline-block" />
      <span className="hidden md:inline">{viewMode === 'water' ? 'Brauch-/Grauwasser' : '12 V / 230 V'}</span>
      <span className="cad-statusbar__sep hidden md:inline-block" />
      <span className="hidden md:inline">Raster {gridMm} mm</span>
      <span className="cad-statusbar__sep hidden md:inline-block" />
      <span>Zoom {Math.round(zoom * 100)} %</span>
      <span className="cad-statusbar__sep hidden md:inline-block" />
      <span className="hidden md:inline">Snap aktiv</span>
      <span className="cad-statusbar__sep" />
      {criticalCount > 0 ? (
        <span className="cad-statusbar__signal">
          {criticalCount} kritisch · {warningCount} Warnungen
        </span>
      ) : warningCount > 0 ? (
        <span className="text-warning">{warningCount} Warnungen · kein kritischer Fehler</span>
      ) : (
        <span className="cad-statusbar__ok">Keine Fehler</span>
      )}
    </div>
  );
}
