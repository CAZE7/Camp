import React from 'react';
import { type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../edges/CableEdge';
import { ValidatingInput, COMMON_RULES } from '../ui/ValidatingInput';
import { FUSE_MAP } from '../../lib/electrical';
import {
  FUSE_BREAKING_CAPACITY_A,
  FUSE_TYPE_LABELS,
  FUSE_TYPES,
  isFuseType,
  type FuseType,
} from '../../lib/shortCircuit';

export interface EdgeInspectorProps {
  edge: Edge<CableEdgeData>;
  onChangeLength: (id: string, length: number) => void;
  onChangeFuseSize?: (id: string, fuseSize: number) => void;
  /** AUDIT ELE-004: Position der Sicherung ab Batteriepol (m). */
  onChangeFuseOffset?: (id: string, fuseOffset: number) => void;
  /** AUDIT DOM-002: Bauform der Sicherung (Abschaltvermögens-Check). */
  onChangeFuseType?: (id: string, fuseType: string | undefined) => void;
}

export function EdgeInspector({
  edge,
  onChangeLength,
  onChangeFuseSize,
  onChangeFuseOffset,
  onChangeFuseType,
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
            Die Hauptsicherung soll möglichst direkt am Batteriepol sitzen — ungeschützte Strecke ≤ 0,2 m (ISO
            10133:2000 §8.1 = 200 mm; ABYC E-11: 7 in = 178 mm).
          </p>
        </div>
      )}
      {/* AUDIT DOM-002: Bauform → typisches Abschaltvermögen (kA) für den
          Kurzschluss-Check der Live-Validierung. Ohne Bauform bleibt der
          Check offen und meldet sich als Hinweis. */}
      {!isAc && onChangeFuseType && edge.data?.fuseSize !== undefined && (
        <div className="flex flex-col">
          <label
            className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            htmlFor="fuse-type-select"
          >
            Sicherungs-Bauform
          </label>
          <select
            id="fuse-type-select"
            value={isFuseType(edge.data?.fuseType) ? (edge.data?.fuseType as FuseType) : ''}
            onChange={(e) => onChangeFuseType(edge.id, e.target.value === '' ? undefined : e.target.value)}
            className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— nicht angegeben —</option>
            {FUSE_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {FUSE_TYPE_LABELS[ft]} (
                {ft === 'mrbf'
                  ? '≈ 10 kA @ 12 V / 5 kA @ 24 V'
                  : `≈ ${(FUSE_BREAKING_CAPACITY_A[ft] / 1000).toLocaleString('de-DE')} kA`}
                )
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Abschaltvermögen der Bauform nach Hersteller-Datenblatt (Littelfuse/Blue Sea; MRBF
            spannungsabhängig). Danach prüft der Planer, ob die Sicherung den geschätzten Kurzschlussstrom der
            Batteriebank trennen kann.
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
