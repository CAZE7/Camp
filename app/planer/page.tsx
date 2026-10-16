import type { Metadata } from 'next';

import { metadataForPage } from '@/app/seoMetadata';
import Planner from '@/components/Planner';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
import { pageByPath } from '@/lib/seo/inventory';

/**
 * app/planer/page.tsx — der Camper-Elektroplaner als eigene Seite.
 *
 * Warum eine eigene Route und kein Abschnitt auf `/camper-elektrik/`:
 * Der Planer ist ein Editor mit eigener Anwendungsshell (Menüleiste,
 * Werkzeugleiste, drei Spalten, Statuszeile) und fester Mindestbreite. Auf der
 * Wissensseite stand er als `h-dvh`-Block zwischen Rechner, Normtext und
 * Fragen: Die Kopfleiste der Website nahm 48 px der Fensterhöhe, die Lesespalte
 * drückte Überschrift und Einleitung darüber, und wer zeichnen wollte, musste
 * erst durch einen Artikel scrollen. Hier ist der Editor das Dokument — die
 * Zeichenfläche beginnt bei y = 0 und endet am unteren Fensterrand.
 *
 * Bewusst ohne `SiteHeader`/`SiteFooter`: Beide würden der Anwendung
 * Fensterhöhe wegnehmen, die sie für Palette, Canvas und Statuszeile braucht.
 * Der Weg zurück auf die Website führt über die Wortmarke in der Menüleiste
 * des Planers (`components/planner/ui/PlannerMenubar.tsx`) und über den
 * Startbildschirm, der bis zum geladenen Modul sichtbar bleibt.
 *
 * Kopfdaten und strukturierte Beschreibung kommen aus dem Seiteninventar
 * (`lib/seo/inventory.ts`) — dieselbe Quelle, aus der Sitemap, Canonical und
 * die Exportprüfung lesen.
 */

const PLANER_PFAD = '/planer/';

const SEITE = pageByPath(PLANER_PFAD);
if (!SEITE) throw new Error(`Route "${PLANER_PFAD}" fehlt im SEO-Inventar.`);

/** Überschrift aus derselben Inventarzeile wie Titel, Beschreibung und Schema. */
const PLANER_H1 = SEITE.h1;

export const metadata: Metadata = metadataForPage(PLANER_PFAD);

export default function PlanerSeite() {
  return (
    <>
      {/* Außerhalb von `main`: Die Exportprüfung misst den Textumfang des
          Hauptinhalts, und ein JSON-LD-Block darin wäre Text, den niemand liest. */}
      <PageStructuredData path={PLANER_PFAD} />

      <main id="main" className="flex h-dvh w-full flex-col overflow-hidden bg-background">
        {/*
          Die Anwendung trägt ihre Überschrift in der Menüleiste, nicht als
          Dokument-Überschrift — für Screenreader und für die Exportprüfung
          (genau eine `h1`, Text identisch zum Inventar) bleibt sie hier,
          ohne der Zeichenfläche Höhe zu nehmen.
        */}
        <h1 className="sr-only">{PLANER_H1}</h1>
        <Planner />
      </main>
    </>
  );
}
