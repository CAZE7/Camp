/**
 * lib/seo/content/elektrik-fehler.ts — Cluster-Seite
 * `/camper-elektrik/fehler/`.
 *
 * Die 15 häufigsten Elektrik-Fehler im Camper-Selbstausbau: jeder Fehler mit
 * Folge und Gegenmaßnahme. Eigene Erfahrungen aus dem Briefing sind als
 * solche markiert.
 */

import type { SeoPageContent } from '../types';

export const ELEKTRIK_FEHLER_CONTENT: SeoPageContent = {
  path: '/camper-elektrik/fehler/',
  slug: 'fehler',
  topicId: 'fehler',
  kind: 'ratgeber',
  title: 'Die 15 häufigsten Elektrik-Fehler im Camper-Selbstausbau',
  absoluteTitle: true,
  description:
    'Die 15 häufigsten Elektrik-Fehler im Selbstausbau: jeder Fehler mit Folge und Gegenmaßnahme — von der Sicherung am Pol bis zum Kabelquerschnitt.',
  h1: 'Die 15 häufigsten Elektrik-Fehler im Camper-Ausbau',
  lead: 'Die meisten Elektrik-Probleme im Camper sind keine Defekte, sondern Planungsfehler. Diese Seite listet die 15 häufigsten mit Folge und Gegenmaßnahme.',
  priority: 'P0',
  changeFrequency: 'monthly',
  sitemapPriority: 0.8,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'einleitung',
      heading: 'Warum Elektrik-Fehler so teuer werden',
      body: [
        'Ein Elektrik-Fehler im Camper macht sich meist erst im Betrieb bemerkbar: Die Kühlbox schaltet ab, die Batterie ist leer, die Sicherung fliegt raus. Dann liegt das Fahrzeug in der Werkstatt — oder der Ausbau muss aufgebrochen werden, weil das Kabel hinter der Verkleidung liegt.',
        'Die gute Nachricht: Die meisten Fehler lassen sich vermeiden, wenn man vor dem ersten Bohren rechnet. Die folgende Liste ist nach Häufigkeit sortiert, nicht nach Schwere.',
      ],
    },
    {
      id: 'fehler-1',
      heading: 'Fehler 1: Sicherung im Verteiler statt am Batteriepol',
      body: [
        'Die Sicherung schützt die Leitung, nicht das Gerät. Sitzt sie erst im Verteiler, ist die Strecke vom Pol zum Verteiler ungeschützt — genau dort fließt bei einem Kurzschluss der größte Strom.',
        'Gegenmaßnahme: Die Hauptsicherung gehört unmittelbar am Pluspol der Batterie, höchstens 0,2 m entfernt (ISO 10133:2000 § 8.1). Jeder weitere Abzweig bekommt seine eigene Sicherung passend zum Querschnitt.',
      ],
    },
    {
      id: 'fehler-2',
      heading: 'Fehler 2: Kabelquerschnitt nach Verbraucher statt nach Leitung gewählt',
      body: [
        '„Der Kühlschrank hat eine 15-A-Sicherung, also reicht 2,5 mm²“ dreht die Kette um: I_B ≤ I_n ≤ I_z. Die Sicherung folgt dem Querschnitt, nicht umgekehrt. Eine zu große Sicherung auf einem dünnen Kabel lässt den Leiter überhitzen.',
        'Gegenmaßnahme: Zuerst den Querschnitt aus Spannungsfall und Belastbarkeit bestimmen, dann die kleinste Sicherung wählen, die über dem Betriebsstrom liegt.',
      ],
      links: [
        {
          href: '/camper-elektrik/kabelquerschnitt/',
          label: 'Kabelquerschnitt berechnen',
          description: 'Formel, Normreihe und die Kette I_B ≤ I_n ≤ I_z.',
        },
      ],
    },
    {
      id: 'fehler-3',
      heading: 'Fehler 3: Nur die halbe Leitungslänge rechnen',
      body: [
        'Der Strom fließt hin und zurück. Wer nur die einfache Länge von Batterie zu Verbraucher einrechnet, halbiert den nötigen Querschnitt. Die Formel verwendet die einfache Länge mit dem Faktor 2: A = (2 · L · I) / (κ · ΔU).',
        'Gegenmaßnahme: Immer die einfache Leitungslänge angeben — der Faktor 2 für die Rückführung ist bereits in der Formel.',
      ],
    },
    {
      id: 'fehler-4',
      heading: 'Fehler 4: Keine Hauptsicherung an der Bordbatterie',
      body: [
        'Ohne Hauptsicherung direkt am Pol kann ein Kurzschluss in der Hauptleitung die Batterie entladen und das Kabel zur Heizung werden. Eine LiFePO4-Batterie kann dabei sehr hohe Kurzschlussströme liefern.',
        'Gegenmaßnahme: Hauptsicherung direkt am Pol, Dimensionierung nach dem stärksten gleichzeitig fließenden Strom (Laden plus größter Verbraucher).',
      ],
    },
    {
      id: 'fehler-5',
      heading: 'Fehler 5: Masse und Plus gemischt',
      body: [
        'Wer die Karosserie als Masseleitung nutzt, schafft versteckte Korrosionsstellen und schlechte Kontakte. Im Camper ist jeder Verbraucher besser über eine eigene Minusleitung zurück zur Batterie oder Sammelschiene angeschlossen.',
        'Gegenmaßnahme: Zweileitersystem (Plus und Minus separat verlegt), alle Minusleitungen über eine Sammelschiene zur Batterie führen.',
      ],
    },
    {
      id: 'fehler-6',
      heading: 'Fehler 6: Abschaltvermögen der Sicherung ignoriert',
      body: [
        'Eine Sicherung muss den Kurzschlussstrom am Einbauort sicher abschalten. Eine Flachsicherung mit 1 000 A Abschaltvermögen kann an einer großen LiFePO4-Bank überfordert sein — es entsteht ein Lichtbogen, den sie nicht löscht.',
        'Gegenmaßnahme: Beim Batteriepol eine Bauform mit ausreichendem Abschaltvermögen wählen (MEGA, ANL, MRBF oder Class T), nicht automatisch die kleinste Flachsicherung.',
      ],
      links: [
        {
          href: '/camper-elektrik/sicherungen/',
          label: 'Sicherungen dimensionieren',
          description: 'Bauformen mit typischem Abschaltvermögen.',
        },
      ],
    },
    {
      id: 'fehler-7',
      heading: 'Fehler 7: Spannungsfall vergessen',
      body: [
        'Bei 12 V entscheidet der Spannungsfall über den Querschnitt, nicht die Belastbarkeit. 10 A über 5 m brauchen nach dem Modell 6 mm² für 3 % Spannungsfall — 1,5 mm² würden den Verbraucher in die Unterspannungsabschaltung treiben.',
        'Gegenmaßnahme: Immer den Spannungsfall prüfen, besonders bei empfindlichen Verbrauchern (Kompressor-Kühlbox, Funkgerät, Laderegler).',
      ],
      links: [
        {
          href: '/camper-elektrik/spannungsabfall/',
          label: 'Spannungsabfall bei 12 V',
          description: 'Wann der Verbraucher abschaltet und wie viel Querschnitt nötig ist.',
        },
      ],
    },
    {
      id: 'fehler-8',
      heading: 'Fehler 8: Kabel im Fahrzeug nach Länge schätzen',
      body: [
        'Der Weg entlang der Karosserie ist fast immer länger als die Luftlinie. Kabel werden in Trassen geführt, nicht diagonal. Wer die Länge schätzt statt zu misst, bekommt einen zu dünnen Querschnitt.',
        'Gegenmaßnahme: Die tatsächliche Verlegewege messen und mit Reserve einplanen.',
      ],
    },
    {
      id: 'fehler-9',
      heading: 'Fehler 9: Querschnitt am Verbraucher reduziert',
      body: [
        'Ein 0,75-mm²-Anschlusskabel am Ende einer 10-mm²-Leitung bringt den Spannungsfall zurück und wird zur Schwachstelle. Jede Übergangsstelle ist ein Widerstand.',
        'Gegenmaßnahme: Bis zur letzten Klemme den richtigen Querschnitt führen, Verbrauchernähere Anschlüsse nicht dünner wählen als nötig.',
      ],
    },
    {
      id: 'fehler-10',
      heading: 'Fehler 10: Verlegeart und Temperatur ignoriert',
      body: [
        'Kabel im Bündel oder im warmen Motorraum tragen weniger als im Freien. Der Tabellenwert der Strombelastbarkeit gilt für Verlegeart B2 bei 30 °C — mit Derating 0,7 im elektroplaner-camper.de-Modell.',
        'Gegenmaßnahme: Bei Bündelung und hohen Umgebungstemperaturen den Derating-Faktor anwenden.',
      ],
    },
    {
      id: 'fehler-11',
      heading: 'Fehler 11: Keine Trennung von Verbraucherkreisen',
      body: [
        'Alle Verbraucher an einer Sicherung hängen zu lassen bedeutet: Ein Kurzschluss an der kleinsten Leitung löst die Hauptsicherung aus, und das ganze Fahrzeug ist dunkel. Besser: jeder Kreis hat seine eigene Sicherung.',
        'Gegenmaßnahme: Plusverteilung mit mehreren Kreisen, jeder Kreis abgesichert nach seinem Querschnitt.',
      ],
    },
    {
      id: 'fehler-12',
      heading: 'Fehler 12: Batterie ohne Trennschalter',
      body: [
        'Ohne Batterietrennschalter bleibt die Anlage auch im Winter oder bei Nichtnutzung angeschlossen. Kleine Verbraucher (Ladegerät, Display) entladen die Batterie über Monate.',
        'Gegenmaßnahme: Haupttrennschalter zwischen Batterie und Anlage, im Winter geöffnet.',
      ],
    },
    {
      id: 'fehler-13',
      heading: 'Fehler 13: LiFePO4 an Blei-Ladegerät oder Lichtmaschine ohne Booster',
      body: [
        'LiFePO4 braucht eine eigene Ladekurve (Konstantstrom, dann Konstantspannung). Ein Blei-Ladegerät lädt nie vollständig. Die Lichtmaschine ohne Ladebooster begrenzt den Strom nur über ihren eigenen Widerstand — die Lima kann überhitzen.',
        'Gegenmaßnahme: Ladegerät und Laderegler zur Chemie passen; Lichtmaschine immer über Ladebooster (DC-DC-Lader) an die Bordbatterie koppeln.',
      ],
      links: [
        {
          href: '/camper-elektrik/laden/',
          label: 'Ladebooster: Größe, Anschluss, Absicherung',
          description: 'Hauptseite zum Laden über die Lichtmaschine.',
        },
      ],
    },
    {
      id: 'fehler-14',
      heading: 'Fehler 14: Batterien verschiedener Kapazität parallel',
      body: [
        'Zwei Batterien mit unterschiedlicher Kapazität oder Marke parallel zu schalten führt zu ungleicher Stromverteilung. Das stärkere BMS dominiert, das schwächere wird über- oder unterbelastet.',
        'Gegenmaßnahme: Nur identische Batterien (gleicher Typ, gleiche Kapazität, gleiches Alter) parallel schalten.',
      ],
    },
    {
      id: 'fehler-15',
      heading: 'Fehler 15: 230-V-Anlage ohne Elektrofachkraft',
      body: [
        'Landstrom-Einspeisung, Wechselrichter mit Steckdosen und FI-Schutz sind keine Heimwerkerarbeit. Eine falsch installierte 230-V-Anlage ist lebensgefährlich und versicherungstechnisch nicht gedeckt.',
        'Gegenmaßnahme: Die 230-V-Anlage errichtet, ändert und prüft eine Elektrofachkraft nach DIN VDE 0100-721.',
        '[Erfahrung] Ich habe anfangs versucht, den Wechselrichter mit einer einfachen Steckdose an die 12-V-Anlage zu koppeln. Ein Elektriker hat mich darauf hingewiesen, dass das ohne FI-Schutz und ohne ordnungsgemäße Trennung nicht zulässig ist. Seitdem lasse ich alle 230-V-Arbeiten von einer Fachkraft machen. Foto: 230-V-Einspeisung mit CEE-Dose und FI-Schutz.',
      ],
      callout: {
        tone: 'warning',
        text: 'Die 230-V-Anlage (Landstrom, Wechselrichter-Ausgang mit Steckdosen) errichtet, ändert und prüft eine Elektrofachkraft nach DIN VDE 0100-721.',
      },
    },
  ],
  faq: [
    {
      question: 'Welcher Fehler ist der gefährlichste?',
      answer:
        'Die fehlende Hauptsicherung am Batteriepol: Ein Kurzschluss in der Hauptleitung kann ohne Schutzorgan die Batterie entleeren und das Kabel zur Heizung werden.',
    },
    {
      question: 'Muss jede Leitung einzeln abgesichert werden?',
      answer:
        'Ja. Jeder Abzweig braucht die Sicherung, die zu seinem Querschnitt passt. Eine gemeinsame Sicherung schützt nur die stärkste Leitung und lässt alle dünneren Abzweige ungeschützt.',
    },
    {
      question: 'Reicht eine Flachsicherung am Batteriepol?',
      answer:
        'Nicht bei großen LiFePO4-Bänken. Der Kurzschlussstrom ist dort hoch; die Sicherung muss ein ausreichendes Abschaltvermögen haben (MEGA, ANL, MRBF oder Class T).',
    },
  ],
  related: [
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen — Überblick' },
    { href: '/camper-elektrik/sicherungen/', label: 'Sicherungen im Camper' },
    { href: '/camper-elektrik/kabelquerschnitt/', label: 'Kabelquerschnitt berechnen' },
    { href: '/camper-elektrik/lifepo4/', label: 'LiFePO4 im Camper' },
    { href: '/planer/', label: 'Camper-Elektroplaner öffnen' },
  ],
  sources: [
    {
      label: 'Normen und Modellwerte',
      detail:
        'ISO 10133:2000 § 8.1 (Hauptsicherung ≤ 0,2 m ab Pol) · DIN VDE 0298-4 (Strombelastbarkeit, Derating 0,7) · elektroplaner-camper.de-Modell (κ = 58, 3 % Spannungsfall).',
    },
  ],
  assumptions: [
    'Die Liste basiert auf typischen Selbstausbau-Fehlern, nicht auf einer statistischen Erhebung.',
    'Normwerte beziehen sich auf das elektroplaner-camper.de-Modell und sind keine Rechtsauskunft.',
  ],
  limits: [
    'Kein Ersatz für eine Prüfung durch eine Elektrofachkraft.',
    'Keine Aussagen zu 230-V-Installationen ohne Fachkraft.',
  ],
};
