import { SITE_LEGAL } from './siteLegal';
import { siteUrl } from './site';

/**
 * `lib/author.ts` — wer die Inhalte dieser Seite schreibt.
 *
 * Warum das eine eigene Datei ist: Der Name stand bisher nur im Fließtext von
 * `/ueber-elektroplaner/` („Ich bin Jonas Rieckhoff") und im Impressum. Für
 * Suchmaschinen und für Sprachmodell-Agenten ist die Autorenangabe aber eine
 * Angabe im Maschinenformat: `author` an der Seite, eine `Person` im JSON-LD,
 * ein sichtbarer Verweis von jedem Artikel auf dieselbe Stelle. Drei Stellen
 * mit drei Schreibweisen wären drei Gelegenheiten, den Namen zu ändern und
 * zwei davon zu vergessen.
 *
 * Warum nur belegte Angaben hier stehen: Eine Autorenzeile ist eine Aussage
 * über eine Person. Erfundene Qualifikationen sind der schnellste Weg, eine
 * Seite unglaubwürdig zu machen — und der Betreiber kann sie jederzeit selbst
 * richtigstellen. Was hier fehlt (Studienfach, Hochschule, Baujahr der
 * Fahrzeuge), fehlt bewusst: Es ist nicht geliefert worden.
 */

/** Anker der Autorenvorstellung auf der Vertrauensseite. */
export const AUTHOR_PROFILE_PATH = '/ueber-elektroplaner/#autor';

/**
 * Die Angaben zur Person. `SITE_AUTHOR.name` und `SITE_LEGAL.providerName`
 * müssen übereinstimmen — beide bezeichnen dieselbe Person; ein Test prüft
 * das, damit ein Tippfehler in einer der beiden Dateien auffällt.
 */
export const SITE_AUTHOR = {
  name: 'Jonas Rieckhoff',
  /** Rolle im Projekt — bewusst ohne Titel oder Berufsbezeichnung. */
  role: 'Betreiber von Elektroplaner',
  /**
   * Ein Satz zur Grundlage der Inhalte. Zwei belegte Angaben: eigene
   * Camper-Ausbauten und ein Studium an einer Universität. Kein Studienfach,
   * keine Hochschule — beides ist nicht genannt worden.
   */
  background: 'baut Camper selbst aus und studiert an einer Universität',
  /**
   * Dieselben zwei Angaben in der ersten Person — die Autorenvorstellung auf
   * `/ueber-elektroplaner/` spricht den Leser direkt an, das JSON-LD nicht.
   * Beide Formen stehen nebeneinander, damit sie nicht auseinanderlaufen; ein
   * Test prüft, dass beide dieselben Fakten nennen.
   */
  backgroundFirstPerson: 'baue Camper selbst aus und studiere an einer Universität',
} as const;

/** Absolute Adresse der Autorenvorstellung (für JSON-LD). */
export const authorProfileUrl = (): string => siteUrl(AUTHOR_PROFILE_PATH);

/**
 * `Person`-Knoten für die strukturierte Beschreibung.
 *
 * Steht im Wurzel-Layout, weil Person und Organisation seitenweite Angaben
 * sind: Jede Seite verweist mit `author` auf dieselbe `@id`, statt die Person
 * neu zu beschreiben. `worksFor` zeigt auf die Organisation, die im selben
 * Dokument steht — ein Verweis, kein zweiter Datensatz.
 */
export function authorPersonNode() {
  return {
    '@type': 'Person',
    '@id': `${siteUrl('/')}#author`,
    name: SITE_AUTHOR.name,
    url: authorProfileUrl(),
    jobTitle: SITE_AUTHOR.role,
    description: `${SITE_AUTHOR.name} ${SITE_AUTHOR.background}.`,
    worksFor: { '@id': `${siteUrl('/')}#organization` },
  };
}

/** Kennung, auf die Seiten mit `author` verweisen. */
export const authorNodeId = (): string => `${siteUrl('/')}#author`;

/**
 * Zeile für die Fußnote einer Inhaltsseite: „Von … · Betreiber …“ mit Verweis
 * auf die Autorenvorstellung. Bewusst kurz — die Zeile beantwortet „wer sagt
 * das hier?“, nicht „warum sollte ich das glauben?“.
 */
export const authorByline = (): string => `Von ${SITE_AUTHOR.name}, ${SITE_AUTHOR.role}`;

/** Prüft die Übereinstimmung von Autor und Anbieter (für den Test). */
export const authorMatchesProvider = (): boolean => SITE_AUTHOR.name === SITE_LEGAL.providerName;
