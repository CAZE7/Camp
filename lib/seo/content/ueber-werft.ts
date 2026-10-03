/**
 * lib/seo/content/ueber-werft.ts — Vertrauensseite `/ueber-werft/` (§19).
 *
 * Sie beantwortet die Frage „warum kann ich diesen Zahlen glauben?" mit dem,
 * was im Projekt tatsächlich nachprüfbar ist: Quellen, Rechenwege, Grenzen,
 * Prüfungen. Keine erfundenen Referenzen, keine fachliche Prüfung, die es
 * nicht gibt — es gibt keine.
 */

import { FUSE_BREAKING_CAPACITY_A, FUSE_TYPE_LABELS } from '@/lib/shortCircuit';
import { COPPER_CONDUCTIVITY_MS_PER_MM2, COPPER_RESISTIVITY_OHM_MM2_PER_M } from '@/lib/materials';
import { VDE_GROUP_FACTORS_MAX_N } from '@/lib/electrical';

import type { SeoPageContent } from '../types';

const CAPACITY_ROWS = (['ato', 'midi', 'anl', 'mrbf'] as const).map((type) => [
  FUSE_TYPE_LABELS[type],
  `${FUSE_BREAKING_CAPACITY_A[type].toLocaleString('de-DE')} A`,
]);

export const UEBER_WERFT_CONTENT: SeoPageContent = {
  path: '/ueber-werft/',
  slug: 'ueber-werft',
  topicId: 'vertrauen',
  kind: 'vertrauen',
  title: 'Über Werft: Projekt, Methodik und Grenzen',
  absoluteTitle: true,
  description:
    'Werft ist ein Planungswerkzeug für den Camper-Ausbau. Was es rechnet, worauf es sich stützt, was es nicht kann — und wie die Seiten entstehen.',
  h1: 'Über Werft',
  lead: 'Werft ist ein Planungs- und Rechenwerkzeug für den Camper-Ausbau: Elektrik, Dach, Heizlast. Diese Seite erklärt, wie die Zahlen entstehen, worauf sie sich stützen und wo die Grenzen liegen — damit jede Zahl auf ihre Weise überprüfbar bleibt.',
  priority: 'P1',
  changeFrequency: 'monthly',
  sitemapPriority: 0.6,
  contentRevision: '2026-10',
  sections: [
    {
      id: 'projekt',
      heading: 'Das Projekt',
      body: [
        'Werft entstand aus einer wiederkehrenden Beobachtung: Beim Camper-Ausbau entscheidet die PLANUNG über Sicherheit und Kosten — und gleichzeitig ist die Planung der Teil, für den es die wenigsten Werkzeuge gibt. Ein Kabelquerschnitt wird über den Daumen gewählt, eine Batterie nach Bauchgefühl, und der Fehler fällt im ersten Winter auf.',
        'Deshalb ist Werft kein Katalog und kein Blog mit Rechnern, sondern eine Werkstatt: Der Kern ist der Camper-Elektroplaner — Bauteile setzen, verbinden lassen, und dabei werden Querschnitt, Sicherung, Spannungsfall und Energiebilanz für jede Leitung geprüft. Dazu kommen Einzelrechner für die Fragen, die man vor dem Plan beantwortet: Kabel, Batterie, Solar, Heizlast, Dachbelegung.',
      ],
    },
    {
      id: 'methodik',
      heading: 'Wie gerechnet wird',
      list: {
        items: [
          `Spannungsfall über die Kupfer-Leitfähigkeit κ = ${COPPER_CONDUCTIVITY_MS_PER_MM2} m/(Ω·mm²) bei 20 °C (Kehrwert von ρ = ${COPPER_RESISTIVITY_OHM_MM2_PER_M} Ω·mm²/m, der in den Branchentabellen übliche Verlegepraxis-Wert).`,
          'Querschnittsbemessung in beide Richtungen: A = I · 2L / (κ · ΔU) sucht den Querschnitt, ΔU = I · 2L / (κ · A) bewertet eine vorhandene Leitung. Es gibt keinen zweiten Rechenweg.',
          'Strombelastbarkeit nach DIN VDE 0298-4 (Verlegeart B2, 30 °C, zwei belastete Adern) mit einem dokumentierten Derating von 0,7 für Bündelung und höhere Umgebungstemperatur.',
          `Sicherungen nach der Kette I_B ≤ I_n ≤ I_z: Die größte zulässige Sicherung folgt der belastbaren Leitung, nicht dem Verbraucher. Bündel bis ${VDE_GROUP_FACTORS_MAX_N} Stromkreise werden über Häufungsfaktoren des Modells abgebildet.`,
          'Kapazität über Entladetiefe je Chemie und den Peukert-Effekt — beides als Modellgröße benannt, nicht als Messung ausgegeben.',
          'Solar über spezifischen Ertrag, Winterfaktor (35 % des Sommerwerts) und Ladezeit-Aufschlag (1,15).',
        ],
      },
      body: [
        'Wo eine Größe eine Annahme ist, steht sie als Annahme auf der Seite — und wenn sie im Rechner veränderbar ist, steht sie als Eingabefeld dort. Eine Zahl, die niemand belegen kann, wird nicht als Ergebnis ausgegeben.',
      ],
    },
    {
      id: 'quellen',
      heading: 'Quellen und Bezugsrahmen',
      list: {
        items: [
          'DIN VDE 0298-4 — Strombelastbarkeit der Leitungen (Modellspalte Verlegeart B2).',
          'DIN VDE 0100-430 — Schutz bei Überstrom, Koordination von Betriebsstrom, Sicherung und Leitungsbelastbarkeit.',
          'DIN VDE 0100-520 — Auswahl und Errichtung elektrischer Betriebsmittel, Spannungsfall.',
          'DIN VDE 0100-721 — Kleinspannungsanlagen in Caravans und Motorcaravans.',
          'ISO 10133:2000 § 8.1 — Schutzorgan am Quellpunkt (200 mm) bei Kleinspannungs-Gleichstromanlagen.',
          'IEC 60364-5-54 (Schutzleiter), IEC 60898-1 (Leitungsschutzschalter), IEC 60364-4-41 (Abschaltbedingung) — die 230-V-Prüfungen.',
          'NEC 690.8 / 690.9 — Ableitung des Sicherungsfaktors im Solarkreis (1,5625 × Isc).',
        ],
      },
      body: [
        `Die Normwerte werden als Geltungsbereich zitiert, nicht als Rechtsauskunft. Wo eine Angabe aus Herstellerdatenblättern stammt (etwa die Abschaltvermögen der Sicherungsbauformen — ATO ${FUSE_BREAKING_CAPACITY_A.ato.toLocaleString('de-DE')} A, MIDI ${FUSE_BREAKING_CAPACITY_A.midi.toLocaleString('de-DE')} A, Class T ${FUSE_BREAKING_CAPACITY_A.classT.toLocaleString('de-DE')} A), sagt der Quelltext das ausdrücklich, und das Datenblatt des konkreten Produkts geht vor.`,
      ],
      table: {
        caption: 'Abschaltvermögen: typische Ankerwerte je Bauform (Modellwerte, Auszug)',
        head: ['Bauform', 'Abschaltvermögen (typisch)'],
        rows: CAPACITY_ROWS,
        note: 'Vollständige Tabelle mit 32-V-Bezug und Herstellerhinweisen: [Sicherungen im Camper](/camper-elektrik/sicherungen/).',
      },
    },
    {
      id: 'pruefung',
      heading: 'Wie die Seiten geprüft werden',
      body: [
        'Jede dieser Seiten ist Teil eines maschinell geprüften Exports: Titel, Beschreibung, Canonical-Verweis, Hauptüberschrift, Vorschaukarten, strukturierte Beschreibung, Brotkrumen und interne Verweise werden nach dem Bau automatisch gegen Regeln gehalten. Fehlt ein Ziel, ist ein Titel doppelt oder widerspricht die Sitemap einer noindex-Seite, wird der Lauf rot.',
        'Dasselbe gilt für die Rechnungen: Die Beispiele auf diesen Seiten werden beim Bau aus demselben Modell berechnet, das der Rechner benutzt — eine Seite kann also nicht andere Zahlen zeigen als das Werkzeug daneben.',
      ],
      links: [
        { href: '/rechner/', label: 'Alle Rechner im Überblick' },
        { href: '/camper-elektrik/', label: 'Camper-Elektrik planen' },
      ],
    },
    {
      id: 'grenzen',
      heading: 'Grenzen',
      list: {
        items: [
          'Werft ersetzt keine Elektrofachkraft: Die 230-V-Anlage im Fahrzeug braucht Aufbau und Abnahme durch eine qualifizierte Person.',
          'Das Modell kennt keine Alterung, keine Zyklenzahl und keine Garantien von Bauteilen.',
          'Mechanische Fragen — Verlegung, Scheuerschutz, Befestigung, Brandverhalten, Zuladung — sind keine Rechengrößen.',
          'Batteriedaten einzelner Produkte (Ladespannungen, Temperaturfenster, BMS-Schwellen) stehen nicht im Modell; die Datenblätter der Hersteller sind dort die Quelle.',
          'Es gibt keine fachliche Prüfung durch eine externe Stelle. Wo eine Seite sich auf Normen stützt, steht die Bezugsnorm dabei; wo eine Größe eine Modellannahme ist, steht „Annahme" dabei.',
        ],
      },
    },
    {
      id: 'kontakt',
      heading: 'Kontakt und Korrekturen',
      body: [
        'Fehlerfunde sind ausdrücklich willkommen — vor allem dort, wo eine Zahl einer Norm widerspricht. Die Anbieterkennzeichnung mit Kontaktweg steht im [Impressum](/impressum/); welche Daten die Seite verarbeitet, im [Datenschutz](/datenschutz/).',
      ],
    },
  ],
  faq: [
    {
      question: 'Kann ich mich auf die Berechnungen verlassen?',
      answer:
        'Die Berechnungen sind nachvollziehbar: Jede Seite nennt Formel, Eingabewerte und Annahmen, und die Beispiele werden aus demselben Modell erzeugt wie der Rechner. Verantwortung bleibt trotzdem beim Planenden — insbesondere bei 230 V, bei Batterien und bei mechanischen Fragen.',
    },
    {
      question: 'Wer hat die Inhalte fachlich geprüft?',
      answer:
        'Es gibt keine benannte fachliche Prüfung durch eine externe Person oder Stelle, und es wird keine behauptet. Angegeben sind stattdessen die Bezugsnormen, die Rechenwege und die Grenzen des Modells. Wer eine Prüfung durch eine Elektrofachkraft braucht, findet den Hinweis bei der jeweiligen Seite.',
    },
    {
      question: 'Warum steht auf den Seiten kein „Zuletzt aktualisiert"-Datum?',
      answer:
        'Weil ein Datum pro Auslieferung nichts über eine inhaltliche Änderung aussagt. Die Sitemap führt deshalb bewusst keine lastModified-Zeitstempel, und inhaltliche Stände stehen als Revisionsangabe am Inhalt selbst — nur dann geändert, wenn sich der Inhalt tatsächlich geändert hat.',
    },
  ],
  related: [
    { href: '/', label: 'Startseite' },
    { href: '/camper-elektrik/', label: 'Camper-Elektrik planen' },
    { href: '/rechner/', label: 'Alle Rechner' },
    { href: '/elektrik-planung/', label: 'Camper-Elektroplaner öffnen' },
    { href: '/impressum/', label: 'Impressum' },
    { href: '/datenschutz/', label: 'Datenschutz' },
  ],
  sources: [
    {
      label: 'Modellwerte in der Auslieferung',
      detail:
        '`lib/materials.ts` (Kupfer), `lib/electrical.ts` (Normreihe, Derating, Sicherungsgrenzen), `lib/vde-standards.ts` (Entladetiefen, Systemspannungen, Solarfaktoren), `lib/shortCircuit.ts` (Abschaltvermögen), `lib/acProtection.ts` (230-V-Modell).',
    },
    {
      label: 'Prüfungen der Auslieferung',
      detail:
        'Der SEO-Prüflauf (`scripts/seo/auditExport.ts`) prüft den gebauten Export; die elektrischen Invarianten prüfen die Test-Suiten in `lib/` und `scripts/`.',
    },
  ],
  assumptions: [
    'Normzitate geben den Geltungsbereich der genannten Regelwerke wieder und sind keine Rechtsprüfung.',
    'Beispielwerte auf Themenseiten sind als Beispiel gekennzeichnet.',
  ],
  limits: [
    'Keine Haftung für Schäden aus der Umsetzung — die Verantwortung für die eigene Anlage bleibt beim Errichter.',
    'Keine Aussage über die Zulässigkeit eines konkreten Umbaus im Einzelfall (TÜV, Zulassung, Versicherung).',
  ],
};
