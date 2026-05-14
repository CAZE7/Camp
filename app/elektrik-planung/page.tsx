import Planner from '../../components/Planner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ElektrikPlanung() {
  return (
    <main className="w-full h-screen relative bg-stone-50 font-sans">
      <Planner />
    </main>
  );
}
