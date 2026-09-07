'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { type UIMessage } from 'ai';
import { Send, X } from 'lucide-react';

const ChatInputForm = ({
  input,
  setInput,
  onSubmit,
  isLoading,
}: {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
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

// Der Chat-Endpunkt kann über NEXT_PUBLIC_CHAT_API_URL auf einen externen
// Serverless-Endpoint zeigen (erforderlich, wenn die App per `output: 'export'`
// statisch gehostet wird). Fällt auf '/api/chat' zurück, falls kein Wert
// gesetzt ist.
const CHAT_API_URL = process.env.NEXT_PUBLIC_CHAT_API_URL || '/api/chat';
const CHAT_TOKEN = process.env.NEXT_PUBLIC_CHAT_TOKEN;

export default function Chat({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: CHAT_API_URL,
      headers: CHAT_TOKEN ? { 'x-chat-token': CHAT_TOKEN } : undefined,
    }),
  });
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    await sendMessage({ text: input });
    setInput('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700"
        aria-label="Chat öffnen"
      >
        💬
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-96 flex-col rounded-lg border border-border bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-lg border-b border-border bg-blue-600 p-4 text-white">
        <h2 className="font-semibold">Camper AI Assistent</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded p-1 transition-colors hover:bg-blue-700"
          aria-label="Chat schließen"
        >
          <X size={20} />
        </button>
      </div>

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
                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-900'
                }`}
              >
                {getMessageText(msg as UIMessage)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <ChatInputForm input={input} setInput={setInput} onSubmit={handleSubmit} isLoading={isLoading} />
    </div>
  );
}
