'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, Check, Crosshair, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ValidationWarning, SEVERITY_ORDER } from '../hooks/useLiveValidation';

interface WarningCenterProps {
  warnings: ValidationWarning[];
  onFix?: (warning: ValidationWarning) => void;
}

const TYPE_STYLES: Record<
  ValidationWarning['type'],
  { badge: string; card: string; icon: React.ReactNode; label: string }
> = {
  critical: {
    badge: 'bg-warn-critical text-white',
    card: 'bg-warn-critical-bg border-warn-critical',
    icon: <AlertTriangle className="h-5 w-5 shrink-0 text-warn-critical" />,
    label: 'Kritisch',
  },
  warning: {
    badge: 'bg-warn-warning text-white',
    card: 'bg-warn-warning-bg border-warn-warning',
    icon: <AlertCircle className="h-5 w-5 shrink-0 text-warn-warning" />,
    label: 'Warnung',
  },
  info: {
    badge: 'bg-warn-info text-white',
    card: 'bg-warn-info-bg border-warn-info',
    icon: <Info className="h-5 w-5 shrink-0 text-warn-info" />,
    label: 'Hinweis',
  },
};

// \p{Extended_Pictographic} erfasst alle Emoji inkl. Surrogate-Paare; die
// Separat-Bereiche der alten Klasse waren bei /g ohne /u fehleranfällig.
const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F]/gu;
function toPlainExplanation(message: string) {
  return message
    .replace(EMOJI_PATTERN, '')
    .replace(/^\s*(Kritisch|Hinweis|Warnung|Tipp)\s*:\s*/i, '')
    .trim();
}

function consequence(warning: ValidationWarning) {
  if (warning.category === 'safety')
    return 'Folge: Leitung oder Gerät kann überhitzen; bei 230 V besteht zusätzlich Stromschlaggefahr.';
  if (warning.category === 'topology')
    return 'Folge: Das System kann unvollständig sein oder nicht wie geplant funktionieren.';
  if (warning.category === 'monitoring')
    return 'Folge: Der Batteriestand wird falsch berechnet und ist nicht verlässlich.';
  return 'Folge: Reichweite, Ladezeit oder Leistung können schlechter sein als erwartet.';
}

function nextStep(warning: ValidationWarning) {
  if (warning.id.startsWith('missing-fuse'))
    return 'So löst du es: Füge am Anfang der Plusleitung eine passende Sicherung oder einen Sicherungskasten ein.';
  if (warning.id === 'solar-overload')
    return 'So löst du es: Wähle einen Solar-Laderegler mit höherem zulässigem Ladestrom oder reduziere die Solarleistung.';
  if (warning.id === 'battery-capacity')
    return 'So löst du es: Reduziere tägliche Nutzungszeiten, ergänze Solarleistung oder plane mehr nutzbare Batteriekapazität.';
  if (warning.id.includes('inverter-no-minus'))
    return 'So löst du es: Verbinde den Minusanschluss des Wechselrichters mit der Minus-Sammelschiene.';
  if (warning.id.includes('inverter-unprotected'))
    return 'So löst du es: Setze eine eigene passende Sicherung in die Plusleitung zum Wechselrichter.';
  if (warning.id.includes('dcdc-unconnected'))
    return 'So löst du es: Verbinde Eingang mit der Starterseite und Ausgang mit dem abgesicherten Pfad zur Aufbaubatterie.';
  if (warning.id.includes('shunt-bypass'))
    return 'So löst du es: Führe alle Minusleitungen der Aufbaubatterie über den Shunt.';
  if (warning.id.startsWith('rcd-'))
    return 'So löst du es: Lass einen zweipoligen FI/LS-Schutz durch eine Elektrofachkraft einplanen.';
  return 'So löst du es: Zeige die betroffene Stelle im Plan und ergänze die dort beschriebene Komponente.';
}

export function WarningCenter({ warnings, onFix }: WarningCenterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sorted = useMemo(
    () => [...warnings].sort((a, b) => SEVERITY_ORDER[a.type] - SEVERITY_ORDER[b.type]),
    [warnings]
  );
  const counts = useMemo(() => {
    const value = { critical: 0, warning: 0, info: 0 };
    warnings.forEach((warning) => value[warning.type]++);
    return value;
  }, [warnings]);

  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener('open-warning-center', openPanel);
    return () => window.removeEventListener('open-warning-center', openPanel);
  }, []);

  useEffect(() => {
    if (warnings.length === 0) setOpen(false);
  }, [warnings.length]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (warnings.length === 0) {
    return (
      <span className="hidden min-h-11 items-center gap-1 rounded-lg border border-moss bg-moss/10 px-3 text-xs font-semibold text-moss xl:inline-flex">
        <Check className="h-4 w-4" />
        Keine Hinweise
      </span>
    );
  }

  const topType: ValidationWarning['type'] =
    counts.critical > 0 ? 'critical' : counts.warning > 0 ? 'warning' : 'info';

  return (
    <div className="relative" ref={containerRef}>
      <span className="sr-only" role="status" aria-live="polite">
        {warnings.length} Prüfhinweise im Plan.
      </span>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${warnings.length} Prüfhinweise anzeigen`}
        className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${TYPE_STYLES[topType].badge}`}
      >
        <AlertTriangle className="h-4 w-4" />
        <span>{warnings.length}</span>
        <span className="hidden sm:inline">{warnings.length === 1 ? 'Hinweis' : 'Hinweise'}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="absolute right-0 top-full z-50 mt-2 max-h-96 w-11/12 min-w-80 max-w-md overflow-y-auto rounded-xl border border-border bg-card shadow-2xl focus:outline-none sm:w-96"
          role="dialog"
          aria-label="Prüfhinweise für deine Anlage"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Prüfung deiner Anlage</h3>
              <p className="text-xs text-muted-foreground">Kritische Punkte stehen zuerst.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Prüfhinweise schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ul className="flex flex-col gap-3 p-3">
            {sorted.map((warning) => {
              const style = TYPE_STYLES[warning.type];
              return (
                <li key={warning.id} className={`rounded-lg border-l-4 p-3 ${style.card}`}>
                  <div className="flex items-start gap-2">
                    {style.icon}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{warning.title || style.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                        <strong>Problem:</strong> {toPlainExplanation(warning.message)}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{consequence(warning)}</p>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-foreground">
                        {nextStep(warning)}
                      </p>
                      {warning.focusId && onFix && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            onFix(warning);
                            setOpen(false);
                          }}
                          className="mt-3 min-h-11 gap-1.5 bg-card text-sm"
                        >
                          <Crosshair className="h-4 w-4" />
                          Im Plan zeigen
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
