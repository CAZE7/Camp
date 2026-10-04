import type { Metadata } from 'next';

import { metadataForPage } from '@/app/seoMetadata';
import { SiteHeader } from '@/components/brand/SiteHeader';
import AssistantLauncher from '@/components/chat/AssistantLauncher';
import ChatUnavailablePanel from '@/components/chat/ChatUnavailablePanel';

/**
 * Die Assistenten-Ansicht ruft eine Server-Schnittstelle auf, die es in der
 * statischen Auslieferung nur mit konfiguriertem externem Endpunkt gibt. Ohne
 * Endpunkt bleibt ein leichter Hinweis sichtbar; mit Endpunkt lädt der
 * Launcher das AI-SDK erst, wenn jemand den Chat tatsächlich öffnet.
 */
export const metadata: Metadata = metadataForPage('/ki-assistent/');

const chatAvailable =
  process.env.NODE_ENV === 'development' || Boolean(process.env.NEXT_PUBLIC_CHAT_API_URL?.trim());

export default function KiAssistent() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main id="main" className="relative flex-1">
        <h1 className="sr-only">Camper-Assistent</h1>
        {chatAvailable ? <AssistantLauncher /> : <ChatUnavailablePanel />}
      </main>
    </div>
  );
}
