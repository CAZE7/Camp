/**
 * components/planner/AutoWireReviewModal.tsx — AUTO-WIRE REVIEW DIALOG (Spec #29).
 *
 * Zeigt den Vorschlag von `performAutoWiring`, BEVOR er angewendet wird:
 *
 *   - Anzahl sicherer Verbindungen (neu vorgeschlagen)
 *   - Anzahl vom Automaten geheilter Nutzerkanten (umgehängt)
 *   - Konflikte (Regelverstöße an gepinnten Kanten, Lastgrenze, Spannung …)
 *   - Offene Fragen (Batterietopologie, AC-Quelle)
 *   - Vorher/Nachher je Leitung: Querschnitt, Sicherung, Verlegebedingung und
 *     Begründung aus dem Vorschlag (`lib/autoWire/reviewDiff.ts`)
 *
 * Der Nutzer entscheidet mit drei Buttons:
 *   — »Anwenden«: Vorschlag in den Graphen schreiben (applyAutoWirePreview)
 *   — »Abbrechen«: Vorschlag verwerfen (dismissAutoWirePreview)
 *   — »Nur sichere anwenden«: Kritische Konflikte werden abgewählt; der
 *     sichere Teil wird angewendet. (Diese Version wendet alle nicht-kritischen
 *     Vorschläge an — kritische Befunde bleiben als Meldungen stehen; wir
 *     modifizieren den Vorschlag hier NICHT selbst, weil das eine zweite
 *     Logik-Schicht neben `performAutoWiring` hieße. Statt dessen warnen wir
 *     explizit und empfehlen Abbrechen bei kritischen Konflikten.)
 *
 * Barrierefreiheit: nutzt AccessibleDialog (Fokusfalle, Escape,
 * Fokus-Rückgabe); der Dialog hat `role="dialog"` und eine sichtbare
 * Beschreibung. Kritische Konflikte werden als `role="alert"` angekündigt.
 *
 * Schichten: reine UI-Komponente über dem Store — keine eigenen
 * Graph- oder Routing-Berechnungen.
 */

'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { usePlannerStore } from '../../store/usePlannerStore';
import { AlertTriangle, CheckCircle2, HelpCircle, Wrench, X, Zap } from 'lucide-react';
import type { AutoWireConflict, AutoWireReport } from '../../lib/autoWire/conflicts';
import {
  autoWireDiffSummary,
  autoWireEdgeDiff,
  type AutoWireDiffStatus,
  type AutoWireEdgeValues,
} from '../../lib/autoWire/reviewDiff';
import { toPlainGerman } from './utils/plainGerman';

type Summary = {
  safeNew: number;
  healed: number;
  dropped: number;
  warnings: number;
  critical: number;
  questions: number;
};

/** Zählt aus dem Report die für den Nutzer wichtigen Kennzahlen. */
function summarizeReport(report: AutoWireReport, previousEdgeCount: number, nextEdgeCount: number): Summary {
  const byKind = new Map<string, number>();
  for (const conflict of report.conflicts) {
    byKind.set(conflict.kind, (byKind.get(conflict.kind) ?? 0) + 1);
  }
  const critical = report.conflicts.filter((c) => c.severity === 'critical').length;
  const warnings = report.conflicts.filter((c) => c.severity !== 'critical').length;
  const healed = byKind.get('healed-user-edge') ?? 0;
  const dropped = byKind.get('dropped-user-edge') ?? 0;
  // „Neue sichere Verbindungen": Der Zuwachs an Kanten abzüglich der geheilten/
  // entfernten Kanten — die Zahlen, die der Nutzer unmittelbar auf der
  // Arbeitsfläche als neue Leitungen sieht.
  const delta = nextEdgeCount - previousEdgeCount + dropped;
  const safeNew = Math.max(0, delta);
  return {
    safeNew,
    healed,
    dropped,
    warnings,
    critical,
    questions: report.questions.length,
  };
}

const DIFF_STATUS_LABEL: Readonly<Record<AutoWireDiffStatus, string>> = {
  changed: 'geändert',
  new: 'neu',
  removed: 'entfernt',
  unchanged: 'unverändert',
};

/** Deutsche Zahl ohne `toLocaleString` — stabil in Tests und SSR. */
const decimal = (value: number): string => String(value).replace('.', ',');

/** Reine Anzeige der Werte EINER Leitung; keine elektrische Rechnung. */
function EdgeValues({ values }: { values: AutoWireEdgeValues | null }) {
  if (values === null) return <span>—</span>;
  return (
    <ul className="space-y-0.5">
      <li>Querschnitt: {values.crossSection === null ? '—' : `${decimal(values.crossSection)} mm²`}</li>
      <li>Sicherung: {values.fuseSize === null ? '—' : `${decimal(values.fuseSize)} A`}</li>
      <li>
        Bedingung: {values.conditionLabel} <span className="opacity-80">({values.assessment})</span>
      </li>
      <li>Domäne: {values.domainLabel}</li>
      {!values.valid && (
        <li className="font-semibold" style={{ color: 'var(--warn-critical)' }}>
          Nicht ausführbar
        </li>
      )}
    </ul>
  );
}

/**
 * Farb-Töne für Konflikte — nutzt zentrale Warn-Tokens (`--warn-*`) statt
 * Tailwind-Palettenklassen. Siehe lib/designTokens.test.ts D-1.
 */
const SEVERITY_STYLES: Readonly<
  Record<
    AutoWireConflict['severity'],
    {
      ring: string;
      boxStyle: React.CSSProperties;
      icon: React.ElementType;
      label: string;
      toneStyle: React.CSSProperties;
    }
  >
> = {
  critical: {
    ring: 'aw-tone aw-tone--critical',
    boxStyle: {
      background: 'var(--warn-critical-bg)',
      borderColor: 'var(--warn-critical-border)',
      color: 'var(--warn-critical)',
    },
    icon: AlertTriangle,
    label: 'Kritisch',
    toneStyle: { color: 'var(--warn-critical)' },
  },
  warning: {
    ring: 'aw-tone aw-tone--warning',
    boxStyle: {
      background: 'var(--warn-warning-bg)',
      borderColor: 'var(--warn-warning-border)',
      color: 'var(--warn-warning)',
    },
    icon: Wrench,
    label: 'Hinweis',
    toneStyle: { color: 'var(--warn-warning)' },
  },
  info: {
    ring: 'aw-tone aw-tone--info',
    boxStyle: {
      background: 'var(--warn-info-bg)',
      borderColor: 'var(--warn-info-border)',
      color: 'var(--warn-info)',
    },
    icon: CheckCircle2,
    label: 'Info',
    toneStyle: { color: 'var(--warn-info)' },
  },
};

export function AutoWireReviewModal() {
  const preview = usePlannerStore((state) => state.autoWirePreview);
  // „Vorher" ist der AKTUELLE Plan: Er wird erst mit „Anwenden" überschrieben.
  // Der Dialog ist fokusgefangen — der Vorschlag bleibt bis zur Entscheidung
  // unverändert. Ein Zähler-Vergleich verhindert trotzdem, dass bei einem
  // zwischenzeitlich geänderten Plan falsche Vorher-Werte gezeigt werden.
  const currentEdges = usePlannerStore((state) => state.edges);
  const currentNodes = usePlannerStore((state) => state.nodes);
  const apply = usePlannerStore((state) => state.applyAutoWirePreview);
  const dismiss = usePlannerStore((state) => state.dismissAutoWirePreview);
  const [showDiff, setShowDiff] = useState(true);

  // The preview itself is the source of truth. This also opens the dialog when
  // the lazy-loaded modal mounts after the store action; no timing-sensitive
  // CustomEvent is required. Clean proposals still require explicit approval.
  const open = !!preview;

  const summary = useMemo(() => {
    if (!preview) return null;
    return summarizeReport(preview.report, preview.previousEdgeCount, preview.edges.length);
  }, [preview]);

  // P0-3: Der Vorschlag muss vor der Übernahme erklären, WARUM Querschnitt
  // und Sicherung von der 0,7-Pauschale abweichen — sonst wäre die
  // Verlegebedingung eine unsichtbare Änderung am Plan.
  const conditionedEdges = useMemo(
    () =>
      (preview?.edges ?? []).filter((edge) => {
        const id = edge.data?.installationCondition;
        return typeof id === 'string' && id !== 'reference';
      }).length,
    [preview]
  );

  // P0-Nachlauf: Vorher/Nachher je Leitung. Die Projektion liegt in lib/ und
  // rechnet NICHTS — sie liest nur die Daten beider Kantenmengen und die
  // Konflikte desselben Reports. Keine zweite Fachlogik im Dialog.
  const diff = useMemo(() => {
    if (!preview) return null;
    const previous = currentEdges ?? [];
    const consistent = previous.length === preview.previousEdgeCount;
    const rows = consistent
      ? autoWireEdgeDiff(
          previous,
          preview.edges,
          [...(currentNodes ?? []), ...preview.nodes],
          preview.report.conflicts
        )
      : [];
    return { consistent, rows, summary: autoWireDiffSummary(rows) };
  }, [preview, currentEdges, currentNodes]);

  const handleApply = () => apply();
  const handleCancel = () => dismiss();

  if (!preview || !summary) return null;

  const hasCritical = summary.critical > 0;

  return (
    <AccessibleDialog
      open={open}
      onClose={handleCancel}
      title="Automatisch verbinden — Vorschlag prüfen"
      description="Auto-Wire hat einen Vorschlag berechnet. Prüfe die Änderungen vor der Übernahme."
      className="min-h-0 max-w-2xl min-w-0"
    >
      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4 pt-2 text-sm">
        {/* Kennzahlen */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={Zap} tone={{ color: 'var(--ok)' }} label="Neue Leitungen" value={summary.safeNew} />
          <Stat icon={Wrench} tone={{ color: 'var(--warn-info)' }} label="Geheilt" value={summary.healed} />
          <Stat
            icon={X}
            tone={{ color: 'var(--text-muted, var(--foreground))' }}
            label="Entfernt"
            value={summary.dropped}
          />
          <Stat
            icon={AlertTriangle}
            tone={{ color: hasCritical ? 'var(--warn-critical)' : 'var(--warn-warning)' }}
            label="Konflikte / Fragen"
            value={summary.warnings + summary.critical + summary.questions}
          />
        </div>

        {conditionedEdges > 0 && (
          <p className="aw-section text-xs" data-testid="autowire-condition-note">
            <strong>{conditionedEdges} Leitung(en) mit eigener Verlegebedingung:</strong> Querschnitt und
            Sicherung wurden gegen die eigene I_z aus Temperatur, Bündelung oder Datenblatt dimensioniert,
            nicht gegen die 0,7-Pauschale. Ungültige Angaben werden im Plan als „nicht ausführbar" markiert.
            Datengrundlage: docs/KABEL-VERLEGEBEDINGUNGEN.md — keine normgeprüfte Auslegung.
          </p>
        )}

        {/* P0-Nachlauf: Vorher/Nachher je Leitung mit Begründung. */}
        {diff && (
          <section aria-labelledby="aw-diff-heading" className="aw-section">
            <button
              type="button"
              onClick={() => setShowDiff((value) => !value)}
              aria-expanded={showDiff}
              aria-controls="aw-diff-body"
              className="flex w-full items-center justify-between gap-2 text-left font-semibold"
            >
              <span id="aw-diff-heading">Änderungen je Leitung</span>
              <span className="text-xs font-normal opacity-80">{diff.summary}</span>
            </button>
            <div id="aw-diff-body" hidden={!showDiff} data-testid="autowire-edge-diff">
              {!diff.consistent && (
                <p className="mt-2 text-xs" style={{ color: 'var(--warn-warning)' }}>
                  Der Plan hat sich seit der Vorschau geändert. Vorher-Werte sind nicht mehr eindeutig
                  zuordenbar und werden deshalb nicht angezeigt — bitte den Vorschlag verwerfen und neu
                  berechnen.
                </p>
              )}
              {diff.consistent && diff.rows.length === 0 && (
                <p className="mt-2 text-xs opacity-80">Der Vorschlag enthält keine Leitungen.</p>
              )}
              {diff.consistent && diff.rows.length > 0 && (
                <div className="mt-2 max-h-64 overflow-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th scope="col" className="p-1 pr-2 align-top font-semibold">
                          Leitung
                        </th>
                        <th scope="col" className="p-1 pr-2 align-top font-semibold">
                          Vorher
                        </th>
                        <th scope="col" className="p-1 pr-2 align-top font-semibold">
                          Nachher
                        </th>
                        <th scope="col" className="p-1 align-top font-semibold">
                          Begründung
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {diff.rows.map((row) => (
                        <tr
                          key={row.id}
                          data-testid="autowire-edge-row"
                          data-edge-id={row.id}
                          data-status={row.status}
                          className="border-b border-border/60 align-top"
                        >
                          <td className="p-1 pr-2">
                            <strong>{row.label}</strong>
                            <br />
                            <code className="opacity-70">{row.id}</code>
                            <br />
                            <span className="opacity-80">{DIFF_STATUS_LABEL[row.status]}</span>
                          </td>
                          <td className="p-1 pr-2">
                            <EdgeValues values={row.before} />
                          </td>
                          <td className="p-1 pr-2">
                            <EdgeValues values={row.after} />
                          </td>
                          <td className="p-1">
                            <ul className="list-disc space-y-0.5 pl-4">
                              {row.reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                              {row.conflicts.map((conflict) => (
                                <li key={`${conflict.ruleId}-${conflict.message}`}>
                                  <strong>{conflict.ruleId}:</strong> {toPlainGerman(conflict.message)}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs opacity-80">
                Alle Werte stammen aus dem Vorschlag bzw. dem aktuellen Plan; die Anzeige berechnet keine
                Querschnitte oder Sicherungen. Keine normgeprüfte Auslegung — Datengrundlage:
                docs/KABEL-VERLEGEBEDINGUNGEN.md.
              </p>
            </div>
          </section>
        )}

        {/* Fragen */}
        {preview.report.questions.length > 0 && (
          <section
            aria-labelledby="aw-questions-heading"
            className="aw-section"
            style={{
              background: 'var(--warn-warning-bg)',
              borderColor: 'var(--warn-warning-border)',
              color: 'var(--warn-warning)',
            }}
          >
            <h3
              id="aw-questions-heading"
              className="flex items-center gap-2 font-semibold"
              style={{ color: 'var(--warn-warning)' }}
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              Offene Fragen ({preview.report.questions.length})
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-6" style={{ color: 'var(--warn-warning)' }}>
              {preview.report.questions.map((q) => (
                <li key={q}>{toPlainGerman(q)}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs" style={{ opacity: 0.8 }}>
              Diese Entscheidungen kann die Automatik nicht ohne Deine Angabe treffen. Die Leitungen sind mit
              der sicheren Annahme verdrahtet; bitte im Inspektor die endgültige Verschaltung wählen.
            </p>
          </section>
        )}

        {/* P0 / V2-BMS-002: Ein kritischer Konflikt darf nicht zwischen
            Zahlen und Hinweisen untergehen. Ohne diesen Satz wirkt ein
            „passend dimensionierter" Vorschlag weiterhin geeignet, obwohl
            z. B. das BMS die Last nicht liefern kann. */}
        {hasCritical && (
          <section
            role="alert"
            className="aw-section"
            style={{
              background: 'var(--warn-critical-bg)',
              borderColor: 'var(--warn-critical-border)',
              color: 'var(--warn-critical)',
            }}
          >
            <h3 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Vorschlag ist fachlich nicht geeignet
            </h3>
            <p className="mt-1">
              Kabel und Sicherungen sind für den berechneten Laststrom dimensioniert, aber mindestens eine
              Systemgrenze ist überschritten. Bitte die unten genannten kritischen Konflikte beheben (z. B.
              BMS-Dauerentladestrom, Batteriebank oder Wechselrichterleistung), bevor der Plan freigegeben
              wird.
            </p>
          </section>
        )}

        {/* Konflikte */}
        {preview.report.conflicts.length > 0 && (
          <section aria-labelledby="aw-conflicts-heading" className="space-y-2">
            <h3
              id="aw-conflicts-heading"
              className="flex items-center gap-2 font-semibold"
              style={{ color: hasCritical ? 'var(--warn-critical)' : 'var(--warn-warning)' }}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Hinweise und Konflikte ({preview.report.conflicts.length})
            </h3>
            <ul className="max-h-64 space-y-2 overflow-auto pr-1" role={hasCritical ? 'alert' : undefined}>
              {preview.report.conflicts.map((conflict, i) => (
                <ConflictItem key={`${conflict.ruleId}-${i}`} conflict={conflict} />
              ))}
            </ul>
          </section>
        )}

        {/* Erklärung bei leerer Liste */}
        {preview.report.conflicts.length === 0 && preview.report.questions.length === 0 && (
          <p
            className="aw-section"
            style={{
              background: 'color-mix(in srgb, var(--ok) 12%, var(--surface-panel, white))',
              borderColor: 'color-mix(in srgb, var(--ok) 50%, transparent)',
              color: 'var(--ok)',
            }}
          >
            <CheckCircle2 className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
            Der Vorschlag enthält keine Konflikte und keine offenen Fragen. Alle neuen Verbindungen folgen der
            Flussrichtung Quelle → Wandler → Verteilung → Verbraucher; bestehende, von Dir gesetzte Leitungen
            bleiben unverändert.
          </p>
        )}

        {/* Aktionen */}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={handleCancel} aria-label="Vorschlag verwerfen">
            Abbrechen
          </Button>
          <Button
            variant={hasCritical ? 'destructive' : 'default'}
            onClick={handleApply}
            aria-label="Vorschlag auf den Plan anwenden"
          >
            {hasCritical ? 'Trotzdem anwenden' : 'Vorschlag anwenden'}
          </Button>
        </div>
      </div>
    </AccessibleDialog>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ElementType;
  tone: React.CSSProperties;
  label: string;
  value: number;
}) {
  return (
    <div
      className="rounded border border-border p-2 text-center"
      style={{ background: 'color-mix(in srgb, var(--surface-panel, white) 60%, transparent)' }}
    >
      <div
        className="flex items-center justify-center gap-1 text-xs font-semibold"
        style={tone}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold text-foreground" aria-label={`${value} ${label}`}>
        {value}
      </div>
    </div>
  );
}

function ConflictItem({ conflict }: { conflict: AutoWireConflict }) {
  const style = SEVERITY_STYLES[conflict.severity];
  const Icon = style.icon;
  return (
    <li className={style.ring} style={style.boxStyle}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={style.toneStyle} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span style={style.toneStyle}>{style.label}</span>
          </div>
          <p className="mt-0.5 text-sm">{toPlainGerman(conflict.message)}</p>
        </div>
      </div>
    </li>
  );
}
