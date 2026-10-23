'use client';

import React, { useEffect, useId, useState } from 'react';
import { BadgeCheck, ChevronDown, Info, ShieldAlert, ShieldQuestion, X } from 'lucide-react';
import type { VerificationSummary } from '../utils/verificationWarnings';

/**
 * Prüfsiegel — der Bericht der Verifikations-Engine, sichtbar neben der
 * Warn-Zentrale.
 *
 * Die Warn-Zentrale zeigt die BEHEB BAREN Befunde. Sie kann aber nicht zeigen,
 * was sie NICHT geprüft hat: »keine Hinweise« sah bisher aus wie »alles in
 * Ordnung«, auch wenn die Engine gerade einen Grenzwert nicht entscheiden
 * konnte oder die Hälfte der Regeln im Plan keinen Gegenstand hatte. Dieses
 * Siegel macht den Unterschied sichtbar — Verdikt, Abdeckung, Modellgrenzen
 * und Zertifikat stehen im selben Feld wie die Zahl der Befunde.
 *
 * Es rechnet nichts nach: Alle Zahlen kommen aus `verificationSummary`.
 */
interface VerificationSealProps {
  summary: VerificationSummary;
}

const TONE: Record<
  VerificationSummary['tone'],
  { badge: string; border: string; icon: React.ReactNode; label: string }
> = {
  ok: {
    // Status als Tönung + Symbol, nicht als gefüllte Pille (Konzept, Farbe).
    badge: 'border border-moss/40 bg-moss/10 text-ink',
    border: 'border-moss',
    icon: <BadgeCheck className="h-4 w-4 shrink-0 text-moss" aria-hidden="true" />,
    label: 'Prüfbericht',
  },
  warn: {
    badge: 'border border-warn-warning-border bg-warn-warning-bg text-ink',
    border: 'border-warn-warning',
    icon: <ShieldQuestion className="h-4 w-4 shrink-0 text-warn-warning" aria-hidden="true" />,
    label: 'Prüfbericht',
  },
  bad: {
    badge: 'border border-warn-critical-border bg-warn-critical-bg text-ink',
    border: 'border-warn-critical',
    icon: <ShieldAlert className="h-4 w-4 shrink-0 text-warn-critical" aria-hidden="true" />,
    label: 'Prüfbericht',
  },
};

const PASS_STATUS_LABEL = { PASS: 'erfüllt', FAIL: 'nicht erfüllt', UNPROVABLE: 'Angaben fehlen' } as const;

function Stat({ value, label, hint }: { value: number; label: string; hint: string }) {
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5" title={hint}>
      <div className="text-sm font-bold text-foreground">{value}</div>
      <div className="text-xs leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

export function VerificationSeal({ summary }: VerificationSealProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const tone = TONE[summary.tone];
  const percent = Math.round(summary.decisionRatio * 100);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="verification-seal-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        // Der zugängliche Name sagt auf jeder Breite dasselbe. Auf schmalen
        // Geräten ist nur das Symbol sichtbar (Platz in der Kopfzeile, wie
        // beim Speicher-Indikator); die Bewertung selbst steht im Bericht.
        aria-label={`Prüfbericht: ${summary.label}. ${summary.exercised} Regeln angewandt, ${percent} % entschieden.`}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-11 max-w-full min-w-0 shrink items-center gap-2 rounded border bg-card px-2 py-1 text-xs font-semibold text-foreground ${tone.border}`}
        title="Bericht der Verifikations-Engine: Verdikt, Abdeckung, Modellgrenzen und Zertifikat"
      >
        {/* Siegel in drei Stufen (M12, gemessen in der Werkzeugleiste):
            ganz schmal nur Symbol + Klapppfeil (~50 px), ab `xl` mit
            Verdikt-Abzeichen (~120 px), ab `2xl` mit der vollen Zeile
            (~500 px). Die langen Formen waren bei 1440 px der Grund, dass die
            Aktionsgruppe auf 145 px zusammengedrückt wurde und „Automatisch
            verbinden“ hinter dem Rand lag — die Angaben selbst sind weiter
            vollständig im `aria-label`, im Tooltip und im Bericht. */}
        {tone.icon}
        <span className="cad-tb-explain">{tone.label}:</span>
        <span className={`hidden truncate rounded px-1.5 py-0.5 text-xs font-bold xl:inline ${tone.badge}`}>
          {summary.label}
        </span>
        {/* „{n} Regeln angewandt · {x} % entschieden“ bleibt im DOM (Teil des
            zugänglichen Textes und im `aria-label` des Knopfes), aber ohne
            eigene Breite: Die Zeile war 314 px breit und ließ in der
            Werkzeugleiste bei 1920 px keine Aktionsgruppe mehr übrig. Die
            vollständige Aussage steht im Tooltip, im `aria-label` und im
            Bericht darunter. */}
        <span className="sr-only">
          {summary.exercised} Regeln angewandt · {percent} % entschieden
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <button
          type="button"
          className="planner-sheet-backdrop"
          aria-label="Prüfbericht zuklappen"
          onClick={() => setOpen(false)}
        />
      )}
      {open && (
        <div
          id={panelId}
          data-testid="verification-seal-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Prüfbericht"
          /* `fixed` statt `absolute`: Der Bericht ist bis zu 30 rem breit und
             läge im `absolute`-Fall innerhalb der 44 px hohen Werkzeugleiste,
             die wegen der scrollbaren Aktionsgruppe `overflow: hidden` trägt —
             er wäre bis auf einen Streifen abgeschnitten. Dieselbe Verankerung
             nutzt die Warnzentrale: schmal als Blatt über der Fußleiste,
             ab `md` als Panel unter der Kopfzeile. */
          className="planner-verification-panel fixed inset-x-2 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-sheet flex max-h-[60dvh] min-w-0 flex-col overflow-hidden overscroll-contain rounded border border-rule-strong bg-surface-panel text-xs shadow-[var(--cad-shadow-overlay)] md:inset-x-auto md:top-[4.75rem] md:right-3 md:bottom-auto md:max-h-[min(32rem,calc(100dvh-6rem))] md:w-[min(92vw,30rem)]"
        >
          <div className="planner-layer-header">
            <h3 className="text-sm font-bold text-foreground">Prüfbericht</h3>
            <button
              type="button"
              data-testid="verification-seal-close"
              onClick={() => setOpen(false)}
              className="planner-layer-close"
              aria-label="Prüfbericht schließen"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <p className="planner-sheet-header px-3 pt-2 font-semibold text-foreground">{summary.headline}</p>

          <div
            data-testid="verification-sheet-body"
            className="planner-sheet-body min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-3"
          >
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              <Stat
                value={summary.passed}
                label="erfüllt"
                hint="Prüfungen, deren Bedingung im Plan eingehalten ist."
              />
              <Stat
                value={summary.failed}
                label="nicht erfüllt"
                hint="Prüfungen, deren Bedingung im Plan nicht eingehalten ist. Diese Punkte müssen korrigiert werden."
              />
              <Stat
                value={summary.unprovable}
                label="Angaben fehlen"
                hint="Für diese Prüfungen fehlen Werte im Plan — sie konnten noch nicht beurteilt werden."
              />
              <Stat
                value={summary.notApplicable}
                label="kommt nicht vor"
                hint="Prüfungen ohne passendes Bauteil im Plan (z. B. Solar-Regeln ohne Solarmodul). Sie zählen NICHT als erfüllt."
              />
            </div>

            <div className="mb-3">
              <div className="mb-1 font-semibold text-foreground">Prüfungen (5 Durchgänge)</div>
              <ul className="space-y-0.5">
                {summary.passes.map((pass) => (
                  <li
                    key={pass.pass}
                    className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5"
                  >
                    <span className="min-w-0 text-muted-foreground">
                      {pass.pass}. {pass.name}
                    </span>
                    <span className="text-xs text-foreground">
                      {PASS_STATUS_LABEL[pass.status]} · {pass.ruleCount} Regeln
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {summary.notAppliedRules.length > 0 && (
              <p className="mb-3 text-muted-foreground">
                {summary.notAppliedRules.length} Prüfung(en) sind für dieses Profil nicht vorgesehen und
                wurden nicht angewendet (Liste unter „Technische Details“). Prüfungen ohne passendes Bauteil
                stehen unter „Modellgrenzen“.
              </p>
            )}

            <div className="mb-3">
              <div className="mb-1 flex items-center gap-1 font-semibold text-foreground">
                <Info className="h-3.5 w-3.5" aria-hidden="true" /> Modellgrenzen
              </div>
              <ul
                className="list-disc space-y-0.5 pl-4 text-muted-foreground"
                data-testid="verification-limitations"
              >
                {summary.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>

            {/* Nachtest Bug 4: Hashes, Engine-Version und Regel-Codes sind
              für Laien unverständliches Rauschen — sie bleiben für
              Nachweise verfügbar, aber hinter einem Aufklapp-Bereich. */}
            <details className="border-t border-border pt-2">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-foreground">
                Technische Details
              </summary>
              <p className="text-[10px] leading-relaxed break-words text-muted-foreground">
                Zertifikat {summary.certificateHash} · Plan {summary.planFingerprintHash}
                <br />
                Engine {summary.engineVersion} · Profil {summary.profile} · Kontext {summary.context}
              </p>
              {summary.notAppliedRules.length > 0 && (
                <p className="mt-1 text-[10px] leading-relaxed break-words text-muted-foreground">
                  Nicht angewandte Regeln: {summary.notAppliedRules.join(', ')}
                </p>
              )}
            </details>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Das Siegel bewertet nur, was die Engine prüfen konnte. Die behebbaren Befunde stehen in den
              Prüfhinweisen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
