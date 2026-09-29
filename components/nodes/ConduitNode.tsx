'use client';
import React, { useMemo } from 'react';
import { Handle, Position, useEdges } from '@xyflow/react';
import type { ConduitNodeData } from './types';
import { type CableEdgeData } from '../edges/CableEdge';
import { conduitFillOutcome, type ConduitFillOutcome } from '@/lib/verify';
import { NodeSymbol } from './NodeSymbol';

/**
 * Füllgrad-Anzeige — gerechnet von der Verifikations-Engine.
 *
 * Die Karte rechnet NICHTS selbst: Sie sammelt die Querschnitte der
 * zugeordneten Kabel (so, wie sie im Plan stehen) und lässt
 * `conduitFillOutcome` entscheiden, was daraus folgt. Damit zeigt die Karte
 * dieselbe Zahl wie die Warn-Zentrale und die Prüfung — eine Quelle.
 *
 * Vorher stand hier ein Ersatzwert: Fehlte `crossSection`, rechnete die Karte
 * stillschweigend mit 2,5 mm² weiter und zeigte einen Füllgrad, den niemand
 * gemessen hatte. Ist der Rohrtyp unbekannt oder fehlt einem zugeordneten
 * Kabel der Querschnitt, steht jetzt „nicht bewertet“ mit Begründung statt
 * einer erfundenen Prozentzahl (Regel M — keine stille Annahme).
 */
const ConduitNode = function ({ data, selected }: { id: string; data: ConduitNodeData; selected?: boolean }) {
  const edges = useEdges();

  /** Rohrtyp, wie er im Plan steht — fehlt er, wird NICHTS angenommen. */
  const declaredType =
    typeof data.conduitType === 'string' && data.conduitType.trim() !== '' ? data.conduitType : null;
  // Referenzstabil über Renders mit gleichem data.assignedEdges — ohne dieses
  // Memo wäre das Füllgrad-Memo bei jedem Render invalidiert (neues []-Array).
  const assignedEdgeIds = useMemo(() => data.assignedEdges || [], [data.assignedEdges]);

  const fill: ConduitFillOutcome = useMemo(() => {
    const assignedEdgeIdsSet = new Set(assignedEdgeIds);
    // Persistenzgrenze: `crossSection` kommt aus dem Store. Fehlt oder taugt
    // der Wert nicht, wird er als FEHLEND übergeben — nicht ersetzt.
    const crossSections: Array<number | null> = edges
      .filter((e) => assignedEdgeIdsSet.has(e.id))
      .map((edge) => {
        const raw = (edge.data as CableEdgeData | undefined)?.crossSection;
        return typeof raw === 'number' ? raw : null;
      });

    return conduitFillOutcome(declaredType, crossSections);
  }, [declaredType, assignedEdgeIds, edges]);

  const overfilled = fill.kind === 'known' && fill.overfilled;
  const percentage = fill.kind === 'known' ? fill.percent : null;

  return (
    <div
      role="group"
      aria-label={`${data.label || 'Leerrohr'} (${declaredType ?? 'Typ nicht angegeben'}).${
        percentage === null ? ' Füllgrad nicht bewertet.' : ` Füllgrad ${percentage.toFixed(1)} Prozent.`
      } Komponente im Plan.`}
      data-selected={selected || undefined}
      className={`node-card custom-drag-handle w-64 p-3 ${overfilled ? 'node-card--error bg-warn-critical-bg' : ''} ${
        selected ? 'node-card--selected' : ''
      }`}
    >
      <NodeSymbol kind="conduit" />

      <div className="mb-2 text-center text-sm font-bold text-foreground">
        {data.label || 'Leerrohr'} ({declaredType ?? 'Typ nicht angegeben'})
      </div>

      <div className="measure mb-2 text-xs text-muted-foreground">
        Zugewiesene Kabel: {assignedEdgeIds.length}
      </div>

      <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full border border-border bg-accent">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${overfilled ? 'bg-warn-critical' : 'bg-moss'}`}
          style={{ width: `${percentage === null ? 0 : Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="mb-2 text-right font-mono text-xs">
        {percentage === null ? 'Füllgrad: nicht bewertet' : `Füllgrad: ${percentage.toFixed(1)}%`}
      </div>

      {overfilled && (
        <div className="mt-2 rounded bg-warn-critical p-2 text-xs font-bold leading-tight text-on-signal">
          Kanal überfüllt! Gefahr durch Hitzestau in der Kabelbündelung.
          {fill.kind === 'known' && fill.recommendedType ? (
            <span className="mt-1 block">Bitte mindestens {fill.recommendedType} Rohr verwenden.</span>
          ) : (
            <span className="mt-1 block">Bitte ein größeres Leerrohr verwenden.</span>
          )}
        </div>
      )}

      {fill.kind === 'unknown-type' && (
        <div className="mt-2 rounded border border-border bg-accent p-2 text-xs leading-tight text-muted-foreground">
          {declaredType === null
            ? 'Für dieses Leerrohr ist kein Typ hinterlegt — der Füllgrad lässt sich nicht bestimmen.'
            : `Für den Typ „${declaredType}“ gibt es keinen Innendurchmesser in der Tabelle (EN 20, EN 25, EN 32, EN 40, EN 50) — der Füllgrad lässt sich nicht bestimmen.`}
        </div>
      )}

      {fill.kind === 'missing-cross-section' && (
        <div className="mt-2 rounded border border-border bg-accent p-2 text-xs leading-tight text-muted-foreground">
          Einem zugeordneten Kabel fehlt der Querschnitt — der Füllgrad wäre geraten und wird deshalb nicht
          angezeigt.
        </div>
      )}

      {/* Handles are required by ReactFlow even if we don't connect them explicitly */}
      <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0 }} isConnectable={false} />
      <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0 }} isConnectable={false} />
    </div>
  );
};

export default React.memo(ConduitNode);
