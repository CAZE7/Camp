/**
 * lib/seo/types.ts — Datenmodell der Suchmaschinen-Seite von Camp.
 *
 * Warum ein eigenes Modul: Eine SEO-Landingpage besteht aus Angaben, die
 * an mehreren Stellen gebraucht werden — Titel und Beschreibung für die
 * Kopfdaten, die Hauptüberschrift für die Anzeige UND die Prüfung, die
 * Suchintention für das Inventar, Verweise für den Topic-Graph. Lägen diese
 * Angaben in der Seitendatei verstreut, könnte keine Prüfung sagen, ob eine
 * Absicht („12 V Kabelquerschnitt berechnen") überhaupt eine Seite hat.
 *
 * Hier beschreibt EIN Datensatz die Seite; `app/` rendert ihn, `scripts/seo/`
 * prüft ihn, `app/sitemap.ts` leitet die Sitemap daraus ab.
 *
 * Kein React, keine App-Importe — die Schichtenregel `lib/` gilt auch hier
 * (ARCHITECTURE-RULES Rule A).
 */

/** Art der Seite — entscheidet über Mindestumfang und Rolle im Topic-Graph. */
export type PageKind =
  | 'start'
  | 'pillar'
  | 'cluster'
  | 'rechner'
  | 'werkzeug'
  | 'ratgeber'
  | 'vertrauen'
  | 'rechtliches'
  | 'ansicht';

/** Seitenarten, deren No-JS-Inhalt sinnvoll per Wortzahl eingeordnet wird.
 * Interaktive Werkzeuge haben funktionale Oberfläche und Bedienhinweise; ein
 * Artikel-Mindestwert würde dort künstlichen Fülltext belohnen. */
export const THIN_CONTENT_KINDS: readonly PageKind[] = ['pillar', 'cluster', 'rechner', 'ratgeber'];

/** Prioritätsstufe der Content-Roadmap (siehe docs/seo/AUDIT.md). */
export type PriorityTier = 'P0' | 'P1' | 'P2' | 'P3';

/** Trägt die Seite `noindex` oder gehört sie in den Index? */
export type Indexability = 'index' | 'noindex';

/** Strukturierte Beschreibungstypen, die eine Seite tatsächlich trägt. */
export type StructuredDataType =
  | 'WebPage'
  | 'BreadcrumbList'
  | 'FAQPage'
  | 'WebApplication'
  | 'SoftwareApplication'
  | 'Article'
  | 'HowTo'
  | 'CollectionPage';

/**
 * Fließtext mit optionalen internen Verweisen in der Schreibweise
 * `[Anzeigetext](/ziel/)`. Der Renderer (`components/seo/RichText.tsx`) macht
 * daraus echte Verweise; die Prüfung liest dieselbe Schreibweise.
 *
 * Bewusst keine HTML-Zeichenketten: Ein Inhalt, der Markup enthielte, wäre
 * eine Einladung, Sicherheitsurteile in Texten zu verstecken.
 */
export type RichText = string;

/** Tabelle im Inhalt — Kopfzeile plus Zeilen, alle Zellen als Klartext. */
export type ContentTable = {
  caption?: string;
  head: readonly string[];
  rows: readonly (readonly string[])[];
  note?: RichText;
};

/** Formel mit Erläuterung — erscheint hervorgehoben im Fließtext. */
export type ContentFormula = {
  expression: string;
  caption?: RichText;
};

/** Hinweisbox. `warning` ist für Sicherheits- und Normgrenzen reserviert. */
export type ContentCallout = {
  tone: 'info' | 'warning';
  text: RichText;
};

/** Ein Verweis mit beschreibendem Ankertext (nie „hier klicken", §12). */
export type ContentLink = {
  href: string;
  label: string;
  description?: RichText;
};

/** Ein Abschnitt der Seite: genau eine `h2`, wahlweise mit Inhaltsteilen. */
export type ContentSection = {
  /** Fragment-Kennung; wird zur `id` des Abschnitts (Anker-Ziele im Inhaltsverzeichnis). */
  id: string;
  heading: string;
  body?: readonly RichText[];
  list?: { items: readonly RichText[]; ordered?: boolean };
  /** Begriffsliste (dl) — für Normen, Einheiten, Chemien. */
  definitions?: readonly { term: string; description: RichText }[];
  table?: ContentTable;
  formula?: ContentFormula;
  callout?: ContentCallout;
  /** Rechner, der in diesem Abschnitt steht (nur Rechner-Seiten). */
  calculator?: CalculatorId;
  /** Vertiefende Verweise am Abschnittsende. */
  links?: readonly ContentLink[];
  /** Unterabschnitte als `h3` — der Export verlangt keine Sprünge. */
  subsections?: readonly { heading: string; body: readonly RichText[] }[];
};

/** Kennung der eingebauten Rechner (Zuordnung erfolgt in `components/rechner`). */
export type CalculatorId = 'spannungsabfall' | 'batteriekapazitaet' | 'solaranlage' | 'kabelquerschnitt';

/** Frage/Antwort-Paar — dieselbe Zeichenkette für Anzeige und strukturierte Daten. */
export type FaqEntry = {
  question: string;
  answer: string;
};

/** Quelle, auf die sich eine Seite stützt (sichtbar im Quellenabschnitt, §18). */
export type ContentSource = {
  label: string;
  detail: RichText;
};

/**
 * Vollständige Beschreibung einer inhaltsgetriebenen Seite (Pillar, Cluster,
 * Rechner, Vertrauensseite). Enthält genau die Angaben, die sonst doppelt
 * gepflegt würden: Titel/Beschreibung (Kopfdaten), Hauptüberschrift (Anzeige
 * und Prüfung), Abschnitte (Inhalt), FAQ (Anzeige und JSON-LD).
 */
export type SeoPageContent = {
  /** Pfad im Export, mit führendem und abschließendem Schrägstrich. */
  path: string;
  /** Ordnername innerhalb der Route (nur für datengetriebene Unterseiten). */
  slug: string;
  /** Thema im Topic-Graph (siehe `topics.ts`). */
  topicId: string;
  kind: PageKind;
  /** Titel für Ergebnislisten. `absoluteTitle` unterdrückt den Markenzusatz. */
  title: string;
  absoluteTitle?: boolean;
  description: string;
  /** Überschrift der Seite — genau eine `h1` pro Seite. */
  h1: string;
  /** Einleitungssatz unter der Überschrift. */
  lead: RichText;
  priority: PriorityTier;
  /** Abschnitt „Was will der Nutzer wissen?" — Reihenfolge ist die Leserichtung. */
  sections: readonly ContentSection[];
  faq?: readonly FaqEntry[];
  /** Verwandte Seiten — der Weg tiefer in das Thema (§11). */
  related: readonly ContentLink[];
  /** Quellen der fachlichen Aussagen. */
  sources?: readonly ContentSource[];
  /** Annahmen, unter denen die Aussagen gelten (sichtbar, nicht im Kleingedruckten). */
  assumptions?: readonly RichText[];
  /** Grenzen des Modells — was die Seite NICHT leistet. */
  limits?: readonly RichText[];
  /** Stand der fachlichen Durchsicht als ISO-Monat (`2026-10`). */
  contentRevision: string;
  /** Änderungsfrequenz für die Sitemap (nur indexierbare Seiten). */
  changeFrequency: 'monthly' | 'yearly';
  /** Relative Priorität innerhalb der Auslieferung (0…1). */
  sitemapPriority: number;
  /** Optionale Abweichung vom Standard-Vorschaubild. */
  ogImage?: { path: string; width: number; height: number; alt: string };
};

/**
 * Inventareintrag einer Seite. Für inhaltsgetriebene Seiten wird er aus
 * `SeoPageContent` abgeleitet; für die bestehenden Seiten (Startseite,
 * Werkzeuge, Guides, Rechtliches) steht er ausdrücklich hier — mit
 * Hauptüberschrift und Suchintention, damit die Prüfung sie gegen den Export
 * halten kann (§4).
 */
export type PageEntry = {
  path: string;
  label: string;
  kind: PageKind;
  indexability: Indexability;
  /** Hauptüberschrift im Export — wird maschinell gegen die Seite geprüft. */
  h1: string;
  /** Bediente Suchintention in einem Satz. */
  searchIntent: string;
  /** Thema im Topic-Graph. */
  topicId: string;
  priority: PriorityTier;
  /** Repräsentative Anfragen (aus `opportunities.ts`, nicht hier gepflegt). */
  targetQueries: readonly string[];
  structuredData: readonly StructuredDataType[];
  /** Sitemap-Angaben — nur für indexierbare Seiten gesetzt. */
  sitemap?: { changeFrequency: 'monthly' | 'yearly'; priority: number };
  /** Herkunft der Seite im Quelltext (Nachschlagehilfe für Beitragende). */
  source: string;
  /** Titel ohne Markenzusatz; `absoluteTitle` steuert die Titelvorlage. */
  title: string;
  /** Einzigartige Beschreibung für Suchergebnisse und Vorschaukarten. */
  description: string;
  /** true = Titel enthält bereits den Markenzusatz und ist vollständig. */
  absoluteTitle?: boolean;
  /** Optionales Vorschaubild; ohne Angabe gilt das Bild der Website. */
  ogImage?: { path: string; width: number; height: number; alt: string };
  /** Eingebaute interaktive Rechner, die die Seite tatsächlich rendert. */
  calculators?: readonly CalculatorId[];
};
