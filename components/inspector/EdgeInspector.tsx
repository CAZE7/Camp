import React from 'react';
import { Edge } from 'reactflow';
import { CableEdgeData } from '../edges/CableEdge';
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
      <h3 className="font-semibold text-foreground text-sm">Kabel</h3>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
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
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      {!isAc && onChangeFuseSize && (
        <div className="flex flex-col">
          <label
            className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
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
            className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
          />
          {maxFuse > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Max. {maxFuse} A laut VDE 0298-4 bei {storedCs} mm².
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Der Kabelquerschnitt wird automatisch nach VDE 0100-721 berechnet und an der Leitung im Planer
        angezeigt.
      </p>
    </div>
  );
}
