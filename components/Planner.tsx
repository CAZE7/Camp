'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

/**
 * components/Planner.tsx — Zugang zur Zeichenanwendung.
 *
 * Der Planer ist eine reine Client-Anwendung (React Flow, Zustand, lokale
 * Persistenz); sie wird deshalb nicht serverseitig gerendert. Was der Server
 * stattdessen ausliefert, ist dieser Startbildschirm: Er ist kein Platzhalter,
 * sondern der Zustand, den ein Besuch auf langsamer Verbindung tatsächlich
 * sieht — mit derselben Aussage, die auch die Seite trägt (was der Planer tut,
 * wo der Plan liegt) und einem Weg zurück auf die Website, solange die
 * Menüleiste der Anwendung noch nicht da ist.
 *
 * Zwei Zusicherungen hängen an diesem Text, beide maschinell geprüft
 * (`scripts/seo/auditExport.ts`):
 *   - `hauptinhalt-duenn`: Eine indexierbare Seite braucht sichtbaren Inhalt im
 *     `<main>` der Auslieferung. Die Anwendungsroute rendert außer der
 *     screenreader-Überschrift nur diesen Zustand statisch.
 *   - `seite-ohne-outbound`: Jede indexierbare Seite verlinkt mindestens eine
 *     andere. Der Verweis unten ist derselbe, den die Menüleiste nach der
 *     Hydration trägt.
 */
function PlannerStartScreen() {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-moss" aria-hidden="true" />
      <p role="status" className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Der Elektroplaner lädt: Bauteilkatalog, Zeichenfläche und Stückliste erscheinen, sobald das Modul
        bereit ist. Dein Plan bleibt lokal im Browser — ohne Konto, ohne Server.
      </p>
      <Link
        href="/elektrik-planung/"
        className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground"
      >
        Zur Seite „Camper-Elektrik berechnen“
      </Link>
    </div>
  );
}

const DynamicPlannerInner = dynamic(() => import('./PlannerInner'), {
  ssr: false,
  loading: () => <PlannerStartScreen />,
});

export default function Planner() {
  return <DynamicPlannerInner />;
}
