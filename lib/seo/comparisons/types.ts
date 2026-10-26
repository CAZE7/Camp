/**
 * lib/seo/comparisons/types.ts — Datenmodell eines Produktvergleichs.
 *
 * Warum ein eigenes Modul: Der erste Vergleich dieser Seite stand als
 * 1.391-Zeilen-Komponente im JSX, und dieselben neun Geräte waren viermal von
 * Hand eingetragen (Leiter, Tabelle, Detailkarten, Kompaktkarten). Eine
 * Preisänderung war ein Suchspiel über vier Stellen, und drei Aussagen standen
 * je dreimal fast wortgleich auf derselben Seite.
 *
 * Hier beschreibt EIN Datensatz den Vergleich; `components/vergleich/` rendert
 * ihn, `lib/seo/inventory.ts` leitet die strukturierte Beschreibung daraus ab,
 * und `gates.ts` prüft, was sonst nur behauptet wäre: Vollständigkeit der
 * Merkmale, Aktualität der Preise, Einmaligkeit der Aussagen, Wortbudget.
 *
 * Kein React, keine App-Importe — die Schichtenregel `lib/` gilt auch hier
 * (ARCHITECTURE-RULES Rule A), wie in `lib/seo/types.ts`.
 */

import type { RichText } from '../types';

/** Numerische Achsen eines Produkts, nach denen die Rangliste sortiert. */
export type Sortierschluessel = 'strom' | 'preis';

/**
 * Ein Vergleichsmerkmal. Die Reihenfolge ist die Reihenfolge der Spalten in der
 * Rangliste und der Zeilen in der Produktkarte — beide Darstellungen lesen
 * dieselbe Liste, damit sie nicht auseinanderlaufen können.
 */
export type ComparisonAttribute = {
  /** Kennung; Schlüssel in `ComparisonProduct.specs`. */
  id: string;
  /** Spalten- bzw. Zeilenbeschriftung. */
  label: string;
  unit?: string;
  /** Spalte in der Rangliste? Sonst nur in der Produktkarte. */
  inTable: boolean;
  /**
   * Erklärung des Merkmals — genau hier und damit einmal auf der Seite, nicht
   * je Produkt wiederholt.
   */
  legend?: RichText;
  /**
   * Zahlenachse, über die diese Spalte sortiert.
   *
   * Der Anzeigewert eines Merkmals ist Text („45 / 55 / 63 / 70 A") und damit
   * nicht sortierbar; sortiert wird über `ComparisonProduct.stromA` bzw.
   * `priceEur`. Die Zuordnung steht hier, damit die Komponente nicht raten muss,
   * welche Spalte zu welcher Zahl gehört.
   */
  sortierbar?: Sortierschluessel;
};

/**
 * Wert eines Merkmals.
 *
 * `null` heißt „nachgesehen, nicht belegt" und ist eine **Aussage**. Ein
 * fehlender Schlüssel heißt „vergessen" und ist ein Gate-Fehler (G2). Der
 * Unterschied ist der ganze Zweck der Vollständigkeitsprüfung.
 */
export type AttributeValue = string | number | null;

/** Tone eines Hinweises. `block` ist für Datenlagen, vom Kauf abzuraten ist. */
export type CaveatTone = 'warn' | 'block';

export type ComparisonProduct = {
  /** Ankerziel `#p-<id>` — Rangliste und JSON-LD nutzen dieselbe Kennung. */
  id: string;
  brand: string;
  name: string;
  /** Zuordnung zu `ComparisonSpec.classes`; steuert den Filter. */
  classId: string;
  /** Muss jeden in `attributes` deklarierten `id` als Schlüssel tragen (G2). */
  specs: Readonly<Record<string, AttributeValue>>;
  /** „Passt für" — ein Einsatzfall, kein Urteil mit Note. */
  fit: { label: string; tone: 'pick' | 'plain' };
  /** „Haken" — Einschränkungen, die es nur hier gibt. */
  caveats: readonly { text: RichText; tone: CaveatTone }[];
  /**
   * Nennstrom in Ampere als Zahl — Sortierschlüssel der Rangliste und Wert für
   * `additionalProperty` in der strukturierten Beschreibung.
   *
   * `null` heißt „nicht belegt" und sortiert ans Ende. Das ist eine Entscheidung:
   * Ein Importgerät mit „110–120 A (angeblich)" hätte sich sonst vor Geräte
   * sortiert, deren Strom aus dem Handbuch steht. Bei widersprüchlichen Angaben
   * gilt der kleinere belegte Wert — beim BB12120 also 110 A aus dem Handbuch,
   * nicht 120 A von der Produktseite.
   */
  stromA: number | null;
  /** Beobachteter Straßenpreis in Euro; `null` = kein Preis belegt. */
  priceEur: number | null;
  /** ISO-Datum der Preisprüfung. Älter als `PREIS_MAX_TAGE` ist ein Fehler (G5). */
  priceChecked: string;
  /** Langtext der Produktkarte, eingeklappt gerendert. */
  detail: readonly RichText[];
  links: readonly ComparisonLink[];
};

export type ComparisonLinkKind = 'datasheet' | 'price' | 'manual' | 'report';

export type ComparisonLink = {
  href: string;
  label: string;
  kind: ComparisonLinkKind;
};

/**
 * Ein Einsatzfall: Situation → Gerät → ein Grund. Das ist die Entscheidungshilfe,
 * die beim ersten Vergleich hinter Rechner und Forenbeobachtungen stand und
 * deshalb niemand erreicht hat.
 */
export type ComparisonUseCase = {
  id: string;
  /** Eine Zeile, wer gemeint ist. */
  situation: RichText;
  /** Muss die `id` eines Produkts sein (G2). */
  pickId: string;
  /** Ein Satz, warum dieses Gerät — kein zweiter Absatz. */
  why: RichText;
};

/** Quellenblock des Vergleichs, gruppiert und eingeklappt gerendert. */
export type ComparisonSourceGroup = {
  group: string;
  entries: readonly ComparisonLink[];
};

export type ComparisonClass = { id: string; label: string };

export type ComparisonSpec = {
  /** Kennung des Vergleichs; wird Teil der Fragment-Kennungen. */
  id: string;
  /** `h2` der Vergleichszone. */
  heading: string;
  /** Zugänglicher Name der Rangliste — derselbe Text steht in der `caption`. */
  tableLabel: string;
  tableCaption: RichText;
  /** Sichtbarer Hinweis, dass nicht mit Sternen oder Noten bewertet wird. */
  noRatingNote: RichText;
  /** Stand der Preise als lesbare Zeile — genau einmal auf der Seite. */
  priceAsOf: string;
  /** ISO-Datum des Preisstands; Referenz für `priceChecked` der Produkte. */
  priceAsOfDate: string;
  attributes: readonly ComparisonAttribute[];
  classes: readonly ComparisonClass[];
  /** Reihenfolge ist die Rangreihenfolge ohne JavaScript. */
  products: readonly ComparisonProduct[];
  useCases: readonly ComparisonUseCase[];
  sources: readonly ComparisonSourceGroup[];
};
