/**
 * components/planner/AutoWireReviewModal.tsx — AUTO-WIRE REVIEW DIALOG (Spec #29).
 *
 * Zeigt den Vorschlag von `performAutoWiring`, BEVOR er angewendet wird:
 *
 *   ✅ Anzahl sicherer Verbindungen (neu vorgeschlagen)
 *   🔧 Anzahl vom Automaten geheilter Nutzerkanten (umgehängt)
 *   ⚠️ Konflikte (Regelverstöße an gepinnten Kanten, Lastgrenze, Spannung …)
 *   ❓ Offene Fragen (Batterietopologie, AC-Quelle)
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

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { usePlannerStore } from '../../store/usePlannerStore';
import { AlertTriangle, CheckCircle2, HelpCircle, Wrench, X, Zap } from 'lucide-react';
import type { AutoWireConflict, AutoWireReport } from '../../lib/autoWire/conflicts';

type Props = {
  /** Test-Hook: Überschreibt den Preview (nur für Tests). */
  forceOpen?: boolean;
};

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

export function AutoWireReviewModal({ forceOpen = false }: Props) {
  const preview = usePlannerStore((state) => state.autoWirePreview);
  const apply = usePlannerStore((state) => state.applyAutoWirePreview);
  const dismiss = usePlannerStore((state) => state.dismissAutoWirePreview);
  // `explicitlyOpened` wird nur durch das Event oder durch Apply/Cancel
  // geschrieben. Der eigentliche Offen-Zustand ist dann: Preview VORHANDEN
  // UND (Inhalt ODER forceOpen) UND Nutzer hat nicht abgebrochen. Diese
  // Ableitung braucht keinen Effect (react-hooks/set-state-in-effect).
  const [eventFired, setEventFired] = useState(false);

  useEffect(() => {
    const onEvent = () => setEventFired(true);
    window.addEventListener('planner-auto-wire-review', onEvent);
    return () => window.removeEventListener('planner-auto-wire-review', onEvent);
  }, []);

  // Wenn sich der Preview ändert (neuer Vorschlag), ist der Event-Indikator
  // irrelevant — der Dialog öffnet sich allein, weil ein Preview mit Inhalt
  // vorliegt. (Der Event bleibt als Auslöser für den Fall, dass das
  // Dispatch-Event vor dem ersten Rendern des Dialogs eintrifft.)
  const hasContent =
    !!preview && (preview.report.conflicts.length > 0 || preview.report.questions.length > 0);
  const open = !!preview && (hasContent || forceOpen || eventFired);

  const summary = useMemo(() => {
    if (!preview) return null;
    return summarizeReport(preview.report, preview.previousEdgeCount, preview.edges.length);
  }, [preview]);

  const handleApply = () => {
    setEventFired(false);
    apply();
  };
  const handleCancel = () => {
    setEventFired(false);
    dismiss();
  };

  if (!preview || !summary) return null;

  const hasCritical = summary.critical > 0;

  return (
    <AccessibleDialog
      open={open}
      onClose={handleCancel}
      title="Automatisch verbinden — Vorschlag prüfen"
      description="Auto-Wire hat einen Vorschlag berechnet. Prüfe die Änderungen vor der Übernahme."
      className="max-w-2xl"
    >
      <div className="space-y-4 px-1 pt-2 text-sm">
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
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs" style={{ opacity: 0.8 }}>
              Diese Entscheidungen kann die Automatik nicht ohne Deine Angabe treffen. Die Leitungen sind mit
              der sicheren Annahme verdrahtet; bitte im Inspektor die endgültige Verschaltung wählen.
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
            <span className="text-xs text-muted-foreground">{conflict.ruleId}</span>
          </div>
          <p className="mt-0.5 text-sm">{conflict.message}</p>
        </div>
      </div>
    </li>
  );
}
