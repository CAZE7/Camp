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
 * Abs. 2 RStV). Die sichtbaren Zitate der Seite wurden am 2026-10-16 auf
 * diese Fassung umgestellt — die alte Nennung (TMG/RStV) war durch den
 * Normwechsel überholt.
 *
 * Pflichtangaben je Rechtsform (§ 5 DDG, § 18 Abs. 2 MStV):
 *   - immer: Name, ladungsfähige Anschrift, E-Mail für die schnelle
 *     elektronische Kontaktaufnahme, verantwortliche Person für den Inhalt;
 *   - bei einem Unternehmen zusätzlich: Vertretungsberechtigte, Register­
 *     gericht und Registernummer (nur wenn ein Register besteht);
 *   - optional: Telefon, Umsatzsteuer-Identifikationsnummer.
 */

/**
 * Marke für „noch nicht eingetragen". Steht sie in einem Feld, gilt das Feld
 * als offen — die Seite zeigt dann ihre Aufforderung an den Betreiber, und
 * der Deploy-Wächter schlägt fehl.
 */
export const LEGAL_PLACEHOLDER = 'BITTE-EINTRAGEN';

/** Rechtsform des Anbieters — sie entscheidet, welche Angaben Pflicht sind. */
export const LEGAL_ENTITY_TYPES = ['natuerliche-person', 'unternehmen'] as const;

export type LegalEntityType = (typeof LEGAL_ENTITY_TYPES)[number];

/** Wie die Rechtsform in der sichtbaren Seite benannt wird. */
export const LEGAL_ENTITY_LABELS: Readonly<Record<LegalEntityType, string>> = {
  'natuerliche-person': 'Natürliche Person',
  unternehmen: 'Unternehmen',
};

export type SiteLegal = {
  /** Anbietername inkl. Rechtsformzusatz (§ 5 DDG Nr. 1), z. B. „Werft GmbH". */
  providerName: string;
  /** Straße und Hausnummer der ladungsfähigen Anschrift (§ 5 DDG Nr. 1). */
  street: string;
  /** Postleitzahl und Ort der ladungsfähigen Anschrift (§ 5 DDG Nr. 1). */
  postalCodeAndCity: string;
  /** Adresse für schnelle elektronische Kontaktaufnahme (§ 5 DDG Nr. 2). */
  email: string;
  /**
   * Telefonnummer für die schnelle Kontaktaufnahme — optional.
   * Leer bedeutet ausdrücklich „kein Telefon"; die Platzhalter-Marke
   * bedeutet „noch nicht entschieden".
   */
  phone: string;
  /**
   * Rechtsform des Anbieters. Solange hier die Platzhalter-Marke steht, weiß
   * die Seite nicht, welche Angaben nötig sind — der Wächter fordert dann
   * beide Sätze, damit keine fehlt.
   */
  entityType: LegalEntityType | typeof LEGAL_PLACEHOLDER;
  /** Vertretungsberechtigte Person(en) — Pflicht bei einem Unternehmen. */
  representative: string;
  /** Registergericht — Pflicht bei einem Unternehmen mit Register. */
  registerCourt: string;
  /** Registernummer — Pflicht bei einem Unternehmen mit Register. */
  registerNumber: string;
  /**
   * Umsatzsteuer-Identifikationsnummer nach § 27a UStG — optional.
   * Leer bedeutet „keine vorhanden oder nicht anwendbar".
   */
  vatId: string;
  /** Inhaltlich verantwortliche Person mit Anschrift (§ 18 Abs. 2 MStV). */
  contentResponsible: string;
};

/** Menschliche Bezeichner — für die Fehlermeldung des Deploy-Wächters. */
export const LEGAL_FIELD_LABELS: Readonly<Record<keyof SiteLegal, string>> = {
  providerName: 'Anbietername (inkl. Rechtsformzusatz)',
  street: 'Straße und Hausnummer (ladungsfähige Anschrift)',
  postalCodeAndCity: 'PLZ und Ort (ladungsfähige Anschrift)',
  email: 'E-Mail-Adresse für die schnelle Kontaktaufnahme',
  phone: 'Telefonnummer (optional — leer lassen, wenn keiner angegeben wird)',
  entityType: 'Rechtsform des Anbieters (natuerliche-person | unternehmen)',
  representative: 'Vertretungsberechtigte Person(en) (bei Unternehmen Pflicht)',
  registerCourt: 'Registergericht (bei Unternehmen mit Register Pflicht)',
  registerNumber: 'Registernummer (bei Unternehmen mit Register Pflicht)',
  vatId: 'USt-IdNr. nach § 27a UStG (optional — leer lassen, wenn keine vorhanden ist)',
  contentResponsible: 'Inhaltlich verantwortliche Person (§ 18 Abs. 2 MStV)',
};

/** Angaben, die bei jeder Rechtsform Pflicht sind. */
const ALWAYS_REQUIRED: readonly (keyof SiteLegal)[] = [
  'providerName',
  'street',
  'postalCodeAndCity',
  'email',
  'contentResponsible',
];

/** Zusatzangaben, die bei einem Unternehmen Pflicht sind. */
const REQUIRED_FOR_COMPANY: readonly (keyof SiteLegal)[] = [
  'representative',
  'registerCourt',
  'registerNumber',
];

/** Angaben, die optional sind — leer bedeutet „nicht vorhanden". */
const OPTIONAL: readonly (keyof SiteLegal)[] = ['phone', 'vatId'];

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
  phone: LEGAL_PLACEHOLDER,
  entityType: LEGAL_PLACEHOLDER,
  representative: LEGAL_PLACEHOLDER,
  registerCourt: LEGAL_PLACEHOLDER,
  registerNumber: LEGAL_PLACEHOLDER,
  vatId: LEGAL_PLACEHOLDER,
  contentResponsible: LEGAL_PLACEHOLDER,
};

/** Ist in diesem Wert noch die Platzhalter-Marke? */
export function isPlaceholderText(value: string): boolean {
  return value.includes(LEGAL_PLACEHOLDER);
}

/** Ist die Rechtsform schon festgelegt? */
export function isEntityTypeKnown(legal: SiteLegal = SITE_LEGAL): legal is SiteLegal & {
  entityType: LegalEntityType;
} {
  return (LEGAL_ENTITY_TYPES as readonly string[]).includes(legal.entityType);
}

/**
 * Offene Felder — leer, sobald das Impressum vollständig ist.
 *
 * Prüft die Werte, nicht „irgendeinen" Gesamteindruck: Ein halb ausgefülltes
 * Impressum ist rechtlich genauso unbrauchbar wie ein leeres, deshalb zählt
 * jedes Feld einzeln. Die Pflicht hängt an der Rechtsform: Ein Unternehmen
 * braucht zusätzlich Vertretungsberechtigte und Registerangaben, eine
 * natürliche Person nicht. Steht die Rechtsform selbst noch auf dem
 * Platzhalter, zählen beide Sätze — lieber eine zu viel gemeldete Angabe
 * als eine fehlende.
 */
export function missingLegalFields(legal: SiteLegal = SITE_LEGAL): Array<keyof SiteLegal> {
  const required = isEntityTypeKnown(legal)
    ? [...ALWAYS_REQUIRED, ...(legal.entityType === 'unternehmen' ? REQUIRED_FOR_COMPANY : [])]
    : [...ALWAYS_REQUIRED, ...REQUIRED_FOR_COMPANY];

  const missing = required.filter((field) => isPlaceholderText(legal[field]));

  // Die Rechtsform selbst ist offen, solange sie auf dem Platzhalter steht.
  if (!isEntityTypeKnown(legal)) missing.push('entityType');

  return missing;
}

/**
 * Optionale Angaben, die noch nicht entschieden sind — kein Mangel, aber
 * auch keine bewusste Entscheidung. Sie werden gemeldet, ohne den Deploy zu
 * stoppen: Eine Telefonnummer ist freiwillig, eine unentschiedene Angabe
 * aber auch nicht sauber dokumentiert.
 */
export function undecidedOptionalFields(legal: SiteLegal = SITE_LEGAL): Array<keyof SiteLegal> {
  return OPTIONAL.filter((field) => isPlaceholderText(legal[field]));
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

/** Ist die E-Mail eingetragen? (Für Kontaktblock und JSON-LD.) */
export function isEmailComplete(legal: SiteLegal = SITE_LEGAL): boolean {
  return !isPlaceholderText(legal.email);
}

/** Ist die verantwortliche Person eingetragen? */
export function isContentResponsibleComplete(legal: SiteLegal = SITE_LEGAL): boolean {
  return !isPlaceholderText(legal.contentResponsible);
}

/**
 * Zeigt das Unternehmen? Nur dann stehen Vertretungsberechtigte und
 * Registerangaben in der sichtbaren Seite — bei einer natürlichen Person wären
 * sie falsch.
 */
export function isCompany(legal: SiteLegal = SITE_LEGAL): boolean {
  return isEntityTypeKnown(legal) && legal.entityType === 'unternehmen';
}

/** Hat das Unternehmen eine USt-IdNr. angegeben? */
export function hasVatId(legal: SiteLegal = SITE_LEGAL): boolean {
  const value = legal.vatId.trim();
  // Die Platzhalter-Marke ist keine Angabe: Sie darf nie sichtbar werden.
  return value !== '' && !isPlaceholderText(value);
}

/** Hat der Anbieter ein Telefon angegeben? */
export function hasPhone(legal: SiteLegal = SITE_LEGAL): boolean {
  const value = legal.phone.trim();
  return value !== '' && !isPlaceholderText(value);
}
