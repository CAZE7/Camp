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
 * Normstand (2026): § 5 DDG (Anbieterkennzeichnung, seit 05/2024 Nachfolger von
 * § 5 TMG) und § 18 Abs. 2 MStV (Inhaltsverantwortung, Nachfolger von § 55
 * Abs. 2 RStV). Die SICHTBAREN Zitate auf der Seite lauten noch TMG/RStV —
 * sie sind Teil der eingefrorenen Pixel-Baseline
 * (`tests/e2e/visual.spec.ts-snapshots/route-impressum-*.png`) und werden mit
 * UI-Freigabe zusammen mit den Angaben aktualisiert (FOLLOW-UP, s. Ledger
 * „Achte Fassung").
 */

/**
 * Marke für „noch nicht eingetragen". Steht sie in einem Feld, gilt das Feld
 * als offen — die Seite zeigt dann ihre Aufforderung an den Betreiber, und der
 * Deploy-Wächter schlägt fehl.
 */
export const LEGAL_PLACEHOLDER = 'BITTE-EINTRAGEN';

export type SiteLegal = {
  /** Anbietername inkl. Rechtsformzusatz (§ 5 DDG Nr. 1), z. B. „Werft GmbH". */
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
 * Die Angaben, wie sie im Baum stehen. Solange hier Platzhalter stehen, ist
 * das Impressum unvollständig — die Seite zeigt ihre Aufforderungstexte, und
 * `npm run ci:verify-legal-notice` scheitert im Deploy.
 */
export const SITE_LEGAL: SiteLegal = {
  providerName: LEGAL_PLACEHOLDER,
  street: LEGAL_PLACEHOLDER,
  postalCodeAndCity: LEGAL_PLACEHOLDER,
  email: LEGAL_PLACEHOLDER,
  contentResponsible: LEGAL_PLACEHOLDER,
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
