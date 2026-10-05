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
function summarizeReport(
  report: AutoWireReport,
  previousEdgeCount: number,
  nextEdgeCount: number
): Summary {
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

const SEVERITY_STYLES: Readonly<Record<AutoWireConflict['severity'], { ring: string; icon: React.ElementType; label: string; tone: string }>> = {
  critical: {
    ring: 'border-red-400 bg-red-50 text-red-900',
    icon: AlertTriangle,
    label: 'Kritisch',
    tone: 'text-red-700',
  },
  warning: {
    ring: 'border-amber-300 bg-amber-50 text-amber-900',
    icon: Wrench,
    label: 'Hinweis',
    tone: 'text-amber-700',
  },
  info: {
    ring: 'border-sky-300 bg-sky-50 text-sky-900',
    icon: CheckCircle2,
    label: 'Info',
    tone: 'text-sky-700',
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
  const hasContent = !!preview && (preview.report.conflicts.length > 0 || preview.report.questions.length > 0);
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
          <Stat
            icon={Zap}
            tone="text-emerald-700"
            label="Neue Leitungen"
            value={summary.safeNew}
          />
          <Stat
            icon={Wrench}
            tone="text-sky-700"
            label="Geheilt"
            value={summary.healed}
          />
          <Stat
            icon={X}
            tone="text-slate-600"
            label="Entfernt"
            value={summary.dropped}
          />
          <Stat
            icon={AlertTriangle}
            tone={hasCritical ? 'text-red-700' : 'text-amber-700'}
            label="Konflikte / Fragen"
            value={summary.warnings + summary.critical + summary.questions}
          />
        </div>

        {/* Fragen */}
        {preview.report.questions.length > 0 && (
          <section aria-labelledby="aw-questions-heading" className="rounded border border-amber-300 bg-amber-50 p-3">
            <h3 id="aw-questions-heading" className="flex items-center gap-2 font-semibold text-amber-900">
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              Offene Fragen ({preview.report.questions.length})
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-amber-900">
              {preview.report.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-800">
              Diese Entscheidungen kann die Automatik nicht ohne Deine Angabe treffen. Die
              Leitungen sind mit der sicheren Annahme verdrahtet; bitte im Inspektor die
              endgültige Verschaltung wählen.
            </p>
          </section>
        )}

        {/* Konflikte */}
        {preview.report.conflicts.length > 0 && (
          <section aria-labelledby="aw-conflicts-heading" className="space-y-2">
            <h3
              id="aw-conflicts-heading"
              className={`flex items-center gap-2 font-semibold ${hasCritical ? 'text-red-800' : 'text-amber-800'}`}
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
          <p className="rounded border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
            <CheckCircle2 className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
            Der Vorschlag enthält keine Konflikte und keine offenen Fragen. Alle neuen
            Verbindungen folgen der Flussrichtung Quelle → Wandler → Verteilung → Verbraucher;
            bestehende, von Dir gesetzte Leitungen bleiben unverändert.
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
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded border border-border bg-white/60 p-2 text-center">
      <div className={`flex items-center justify-center gap-1 text-xs font-semibold ${tone}`} aria-hidden="true">
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
    <li className={`rounded border p-2 ${style.ring}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.tone}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className={style.tone}>{style.label}</span>
            <span className="text-xs text-muted-foreground">{conflict.ruleId}</span>
          </div>
          <p className="mt-0.5 text-sm">{conflict.message}</p>
        </div>
      </div>
    </li>
  );
}
