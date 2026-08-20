import React from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';

interface StepData {
  id: string;
  title: string;
  ziel: string;
  warumJetzt: string;
  werkzeugMaterial: string[];
  schrittFuerSchritt: string[];
  typischeFehler: string;
  kaufhilfe?: string;
  zusatzInfo?: string;
  comparison?: {
    title: string;
    items: {
      name: string;
      description: string;
    }[];
  };
}

const StepModule = ({ step }: { step: StepData }) => (
  <section id={step.id} className="scroll-mt-24 border-t border-rule py-12 first:border-t-0 first:pt-0">
    <h2 className="text-lg font-semibold text-ink mb-6">
      {step.title}
    </h2>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
      <div>
        <h3 className="label-eyebrow text-copper mb-2">Ziel</h3>
        <p className="text-ink-soft leading-relaxed">{step.ziel}</p>
      </div>
      <div>
        <h3 className="label-eyebrow text-moss mb-2">Warum jetzt?</h3>
        <p className="text-ink-soft leading-relaxed">{step.warumJetzt}</p>
      </div>
    </div>

    <div className="mb-8">
      <h3 className="label-eyebrow text-ink mb-3">Werkzeug & Material</h3>
      <ul className="list-disc pl-5 space-y-1 text-ink-soft">
        {step.werkzeugMaterial.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>

    <div className="mb-8">
      <h3 className="label-eyebrow text-ink mb-3">Schritt für Schritt</h3>
      <ol className="list-decimal pl-5 space-y-2 text-ink-soft marker:font-medium marker:text-ink">
        {step.schrittFuerSchritt.map((item, index) => (
          <li key={index} className="pl-1">{item}</li>
        ))}
      </ol>
    </div>

    {step.zusatzInfo && (
      <div className="mb-8 p-4 bg-bone border-l-2 border-copper">
        <h3 className="label-eyebrow text-copper mb-1">Zusatzinfo</h3>
        <p className="text-ink-soft text-sm leading-relaxed">{step.zusatzInfo}</p>
      </div>
    )}

    {step.comparison && (
      <div className="mb-8">
        <h3 className="label-eyebrow text-ink mb-4">{step.comparison.title}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-rule border border-rule">
          {step.comparison.items.map((item, index) => (
            <div key={index} className="bg-paper p-5">
              <h4 className="font-display text-lg tracking-[-0.02em] text-ink mb-2">{item.name}</h4>
              <p className="text-sm text-ink-soft leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="mb-8 p-5 bg-[#f3e4dc] border-l-2 border-signal">
      <h3 className="text-sm font-medium text-signal mb-2 flex items-center">
        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Typische Fehler
      </h3>
      <p className="text-ink-soft">{step.typischeFehler}</p>
    </div>

    {step.kaufhilfe && (
      <div className="p-5 bg-bone border border-rule">
        <h3 className="label-eyebrow text-ink mb-2">Kaufhilfe</h3>
        <p className="text-ink-soft text-sm">{step.kaufhilfe}</p>
      </div>
    )}
  </section>
);

interface Step {
  id: string;
  title: string;
}

const stepsData: StepData[] = [
  {
    id: 'planung',
    title: '1. Planung',
    ziel: 'Einen detaillierten Grundriss und eine realistische Budgetkalkulation erstellen.',
    warumJetzt: 'Fehler in der Planung sind später teuer und schwer zu korrigieren. Die Basis für jeden Ausbau.',
    werkzeugMaterial: ['Papier & Stift', 'Maßband', 'Klebeband (um den Grundriss im Transporter abzukleben)'],
    schrittFuerSchritt: [
      'Ausmessen des leeren Kastenwagens',
      'Erstellen eines Grundrisses',
      'Festlegen der wichtigsten Komponenten (Bett, Küche, Bad)',
      'Budgetplan aufstellen'
    ],
    typischeFehler: 'Zu eng kalkuliert! Das Bett ist zu kurz oder wichtige Komponenten passen nicht nebeneinander.',
    kaufhilfe: 'Nutze eine 3D-Software oder Online-Planer für präzise Skizzen.',
  },
  {
    id: 'rostschutz',
    title: '2. Rostschutz & Hohlraumversiegelung',
    ziel: 'Das Blech vor zukünftigem Rost schützen, besonders an schwer zugänglichen Stellen.',
    warumJetzt: 'Später sind die Hohlräume von der Dämmung und Verkleidung verdeckt.',
    werkzeugMaterial: ['Rostumwandler', 'Hohlraumversiegelung (z.B. Fluid Film)', 'Schleifpapier', 'Bremsenreiniger'],
    schrittFuerSchritt: [
      'Komplette Reinigung des Innenraums',
      'Abschleifen von vorhandenem Rost',
      'Rostumwandler auftragen',
      'Hohlräume großzügig versiegeln'
    ],
    typischeFehler: 'Schlechte Vorreinigung, sodass die Versiegelung nicht richtig haftet.',
    kaufhilfe: 'Fluid Film oder Mike Sanders sind bewährte Produkte für den Camper-Ausbau.',
  },
  {
    id: 'fenster',
    title: '3. Fenster & Dachluken',
    ziel: 'Mehr Licht und Luft in den Camper bringen, ohne dass Feuchtigkeit eindringt.',
    warumJetzt: 'Metallspäne fallen an, die man vor der Dämmung leichter wegsaugen kann.',
    werkzeugMaterial: ['Stichsäge mit feinem Metallblatt', 'Sikaflex/Dekaseal', 'Rostschutzgrundierung', 'Feile'],
    schrittFuerSchritt: [
      'Position anzeichnen und abkleben',
      'Ausschnitt sägen (Schutzbrille tragen!)',
      'Schnittkante entgratet, gereinigt und mit Rostschutz behandelt werden',
      'Holzrahmen innen anfertigen',
      'Fenster/Dachluke lückenlos abdichten und einsetzen'
    ],
    typischeFehler: 'Falsches Dichtmittel! Dekaseal 8936 bleibt dauerelastisch, Sikaflex 252 ist ein Kleber und lässt sich nie wieder lösen.',
    zusatzInfo: 'Zusatzinfo Fensteinbau: Besonders hervorheben, dass die Schnittkante entgratet, gereinigt und mit Rostschutz behandelt werden muss und dass die Dichtung lückenlos sitzen muss, damit weder Zugluft noch Feuchtigkeit eindringen.',
    comparison: {
      title: 'Vergleich: Fenster & Lüftung',
      items: [
        { name: 'Fenster', description: 'Doppelt verglaste Camperfenster mit sauberer Rahmenmontage, Rostschutz an Schnittkanten und vollständiger Abdichtung hervorheben.' },
        { name: 'Lüftung', description: 'Fenstergrößen und Position so planen, dass Durchzug möglich ist; über der Kochstelle ist eine Dachluke besonders sinnvoll (häufige Größe: 40x40 cm).' },
      ]
    }
  },
  {
    id: 'daemmung',
    title: '4. Dämmung',
    ziel: 'Kondenswasser vermeiden und angenehme Temperaturen im Sommer sowie Winter schaffen.',
    warumJetzt: 'Bevor Kabel und Wände reinkommen, muss das Blech isoliert werden.',
    werkzeugMaterial: ['Armaflex/Kautschuk', 'Schere/Cutter', 'Bremsenreiniger zum Entfetten', 'Alubutyl (optional zur Schalldämmung)'],
    schrittFuerSchritt: [
      'Blech entfetten',
      'Optional: Alubutyl gegen Dröhnen kleben',
      'Dämmung vollflächig aufkleben',
      'Stöße und Kanten abkleben'
    ],
    typischeFehler: 'Luftblasen unter der Dämmung, wo sich Kondenswasser sammeln und Rost bilden kann.',
    comparison: {
      title: 'Vergleich: Dämmstoffe',
      items: [
        { name: 'Armaflex/Kautschuk', description: 'Standardempfehlung für Wände und Dach. Leicht zu verarbeiten und geschlossenzellig (nimmt keine Feuchtigkeit auf).' },
        { name: 'Mineralwolle', description: 'Nur mit sauberer Dampfsperre verwenden! Ansonsten Gefahr von Schimmel durch Kondenswasser.' },
        { name: 'Schafwolle', description: 'Eher für Nutzer mit Naturmaterial-Fokus. Reguliert das Raumklima gut, erfordert aber ebenfalls sorgfältige Verarbeitung.' }
      ]
    }
  },
  {
    id: 'elektrik',
    title: '5. Elektrik-Vorbereitung',
    ziel: 'Alle Kabel und Leerrohre an die richtigen Stellen im Camper legen.',
    warumJetzt: 'Nach der Wandverkleidung ist das unsichtbare Verlegen unmöglich.',
    werkzeugMaterial: ['Wellrohre', 'Kabelzange', 'Kabel in passenden Querschnitten', 'Kabelbinder'],
    schrittFuerSchritt: [
      'Verbraucher-Positionen festlegen (Licht, USB, Kühlschrank)',
      'Leerrohre verlegen',
      'Kabel einziehen',
      'Ausreichend Kabellänge als Reserve lassen'
    ],
    typischeFehler: 'Zu dünne Kabelquerschnitte gewählt. Das führt zu Spannungsabfall oder Brandgefahr!',
    kaufhilfe: 'Nutze unseren 2D Elektrik-Planer zur genauen Bestimmung der Kabelquerschnitte und Komponenten.',
  },
  {
    id: 'boden',
    title: '6. Boden',
    ziel: 'Einen geraden, stabilen und isolierten Untergrund für Möbel schaffen.',
    warumJetzt: 'Die Basis für den restlichen Aufbau; Möbel müssen gerade stehen.',
    werkzeugMaterial: ['XPS/EPS Platten', 'OSB oder Siebdruckplatten', 'Bodenbelag (z.B. PVC)', 'Holzleisten'],
    schrittFuerSchritt: [
      'Lattengerüst auf das Bodenblech kleben',
      'Zwischenräume dämmen',
      'Bodenplatte zuschneiden und verschrauben',
      'Bodenbelag verlegen'
    ],
    typischeFehler: 'Bodenplatte knarrt, weil die Unterkonstruktion nicht ordentlich verklebt/verschraubt ist.',
  },
  {
    id: 'wand-decke',
    title: '7. Wand- und Deckenverkleidung',
    ziel: 'Den Wohnraum optisch ansprechend und wohnlich gestalten.',
    warumJetzt: 'Der Rohbau ist abgeschlossen, jetzt wird es gemütlich.',
    werkzeugMaterial: ['Profilholz/Sperrholz', 'Akkuschrauber', 'Stichsäge', 'Holzlasur'],
    schrittFuerSchritt: [
      'Unterkonstruktion (Latten) anbringen',
      'Kabeldurchführungen markieren',
      'Holzpaneele zuschneiden und anschrauben/nageln',
      'Holz behandeln (Ölen/Lasieren)'
    ],
    typischeFehler: 'Keine Dehnungsfugen gelassen! Holz arbeitet und kann sich wellen, wenn es zu eng verlegt wird.',
  },
  {
    id: 'moebelbau',
    title: '8. Möbelbau',
    ziel: 'Stauraum, Bett und Küche nach den eigenen Bedürfnissen bauen.',
    warumJetzt: 'Die Hülle ist fertig, jetzt kommt die Einrichtung.',
    werkzeugMaterial: ['Pappelsperrholz (leicht!)', 'Scharniere/Auszüge', 'Holzleim', 'Winkel'],
    schrittFuerSchritt: [
      'Gerüst aus Konstruktionsholz bauen',
      'Verkleidung mit leichtem Holz',
      'Türen und Schubladen einpassen',
      'Möbel fest mit der Karosserie (Unterkonstruktion) verschrauben'
    ],
    typischeFehler: 'Möbel aus schwerem MDF oder Spanplatten gebaut – das kostet extrem viel Zuladung.',
    kaufhilfe: 'Pappelsperrholz (12-15mm) ist der Standard im Camperbau, da es sehr leicht ist.',
  },
  {
    id: 'kueche-kuehlschrank',
    title: '9. Küche & Kühlschrank',
    ziel: 'Lebensmittel kühlen und kochen können.',
    warumJetzt: 'Der letzte große Schritt, bevor es an die Details geht.',
    werkzeugMaterial: ['Wasserkanister', 'Spülbecken', 'Kühlschrank', 'Gaskocher/Induktion'],
    schrittFuerSchritt: [
      'Spülbecken in Arbeitsplatte einlassen',
      'Frisch- und Abwasserkanister anschließen',
      'Kühlschrank anschließen',
      'Kochfeld installieren'
    ],
    typischeFehler: 'Kühlschrank ohne ausreichende Hinterlüftung eingebaut, was zu Hitzestau und hohem Stromverbrauch führt.',
    comparison: {
      title: 'Vergleich: Kühlschrank-Systeme',
      items: [
        { name: 'Kompressor', description: 'Beste Allround-Lösung für starke Kühlung ohne Karosserie-Lüftungsöffnungen. Benötigt meist 12V Strom.' },
        { name: 'Absorber', description: 'Gute Budget-/Gas-Lösung mit 230 V, 12 V und Gasbetrieb. Kühlt aber bei hohen Außentemperaturen schlechter.' },
      ]
    }
  }
];

export default function AusbauFahrplanPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col md:flex-row">
        <aside className="w-full flex-shrink-0 border-b border-rule md:w-56 md:border-b-0 md:border-r" aria-label="Kapitel">
          <div className="sticky top-0 p-5">
            <h2 className="text-sm font-medium">Inhalt</h2>
            <nav className="mt-3 space-y-1" aria-label="Sprungmarken">
              {stepsData.map((step) => (
                <a
                  key={step.id}
                  href={`#${step.id}`}
                  className="flex min-h-11 items-center py-1 text-sm text-ink-soft hover:text-ink"
                >
                  {step.title}
                </a>
              ))}
            </nav>
            <Link href="/guides/holzausbau" className="mt-6 inline-flex min-h-11 items-center text-sm text-copper">
              Holzausbau →
            </Link>
          </div>
        </aside>

        <main id="main" className="flex-1 px-5 py-8 md:px-10 md:py-10">
          <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            Ausbau-Fahrplan
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Planung, Rostschutz, Fenster, Dämmung, Kabel, Boden, Wände, Möbel, Küche.
          </p>
          <div className="mt-8">
            {stepsData.map((step) => (
              <StepModule key={step.id} step={step} />
            ))}
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
