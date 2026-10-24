'use client';

import React, { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { PLANNER_SNAP_GRID } from '../constants';
import { getSystemVoltage } from '../utils/voltage';
import { classifySystemVoltage } from '../../../lib/electricalGraph/powerSystem';

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
  const { nodeCount, edgeCount, viewMode, dcLabel, criticalCount, warningCount, infoCount } = usePlannerStore(
    useShallow((state) => {
      const vClass = classifySystemVoltage(getSystemVoltage(state.nodes));
      const resolvedDcLabel = vClass === '24V' ? '24 V' : vClass === '48V' ? '48 V' : '12 V';
      return {
        nodeCount: state.viewMode === 'water' ? state.waterNodes.length : state.nodes.length,
        edgeCount: state.viewMode === 'water' ? state.waterEdges.length : state.edges.length,
        viewMode: state.viewMode,
        dcLabel: `${resolvedDcLabel} / 230 V`,
        // „kritisch“ umfasst beide harten Stufen der Domäne (`error`, `critical`),
        // während echte Warnungen (`warning`) und Datenlücken (`info` = Hinweise)
        // denselben Wortlaut wie die Warnzentrale führen (M17/N16).
        criticalCount: state.plannerErrors.filter(
          (error) => error.severity === 'error' || error.severity === 'critical'
        ).length,
        warningCount: state.plannerErrors.filter((error) => error.severity === 'warning').length,
        infoCount: state.plannerErrors.filter((error) => error.severity === 'info').length,
      };
    })
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
      {/* Die Zeigerkoordinaten gibt es erst ab 1024 px: Die Zeile hatte sonst
          539 px Inhalt in einem 375-px-Fenster (gemessen 2026-10-14) und war
          zusätzlich eine waagerechte Scroll-Fläche mit versteckter Leiste —
          der Prüfstand am rechten Rand lag außerhalb des Bildes. */}
      <span
        ref={coordsRef}
        data-testid="statusbar-coords"
        className="cad-statusbar__opt cad-statusbar__opt--coords"
      >
        x — · y —
      </span>
      <span className="cad-statusbar__sep cad-statusbar__opt cad-statusbar__opt--coords" />
      <span>
        {/* Unter 360 px ist „15 Bauteile · 23 Leitungen“ 150 px Text in einer
            Zeile, die nur 320 px hat (gemessen: Zeile 355 px, rechter Rand
            abgeschnitten). Dann steht dort die Kurzform. Beide Fassungen
            liegen im DOM — die lange bleibt der Vertrag von
            `PlannerStatusBar.test.tsx` (Testing Library findet auch
            ausgeblendete Elemente), die kurze ist eine Anzeige-Variante. */}
        <span className="cad-statusbar__long">
          {nodeCount} Bauteile · {edgeCount} Leitungen
        </span>{' '}
        <span className="cad-statusbar__short">
          {nodeCount} Bt · {edgeCount} Lt
        </span>
      </span>
      {/* Eine Rangfolge statt waagerechtem Scrollen: Der Planumfang und die
          Zoomstufe stehen immer, der Prüfstand am rechten Rand ebenfalls (er
          ist die sicherheitsrelevante Aussage). Domäne, Raster und Snap kommen
          erst ab 1280 px dazu — dort ist die Zeile 1032 px breit und passt
          (gemessen), darunter bliebe der Prüfstand unsichtbar. */}
      <span className="cad-statusbar__sep cad-statusbar__opt cad-statusbar__opt--facts" />
      <span className="cad-statusbar__opt cad-statusbar__opt--facts">
        {viewMode === 'water' ? 'Brauch-/Grauwasser' : dcLabel}
      </span>
      <span className="cad-statusbar__sep cad-statusbar__opt cad-statusbar__opt--facts" />
      <span className="cad-statusbar__opt cad-statusbar__opt--facts">Raster {gridMm} mm</span>
      <span className="cad-statusbar__sep cad-statusbar__opt cad-statusbar__opt--facts" />
      <span>Zoom {Math.round(zoom * 100)} %</span>
      <span className="cad-statusbar__sep cad-statusbar__opt cad-statusbar__opt--facts" />
      <span className="cad-statusbar__opt cad-statusbar__opt--facts">Snap aktiv</span>
      <span className="cad-statusbar__sep" />
      {criticalCount > 0 ? (
        <span className="cad-statusbar__signal">
          {criticalCount} kritisch
          {warningCount + infoCount > 0 && (
            <span className="hidden md:inline">
              {' · '}
              {[
                warningCount > 0 ? (warningCount === 1 ? '1 Warnung' : `${warningCount} Warnungen`) : null,
                infoCount > 0 ? (infoCount === 1 ? '1 Hinweis' : `${infoCount} Hinweise`) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </span>
      ) : warningCount > 0 ? (
        <span className="text-warning">
          {warningCount === 1 ? '1 Warnung' : `${warningCount} Warnungen`}
          {infoCount > 0 && (
            <span className="hidden sm:inline">
              {' · '}
              {infoCount === 1 ? '1 Hinweis' : `${infoCount} Hinweise`}
            </span>
          )}
          <span className="hidden md:inline"> · kein kritischer Fehler</span>
        </span>
      ) : infoCount > 0 ? (
        <span className="text-muted-foreground">
          {infoCount === 1 ? '1 Hinweis' : `${infoCount} Hinweise`}
          <span className="hidden md:inline"> · kein kritischer Fehler</span>
        </span>
      ) : (
        <span className="cad-statusbar__ok">Keine Hinweise</span>
      )}
    </div>
  );
}
