import Chat from '@/components/Chat';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { pageMetadata } from '@/lib/seo/pages';

/**
 * noindex, follow: der Assistent ist im statischen Export nicht an ein Backend
 * angebunden (`components/Chat.tsx:18-22`) und führt Anfragen ins Leere.
 */
export const metadata = pageMetadata('/ki-assistent');

export default function KiAssistent() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SiteHeader />
      <main className="relative flex-1">
        <Chat defaultOpen />
      </main>
    </div>
  );
}
