"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, Check, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ValidationWarning, SEVERITY_ORDER } from '../hooks/useLiveValidation';

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
    card: 'bg-warn-critical-bg border-warn-critical-border',
    icon: <AlertTriangle className="w-4 h-4 text-warn-critical shrink-0" />,
    label: 'Kritisch',
  },
  warning: {
    badge: 'bg-warn-warning text-white',
    card: 'bg-warn-warning-bg border-warn-warning-border',
    icon: <AlertCircle className="w-4 h-4 text-warn-warning shrink-0" />,
    label: 'Warnung',
  },
  info: {
    badge: 'bg-warn-info text-white',
    card: 'bg-warn-info-bg border-warn-info-border',
    icon: <Info className="w-4 h-4 text-warn-info shrink-0" />,
    label: 'Hinweis',
  },
};

/**
 * Laien-Erklärung: entfernt Emojis und technische Präfixe aus der Roh-Message,
 * ohne die eigentliche Aussage zu verändern.
 */
const EMOJI_PATTERN = /[\u2600-\u27BF\uFE0F\uD800-\uDFFF]/g;

function toPlainExplanation(message: string): string {
  return message
    .replace(EMOJI_PATTERN, '')
    .replace(/^\s*(Kritisch|Hinweis|Warnung|Tipp)\s*:\s*/i, '')
    .trim();
}

export function WarningCenter({ warnings, onFix }: WarningCenterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () => [...warnings].sort((a, b) => SEVERITY_ORDER[a.type] - SEVERITY_ORDER[b.type]),
    [warnings]
  );

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, info: 0 };
    for (const w of warnings) c[w.type]++;
    return c;
  }, [warnings]);

  // Panel schließen, wenn keine Warnungen mehr da sind
  useEffect(() => {
    if (warnings.length === 0 && open) setOpen(false);
  }, [warnings.length, open]);

  // Klick ausserhalb schliesst das Panel
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (warnings.length === 0) return null;

  // Höchste vorhandene Schwere bestimmt die Badge-Farbe
  const topType: ValidationWarning['type'] =
    counts.critical > 0 ? 'critical' : counts.warning > 0 ? 'warning' : 'info';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${warnings.length} Warnungen anzeigen`}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold shadow-sm transition-colors min-h-[36px] ${TYPE_STYLES[topType].badge}`}
      >
        <AlertTriangle className="w-4 h-4" />
        <span>{warnings.length}</span>
        <span className="hidden sm:inline">{warnings.length === 1 ? 'Warnung' : 'Warnungen'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 z-50 w-[min(92vw,26rem)] max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-top-2"
          role="dialog"
          aria-label="Warnungen und Hinweise"
        >
          <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
            <h3 className="text-sm font-bold text-foreground">Prüfung deiner Anlage</h3>
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {counts.critical > 0 && (
                <span className="rounded-full bg-warn-critical px-2 py-0.5 text-white">{counts.critical} kritisch</span>
              )}
              {counts.warning > 0 && (
                <span className="rounded-full bg-warn-warning px-2 py-0.5 text-white">{counts.warning} Warnung</span>
              )}
              {counts.info > 0 && (
                <span className="rounded-full bg-warn-info px-2 py-0.5 text-white">{counts.info} Hinweis</span>
              )}
            </div>
          </div>

          <ul className="flex flex-col gap-2 p-3">
            {sorted.map((w) => {
              const style = TYPE_STYLES[w.type];
              return (
                <li
                  key={w.id}
                  className={`rounded-lg border p-3 ${style.card}`}
                >
                  <div className="flex items-start gap-2">
                    {style.icon}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">
                        {w.title || style.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                        {toPlainExplanation(w.message)}
                      </p>
                      {w.focusId && onFix && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onFix(w);
                            setOpen(false);
                          }}
                          className="mt-2 h-8 gap-1.5 bg-card text-xs"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          Beheben
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <Check className="w-3.5 h-3.5 text-success" />
            Sortiert nach Wichtigkeit — kritische Punkte zuerst.
          </div>
        </div>
      )}
    </div>
  );
}
