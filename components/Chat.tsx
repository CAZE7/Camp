"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@ai-sdk/react';
import { UIMessage } from 'ai';
import { Send, X, MessageCircle, StopCircle, AlertTriangle } from 'lucide-react';

const MAX_CHARS = 10000;

const EXAMPLE_PROMPTS = [
  'Welchen Kabelquerschnitt brauche ich für 100 A auf 3 m Länge?',
  'Ist ein FI-Schutzschalter für meinen Landstrom Pflicht?',
  'Wie groß muss die Batterie für 200 Ah Verbrauch pro Tag sein?',
  'Passt eine Autoterm Air 2D in einen Ducato L2H2?',
];

const getMessageText = (message: UIMessage) =>
  message.parts?.find((part) => part?.type === 'text' || part?.type === 'reasoning')?.text ?? '';

/** Blendet den Rohtext von `\`\`\`json …\`\`\``-Blöcken in User-Nachrichten aus
 * und ersetzt ihn durch einen kurzen Chip — die vollständige Payload bleibt
 * ausklappbar. */
function renderUserContent(text: string) {
  const startTag = '```json';
  const endTag = '```';
  const start = text.indexOf(startTag);
  if (start === -1) {
    return <>{text}</>;
  }
  const contentStart = start + startTag.length;
  const end = text.indexOf(endTag, contentStart);
  if (end === -1) {
    return <>{text}</>;
  }
  const before = text.slice(0, start).trim();
  const payload = text.slice(contentStart, end).trim();
  const after = text.slice(end + endTag.length).trim();
  let itemCount = 0;
  try {
    const parsed = JSON.parse(payload);
    if (parsed && Array.isArray(parsed.cables)) itemCount = parsed.cables.length;
  } catch {
    // ignore
  }
  return (
    <div className="space-y-2">
      {before && <p>{before}</p>}
      <details className="rounded border border-white/30 bg-white/10 px-2 py-1 text-xs">
        <summary className="cursor-pointer select-none font-semibold">
          Stückliste angehängt{itemCount ? ` (${itemCount} Kabel)` : ''}
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-tight">
          {payload}
        </pre>
      </details>
      {after && <p>{after}</p>}
    </div>
  );
}

function mapErrorMessage(error: Error | undefined): string | null {
  if (!error) return null;
  const raw = (error.message || '').toLowerCase();
  if (!raw) {
    return 'Die KI-Hilfe antwortet gerade nicht. Bitte in einer Minute erneut versuchen.';
  }
  if (raw.includes('openai api key') || raw.includes('missing openai')) {
    return 'Der KI-Dienst ist noch nicht konfiguriert. Bitte melde dich beim Support.';
  }
  if (raw.includes('too long') || raw.includes('too many') || raw.includes('10000')) {
    return 'Deine Nachricht war zu lang. Kürze sie auf unter 10 000 Zeichen.';
  }
  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('network')) {
    return 'Keine Verbindung. Prüfe deine Internetverbindung und versuche es erneut.';
  }
  return 'Die KI-Hilfe hatte ein Problem: ' + error.message;
}

export default function Chat({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error, stop } = useChat();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoading = status === 'submitted' || status === 'streaming';
  const errorMessage = useMemo(() => mapErrorMessage(error as Error | undefined), [error]);

  const charCount = input.length;
  const charLimitApproaching = charCount > MAX_CHARS * 0.8;
  const charLimitReached = charCount >= MAX_CHARS;

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  const submit = async (text: string) => {
    if (!text.trim() || text.length > MAX_CHARS) return;
    await sendMessage({ text });
    setInput('');
    inputRef.current?.focus();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submit(input);
  };

  const handleExample = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  if (!isOpen) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed left-6 z-40 flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-ink px-4 text-paper shadow-lg transition-colors hover:bg-soot focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 safe-bottom"
        aria-label="KI-Assistent öffnen"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
        <span className="hidden xl:inline">KI-Assistent</span>
      </button>
    );
  }

  // Nur die letzte Assistant-Nachricht wird als Live-Region angesagt,
  // damit Screen-Reader bei Streaming nicht die gesamte Historie wiederholen.
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <section
      role="dialog"
      aria-label="KI-Assistent"
      className="fixed left-6 z-50 flex h-[min(600px,80vh)] w-96 max-w-[calc(100vw-2rem)] flex-col border border-rule bg-bone shadow-2xl safe-bottom"
    >
      <header className="flex items-center justify-between border-b border-rule bg-ink p-3 text-paper">
        <div>
          <h2 className="text-sm font-semibold">KI-Assistent</h2>
          <p className="caption-xs text-paper/70">Allgemeine Hilfe – keine Elektrofachkraft.</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={() => {
            setIsOpen(false);
            window.requestAnimationFrame(() => triggerRef.current?.focus());
          }}
          className="flex h-11 w-11 items-center justify-center hover:bg-soot focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper"
          aria-label="KI-Assistent schließen"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4" role="log" aria-label="Chat-Verlauf">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-ink">
              Stelle eine Frage zu deinem Ausbau. Der Assistent kennt Kabelquerschnitte, VDE-Normen und die typischen Fallen im Camper.
            </p>
            <div>
              <p className="caption-xs mb-2 font-semibold uppercase tracking-widest text-ink-soft">Beispielfragen</p>
              <ul className="space-y-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => handleExample(prompt)}
                      className="flex min-h-11 w-full items-center border border-rule bg-paper px-3 py-2 text-left text-sm text-ink hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="caption-xs text-ink-soft">
              Tipp: Beziehe deine Stückliste über das Schaltplan-Werkzeug.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => {
              const text = getMessageText(message as UIMessage);
              const isUser = message.role === 'user';
              const isLastAssistant = message.id === lastAssistantId;
              return (
                <li
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    role={isLastAssistant ? 'status' : undefined}
                    aria-live={isLastAssistant ? 'polite' : undefined}
                    aria-atomic="false"
                    className={
                      'max-w-[85%] whitespace-pre-wrap rounded px-3 py-2 text-sm ' +
                      (isUser
                        ? 'bg-ink text-paper'
                        : 'border border-rule bg-paper text-ink')
                    }
                  >
                    {isUser ? renderUserContent(text) : text}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {isLoading && (
          <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-ink" />
            Antwort wird erstellt …
          </p>
        )}
        {errorMessage && (
          <div role="alert" className="warn-card warn-card-critical mt-3 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{errorMessage}</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-rule bg-bone p-3">
        <label htmlFor="planner-chat-input" className="sr-only">
          Nachricht an den KI-Assistenten
        </label>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            id="planner-chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, MAX_CHARS))}
            placeholder="Deine Frage …"
            disabled={isLoading}
            maxLength={MAX_CHARS}
            aria-describedby="planner-chat-hint"
            className="min-h-11 flex-1"
          />
          {isLoading ? (
            <Button
              type="button"
              onClick={() => stop()}
              variant="outline"
              className="min-h-11 gap-2"
              aria-label="Antwort abbrechen"
            >
              <StopCircle className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Abbrechen</span>
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim() || charLimitReached}
              className="min-h-11 gap-2"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Senden</span>
            </Button>
          )}
        </div>
        <div
          id="planner-chat-hint"
          className="mt-2 flex items-center justify-between caption-xs text-ink-soft"
        >
          <span aria-live="polite">
            {charLimitReached ? (
              <span className="font-semibold text-warn-critical">
                Maximallänge erreicht ({MAX_CHARS.toLocaleString('de-DE')} Zeichen).
              </span>
            ) : charLimitApproaching ? (
              <span className="text-warn-warning">
                {charCount.toLocaleString('de-DE')} / {MAX_CHARS.toLocaleString('de-DE')} Zeichen
              </span>
            ) : (
              <span>{charCount.toLocaleString('de-DE')} / {MAX_CHARS.toLocaleString('de-DE')} Zeichen</span>
            )}
          </span>
          <span>Enter zum Senden</span>
        </div>
      </form>
    </section>
  );
}
