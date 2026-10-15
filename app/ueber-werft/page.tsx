import type { Metadata } from 'next';
import Link from 'next/link';

import { metadataForPage } from '@/app/seoMetadata';
import { SITE_BASE_PATH } from '@/lib/site';

/**
 * app/ueber-werft/page.tsx — Umleitung der alten Vertrauensadresse.
 *
 * Die Seite hieß bis 2026-10 `/ueber-werft/` nach dem früheren Produktnamen.
 * Sie liegt jetzt unter `/ueber-elektroplaner/`; diese Route hält die alte
 * Adresse am Leben, damit bestehende Verweise aus Foren, Lesezeichen und dem
 * Suchindex nicht ins Leere laufen.
 *
 * Bewusst KEIN 301: Ein statischer Export kennt keine Serverumleitung. Die
 * Umleitung steht stattdessen als `meta http-equiv="refresh"` mit 0 Sekunden
 * im Dokument — Suchmaschinen behandeln das wie eine permanente Umleitung —
 * und zusätzlich als gewöhnlicher Verweis für alle, deren Browser der
 * Auffrischung nicht folgt. Diese Adresse steht deshalb auf `noindex` und
 * nicht in der Sitemap (`lib/seo/inventory.ts`).
 *
 * Das Ziel ist basispfad-fest: Im Export unter einem Repository-Pfad lautet
 * die Adresse `/Camp/ueber-elektroplaner/`, unter der eigenen Domain
 * `/ueber-elektroplaner/` — die Zusammensetzung kommt aus `lib/site.ts`, nicht
 * aus einer zweiten Zeichenketten-Verkettung.
 */
export const metadata: Metadata = metadataForPage('/ueber-werft/');

const ZIEL = `${SITE_BASE_PATH}/ueber-elektroplaner/`;

export default function UeberWerftUmleitung() {
  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${ZIEL}`} />
      <main id="main" className="container-page flex min-h-screen flex-col justify-center bg-paper text-ink">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Weiterleitung: Über Elektroplaner
        </h1>
        <p className="mt-3 max-w-3xl text-md text-ink-soft">
          Diese Seite ist umgezogen. Die Vertrauensseite mit Methodik, Quellen und Grenzen des Modells liegt
          jetzt unter
        </p>
        <p className="mt-4">
          <Link
            href="/ueber-elektroplaner/"
            className="inline-flex min-h-11 items-center underline underline-offset-2"
          >
            Über Elektroplaner — Projekt, Methodik und Grenzen
          </Link>
        </p>
      </main>
    </>
  );
}
