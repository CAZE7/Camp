import React from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

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
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 md:py-10">
        <Link href="/guides/ausbau-fahrplan" className="inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-ink">
          ← Ausbau-Fahrplan
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Holzausbau nach BEDMAS
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Reihenfolge: entkernen, Kabel, Luken, Verankerung, Wasser, dann Holz.
        </p>

        <div className="mt-8">
          {STEPS.map((step) => (
            <section key={step.n} className="border-t border-rule py-6">
              <h2 className="text-base font-semibold">
                {step.n} {step.de}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
