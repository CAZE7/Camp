import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Ruler } from 'lucide-react';

import { metadataForPage } from '@/app/seoMetadata';
import { breadcrumbsFor } from '@/components/seo/Breadcrumbs';
import { PageStructuredData } from '@/components/seo/PageStructuredData';
import { PageShell } from '@/components/brand/PageShell';
import { buttonVariants } from '@/components/ui/button';
import { pageByPath } from '@/lib/seo/inventory';

/**
 * /guides/holzausbau/ — der Möbelbau in sechs Schritten.
 *
 * Die Überschrift kommt aus dem Inventar (`PAGE.h1`): Der Export-Audit
 * vergleicht sichtbare H1, Titel und Beschreibung mit dem Inventar — zwei
 * Quellen würden auseinanderlaufen.
 *
 * Die sechs Schritte sind die einzigen H2 der Seite (Vertrag:
 * `page.test.tsx`). Ein Abschnittslabel darüber ist deshalb bewusst KEIN
 * heading, sondern eine beschriftete Kante — die Gliederung bleibt: eine H1,
 * sechs H2, keine Überschrift dazwischen.
 */

export const metadata: Metadata = metadataForPage('/guides/holzausbau/');

const PAGE = pageByPath('/guides/holzausbau/');

const STEPS = [
  {
    n: '01',
    title: 'Bulkhead removal and base prep',
    de: 'Trennwand entfernen, Rost behandeln',
    body: 'Bevor der eigentliche Ausbau beginnen kann, muss das Fahrzeug komplett entkernt werden. Entferne die Trennwand, falls vorhanden, um ein offenes Raumgefühl zu schaffen. Reinige den Innenraum gründlich und überprüfe alle Blechteile auf Rost. Vorhandener Rost muss abgeschliffen und mit Rostumwandler sowie Grundierung behandelt werden. Schließe alle nicht benötigten Löcher im Boden, um spätere Feuchtigkeitsprobleme zu vermeiden.',
  },
  {
    n: '02',
    title: 'Electrical planning and rough-in',
    de: 'Kabel ziehen vor der Isolation',
    body: 'Plane deine gesamte 12V- und 230V-Elektrik im Voraus. Ziehe Leerrohre und verlege die Kabelstränge dorthin, wo später Lampen, Steckdosen und Verbraucher installiert werden sollen. Dieser Schritt muss vor der Isolierung erfolgen, da die Kabel hinter der Dämmung und Verkleidung verschwinden. Denke daran, die Kabelquerschnitte entsprechend der erwarteten Stromstärke korrekt zu dimensionieren.',
  },
  {
    n: '03',
    title: 'Doors, windows, and roof vents',
    de: 'Löcher in die Karosserie schneiden',
    body: 'Der Einbau von Fenstern, Dachluken und Belüftungssystemen ist ein kritischer Schritt. Miss alles doppelt aus, bevor du die Karosserie zerschneidest. Behandle die Schnittkanten zwingend mit Rostschutzfarbe. Setze die Fenster und Dachluken mit geeignetem Dichtmittel (z.B. Dekalin Dekaseal) ein, um eine dauerhaft wasserdichte Verbindung zu gewährleisten. Ein Holzrahmen auf der Innenseite sorgt für zusätzliche Stabilität.',
  },
  {
    n: '04',
    title: 'More metalwork and mounting points',
    de: 'Verstärkungen für schwere Möbel anbringen',
    body: 'Plane, wo schwere Gegenstände wie Küchenzeile, Hängeschränke oder Wassertanks befestigt werden sollen. Bringe Nietmuttern (Blindnietmuttern) in den Karosseriestreben an oder klebe/niete zusätzliche Holz- oder Metallprofile ein. Diese Verankerungspunkte sind essenziell, da spätere Möbelkästen während der Fahrt extremen Belastungen standhalten müssen.',
  },
  {
    n: '05',
    title: 'Appliances and plumbing systems',
    de: 'Wassertanks und Geräte installieren',
    body: 'Lege die Position von Frisch- und Abwassertanks fest. Oftmals werden Wassertanks über den Radkästen oder als Unterflurtanks installiert. Verlege die Wasserleitungen (z.B. UniQuick-System) und schließe die Wasserpumpe sowie den Druckausgleichsbehälter an. Plane auch den Platz für Kühlschrank, Herd und Standheizung und bereite die entsprechenden Anschlüsse (Gas, Strom) vor.',
  },
  {
    n: '06',
    title: 'Structure, walls, and interior finish',
    de: 'Wandverkleidung und Möbelbau',
    body: 'Nachdem Kabel und Rohre verlegt sowie die Isolierung angebracht ist, wird der Camper mit Profilholz oder Sperrholzplatten verkleidet. Nutze leichtes, aber stabiles Holz (z.B. Pappelsperrholz) für den Möbelbau. Baue das Bettgerüst, die Küchenzeile und die Sitzbänke und verankere sie an den zuvor vorbereiteten Montagepunkten. Zum Schluss folgen die kosmetischen Details, Bodenbelag und Polsterarbeiten.',
  },
];

export default function HolzausbauGuide() {
  if (!PAGE) throw new Error('SEO-Inventar: /guides/holzausbau/ fehlt.');
  const crumbs = breadcrumbsFor(PAGE);

  return (
    <PageShell
      variant="article"
      breadcrumbs={crumbs}
      mainClassName="container-page w-full px-4 pb-12 md:px-5"
    >
      <PageStructuredData path="/guides/holzausbau/" breadcrumbItems={crumbs} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="border-b border-rule pb-6">
          <p className="kicker">LEITFADEN // MÖBELBAU</p>
          <h1 className="h1 mt-4 max-w-3xl">{PAGE.h1}</h1>
          <p className="prose-measure mt-5 text-base leading-relaxed text-ink-soft md:text-lg">
            Reihenfolge: entkernen, Kabel, Luken, Verankerung, Wasser, dann Holz.
          </p>
        </header>

        <section aria-labelledby="schritte-titel">
          {/* Kein <h2>: die sechs Schritte tragen die Ebenen dieser Seite. */}
          <p id="schritte-titel" className="panel-title border-b border-rule pb-3">
            SECHS SCHRITTE // 01—06
          </p>
          <ol className="mt-5 grid gap-3 md:grid-cols-2">
            {STEPS.map((step) => (
              <li key={step.n} className="node-card flex flex-col gap-2 rounded p-5">
                <h2 className="font-display text-lg leading-snug font-semibold text-ink">
                  {/* Leerzeichen bewusst als Text, nicht als Abstand: Die
                      Ordnungszahl ist Teil des Verweistextes (Vertrag:
                      page.test.tsx erwartet „01 Trennwand entfernen …"). */}
                  <span className="mr-1 font-mono text-sm text-oxide">{step.n}</span> {step.de}
                </h2>
                <p className="caption-xs text-ink-soft">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Bewusst keine H2: Die sechs Schritte sind die einzigen H2 dieser
            Seite (Vertrag: page.test.tsx). Die Zeile ist beschriftender Text,
            kein Gliederungspunkt — `aria-labelledby` darf auf beides zeigen. */}
        <section
          aria-labelledby="weiter-holz-titel"
          className="grid gap-5 rounded border border-rule bg-soot p-5 text-paper md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-8"
        >
          <div>
            <p className="panel-title text-paper/70">WEITER // IM THEMA</p>
            <p id="weiter-holz-titel" className="h2 mt-2 text-paper">
              Erst die Reihenfolge, dann der Schaltplan.
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper/80">
              Der Ausbau-Fahrplan ordnet die Gewerke; der Schaltplan rechnet die Elektrik daraus.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/guides/ausbau-fahrplan/" className={buttonVariants({ variant: 'outline' })}>
              Ausbau-Fahrplan
              <Ruler className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/planer/" className={buttonVariants({ variant: 'default' })}>
              Schaltplan zeichnen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
