"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@ai-sdk/react';
import { UIMessage } from 'ai';
import { Send, X, MessageCircle } from 'lucide-react';

const getMessageText = (message: UIMessage) => message.parts?.find((part) => part?.type === 'text' || part?.type === 'reasoning')?.text ?? '';

export default function Chat({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error } = useChat();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    await sendMessage({ text: input });
    setInput('');
  };

  if (!isOpen) {
    return (
      <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)} className="fixed bottom-6 left-6 z-40 flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-blue-800 px-4 text-white shadow-lg transition-colors hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="KI-Hilfe öffnen">
        <MessageCircle className="h-6 w-6" /><span className="hidden xl:inline">KI-Hilfe</span>
      </button>
    );
  }

  return (
    <section role="dialog" aria-label="KI-Hilfe" className="fixed bottom-6 left-6 z-50 flex h-[min(600px,80vh)] w-96 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-border bg-card shadow-2xl">
      <header className="flex items-center justify-between rounded-t-lg border-b border-blue-900 bg-blue-800 p-4 text-white">
        <div><h2 className="font-semibold">Camper-KI-Hilfe</h2><p className="text-xs text-blue-100">Allgemeine Hilfe – keine Elektrofreigabe</p></div>
        <button ref={closeRef} type="button" onClick={() => { setIsOpen(false); window.requestAnimationFrame(() => triggerRef.current?.focus()); }} className="flex h-11 w-11 items-center justify-center rounded hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="KI-Hilfe schließen"><X className="h-5 w-5" /></button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground"><p>Stelle eine Frage zu deinem Ausbau. Sicherheitswarnungen findest du in der Planprüfung.</p></div>
        ) : messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs rounded-lg px-4 py-2 ${message.role === 'user' ? 'bg-blue-800 text-white' : 'bg-accent text-foreground'}`}>{getMessageText(message as UIMessage)}</div>
          </div>
        ))}
        {isLoading && <p role="status" className="text-sm text-muted-foreground">Antwort wird erstellt …</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-900">Die KI-Hilfe ist gerade nicht erreichbar. Versuche es später erneut.</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-4">
        <label htmlFor="planner-chat-input" className="sr-only">Nachricht an die KI-Hilfe</label>
        <Input id="planner-chat-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Deine Frage …" disabled={isLoading} className="min-h-11 flex-1" />
        <Button type="submit" disabled={isLoading || !input.trim()} className="min-h-11 gap-2"><Send className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Senden</span></Button>
      </form>
    </section>
  );
}
