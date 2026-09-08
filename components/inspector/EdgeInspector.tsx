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
import {
  MCB_BREAKING_CAPACITY_KA_OPTIONS,
  UPSTREAM_IMPEDANCE_ASSUMPTION_OHM,
  acCableComposition,
  evaluateAcEdgeProtection,
  type AcProtectionDescriptor,
} from '../../lib/acProtection';

export interface EdgeInspectorProps {
  edge: Edge<CableEdgeData>;
  onChangeLength: (id: string, length: number) => void;
  onChangeFuseSize?: (id: string, fuseSize: number) => void;
  /** AUDIT ELE-004: Position der Sicherung ab Batteriepol (m). */
  onChangeFuseOffset?: (id: string, fuseOffset: number) => void;
  /** AUDIT DOM-002: Bauform der Sicherung (Abschaltvermögens-Check). */
  onChangeFuseType?: (id: string, fuseType: string | undefined) => void;
  /** AUDIT DOM-001: AC-Schutzorgan (LS/RCBO, Charakteristik, Icn). */
  onChangeAcProtection?: (id: string, acProtection: AcProtectionDescriptor | undefined) => void;
}

export function EdgeInspector({
  edge,
  onChangeLength,
  onChangeFuseSize,
  onChangeFuseOffset,
  onChangeFuseType,
  onChangeAcProtection,
}: EdgeInspectorProps) {
  const isAc = edge.data?.edgeDomain === 'AC_230V';
  const storedCs = edge.data?.crossSection;
  // Bewusst kein calculateMaxFuse: das wirft für Nicht-Normquerschnitte aus
  // alten gespeicherten Plänen (z. B. 3 mm²) einen RangeError und ließ den
  // Inspector crashen. Unbekannte Werte ergeben 0 → kein Hinweis, kein Absturz.
  const maxFuse = typeof storedCs === 'number' && FUSE_MAP[storedCs] !== undefined ? FUSE_MAP[storedCs] : 0;

  // AUDIT DOM-001: AC-Schutzorgan + Mehrleiter-Auswertung, live am Modell.
  const acKind =
    edge.data?.acProtection?.kind === 'mcb' || edge.data?.acProtection?.kind === 'rcbo'
      ? edge.data.acProtection.kind
      : '';
  const acChar =
    edge.data?.acProtection?.characteristic === 'B' || edge.data?.acProtection?.characteristic === 'C'
      ? edge.data.acProtection.characteristic
      : '';
  const acBic = MCB_BREAKING_CAPACITY_KA_OPTIONS.includes(Number(edge.data?.acProtection?.breakingCapacityKA))
    ? Number(edge.data?.acProtection?.breakingCapacityKA)
    : '';
  const acComposition = isAc && typeof storedCs === 'number' ? acCableComposition(storedCs) : null;
  const tripAssessment = isAc
    ? evaluateAcEdgeProtection({
        ratedCurrentA: Number(edge.data?.fuseSize),
        descriptor: edge.data?.acProtection,
        lengthM: typeof edge.data?.length === 'number' ? edge.data.length : undefined,
        crossSection: typeof storedCs === 'number' ? storedCs : undefined,
        // Woher gespeist (Landstrom/Wechselrichter) weiß die Live-Validierung
        // (A8) mit Knotenzugriff — der Inspektor bewertet die Kante pur
        // gegen die TN-Referenz, ohne FI-Deckung (ehrlich = konservativ).
        sourceKind: 'unknown',
        upstreamRcd: false,
      })
    : null;

  const setAcProtection = (acProtection: AcProtectionDescriptor | undefined) =>
    onChangeAcProtection?.(edge.id, acProtection);

  const tripVerdictTone =
    tripAssessment?.verdict === 'fail'
      ? 'text-signal font-semibold'
      : tripAssessment?.verdict === 'borderline'
        ? 'text-oxide'
        : tripAssessment?.verdict === 'rcd-covered'
          ? 'text-info'
          : tripAssessment?.verdict === 'ok-with-assumption'
            ? 'text-moss'
            : 'text-muted-foreground';

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
      {/* AUDIT DOM-001: Die AC-„Sicherung" war ein Zahlenfeld ohne Bauform;
          jetzt LS/RCBO + Charakteristik (B/C) + Icn — mit Mehrleiter-
          Zusammensetzung (PE nach IEC 60364-5-54 Tab. 54.2) und
          Abschaltbedingungs-Schätzung (IEC 60364-4-41, 2/3-Regel). */}
      {isAc && onChangeAcProtection && (
        <div className="flex flex-col gap-3 rounded border border-border p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Schutzorgan (230 V)
          </h4>

          {onChangeFuseSize && (
            <div className="flex flex-col">
              <label
                className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                htmlFor="ac-fuse-input"
              >
                Bemessungsstrom In (A)
              </label>
              <ValidatingInput
                id="ac-fuse-input"
                type="number"
                min="1"
                value={edge.data?.fuseSize ?? 0}
                rules={[COMMON_RULES.positive]}
                onValidChange={(val) => onChangeFuseSize(edge.id, val)}
                className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {maxFuse > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Max. {maxFuse} A nach implementierter Regel (aus der Strombelastbarkeit von {storedCs} mm²
                  mit 0,7-Derating).
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col">
            <label
              className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
              htmlFor="ac-kind-select"
            >
              Bauform
            </label>
            <select
              id="ac-kind-select"
              value={acKind}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '') {
                  setAcProtection(undefined);
                  return;
                }
                setAcProtection({
                  kind: value,
                  characteristic: acChar === '' ? 'B' : acChar,
                  breakingCapacityKA: acBic === '' ? 6 : acBic,
                });
              }}
              className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— nicht angegeben —</option>
              <option value="mcb">LS-Schalter (MCB)</option>
              <option value="rcbo">FI/LS (RCBO, 30 mA)</option>
            </select>
          </div>

          {acKind !== '' && (
            <>
              <div className="flex flex-col">
                <label
                  className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  htmlFor="ac-char-select"
                >
                  Charakteristik (IEC 60898-1)
                </label>
                <select
                  id="ac-char-select"
                  value={acChar === '' ? 'B' : acChar}
                  onChange={(event) =>
                    setAcProtection({
                      kind: acKind,
                      characteristic: event.target.value,
                      breakingCapacityKA: acBic === '' ? 6 : acBic,
                    })
                  }
                  className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="B">B (3–5×In, Standard)</option>
                  <option value="C">C (5–10×In, induktive Lasten)</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label
                  className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  htmlFor="ac-bic-select"
                >
                  Abschaltvermögen Icn
                </label>
                <select
                  id="ac-bic-select"
                  value={String(acBic === '' ? 6 : acBic)}
                  onChange={(event) =>
                    setAcProtection({
                      kind: acKind,
                      characteristic: acChar === '' ? 'B' : acChar,
                      breakingCapacityKA: Number(event.target.value),
                    })
                  }
                  className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {MCB_BREAKING_CAPACITY_KA_OPTIONS.map((ka) => (
                    <option key={ka} value={ka}>
                      {ka} kA
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {acComposition && (
            <p className="text-xs text-muted-foreground">
              Mehrleiter: <strong className="text-foreground">{acComposition.label}</strong> — L/N je{' '}
              {acComposition.phase} mm², PE = {acComposition.protectiveEarth} mm² (IEC 60364-5-54, Tabelle
              54.2).
            </p>
          )}

          {tripAssessment && (
            <div className={`text-xs ${tripVerdictTone}`}>
              <p>{tripAssessment.reason}</p>
              {tripAssessment.verdict !== 'not-modeled' && tripAssessment.iaA !== null && (
                <p className="mt-1 text-muted-foreground">
                  Ia = {Math.round(tripAssessment.iaA)} A · Zs zulässig ≤{' '}
                  {tripAssessment.zsMaxOhm?.toFixed(2)} Ω · Leitungsanteil ≈{' '}
                  {tripAssessment.cableLoopOhm.toFixed(2)} Ω (Annahme vorgelagert ≈{' '}
                  {UPSTREAM_IMPEDANCE_ASSUMPTION_OHM} Ω ohne FI-Deckung — die Plan-Hinweise werten die
                  tatsächliche Speisung mit FI-Feld aus).
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Der Kabelquerschnitt wird automatisch nach den implementierten Regeln (thermische Belastbarkeit +
        Spannungsfall) berechnet und an der Leitung im Planer angezeigt — keine normengeprüfte Auslegung.
      </p>
    </div>
  );
}
