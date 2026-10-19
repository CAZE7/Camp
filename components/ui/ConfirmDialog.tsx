'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AccessibleDialog } from './AccessibleDialog';
import { Button } from './button';

/**
 * In-App-Rückfrage statt nativer `window.confirm()`-Dialoge
 * (Nachtest 2026-10-16: Wizard ließ sich nicht schließen, weil die
 * native Rückfrage „Plan wird geleert“ jeden Schließversuch blockierte;
 * übernommen aus PR #536, B-23).
 *
 * `requestConfirm(message)` liefert ein Promise<boolean>. Der Host
 * (`ConfirmDialogHost`) muss einmal im Baum eingehängt sein. Der Dialog
 * nutzt denselben `AccessibleDialog` wie alle anderen Planer-Overlays
 * (Fokusfalle, Esc, Fokus-Rückgabe) und trägt das Design der Anwendung.
 *
 * Esc und „Abbrechen“ liefern `false`. Eine neue Rückfrage verneint eine
 * noch offene.
 */

type Pending = { message: string; resolve: (ok: boolean) => void };

let current: Pending | null = null;
const listeners = new Set<(next: Pending | null) => void>();

function emit(next: Pending | null) {
  current = next;
  listeners.forEach((listener) => listener(next));
}

export function requestConfirm(message: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    current?.resolve(false);
    emit({ message, resolve });
  });
}

export function ConfirmDialogHost() {
  const [request, setRequest] = useState<Pending | null>(null);

  useEffect(() => {
    const listener = (next: Pending | null) => setRequest(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const answer = useCallback((ok: boolean) => {
    const active = current;
    emit(null);
    active?.resolve(ok);
  }, []);

  if (!request) return null;

  return (
    <AccessibleDialog
      open
      onClose={() => answer(false)}
      title="Bitte bestätigen"
      showClose={false}
      closeOnBackdrop={false}
    >
      <p className="px-5 py-4 text-sm text-foreground">{request.message}</p>
      <div className="flex flex-wrap justify-end gap-3 px-5 pb-5">
        <Button variant="outline" onClick={() => answer(false)} className="min-h-11 px-6">
          Abbrechen
        </Button>
        <Button onClick={() => answer(true)} className="min-h-11 px-6">
          Fortfahren
        </Button>
      </div>
    </AccessibleDialog>
  );
}
