import Planner from '../../components/Planner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ElektrikPlanung() {
  return (
    <main className="w-full h-screen relative bg-stone-50 font-sans">
      <div className="absolute top-6 left-6 z-50">
        <Link href="/">
          <Button variant="outline" size="sm" className="shadow-sm rounded-xl border-stone-200 bg-white/80 backdrop-blur-md hover:bg-stone-50">
            ← Zurück
          </Button>
        </Link>
      </div>
      <Planner />
    </main>
  );
}
