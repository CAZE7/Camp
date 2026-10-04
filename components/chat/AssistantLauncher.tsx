'use client';

import { useState, type ComponentType } from 'react';

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
        className="fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-oxide text-on-signal shadow-lg transition-all hover:bg-oxide/90 disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? '…' : '💬'}
      </button>
      {loadFailed && (
        <p
          role="alert"
          className="fixed bottom-24 right-6 max-w-xs rounded border border-border bg-bone p-3 text-sm text-ink shadow-lg"
        >
          Der Assistent konnte nicht geladen werden. Bitte versuche es erneut.
        </p>
      )}
    </>
  );
}
