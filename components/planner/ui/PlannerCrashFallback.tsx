'use client';

import React, { useState } from 'react';
import { LEGACY_PLANNER_STORAGE_KEY, PLANNER_STORAGE_KEY } from '@/lib/storageKeys';
import { restoreFirstVisit } from '@/store/freshVisit';
import { plannerDebouncedStorage } from '@/store/storage';

export type PlannerCrashFallbackProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

function readRawStoredPlan(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.localStorage.getItem(PLANNER_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_PLANNER_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function resetCorruptedPlannerState(): void {
  if (typeof window !== 'undefined') {
    try {
      plannerDebouncedStorage.removeItem(PLANNER_STORAGE_KEY);
      plannerDebouncedStorage.removeItem(LEGACY_PLANNER_STORAGE_KEY);
      window.localStorage.removeItem(PLANNER_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_PLANNER_STORAGE_KEY);
    } catch {
      // Speicher im Privatmodus ggf. blockiert.
    }
    const cleanParams = new URLSearchParams(window.location.search);
    cleanParams.delete('template');
    const query = cleanParams.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }
  restoreFirstVisit();
}

export function downloadRawPlannerBackup(): boolean {
  const raw = readRawStoredPlan();
  if (!raw || typeof document === 'undefined') return false;
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const iso = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `camp-plan-notfall-backup-${iso}.json`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export function PlannerCrashFallback({
  title = 'Der Elektroplaner konnte nicht geladen werden.',
  description = 'Ein ungültiger Planwert (z. B. aus einem defekten Teilen-Link oder alten Browserdaten) hat die Berechnung unterbrochen.',
  onRetry,
}: PlannerCrashFallbackProps) {
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  const handleBackup = () => {
    const saved = downloadRawPlannerBackup();
    setBackupMessage(
      saved
        ? 'Backup-Datei heruntergeladen. Du kannst den Plan jetzt gefahrlos zurücksetzen.'
        : 'Kein lokal gespeicherter Plan zum Sichern gefunden.'
    );
  };

  const handleReset = () => {
    resetCorruptedPlannerState();
    if (onRetry) {
      onRetry();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleReload = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      data-testid="planner-crash-fallback"
      className="flex min-h-[320px] w-full flex-1 flex-col items-center justify-center gap-4 bg-background p-6 text-center"
    >
      <p className="panel-title">Fehlerschutz</p>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">{description}</p>
      {backupMessage && <p className="text-xs text-foreground">{backupMessage}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          data-testid="planner-crash-backup"
          onClick={handleBackup}
          className="cad-btn cad-btn--line min-h-11 px-3"
        >
          Rohdaten als Backup sichern
        </button>
        <button
          type="button"
          data-testid="planner-crash-reset"
          onClick={handleReset}
          className="cad-btn cad-btn--primary min-h-11 px-3"
        >
          Gespeicherten Plan zurücksetzen
        </button>
        <button
          type="button"
          data-testid="planner-crash-reload"
          onClick={handleReload}
          className="cad-btn cad-btn--line min-h-11 px-3"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
