import React from 'react';
import { type Edge } from '@xyflow/react';
import { InspectorSection } from './InspectorSection';
import { type CableEdgeData } from '../edges/CableEdge';
import { useCableRoute } from '../edges/utils/cableRouteStore';
import { PX_PER_METER } from '../../lib/units';
import { ValidatingInput, COMMON_RULES } from '../ui/ValidatingInput';
import { FUSE_MAP } from '../../lib/electrical';
import { FUSE_BREAKING_CAPACITY_A, FUSE_TYPE_LABELS, FUSE_TYPES, isFuseType } from '../../lib/shortCircuit';
import { edgeIntentOf } from '../../lib/electricalGraph/intent';
import { QUALIFIED_PERSONNEL_NOTICE } from '../../lib/verify/acScope';
import {
  CABLE_INSULATION_LABELS,
  CABLE_INSTALLATION_CONDITIONS,
  cableIzFor,
  maxFuseForConditions,
  resolveCableConditions,
  type CableConditionFields,
  type CableConditionPatch,
} from '../../lib/cableConditions';
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
  /** Konventioneller Auslösestrom I₂ (A) aus dem Datenblatt des Produkts. */
  onChangeFuseI2?: (id: string, i2A: number) => void;
  /** AUDIT DOM-001: AC-Schutzorgan (LS/RCBO, Charakteristik, Icn). */
  onChangeAcProtection?: (id: string, acProtection: AcProtectionDescriptor | undefined) => void;
  /** V2-INTENT-002: Verbindlichkeit der Leitung gegenüber der Automatik. */
  onChangeIntent?: (id: string, intent: 'auto' | 'user' | 'locked') => void;
  /** P0-3: auswählbare Verlegebedingungen (Temperatur, Bündelung, Leitungstyp). */
  onChangeCableConditions?: (id: string, patch: CableConditionPatch) => void;
}

/**
 * Die drei Stufen, die der Nutzer von Hand setzen darf.
 *
 * `required` (Regel) und `suggested` (Vorschlag) fehlen bewusst: Beides sind
 * Aussagen des Systems über sich selbst. Könnte man sie hier wählen, hieße
 * das, eine Regel per Klick zu behaupten.
 */
const INTENT_CHOICES: { value: 'auto' | 'user' | 'locked'; label: string; hint: string }[] = [
  {
    value: 'auto',
    label: 'Automatik',
    hint: 'Die Auto-Verdrahtung darf diese Leitung umbauen oder ersetzen.',
  },
  {
    value: 'user',
    label: 'Meine Entscheidung',
    hint: 'Topologie bleibt, wie du sie gezogen hast. Widerspricht sie einer Regel, erscheint eine Warnung — geändert wird nichts.',
  },
  {
    value: 'locked',
    label: 'Fixiert',
    hint: 'Zusätzlich bleibt der Kabelweg unverändert: Das Routing rechnet um diese Leitung herum.',
  },
];

export function EdgeInspector({
  edge,
  onChangeLength,
  onChangeFuseSize,
  onChangeFuseOffset,
  onChangeFuseType,
  onChangeFuseI2,
  onChangeAcProtection,
  onChangeIntent,
  onChangeCableConditions,
}: EdgeInspectorProps) {
  // Die angezeigte Stufe kommt aus DERSELBEN Ableitung, die AutoWire und
  // Routing lesen (`edgeIntentOf`) — nicht aus einem zweiten Feldvergleich im
  // UI. Sonst zeigte der Inspector „Automatik", während AutoWire die Kante
  // längst als Nutzerkante behandelt. `required`/`suggested` fallen für die
  // Anzeige auf die nächstliegende wählbare Stufe zurück.
  const intent = edgeIntentOf(edge);
  const selectedIntent: 'auto' | 'user' | 'locked' =
    intent === 'locked' ? 'locked' : intent === 'auto' || intent === 'suggested' ? 'auto' : 'user';
  const isAc = edge.data?.edgeDomain === 'AC_230V';
  const storedCs = edge.data?.crossSection;
  // P0-3: Verlegebedingungen dieser Leitung — EINE Ableitung für Anzeige,
  // AutoWire-Sizing und Prüfbericht. Ein ungültiger Importwert wird als
  // Fehler gezeigt, nicht still auf 30 °C zurückgesetzt.
  const conditionFields: CableConditionFields = {
    installationCondition: edge.data?.installationCondition,
    ambientC: edge.data?.ambientC,
    bundledCircuits: edge.data?.bundledCircuits,
    cableInsulation: edge.data?.cableInsulation,
    manufacturerIzA: edge.data?.manufacturerIzA,
  };
  let cableConditions: ReturnType<typeof resolveCableConditions> | null = null;
  let conditionError = '';
  try {
    cableConditions = resolveCableConditions(conditionFields);
  } catch (error) {
    conditionError = error instanceof Error ? error.message : String(error);
  }
  const hasOwnConditions = cableConditions !== null && cableConditions.kind !== 'reference';
  let conditionIz: number | null = null;
  let conditionMaxFuse: number | null = null;
  if (cableConditions && typeof storedCs === 'number' && storedCs > 0) {
    try {
      conditionIz = cableIzFor(storedCs, cableConditions).correctedIz;
      conditionMaxFuse = maxFuseForConditions(storedCs, cableConditions);
    } catch {
      conditionIz = null;
    }
  }
  const patchConditions = (patch: CableConditionPatch) => onChangeCableConditions?.(edge.id, patch);
  // R1: Ohne eingetragene Länge zeigt das Feld die geroutete Verlegelänge
  // (dieselbe Quelle wie das Kanten-Label) statt einer fiktiven Konstante.
  // Beim Drag des Plans ändert sich die Schätzung live (gedrosselt).
  const globalRoute = useCableRoute(edge.id);
  const lengthEstimateM =
    globalRoute !== undefined ? Math.round((globalRoute.length / PX_PER_METER) * 10) / 10 : undefined;
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
  // Polzahl: ein FI/LS ist bauartbedingt zweipolig; ein LS ist ohne Angabe
  // unbekannt (RCD-004). Der Wert ist im Inspektor pflegbar.
  const acPoles =
    edge.data?.acProtection?.poles === 1 || edge.data?.acProtection?.poles === 2
      ? edge.data.acProtection.poles
      : edge.data?.acProtection?.kind === 'rcbo'
        ? 2
        : '';
  const acResidual =
    edge.data?.acProtection?.residualType === 'AC' ||
    edge.data?.acProtection?.residualType === 'A' ||
    edge.data?.acProtection?.residualType === 'F' ||
    edge.data?.acProtection?.residualType === 'B'
      ? edge.data.acProtection.residualType
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
  const updateAcProtection = (patch: Partial<AcProtectionDescriptor>) => {
    const current = edge.data?.acProtection;
    if (!current) return;
    setAcProtection({ ...current, ...patch });
  };

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
      <InspectorSection title="Allgemein" defaultOpen>
        <div className="flex flex-col gap-3">
          {/* V2-INTENT-002: Vorher gab es keinen Weg, eine bewusste Entscheidung
          zu erklären — jeder Auto-Wire-Lauf konnte sie einsammeln. */}
          {onChangeIntent && (
            <fieldset className="flex flex-col">
              <legend className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Verbindlichkeit
              </legend>
              <div role="radiogroup" aria-label="Verbindlichkeit" className="flex gap-1">
                {INTENT_CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    role="radio"
                    data-testid={`edge-intent-${choice.value}`}
                    aria-checked={selectedIntent === choice.value}
                    title={choice.hint}
                    onClick={() => onChangeIntent(edge.id, choice.value)}
                    className="min-h-11 flex-1 rounded border border-border px-2 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-checked:border-accent aria-checked:bg-accent aria-checked:text-foreground"
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {INTENT_CHOICES.find((choice) => choice.value === selectedIntent)?.hint}
              </p>
            </fieldset>
          )}
          <div className="flex flex-col">
            <label
              className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
              htmlFor="length-input"
            >
              Länge (m)
            </label>
            <ValidatingInput
              id="length-input"
              min="0.1"
              step="0.1"
              isFloat={true}
              value={edge.data?.length ?? lengthEstimateM ?? 3}
              rules={[COMMON_RULES.strictlyPositive]}
              onValidChange={(val) => onChangeLength(edge.id, val)}
              className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
            />
            {typeof edge.data?.length !== 'number' && (
              <p className="mt-1 text-xs text-muted-foreground">
                Geschätzt aus dem gerouteten Verlegeweg (inkl. Umwege, nicht Luftlinie) — ein eigener Wert
                überschreibt die Schätzung dauerhaft.
              </p>
            )}
            {typeof edge.data?.length === 'number' && edge.data.lengthIsAssumption === true && (
              <p className="mt-1 text-xs text-muted-foreground">
                Planungsannahme aus der Vorlage (kein Messwert) — nach dem Verlegen den echten Wert eintragen;
                er überschreibt die Annahme dauerhaft.
              </p>
            )}
          </div>
        </div>
      </InspectorSection>
      <InspectorSection title="Anschluss" defaultOpen>
        <div className="flex flex-col gap-3">
          {!isAc && onChangeFuseSize && (
            <div className="flex flex-col">
              <label
                className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                htmlFor="fuse-input"
              >
                Sicherung (A)
              </label>
              <ValidatingInput
                isFloat
                id="fuse-input"
                min="0"
                value={edge.data?.fuseSize ?? 0}
                rules={[COMMON_RULES.positive]}
                onValidChange={(val) => onChangeFuseSize(edge.id, val)}
                className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
              />
              {maxFuse > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Max. {maxFuse} A nach implementierter Regel (abgeleitet aus der Strombelastbarkeit von{' '}
                  {storedCs} mm² mit {hasOwnConditions ? 'den gewählten Verlegebedingungen' : '0,7-Derating'}
                  ).
                </p>
              )}
            </div>
          )}
          {/* AUDIT ELE-004: Position der Sicherung — ohne diese Angabe gilt eine
          vorhandene Sicherung als „am Pol sitzend" (≤ 20 cm ungeschützt). */}
          {!isAc && onChangeFuseOffset && edge.data?.fuseSize !== undefined && (
            <div className="flex flex-col">
              <label
                className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                htmlFor="fuse-offset-input"
              >
                Abstand Sicherung → Batteriepol (m)
              </label>
              <ValidatingInput
                id="fuse-offset-input"
                min="0"
                max="1"
                step="0.05"
                isFloat={true}
                value={edge.data?.fuseOffset ?? 0}
                rules={[COMMON_RULES.positive]}
                onValidChange={(val) => onChangeFuseOffset(edge.id, val)}
                className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Die Hauptsicherung soll möglichst direkt am Batteriepol sitzen — ungeschützte Strecke ≤ 0,2 m
                (ISO 10133:2000 §8.1 = 200 mm; ABYC E-11: 7 in = 178 mm).
              </p>
            </div>
          )}
          {/* AUDIT DOM-002: Bauform → typisches Abschaltvermögen (kA) für den
          Kurzschluss-Check der Live-Validierung. Ohne Bauform bleibt der
          Check offen und meldet sich als Hinweis. */}
          {!isAc && onChangeFuseType && edge.data?.fuseSize !== undefined && (
            <div className="flex flex-col">
              <label
                className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                htmlFor="fuse-type-select"
              >
                Sicherungs-Bauform
              </label>
              <select
                id="fuse-type-select"
                value={isFuseType(edge.data?.fuseType) ? edge.data?.fuseType : ''}
                onChange={(e) =>
                  onChangeFuseType(edge.id, e.target.value === '' ? undefined : e.target.value)
                }
                className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
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
                spannungsabhängig). Danach prüft der Planer, ob die Sicherung den geschätzten Kurzschlussstrom
                der Batteriebank trennen kann.
              </p>
            </div>
          )}
          {/* I₂-Koordination nach IEC 60364-4-43 §433.1: Für Bauformen ohne
          belegte Produktnorm (MIDI/MEGA/ANL/MRBF) ist der Datenblattwert die
          einzige ehrliche Grundlage — ohne ihn bleibt der Punkt offen. */}
          {!isAc && onChangeFuseI2 && edge.data?.fuseSize !== undefined && (
            <div className="flex flex-col">
              <label
                className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                htmlFor="fuse-i2-input"
              >
                Prüfstrom I₂ (A, Datenblatt)
              </label>
              <ValidatingInput
                isFloat
                id="fuse-i2-input"
                min="0"
                allowEmpty
                value={edge.data?.i2A ?? ''}
                rules={[COMMON_RULES.positive]}
                onValidChange={(val) => onChangeFuseI2(edge.id, val)}
                onEmptyChange={() => onChangeFuseI2(edge.id, 0)}
                className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Konventioneller Auslösestrom aus dem Datenblatt. Leer bzw. 0 = Produktnorm der Bauform (ATO
                und Class T sind belegt). Für MIDI/MEGA/ANL/MRBF ohne Datenblatt bleibt die I₂-Prüfung offen —
                der Planer erfindet keinen Wert.
              </p>
            </div>
          )}
          {/* AUDIT DOM-001: Die AC-„Sicherung" war ein Zahlenfeld ohne Bauform;
          jetzt LS/RCBO + Charakteristik (B/C) + Icn — mit Mehrleiter-
          Zusammensetzung (PE nach IEC 60364-5-54 Tab. 54.2) und
          Abschaltbedingungs-Schätzung (IEC 60364-4-41, 2/3-Regel). */}
          {isAc && onChangeAcProtection && (
            <div className="flex flex-col gap-3 rounded border border-border p-3">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Schutzorgan (230 V)
              </h4>

              {onChangeFuseSize && (
                <div className="flex flex-col">
                  <label
                    className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                    htmlFor="ac-fuse-input"
                  >
                    Bemessungsstrom In (A)
                  </label>
                  <ValidatingInput
                    isFloat
                    id="ac-fuse-input"
                    min="1"
                    value={edge.data?.fuseSize ?? 0}
                    rules={[COMMON_RULES.positive]}
                    onValidChange={(val) => onChangeFuseSize(edge.id, val)}
                    className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                  {maxFuse > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Max. {maxFuse} A nach implementierter Regel (aus der Strombelastbarkeit von {storedCs}{' '}
                      mm² mit 0,7-Derating).
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col">
                <label
                  className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
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
                      ...(edge.data?.acProtection ?? {}),
                      kind: value,
                      characteristic: acChar === '' ? 'B' : acChar,
                      breakingCapacityKA: acBic === '' ? 6 : acBic,
                    });
                  }}
                  className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
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
                      className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                      htmlFor="ac-char-select"
                    >
                      Charakteristik (IEC 60898-1)
                    </label>
                    <select
                      id="ac-char-select"
                      value={acChar === '' ? 'B' : acChar}
                      onChange={(event) =>
                        updateAcProtection({
                          characteristic: event.target.value as 'B' | 'C',
                        })
                      }
                      className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="B">B (3–5×In, Standard)</option>
                      <option value="C">C (5–10×In, induktive Lasten)</option>
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label
                      className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                      htmlFor="ac-bic-select"
                    >
                      Abschaltvermögen Icn
                    </label>
                    <select
                      id="ac-bic-select"
                      value={String(acBic === '' ? 6 : acBic)}
                      onChange={(event) =>
                        updateAcProtection({ breakingCapacityKA: Number(event.target.value) })
                      }
                      className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      {MCB_BREAKING_CAPACITY_KA_OPTIONS.map((ka) => (
                        <option key={ka} value={ka}>
                          {ka} kA
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label
                      className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                      htmlFor="ac-poles-select"
                    >
                      Polzahl
                    </label>
                    <select
                      id="ac-poles-select"
                      value={acPoles === '' ? '' : String(acPoles)}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateAcProtection({
                          poles: value === '' ? undefined : value === '1' ? 1 : 2,
                        });
                      }}
                      className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="">— nicht angegeben —</option>
                      <option value="1">1-polig (nur L)</option>
                      <option value="2">2-polig (L+N)</option>
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Für die Einspeisung fordert RCD-004 zwei Pole (L und N gemeinsam). Ohne Angabe bleibt
                      die Polzahl unbekannt.
                    </p>
                  </div>

                  {acKind === 'rcbo' && (
                    <div className="flex flex-col">
                      <label
                        className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                        htmlFor="ac-residual-select"
                      >
                        Fehlerstromtyp
                      </label>
                      <select
                        id="ac-residual-select"
                        value={acResidual}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateAcProtection({
                            residualType: value === '' ? undefined : (value as 'AC' | 'A' | 'F' | 'B'),
                          });
                        }}
                        className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
                      >
                        <option value="">— nicht angegeben —</option>
                        <option value="A">A (Standard)</option>
                        <option value="AC">AC</option>
                        <option value="F">F</option>
                        <option value="B">B (glatte Gleichfehlerströme)</option>
                      </select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Typ B ist für Wechselrichter-Inseln die belegte Wahl; Typ A/F braucht einen
                        Herstellernachweis, Typ AC ist unzureichend.
                      </p>
                    </div>
                  )}
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
                      {tripAssessment.zsMaxOhm?.toFixed(2).replace('.', ',')} Ω · Leitungsanteil ≈{' '}
                      {tripAssessment.cableLoopOhm.toFixed(2).replace('.', ',')} Ω (Annahme vorgelagert ≈{' '}
                      {String(UPSTREAM_IMPEDANCE_ASSUMPTION_OHM).replace('.', ',')} Ω ohne FI-Deckung — die
                      Plan-Hinweise werten die tatsächliche Speisung mit FI-Feld aus).
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground" data-testid="edge-230v-scope-note">
                Modellgrenze (NET-003): Diese Felder beschreiben EIN Schutzorgan im Single-Line-Modell.
                Zweipolige Trennung als reales Gerät, Umschaltung, Rückspeiseschutz und der PE-Anschluss zur
                Karosserie sind nicht modelliert und nicht überprüfbar. {QUALIFIED_PERSONNEL_NOTICE}
              </p>
            </div>
          )}
        </div>
      </InspectorSection>
      {/* P0-3: auswählbare Verlegebedingungen. Kein neuer Pauschalfaktor:
          Es werden nur die dokumentierten f₁/f₂ der einen I_z-Rechnung je
          Leitung gesetzt. */}
      <InspectorSection title="Verlegebedingungen">
        <div className="flex flex-col gap-3">
          {onChangeCableConditions ? (
            <>
              <div className="flex flex-col">
                <label
                  className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                  htmlFor="cable-condition-select"
                >
                  Einbausituation
                </label>
                <select
                  id="cable-condition-select"
                  value={conditionFields.installationCondition ?? 'reference'}
                  onChange={(event) =>
                    patchConditions(
                      event.target.value === 'reference'
                        ? { reset: true }
                        : { installationCondition: event.target.value }
                    )
                  }
                  className="rounded border border-border bg-background px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  {Object.values(CABLE_INSTALLATION_CONDITIONS).map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="custom">Eigene Werte (Temperatur / Bündelung / Leitungstyp)</option>
                  <option value="datasheet">Herstellerangabe I_z aus Datenblatt</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cableConditions?.label ?? '—'} ·{' '}
                  {cableConditions?.assessment === 'manufacturer-data'
                    ? 'Herstellerangabe hinterlegt'
                    : cableConditions?.assessment === 'assumption-based'
                      ? 'mit Annahmen bewertet'
                      : 'rechnerisch mit Referenzmodell bewertet'}
                  . Datengrundlage: docs/KABEL-VERLEGEBEDINGUNGEN.md. Keine normgeprüfte Auslegung.
                </p>
              </div>

              {(conditionFields.installationCondition === 'custom' ||
                conditionFields.installationCondition === 'datasheet') && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <label className="mb-1 text-xs text-muted-foreground" htmlFor="cable-ambient-input">
                      Umgebung (°C)
                    </label>
                    <ValidatingInput
                      id="cable-ambient-input"
                      isFloat
                      step="1"
                      value={conditionFields.ambientC ?? 30}
                      rules={[
                        { validate: (v) => v > -40 && v < 90, message: 'Temperatur zwischen −40 und 90 °C.' },
                      ]}
                      onValidChange={(val) => patchConditions({ ambientC: val })}
                      className="rounded border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-1 text-xs text-muted-foreground" htmlFor="cable-bundle-input">
                      Stromkreise im Bündel (1–9)
                    </label>
                    <ValidatingInput
                      id="cable-bundle-input"
                      step="1"
                      value={conditionFields.bundledCircuits ?? 1}
                      rules={[
                        {
                          validate: (v) => Number.isInteger(v) && v >= 1 && v <= 9,
                          message: 'Ganze Zahl 1…9.',
                        },
                      ]}
                      onValidChange={(val) => patchConditions({ bundledCircuits: val })}
                      className="rounded border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="col-span-2 flex flex-col">
                    <label className="mb-1 text-xs text-muted-foreground" htmlFor="cable-insulation-select">
                      Fahrzeugleitung
                    </label>
                    <select
                      id="cable-insulation-select"
                      value={conditionFields.cableInsulation ?? 'FLRY-B'}
                      onChange={(event) => patchConditions({ cableInsulation: event.target.value })}
                      className="rounded border border-border bg-background px-3 py-2 text-sm"
                    >
                      {Object.entries(CABLE_INSULATION_LABELS).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {conditionFields.installationCondition === 'datasheet' && (
                    <div className="col-span-2 flex flex-col">
                      <label className="mb-1 text-xs text-muted-foreground" htmlFor="cable-datasheet-iz">
                        I_z laut Datenblatt (A)
                      </label>
                      <ValidatingInput
                        id="cable-datasheet-iz"
                        isFloat
                        step="1"
                        value={conditionFields.manufacturerIzA ?? 0}
                        rules={[COMMON_RULES.strictlyPositive]}
                        onValidChange={(val) => patchConditions({ manufacturerIzA: val })}
                        className="rounded border border-border px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {conditionError && (
                <p className="text-xs text-destructive" role="alert">
                  {conditionError}
                </p>
              )}
              {!conditionError && conditionIz !== null && (
                <p className="text-xs text-muted-foreground">
                  I_z für {storedCs} mm²:{' '}
                  <strong className="text-foreground">{conditionIz.toFixed(1).replace('.', ',')} A</strong>
                  {conditionMaxFuse !== null && ` · größte zulässige Sicherung ${conditionMaxFuse} A`}.
                </p>
              )}
              {!conditionError && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Rechenweg und Datengrundlage</summary>
                  <p className="mt-1">{cableConditions?.explanation}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {cableConditions?.basis.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                    {cableConditions?.assumptions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Verlegebedingungen sind in dieser Ansicht nicht editierbar.
            </p>
          )}
        </div>
      </InspectorSection>
      <InspectorSection title="Berechnung">
        <div className="flex flex-col gap-3">
          <p className="mt-2 text-xs text-muted-foreground">
            Der Kabelquerschnitt wird automatisch nach den implementierten Regeln (thermische Belastbarkeit +
            Spannungsfall) berechnet und an der Leitung im Planer angezeigt — keine normengeprüfte Auslegung.
          </p>
        </div>
      </InspectorSection>
    </div>
  );
}
