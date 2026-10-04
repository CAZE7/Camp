'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Send } from 'lucide-react';
import ChatWindow from '@/components/chat/ChatWindow';
import ChatUnavailable from '@/components/chat/ChatUnavailable';

export { CHAT_API_URL_ENV } from '@/components/chat/constants';

/**
 * Endpunkt des Assistenten — oder `null`, wenn es keinen gibt (ADR 0021,
 * ARCH-001).
 *
 * Warum diese Funktion und nicht mehr `… || '/api/chat'`: Der Produktbuild ist
 * ein **statischer Export** (`next.config.mjs` → `output: 'export'`,
 * ADR 0001). Er enthält kein `out/api`, und `next start` ist damit gar nicht
 * möglich — `/api/chat` wäre im ausgelieferten Artefakt immer ein 404. Die
 * Route in `app/api/chat/route.ts` existiert nur im Development-Server
 * (`next dev`), und genau dort — und nur dort — ist der lokale Fallback
 * erlaubt. Überall sonst gilt: ohne `NEXT_PUBLIC_CHAT_API_URL` gibt es keinen
 * Assistenten, und die Seite sagt das, statt ein Eingabefeld zu zeigen, das
 * ins Leere sendet (gemessener Ist-Zustand vorher: 404 je Nachricht).
 */
export function resolveChatEndpoint(
  configured: string | undefined,
  nodeEnv: string | undefined
): string | null {
  const trimmed = configured?.trim();
  if (trimmed) return trimmed;
  return nodeEnv === 'development' ? '/api/chat' : null;
}

const ChatInputForm = ({
  input,
  setInput,
  onSubmit,
  isLoading,
}: {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  isLoading: boolean;
}) => (
  <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-4">
    <Input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Schreib deine Nachricht..."
      disabled={isLoading}
      className="flex-1"
    />
    <Button type="submit" disabled={isLoading || !input.trim()} size="sm" className="gap-2">
      <Send size={16} />
      {isLoading ? 'Wird gesendet...' : 'Senden'}
    </Button>
  </form>
);

const getMessageText = (message: UIMessage) => {
  return message.parts?.find((part) => part?.type === 'text' || part?.type === 'reasoning')?.text ?? '';
};

const ConfiguredChat = ({ endpoint, defaultOpen }: { endpoint: string; defaultOpen: boolean }) => {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: endpoint }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // AUDIT T1 (no-misused-promises): `handleSubmit` hing als async-Funktion an
  // einem `onSubmit`, das `void` erwartet. Eine Ablehnung von `sendMessage`
  // war damit ein unbeobachtetes Promise: Die Eingabe blieb stehen, der Nutzer
  // sah aber nichts — weder Erfolg noch Fehler. Jetzt wird der Fehler gefangen
  // und gesagt; die Eingabe bleibt absichtlich erhalten (erneut versuchen).
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmitError(null);

    try {
      await sendMessage({ text: input });
      setInput('');
    } catch (error) {
      console.error('[Chat] Nachricht konnte nicht gesendet werden:', error);
      setSubmitError(
        'Nachricht konnte nicht gesendet werden. Bitte verbinde dich erneut und versuche es noch einmal.'
      );
    }
  };

  return (
    <ChatWindow defaultOpen={defaultOpen}>
      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground">
            <p>Starte eine Konversation mit dem AI-Assistenten!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs rounded-lg px-4 py-2 ${
                  msg.role === 'user' ? 'bg-oxide text-on-signal' : 'bg-surface-raised text-ink'
                }`}
              >
                {getMessageText(msg)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      {submitError && (
        <p role="alert" className="border-t border-border bg-signal/10 px-4 py-2 text-sm text-signal">
          {submitError}
        </p>
      )}
      <ChatInputForm
        input={input}
        setInput={setInput}
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        isLoading={isLoading}
      />
    </ChatWindow>
  );
};

/**
 * Der Chat-Endpunkt kann über `NEXT_PUBLIC_CHAT_API_URL` auf einen externen
 * Serverless-Endpoint zeigen (erforderlich, wenn die App per `output: 'export'`
 * statisch gehostet wird). Ohne Wert zeigt die Seite einen Hinweis — siehe
 * `resolveChatEndpoint`.
 *
 * S1 (AUDIT): Hier stand zusätzlich ein `NEXT_PUBLIC_CHAT_TOKEN`. Alles mit
 * NEXT_PUBLIC_ wird in das Client-Bundle eingebettet — das „Secret“ war damit
 * für jeden Besucher lesbar und schützte nichts. Die Autorisierung liegt
 * vollständig auf dem Server (siehe app/api/chat/route.ts): dort gilt
 * entweder ein serverseitiges CHAT_SHARED_SECRET oder Same-Origin.
 */
export default function Chat({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const endpoint = resolveChatEndpoint(process.env.NEXT_PUBLIC_CHAT_API_URL, process.env.NODE_ENV);

  if (!endpoint) {
    return (
      <ChatWindow defaultOpen={defaultOpen}>
        <ChatUnavailable />
      </ChatWindow>
    );
  }

  return <ConfiguredChat endpoint={endpoint} defaultOpen={defaultOpen} />;
}
