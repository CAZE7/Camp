import Planner from '../../components/Planner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ElektrikPlanung() {
  return (
    <main id="main" className="w-full flex-1 flex flex-col relative bg-paper font-sans min-h-0">
      <Planner />
    </main>
  );
}
