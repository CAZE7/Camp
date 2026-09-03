import React from 'react';
import { type Edge } from 'reactflow';
import { type CableEdgeData } from '../edges/CableEdge';
import { ValidatingInput, COMMON_RULES } from '../ui/ValidatingInput';
import { FUSE_MAP } from '../../lib/electrical';

export interface EdgeInspectorProps {
  edge: Edge<CableEdgeData>;
  onChangeLength: (id: string, length: number) => void;
  onChangeFuseSize?: (id: string, fuseSize: number) => void;
}

export function EdgeInspector({ edge, onChangeLength, onChangeFuseSize }: EdgeInspectorProps) {
  const isAc = edge.data?.edgeDomain === 'AC_230V';
  const storedCs = edge.data?.crossSection;
  // Bewusst kein calculateMaxFuse: das wirft für Nicht-Normquerschnitte aus
  // alten gespeicherten Plänen (z. B. 3 mm²) einen RangeError und ließ den
  // Inspector crashen. Unbekannte Werte ergeben 0 → kein Hinweis, kein Absturz.
  const maxFuse = typeof storedCs === 'number' && FUSE_MAP[storedCs] !== undefined ? FUSE_MAP[storedCs] : 0;

  return (
    <div className="flex flex-col space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Kabel</h3>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          htmlFor="length-input"
        >
          Länge (m)
        </label>
        <ValidatingInput
          id="length-input"
          type="number"
          min="0.1"
          step="0.1"
          isFloat={true}
          value={edge.data?.length ?? 3}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onChangeLength(edge.id, val)}
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {!isAc && onChangeFuseSize && (
        <div className="flex flex-col">
          <label
            className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            htmlFor="fuse-input"
          >
            Sicherung (A)
          </label>
          <ValidatingInput
            id="fuse-input"
            type="number"
            min="0"
            value={edge.data?.fuseSize ?? 0}
            rules={[COMMON_RULES.positive]}
            onValidChange={(val) => onChangeFuseSize(edge.id, val)}
            className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {maxFuse > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Max. {maxFuse} A laut VDE 0298-4 bei {storedCs} mm².
            </p>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Der Kabelquerschnitt wird automatisch nach VDE 0100-721 berechnet und an der Leitung im Planer
        angezeigt.
      </p>
    </div>
  );
}
