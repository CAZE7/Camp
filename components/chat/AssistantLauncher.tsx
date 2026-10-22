'use client';

import { useState, type ComponentType } from 'react';
import { MessageSquare } from 'lucide-react';

type ChatProps = { defaultOpen?: boolean };
type ChatComponent = ComponentType<ChatProps>;

/** Loads the AI SDK only after the visitor explicitly opens the assistant. */
export default function AssistantLauncher() {
  const [Chat, setChat] = useState<ChatComponent | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadChat = async () => {
    if (loading || Chat) return;
    setLoading(true);
    setLoadFailed(false);

    try {
      const module = await import('@/components/Chat');
      setChat(() => module.default);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    void loadChat();
  };

  if (Chat) return <Chat defaultOpen />;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        aria-label={loading ? 'Assistent wird geladen' : 'Chat öffnen'}
        aria-busy={loading}
        className="assistant-launcher-button fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center border border-oxide bg-surface-panel text-oxide transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? (
          <span aria-hidden="true">…</span>
        ) : (
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
      {loadFailed && (
        <p
          role="alert"
          className="assistant-load-error fixed inset-x-4 bottom-24 z-50 mx-auto w-auto max-w-xs border border-border bg-surface-panel p-3 text-sm text-foreground sm:right-6 sm:left-auto"
        >
          Der Assistent konnte nicht geladen werden. Bitte versuche es erneut.
        </p>
      )}
    </>
  );
}
