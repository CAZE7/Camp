import React from 'react';
import { type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../edges/CableEdge';
import { ValidatingInput, COMMON_RULES } from '../ui/ValidatingInput';
import { FUSE_MAP } from '../../lib/electrical';

export interface EdgeInspectorProps {
  edge: Edge<CableEdgeData>;
  onChangeLength: (id: string, length: number) => void;
  onChangeFuseSize?: (id: string, fuseSize: number) => void;
  /** AUDIT ELE-004: Position der Sicherung ab Batteriepol (m). */
  onChangeFuseOffset?: (id: string, fuseOffset: number) => void;
}

export function EdgeInspector({
  edge,
  onChangeLength,
  onChangeFuseSize,
  onChangeFuseOffset,
}: EdgeInspectorProps) {
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
              Max. {maxFuse} A nach implementierter Regel (abgeleitet aus der Strombelastbarkeit von{' '}
              {storedCs} mm² mit 0,7-Derating).
            </p>
          )}
        </div>
      )}
      {/* AUDIT ELE-004: Position der Sicherung — ohne diese Angabe gilt eine
          vorhandene Sicherung als „am Pol sitzend" (≤ 20 cm ungeschützt). */}
      {!isAc && onChangeFuseOffset && edge.data?.fuseSize !== undefined && (
        <div className="flex flex-col">
          <label
            className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            htmlFor="fuse-offset-input"
          >
            Abstand Sicherung → Batteriepol (m)
          </label>
          <ValidatingInput
            id="fuse-offset-input"
            type="number"
            min="0"
            max="1"
            step="0.05"
            isFloat={true}
            value={edge.data?.fuseOffset ?? 0}
            rules={[COMMON_RULES.positive]}
            onValidChange={(val) => onChangeFuseOffset(edge.id, val)}
            className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Die Hauptsicherung soll möglichst direkt am Batteriepol sitzen (ISO 10133 / ABYC E-11:
            ungeschützte Strecke ≤ 0,2 m).
          </p>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Der Kabelquerschnitt wird automatisch nach den implementierten Regeln (thermische Belastbarkeit +
        Spannungsfall) berechnet und an der Leitung im Planer angezeigt — keine normengeprüfte Auslegung.
      </p>
    </div>
  );
}
