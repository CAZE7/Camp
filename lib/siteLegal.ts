/**
 * Anbieterangaben des Impressums (AUDIT „Impressum-Placeholder").
 *
 * Warum diese Angaben ein eigenes Modul sind und nicht Text in der Seite:
 * `app/impressum/page.tsx` wird öffentlich ausgeliefert (Static Export auf
 * GitHub Pages). Ein Impressum mit Platzhaltern erfüllt § 5 DDG nicht und ist
 * abmahnfähig — und zwar genau in dem Moment, in dem deployt wird. Damit das
 * nicht unbemerkt passiert, braucht es (a) genau EINE Stelle, an der die
 * Angaben stehen, und (b) eine maschinell prüfbare Antwort auf die Frage
 * „sind sie vollständig?". Beides liegt hier; die Prüfung hängt als Schritt im
 * Deploy-Workflow (`scripts/ci/verifyLegalNotice.ts`).
 *
 * Auszufüllen vom Betreiber. Bewusst NICHT automatisiert befüllbar: erfundene
 * Namen und Anschriften wären schlimmer als ein Platzhalter, weil sie die Seite
 * gleichzeitig rechtswidrig und plausibel machen.
 *
 * Normstand (2026): § 5 DDG (Anbieterkennzeichnung, seit 14.05.2024 Nachfolger
 * von § 5 TMG) und § 18 Abs. 2 MStV (Inhaltsverantwortung, seit 2020
 * Nachfolger von § 55 Abs. 2 RStV). Beide Vorschriften werden auf der Seite
 * auch so zitiert — ein Impressum, das ein aufgehobenes Gesetz nennt, sieht
 * vollständig aus und ist es nicht.
 *
 * Stand 2026-10-28: vollständig ausgefüllt. Die Pixel-Baseline der Route
 * (`route-impressum-{light,dark}-*.png`) zeigt noch den Platzhalter-Zweig und
 * wird mit dieser Änderung neu aufgenommen (Workflow „Pixel-Baselines
 * aufnehmen", Freigabe nach Sichtprüfung).
 */

/**
 * Marke für „noch nicht eingetragen". Steht sie in einem Feld, gilt das Feld
 * als offen — die Seite zeigt dann ihre Aufforderung an den Betreiber, und der
 * Deploy-Wächter schlägt fehl.
 */
export const LEGAL_PLACEHOLDER = 'BITTE-EINTRAGEN';

export type SiteLegal = {
  /** Anbietername inkl. Rechtsformzusatz (§ 5 DDG Nr. 1), z. B. „Elektroplaner GmbH". */
  providerName: string;
  /** Straße und Hausnummer der ladungsfähigen Anschrift (§ 5 DDG Nr. 1). */
  street: string;
  /** Postleitzahl und Ort der ladungsfähigen Anschrift (§ 5 DDG Nr. 1). */
  postalCodeAndCity: string;
  /** Adresse für schnelle elektronische Kontaktaufnahme (§ 5 DDG Nr. 2). */
  email: string;
  /** Inhaltlich verantwortliche Person mit Anschrift (§ 18 Abs. 2 MStV). */
  contentResponsible: string;
};

/** Menschliche Bezeichner — für die Fehlermeldung des Deploy-Wächters. */
export const LEGAL_FIELD_LABELS: Readonly<Record<keyof SiteLegal, string>> = {
  providerName: 'Anbietername (inkl. Rechtsformzusatz)',
  street: 'Straße und Hausnummer (ladungsfähige Anschrift)',
  postalCodeAndCity: 'PLZ und Ort (ladungsfähige Anschrift)',
  email: 'E-Mail-Adresse für die schnelle Kontaktaufnahme',
  contentResponsible: 'Inhaltlich verantwortliche Person (§ 18 Abs. 2 MStV)',
};

/**
 * Die Angaben, wie sie im Baum stehen.
 *
 * Anbieter ist eine natürliche Person: Nach § 5 DDG Nr. 1 genügt dann der
 * bürgerliche Name — ein Rechtsformzusatz existiert nicht und darf auch nicht
 * erfunden werden. Anschrift ist die ladungsfähige Anschrift, kein Postfach.
 *
 * `missingLegalFields` und der Deploy-Wächter (`npm run ci:verify-legal-notice`)
 * prüfen diese fünf Felder weiterhin einzeln: Wer sie später leert oder
 * überschreibt, bekommt den Mangel im Deploy gemeldet, statt ihn zu erben.
 */
export const SITE_LEGAL: SiteLegal = {
  providerName: 'Jonas Rieckhoff',
  street: 'Franzosenkoppel 46',
  postalCodeAndCity: '22547 Hamburg',
  email: 'kontakt@elektroplaner-camper.de',
  contentResponsible: 'Jonas Rieckhoff, Franzosenkoppel 46, 22547 Hamburg',
};

/** Ist in diesem Wert noch die Platzhalter-Marke? */
export function isPlaceholderText(value: string): boolean {
  return value.includes(LEGAL_PLACEHOLDER);
}

/**
 * Offene Felder — leer, sobald das Impressum vollständig ist.
 *
 * Prüft die Werte, nicht „irgendeinen" Gesamteindruck: Ein halb ausgefülltes
 * Impressum ist rechtlich genauso unbrauchbar wie ein leeres, deshalb zählt
 * jedes Feld einzeln.
 */
export function missingLegalFields(legal: SiteLegal = SITE_LEGAL): Array<keyof SiteLegal> {
  return (Object.keys(LEGAL_FIELD_LABELS) as Array<keyof SiteLegal>).filter((field) =>
    isPlaceholderText(legal[field])
  );
}

/**
 * Sind die Anbieterangaben (Name + Anschrift) vollständig? Die Seite trennt
 * danach, ob sie die echte Anschrift oder die Aufforderung an den Betreiber
 * zeigt — ein halb eingetragenes Impressum wäre schlechter als keines, weil es
 * vollständig aussieht.
 */
export function isProviderComplete(legal: SiteLegal = SITE_LEGAL): boolean {
  return (
    !isPlaceholderText(legal.providerName) &&
    !isPlaceholderText(legal.street) &&
    !isPlaceholderText(legal.postalCodeAndCity)
  );
}
