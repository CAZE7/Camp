"use client";

import { useChat } from '@ai-sdk/react';
import React, { useCallback, useEffect, useState } from 'react';

// Extracted UI Components

const ChatToggleButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    aria-label="Chat öffnen"
    className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-105 z-50"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  </button>
);

const ChatHeader = ({ onClose }: { onClose: () => void }) => (
  <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
    <h3 className="font-semibold">Camper AI Assistent</h3>
    <button
      onClick={onClose}
      aria-label="Chat schließen"
      className="text-gray-300 hover:text-white"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
);

const ChatMessageItem = ({ message }: { message: any }) => {
  // Hide messages containing large JSON payloads from the user UI
  const hasJsonPayload = message.parts.some((p: any) => p.type === 'text' && p.text?.includes('```json\n'));
  if (message.role === 'user' && hasJsonPayload) {
    return null;
  }

  return (
    <div className={`max-w-[85%] p-3 rounded-lg text-sm ${message.role === 'user' ? 'bg-blue-100 self-end text-blue-900 rounded-br-none' : 'bg-white border border-gray-200 self-start text-gray-800 rounded-bl-none shadow-sm'}`}>
      <div className="font-semibold text-xs mb-1 opacity-60">
        {message.role === 'user' ? 'Du' : 'KI Assistent'}
      </div>
      <div className="whitespace-pre-wrap">
        {message.parts.map((part: any, index: number) => {
          if (part.type === 'text') {
            return <span key={index}>{part.text}</span>;
          }
          return null;
        })}
      </div>
    </div>
  );
};

const ChatLoadingIndicator = () => (
  <div className="bg-white border border-gray-200 self-start text-gray-800 rounded-lg rounded-bl-none shadow-sm p-3 max-w-[85%]">
    <div className="font-semibold text-xs mb-1 opacity-60">KI Assistent</div>
    <div className="flex gap-1 items-center h-5">
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
    </div>
  </div>
);

const ChatInputForm = ({
  input,
  setInput,
  onSubmit,
  isLoading
}: {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}) => (
  <form onSubmit={onSubmit} className="p-3 border-t border-gray-200 bg-white">
    <div className="flex relative">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Frag etwas zu deinem Camper-Ausbau..."
        aria-label="Chat Nachricht"
        className="w-full border border-gray-300 rounded-full py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base md:text-sm"
      />
      <button
        type="submit"
        aria-label="Nachricht senden"
        disabled={isLoading || !input.trim()}
        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2.5 md:p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        )}
      </button>
    </div>
  </form>
);

export default function Chat() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat();
  const [isOpen, setIsOpen] = useState(false);

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleExportBOM = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    const bom = customEvent.detail;

    setIsOpen(true);

    const bomString = JSON.stringify(bom, null, 2);
    const promptText = `Bitte überprüfe meine Stückliste und schlage mir passende, günstige Produkte vor.\n\nStückliste:\n\`\`\`json\n${bomString}\n\`\`\``;

    sendMessage({ text: promptText });
  }, [sendMessage]);

  const handleCheckSchematic = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    const schematic = customEvent.detail;

    setIsOpen(true);

    const schematicString = JSON.stringify(schematic, null, 2);
    const promptText = `Bitte überprüfe diesen Schaltplan auf Fehler. Hier ist die Topologie:\n\`\`\`json\n${schematicString}\n\`\`\``;

    sendMessage({ text: promptText });
  }, [sendMessage]);

  useEffect(() => {
    window.addEventListener('export-bom', handleExportBOM);
    window.addEventListener('check-schematic', handleCheckSchematic);

    return () => {
      window.removeEventListener('export-bom', handleExportBOM);
      window.removeEventListener('check-schematic', handleCheckSchematic);
    };
  }, [handleExportBOM, handleCheckSchematic]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage({ text: input });
    setInput('');
  };

  if (!isOpen) {
    return <ChatToggleButton onClick={() => setIsOpen(true)} />;
  }

  return (
    <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 w-full md:w-96 h-[80vh] md:h-[600px] bg-white border border-gray-200 rounded-lg md:rounded-lg rounded-b-none md:rounded-b-lg shadow-2xl flex flex-col z-50 overflow-hidden">
      <ChatHeader onClose={() => setIsOpen(false)} />

      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-gray-50">
        {messages.map((m) => (
          <ChatMessageItem key={m.id} message={m} />
        ))}
        {isLoading && <ChatLoadingIndicator />}
      </div>

      <ChatInputForm
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
