'use client';

import { lazy, Suspense } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

import type { CalculatorId } from '@/lib/seo/types';

const CALCULATORS: Record<CalculatorId, LazyExoticComponent<ComponentType>> = {
  kabelquerschnitt: lazy(() =>
    import('@/components/elektrik/KabelquerschnittRechner').then((module) => ({
      default: module.KabelquerschnittRechner,
    }))
  ),
  spannungsabfall: lazy(() =>
    import('@/components/rechner/SpannungsabfallRechner').then((module) => ({
      default: module.SpannungsabfallRechner,
    }))
  ),
  batteriekapazitaet: lazy(() =>
    import('@/components/rechner/BatteriekapazitaetRechner').then((module) => ({
      default: module.BatteriekapazitaetRechner,
    }))
  ),
  solaranlage: lazy(() =>
    import('@/components/rechner/SolaranlageRechner').then((module) => ({
      default: module.SolaranlageRechner,
    }))
  ),
};

/** Lädt genau den Rechner, den der Abschnitt tatsächlich rendert. */
export function CalculatorRenderer({ calculator }: { calculator: CalculatorId }) {
  const Calculator = CALCULATORS[calculator];
  return (
    <Suspense fallback={<p role="status">Rechner wird geladen …</p>}>
      <Calculator />
    </Suspense>
  );
}
