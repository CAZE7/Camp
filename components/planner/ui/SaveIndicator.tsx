'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Circle } from 'lucide-react';

/**
 * Speicherzustand des Plans (`check` = alles liegt lokal im Browser).
 *
 * Bewusst Text statt Farb-Badge: „Gespeichert" bzw. „Ungespeichert" ist eine
 * Aussage, kein Alarm. Der Zeitpunkt steht im Tooltip und in der Ansage
 * (`aria-label`), damit Screenreader nicht bei jeder Änderung einen neuen Wert
 * vorlesen — die Live-Region meldet nur den Zustandswechsel.
 */

function relativeSaveTime(date: Date | null): string {
  if (!date) return 'noch nicht in dieser Sitzung';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'gerade eben';
  return `vor ${minutes} Minute${minutes === 1 ? '' : 'n'}`;
}

export function SaveIndicator({ revision }: { revision: unknown[] }) {
  const [saved, setSaved] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const first = useRef(true);
  const [, forceMinuteUpdate] = useState(0);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setSavedAt(new Date());
      return;
    }
    setSaved(false);
    const timer = window.setTimeout(() => {
      setSaved(true);
      setSavedAt(new Date());
    }, 450);
    return () => window.clearTimeout(timer);
    // The four graph references are the persisted planner revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, revision);

  useEffect(() => {
    const interval = window.setInterval(() => forceMinuteUpdate((value) => value + 1), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const detail = saved ? `Zuletzt gespeichert: ${relativeSaveTime(savedAt)}` : 'Ungespeicherte Änderungen';

  return (
    <span
      data-testid="save-indicator"
      role="status"
      aria-live="polite"
      aria-label={detail}
      title={detail}
      className="cad-statusbar__cell text-muted-foreground"
    >
      {saved ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      ) : (
        <Circle className="h-2.5 w-2.5 fill-current text-warning" aria-hidden="true" />
      )}
      <span className="hidden xl:inline">{saved ? 'Gespeichert' : 'Ungespeichert'}</span>
    </span>
  );
}
