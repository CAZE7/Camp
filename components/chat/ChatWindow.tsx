'use client';

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Kleiner interaktiver Rahmen für die Ansicht des Assistenten. */
export default function ChatWindow({ defaultOpen, children }: { defaultOpen: boolean; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-oxide text-on-signal shadow-lg transition-all hover:bg-oxide/90"
        aria-label="Chat öffnen"
      >
        💬
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-96 flex-col rounded-lg border border-border bg-bone shadow-2xl">
      <div className="flex items-center justify-between rounded-t-lg border-b border-border bg-oxide p-4 text-on-signal">
        <h2 className="font-semibold">Camper AI Assistent</h2>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded p-1 transition-colors hover:bg-oxide/90"
          aria-label="Chat schließen"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  );
}
