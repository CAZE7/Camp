import Chat from '@/components/Chat';
import { SiteHeader } from '@/components/brand/SiteHeader';

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
