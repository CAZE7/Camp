/**
 * lib/siteIdentity.ts — die Identität der Marke „Werft" in der strukturierten
 * Beschreibung.
 *
 * Website und Organisation stehen seit dem Relaunch im Wurzel-Layout. Was dort
 * fehlte, waren die beiden Angaben, die eine Organisation von einer Website
 * unterscheiden: **mit wem man Kontakt aufnehmen kann** und **wo dieselbe
 * Marke noch zu finden ist** (`sameAs`).
 *
 * Zwei Regeln, die den Wert dieses Moduls ausmachen:
 *
 *   1. **Nichts erfinden.** `SITE_SAME_AS` ist leer, solange der Betreiber
 *      keine echten Profile eingetragen hat. Eine erfundene GitHub-Adresse
 *      im Markup ist schlechter als keine: Sie behauptet eine Identität, die
 *      es nicht gibt, und Suchmaschinen wie Nutzer werden sie prüfen.
 *   2. **Was nicht belegt ist, steht nicht im Markup.** Die Kontaktangabe
 *      erscheint erst, wenn die Impressumsangaben eingetragen sind — vorher
 *      würde eine Platzhalter-Marke als Kontaktadresse veröffentlicht.
 *
 * `sameAs` verweist per Definition auf fremde Adressen (ein Profil, ein
 * Kanal, ein Repository). Die Exportprüfung lässt diese Ausnahme deshalb zu
 * (`scripts/seo/checks.ts`) — alle übrigen Adressen im Markup müssen auf
 * dieselbe Herkunft zeigen.
 */

import { SITE_NAME, siteNodeId, siteUrl } from './site';
import { SITE_LEGAL, isEmailComplete, type SiteLegal } from './siteLegal';

/**
 * Profile derselben Marke — die `sameAs`-Liste.
 *
 * Nur Adressen eintragen, die wirklich existieren und zum Betreiber gehören.
 * Eine leere Liste ist eine gültige Angabe: dann trägt der Organisationsknoten
 * schlicht kein `sameAs`.
 */
export const SITE_SAME_AS: readonly string[] = [];

/** Der WebSite-Knoten der Auslieferung. */
export function websiteNode(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': siteNodeId('website'),
    url: siteUrl('/'),
    name: SITE_NAME,
    inLanguage: 'de-DE',
    publisher: { '@id': siteNodeId('organization') },
  };
}

/**
 * Der Organisationsknoten der Auslieferung.
 *
 * Kontaktangabe und `sameAs` erscheinen nur, wenn sie belegt sind: Die
 * E-Mail aus dem Impressum (dessen Angaben der Betreiber pflegt) und die
 * konfigurierten Profile. Der Rest — Name, Adresse, Sprache, Logo — steht
 * immer, weil es sich aus dem Baum ergibt.
 */
export function organizationNode(
  input: { legal?: SiteLegal; sameAs?: readonly string[] } = {}
): Record<string, unknown> {
  const legal = input.legal ?? SITE_LEGAL;
  const sameAs = input.sameAs ?? SITE_SAME_AS;
  const contactEmail = isEmailComplete(legal) ? legal.email.trim() : '';

  return {
    '@type': 'Organization',
    '@id': siteNodeId('organization'),
    name: SITE_NAME,
    url: siteUrl('/'),
    inLanguage: 'de-DE',
    logo: {
      '@type': 'ImageObject',
      url: siteUrl('/og/werft-mark.png'),
      width: 512,
      height: 512,
    },
    ...(contactEmail
      ? {
          email: contactEmail,
          contactPoint: [
            {
              '@type': 'ContactPoint',
              contactType: 'customer support',
              email: contactEmail,
              availableLanguage: ['de'],
            },
          ],
        }
      : {}),
    ...(sameAs.length > 0 ? { sameAs: [...sameAs] } : {}),
  };
}

/** Der Graph der Auslieferung: Website und Organisation. */
export function siteGraph(input: { legal?: SiteLegal; sameAs?: readonly string[] } = {}): {
  '@context': string;
  '@graph': Record<string, unknown>[];
} {
  return {
    '@context': 'https://schema.org',
    '@graph': [websiteNode(), organizationNode(input)],
  };
}
