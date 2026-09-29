'use client';

import React, { useId, useState } from 'react';
import { BadgeCheck, ChevronDown, Info, ShieldAlert, ShieldQuestion } from 'lucide-react';
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
    badge: 'bg-moss text-on-signal',
    border: 'border-moss',
    icon: <BadgeCheck className="h-4 w-4 shrink-0 text-moss" aria-hidden="true" />,
    label: 'Prüfbericht',
  },
  warn: {
    badge: 'bg-warn-warning text-on-signal',
    border: 'border-warn-warning',
    icon: <ShieldQuestion className="h-4 w-4 shrink-0 text-warn-warning" aria-hidden="true" />,
    label: 'Prüfbericht',
  },
  bad: {
    badge: 'bg-warn-critical text-on-signal',
    border: 'border-warn-critical',
    icon: <ShieldAlert className="h-4 w-4 shrink-0 text-warn-critical" aria-hidden="true" />,
    label: 'Prüfbericht',
  },
};

const PASS_STATUS_LABEL = { PASS: 'bestanden', FAIL: 'verletzt', UNPROVABLE: 'nicht entscheidbar' } as const;

function Stat({ value, label, hint }: { value: number; label: string; hint: string }) {
  return (
    <div className="rounded border border-border bg-card px-2 py-1.5" title={hint}>
      <div className="font-mono text-sm font-bold text-foreground">{value}</div>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}

export function VerificationSeal({ summary }: VerificationSealProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const tone = TONE[summary.tone];
  const percent = Math.round(summary.decisionRatio * 100);

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="verification-seal-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex min-h-8 items-center gap-2 rounded border bg-card px-2 py-1 text-xs font-semibold text-foreground ${tone.border}`}
        title="Bericht der Verifikations-Engine: Verdikt, Abdeckung, Modellgrenzen und Zertifikat"
      >
        {tone.icon}
        <span>{tone.label}:</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${tone.badge}`}>{summary.label}</span>
        <span className="hidden font-normal text-muted-foreground sm:inline">
          {summary.exercised} Regeln angewandt · {percent} % entschieden
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={panelId}
          data-testid="verification-seal-panel"
          role="region"
          aria-label="Prüfbericht der Verifikations-Engine"
          className="absolute right-0 z-[80] mt-2 w-[min(92vw,30rem)] rounded border border-border bg-surface-panel p-3 text-xs shadow-2xl"
        >
          <p className="mb-2 font-semibold text-foreground">{summary.headline}</p>

          <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <Stat
              value={summary.passed}
              label="bestanden"
              hint="Regeln, deren Bedingung im Plan erfüllt ist (PASS)."
            />
            <Stat
              value={summary.failed}
              label="verletzt"
              hint="Regeln, deren Bedingung im Plan verletzt ist (FAIL)."
            />
            <Stat
              value={summary.unprovable}
              label="nicht entscheidbar"
              hint="Regeln, deren Eingaben fehlen: keine Aussage möglich — weder bestanden noch verletzt."
            />
            <Stat
              value={summary.notApplicable}
              label="ohne Gegenstand"
              hint="Regeln, die im Plan nichts zu prüfen hatten (z. B. Solar-Regeln ohne Solar). Sie sind NICHT bestanden."
            />
          </div>

          <div className="mb-3">
            <div className="mb-1 font-semibold text-foreground">Prüfungen (5 Durchgänge)</div>
            <ul className="space-y-0.5">
              {summary.passes.map((pass) => (
                <li key={pass.pass} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {pass.pass}. {pass.name}
                  </span>
                  <span className="font-mono text-[11px]">
                    {PASS_STATUS_LABEL[pass.status]} · {pass.ruleCount} Regeln
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {summary.notAppliedRules.length > 0 && (
            <p className="mb-3 text-muted-foreground">
              Nicht angewandt: <span className="font-mono">{summary.notAppliedRules.join(', ')}</span> —
              Profil oder Kontext schließen diese Regeln aus. Regeln, die im Plan keinen Gegenstand hatten,
              stehen unter Modellgrenzen.
            </p>
          )}

          <div className="mb-3">
            <div className="mb-1 flex items-center gap-1 font-semibold text-foreground">
              <Info className="h-3.5 w-3.5" aria-hidden="true" /> Modellgrenzen
            </div>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {summary.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>

          <p className="border-t border-border pt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
            Zertifikat {summary.certificateHash} · Plan {summary.planFingerprintHash}
            <br />
            Engine {summary.engineVersion} · Profil {summary.profile} · Kontext {summary.context}
          </p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            Das Siegel bewertet nur, was die Engine prüfen konnte. Die behebbaren Befunde stehen in den
            Prüfhinweisen.
          </p>
        </div>
      )}
    </div>
  );
}
