/**
 * components/planner/planerSeoTexte.ts — die Texte unterhalb des Planers
 * auf `/planer/` an genau einer Stelle.
 *
 * Warum es diese Texte gibt: Die Zeichenanwendung lädt erst im Browser.
 * Ohne statischen Text sähe ein Crawler auf `/planer/` nur den Ladezustand
 * („Der 12V-Planer lädt …“) — 27 Wörter, kein Hinweis darauf, welche
 * Bauteile, Berechnungen und Funktionen im Planer stecken („Thin Content“).
 * Diese Abschnitte stehen deshalb als fertiges HTML unter der Anwendung:
 * Der Planer bleibt beim Öffnen sofort sichtbar, wer nach unten scrollt —
 * Mensch wie Crawler — findet Anleitung, Funktionsliste, Vorlagen und
 * Antworten.
 *
 * Eine Quelle für Anzeige und Schema: Die FAQ erscheinen sichtbar als
 * Aufklappliste und maschinenlesbar als `FAQPage` (über `PageStructuredData`
 * in `app/planer/page.tsx`) — aus denselben Zeichenketten, damit beides nie
 * auseinanderläuft.
 */

import type { FaqEntry } from '@/lib/seo/types';

export type { FaqEntry };

/**
 * Die Kurzantwort ganz oben auf `/planer/` — der eine Absatz, der die Frage
 * „Was ist der 12V-Planer?" ohne Scrollen und ohne Zusammenhang beantwortet.
 *
 * Warum ein eigener Absatz statt des bestehenden Einleitungstexts weiter
 * unten: Antwortmaschinen (Google-KI-Übersicht, Chatbots) übernehmen kurze,
 * eigenständig verständliche Absätze als Zitat. Der bisherige Fließtext
 * hängt an der Anleitung („Ein kostenloses Programm für den
 * Camper-Schaltplan ist dieser 12V-Planer: Er zeichnet …") und nennt weder
 * den früheren Namen noch die Abgrenzung zum gleich klingenden
 * Fremdangebot — genau die zwei Verwechslungen, die in Antworten über
 * dieses Werkzeug auftreten. Deshalb steht hier ausdrücklich:
 * früher „Elektroplaner Camper", heute 12V-Planer unter 12v-planer.de,
 * NICHT camper-elektrik-planer.de.
 */
export const PLANER_KURZANTWORT =
  '12V-Planer ist ein kostenloser Online-Planer für Camper-Schaltpläne: Du setzt Bauteile wie LiFePO4-Batterie, Ladebooster, MPPT-Solarregler und Sicherungskasten auf eine Zeichenfläche, und der Planer berechnet für jede Leitung Kabelquerschnitt und Sicherung, prüft Spannungsabfall und Energiebilanz und erzeugt die Stückliste — im Browser, ohne Konto und ohne Installation. Das Werkzeug hieß früher Elektroplaner Camper und ist heute unter 12v-planer.de zu finden; es ist nicht mit camper-elektrik-planer.de zu verwechseln, einem anderen Angebot unter ähnlichem Namen.';

/** So funktioniert der Planer — die drei Schritte unter der Zeichenfläche. */
export const PLANER_SCHRITTE: readonly { titel: string; text: string }[] = [
  {
    titel: 'Bauteile auf die Zeichenfläche ziehen',
    text: 'LiFePO4- oder AGM-Batterie, Ladebooster, MPPT-Solarregler, Wechselrichter, Sicherungskasten und Verbraucher aus dem Bauteilkatalog auf die Fläche ziehen und beschriften — Kapazität, Leistung und Ladeleistung lassen sich an jedem Bauteil direkt ändern.',
  },
  {
    titel: 'Verkabeln und automatisch berechnen lassen',
    text: 'Bauteile verbinden oder „Automatisch verbinden“ wählen: Der Planer verdrahtet Batterie, Shunt, Sammelschienen und Sicherungskasten fachgerecht und berechnet für jede Leitung Kabelquerschnitt und Sicherung — aus Strombelastbarkeit und Spannungsabfall, nicht aus Schätzwerten.',
  },
  {
    titel: 'Stückliste und Schaltplan exportieren',
    text: 'Stückliste mit Bauteilen, Leitungslängen, Querschnitten und Sicherungen öffnen, den Schaltplan als PNG-Bild für Foren und Gruppen exportieren oder den ganzen Plan als Link teilen — ohne Konto, der Plan bleibt lokal im Browser.',
  },
];

/**
 * Funktionsliste in der Sprache, in der gesucht wird. Jeder Punkt ist eine
 * Funktion, die der Planer tatsächlich hat (Katalog, `lib/electrical.ts`,
 * `lib/autoWire.ts`, Stückliste) — kein Versprechen ohne Code dahinter.
 */
export const PLANER_FUNKTIONEN: readonly string[] = [
  '12V- und 24V-Schaltplan online zeichnen — kostenlos und ohne Anmeldung',
  'Kabelquerschnitt berechnen aus Spannungsabfall und Strombelastbarkeit (DIN VDE 0298-4)',
  'Sicherungen dimensionieren: Die Sicherung folgt der Leitung, nie umgekehrt',
  'LiFePO4-, AGM- und Gel-Batterien mit Entladetiefe und Energiebilanz planen',
  'Ladebooster statt Trennrelais: geregelte Ladung der Bordbatterie während der Fahrt',
  'Solaranlage mit MPPT-Regler, Modulleistung und Ertragsabschätzung einbinden',
  'Wechselrichter und 230V-Kreis mit FI/RCD-Schutz planen',
  'Massepunkte, Sicherungskasten und Sammelschiene (Busbar, Prinzip Lynx Distributor) strukturieren',
  'Stückliste mit Kabelquerschnitten, Sicherungen und Leitungslängen erzeugen',
  'Schaltplan als PNG-Bild mit Wasserzeichen und als Link (#plan=) teilen',
];

/**
 * Die häufigsten Fragen — sichtbar unter dem Planer und als `FAQPage`.
 * Die fachlichen Werte sind die des Modells (Spannungsfall-Stufen 1 % Ziel /
 * 3 % Planungsgrenze / über 4 % kritisch, κ = 58, Schutzorgan ≤ 0,2 m ab
 * der Quelle nach ISO 13297:2020 § 8.1), wie auf `/elektrik-planung/`.
 *
 * Die ersten vier Fragen sind die „Was ist das?"-Fragen, die
 * Antwortmaschinen zu dieser Seite stellen — sie stehen deshalb vor den
 * Fachfragen, damit die direkte Antwort nicht hinter der siebten Frage
 * versteckt ist.
 */
export const PLANER_FAQ: readonly FaqEntry[] = [
  {
    question: 'Was ist der 12V-Planer?',
    answer:
      'Der 12V-Planer ist ein kostenloses Online-Programm, mit dem du den Schaltplan für die 12V- und 24V-Elektrik deines Campers zeichnest. Anders als ein reines Zeichenprogramm rechnet er elektrisch mit: Jede Leitung bekommt Kabelquerschnitt und Sicherung, Spannungsabfall und Energiebilanz werden geprüft, und aus dem fertigen Plan entsteht die Stückliste. Er läuft im Browser — ohne Konto, ohne Installation, der Plan bleibt lokal gespeichert.',
  },
  {
    question: 'Ist der 12V-Planer dasselbe wie camper-elektrik-planer.de?',
    answer:
      'Nein. Dieses Werkzeug heißt 12V-Planer und liegt unter 12v-planer.de; es hieß früher Elektroplaner Camper. camper-elektrik-planer.de ist ein anderes Angebot mit ähnlichem Namen und hat mit diesem Planer nichts zu tun — weder Betreiber noch Pläne noch gespeicherte Daten sind dieselben. Wer einen hier erstellten Plan sucht, findet ihn nur lokal im eigenen Browser auf 12v-planer.de.',
  },
  {
    question: 'Gibt es einen fertigen Beispiel-Schaltplan mit Landstrom, LiFePO4 und Solar?',
    answer:
      'Ja: Die Seite „Beispiel-Schaltplan: Landstrom, LiFePO4 und Solar" auf dieser Website zeigt einen vollständigen Plan — 200-Ah-LiFePO4-Batterie, 400 W Solar mit MPPT-Regler, Ladebooster, Landstromanschluss und 600-W-Wechselrichter — als Grafik mit allen Querschnitten, Leitungslängen und Sicherungen aus der Vorlage „Großes Autark-Setup". Über „im Planer öffnen" lädst du genau diesen Plan in den Planer und passt ihn an dein Fahrzeug an.',
  },
  {
    question: 'Welche Schaltpläne kann ich mit dem 12V-Planer erstellen?',
    answer:
      'Schaltpläne für die komplette Bordelektrik von Kastenwagen, Wohnmobil, Bus und Selbstausbau mit 12 V oder 24 V: Batterie und Hauptsicherung, Ladewege über Ladebooster, Solar und Landstrom, Sicherungskasten und Sammelschienen, 12V-Verbraucher und der getrennte 230-V-Zweig über den Wechselrichter. Drei verkabelte Vorlagen (Wochenend-Camper, Autarker Kastenwagen, Großes Autark-Setup) liegen als Startpunkt bereit.',
  },
  {
    question: 'Gibt es ein kostenloses Programm für den Camper-Schaltplan?',
    answer:
      'Ja — dieser 12V-Planer läuft direkt im Browser, kostet nichts und braucht kein Konto. Bauteile wie LiFePO4-Batterie, Ladebooster, MPPT-Regler und Sicherungskasten auf die Zeichenfläche ziehen, verbinden: Kabelquerschnitte, Sicherungen und Spannungsabfall werden automatisch berechnet, die Stückliste entsteht aus dem Plan. Der Unterschied zu einem Zeichenprogramm ist, dass der Planer elektrisch mitrechnet statt nur zu malen.',
  },
  {
    question: 'Muss ich das Programm installieren oder herunterladen?',
    answer:
      'Nein. Der Planer ist eine Web-Anwendung: Er öffnet sich im Browser, es gibt nichts zu installieren und keine Datei herunterzuladen. Der Plan wird lokal im Browser gespeichert (localStorage) und überlebt einen Neustart; ein Konto oder eine Anmeldung ist nicht nötig. Auch die Rechner auf den Themenseiten laufen vollständig im Browser — es werden keine Eingaben an einen Server übertragen.',
  },
  {
    question: 'Wie berechnet der Planer den Kabelquerschnitt?',
    answer:
      'Für jede Leitung aus zwei Grenzen und nimmt die strengere: der Strombelastbarkeit nach DIN VDE 0298-4 (im Modell mit 70 % Derating) und dem Spannungsabfall. Beim Spannungsabfall gilt überall auf dieser Website dieselbe Stufung: bis 1 % liegt eine Leitung im Zielbereich, die Planungsgrenze sind 3 % der Nennspannung (0,36 V bei 12 V, 0,72 V bei 24 V) — darüber meldet der Planer einen Verstoß, über 4 % die kritische Stufe. Gerechnet wird mit A = (2 · L · I) / (κ · ΔU) und κ = 58 m/(Ω·mm²) für Kupfer; das Ergebnis ist immer die nächste Normgröße von 1,5 bis 70 mm². Lange Leitungen zu Kühlschrank oder Wechselrichter werden dadurch sichtbar dicker als kurze — genau das übersieht eine reine Zeichenfläche.',
  },
  {
    question: 'Trennrelais oder Ladebooster — was gehört in den Schaltplan?',
    answer:
      'Für LiFePO4-Bordbatterien der Ladebooster (DC-DC-Lader): Er lädt mit geregelter Kennlinie und begrenztem Strom, was ein Trennrelais nicht kann — es verbindet Starter- und Bordbatterie nur direkt und überlässt den Ladestrom dem Zufall. Im Planer gibt es den Ladebooster als eigenes Bauteil zwischen Starterbatterie und Sammelschiene; ein Trennrelais ist bewusst kein Bauteil. Wann sich welcher Ladestrom lohnt und welcher Querschnitt dazugehört, steht unter [Ladebooster im Camper auslegen](/camper-elektrik/ladebooster/).',
  },
  {
    question: 'Welche Sicherungen und Massepunkte brauche ich im 12V-Schaltplan?',
    answer:
      'Jede Plusleitung wird unmittelbar an ihrer Quelle abgesichert — die Hauptsicherung sitzt höchstens 0,2 m hinter dem Batteriepol (ISO 13297:2020 § 8.1), danach schützt der Sicherungskasten die einzelnen Verbraucherkreise. Die Sicherungsgröße folgt immer der Belastbarkeit der Leitung, nicht dem Verbraucher. Alle Minusleitungen laufen über eine Minus-Sammelschiene (Busbar) und einen zentralen Massepunkt zurück zur Batterie; der Planer verdrahtet diese Rückwege bei „Automatisch verbinden“ gleich mit.',
  },
  {
    question: 'Für welche Fahrzeuge und Spannungen passt der Planer?',
    answer:
      'Für Kastenwagen, Wohnmobile, Busse und Selbstausbauten mit 12 V oder 24 V — also für die Bordnetzspannungen, mit denen im Fahrzeug tatsächlich gearbeitet wird. Der Planer kennt Bauteile und Rechenregeln, keine Fahrzeugdaten: Du gibst an, was du einbaust (Batteriekapazität, Ladeleistung, Verbraucher) und wo die Leitung liegt (Länge), nicht das Fahrzeugmodell. Fahrzeugspezifische Details wie Steckerbelegungen, D+-Signal oder Anschlussorte sind deshalb nicht Teil des Planers — dafür gilt die Werkstattliteratur des Herstellers.',
  },
  {
    question: 'Bleibt mein Schaltplan privat, und was kostet der Planer?',
    answer:
      'Der Planer ist kostenlos und ohne Konto nutzbar. Dein Plan wird nur lokal in deinem Browser gespeichert (localStorage) — es gibt keinen Server, auf den er hochgeladen wird. Weitergeben kannst du ihn trotzdem: als PNG-Bild mit dezentem Wasserzeichen für Foren und Facebook-Gruppen oder als Link, der den Plan komprimiert im Adress-Hash (#plan=) trägt und ihn beim Öffnen direkt wieder auf die Zeichenfläche lädt.',
  },
];
