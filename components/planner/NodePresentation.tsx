"use client";

import React from 'react';
import { Handle, Position } from 'reactflow';
import { NODE_DETAIL_LEVEL, FULL_DETAIL_LABELS } from './constants';

/**
 * NodePresentation – zentrale Node-Vorschau-Komponente.
 *
 * M8-1-resolution: Zoom-Stufen abgeschafft. Statt stufenweiser
 * Detailreduktion (Mini/Compact/Full) zeigt jeder Knoten immer
 * den vollständigen Detailgrad ("Full-Detail"). Die vorherigen
 * Zoom-abhängigen Conditional-Rendering-Blöcke wurden entfernt.
 *
 * Diese Komponente dient als Referenz-Schablone. Konkrete Node-
 * Implementierungen (BatteryNode, SolarNode, …) importieren die
 * Konstanten aus constants.ts und rendern gemäß
 * NODE_DETAIL_LEVEL === 'full' ohne stufenweises Ausblenden.
 */

interface NodePresentationProps {
  id: string;
  label: string;
  details: React.ReactNode;
  handles: React.ReactNode;
  selected?: boolean;
  borderColor?: string;
}

export default function NodePresentation({
  id,
  label,
  details,
  handles,
  selected,
  borderColor = 'border-gray-300',
}: NodePresentationProps) {
  // M8-1: Immer Full-Detail — kein Zoom-Level, kein stufenweises
  // Einblenden von Details. Alle Infos sind sichtbar.
  return (
    <div
      className={`custom-drag-handle bg-white border-2 rounded-md p-3 shadow-md w-48 
        ${selected ? 'ring-4 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : ''}
        ${borderColor}`}
    >
      {/* Label — immer sichtbar, auch bei kleiner Zoomstufe */}
      <div className="font-bold mb-2 text-sm text-center break-words">
        {label}
      </div>

      {/* Details — immer vollständig angezeigt (kein stufenweises Ausblenden) */}
      <div className="flex flex-col gap-1 text-xs text-gray-600 min-h-[3rem] overflow-visible">
        {details}
      </div>

      {/* Handles — sichtbar unabhängig von Zoom */}
      {handles}
    </div>
  );
}
