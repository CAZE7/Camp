/**
 * lib/verify/rules.ts — DIE REGELMATRIX.
 *
 * Jede Regel der Engine steht hier genau einmal, mit:
 *   - Anforderung (Klartext) und ihrer **Quelle** (`standard`, `clause`,
 *     `provenance`) — die Herkunft der ANFORDERUNG,
 *   - der Herkunft des TESTS (`testProvenance`) — denn eine belegte
 *     Anforderung kann mit einem Modellwert geprüft werden (und umgekehrt),
 *   - dem **formalen Test** (Prädikat über dem Konduktionsgraphen),
 *   - dem **Abbruchkriterium** (was als Gegenbeispiel zählt),
 *   - Schwere, Befundart, Mindestprofil und Geltungsbereich.
 *
 * Warum eine Matrix und nicht Kommentare in den Prüffunktionen?
 *   1. Der Report muss zu jedem Befund Norm + Klausel + Herkunft nennen
 *      können — ohne sie im Prüfcode zu duplizieren.
 *   2. Ein Test (`rules.test.ts`) erzwingt, dass zu jeder Regel-ID genau ein
 *      Eintrag existiert UND dass jede deklarierte Regel von einer
 *      Implementierung ausgeführt wird. Eine Regel ohne Prüfung wäre eine
 *      Behauptung; eine Prüfung ohne Regel wäre eine undokumentierte Politik.
 *   3. Das Profil (`VerificationProfile`) filtert über `provenance`: Ein
 *      `NORM_CORE`-Lauf prüft NUR belegte Anforderungen und nennt die
 *      übersprungenen Regeln im Report.
 *
 * Norm-Disziplin (AGENTS.md §5: „Nie eine VDE-/Normaussage erfinden“):
 * Klauselnummern stehen nur dort, wo sie im Repo bereits belegt sind oder im
 * Wortlaut über eine Sekundärquelle vorliegen. Sonst steht `clause: null` und
 * die Einschränkung in `limitation`.
 */

import {
  VERIFICATION_PROFILES,
  type InstallationContext,
  type PassNumber,
  type Provenance,
  type RuleId,
  type VerificationProfile,
  type VerificationSeverity,
  type FindingKind,
} from './types';

/** Deklaration einer Regel (maschinenlesbar + lesbar). */
export interface RuleSpec {
  id: RuleId;
  pass: PassNumber;
  title: string;
  /** Anforderung in Worten (ein Satz, keine Paragrafenprosa). */
  requirement: string;
  standard: string;
  /** Klausel/Abschnitt — `null`, wenn nicht belegt (nie geraten). */
  clause: string | null;
  /** Herkunft der Anforderung. */
  provenance: Provenance;
  /** Herkunft der Zahl/Formel, mit der geprüft wird (§8.3-Praxis: oft Modellwert). */
  testProvenance: Provenance;
  /** Formales Prädikat über dem Konduktionsgraphen. */
  formalTest: string;
  /** Abbruchkriterium / Gegenbeispiel. */
  abortCriterion: string;
  severity: VerificationSeverity;
  defaultKind: FindingKind;
  /** Mindestprofil, ab dem die Regel angewandt wird. */
  profile: VerificationProfile;
  /** Installationskontexte, in denen die Regel gilt. */
  contexts: readonly InstallationContext[];
  /** Einschränkung der Aussagekraft (Pflicht bei `UNVERIFIED`/Modellwerten). */
  limitation?: string;
}

const ALL_CONTEXTS: readonly InstallationContext[] = ['VEHICLE', 'MARINE', 'STATIONARY'];
const CRAFT_CONTEXTS: readonly InstallationContext[] = ['VEHICLE', 'MARINE'];

/**
 * Die vollständige Regelmatrix. Reihenfolge = Pass-Reihenfolge; innerhalb
 * eines Passes in Prüfreihenfolge (die Pipeline nutzt diese Ordnung).
 */
export const RULE_MATRIX: readonly RuleSpec[] = [
  // ────────────────────────────────────────────────────────────────────────
  // PASS 1 — Syntax & Connectivity Gate
  // ────────────────────────────────────────────────────────────────────────
  {
    id: 'SYN-001-dangling-endpoint',
    pass: 1,
    title: 'Leitung ohne Endknoten',
    requirement: 'Jede Leitung muss an beiden Enden an einem existierenden Bauteil angeschlossen sein.',
    standard: 'CAMP-Datenmodell (Kanten-Integrität)',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest: '∀ e ∈ E: source(e) ∈ V ∧ target(e) ∈ V',
    abortCriterion:
      '∃ Kante mit fehlendem Endknoten → FAIL (CRITICAL_SAFETY: die Leitung ist nicht bewertbar)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Import-/Altpläne können verwaiste Kanten enthalten; sie werden namentlich gemeldet, nicht ausgelassen.',
  },
  {
    id: 'SYN-002-unmodeled-component',
    pass: 1,
    title: 'Bauteil ohne Modellverhalten',
    requirement:
      'Jedes elektrisch berührte Bauteil muss eine Verhaltensklasse (Quelle/Last/Schutz/Messung/Referenz) haben.',
    standard: 'CAMP-Modell (componentBehavior)',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest: '∀ v ∈ V(elektr. Kanten): behavior(v) ≠ UNKNOWN',
    abortCriterion: '∃ Bauteil mit UNKNOWN-Verhalten an einer elektrischen Kante → UNPROVABLE',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'UNVERIFIABLE',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Die Liste der Bauteiltypen ist ein Vertrag mit der Registry. Ein NEUER Typ ist bis zur Aufnahme ein Datenloch — bewusst kein „unbekannt ⇒ DC“-Fallback.',
  },
  {
    id: 'SYN-003-unknown-port',
    pass: 1,
    title: 'Unbekannter Anschluss (Handle)',
    requirement:
      'Jeder Kantenendpunkt muss ein vom Bauteil deklariertes Handle sein — sonst ist Domäne/Polarität geraten.',
    standard: 'CAMP-Modell (Handle-Verzeichnis der Registry)',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest: '∀ e ∈ E: handle(e) ∈ handles(type(source(e))) ∪ handles(type(target(e)))',
    abortCriterion: '∃ Handle außerhalb der Deklaration → UNPROVABLE für diese Kante',
    severity: 'CODE_VIOLATION',
    defaultKind: 'UNVERIFIABLE',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
  },
  {
    id: 'SYN-004-domain-crossing',
    pass: 1,
    title: 'Leitung über Domänengrenzen',
    requirement:
      'Eine Leitung darf keine zwei unterschiedlichen Domänenklassen verbinden (DC-Kleinspannung ↔ 230 V AC).',
    standard: 'CAMP-Modell (getEdgeDomain/getHandleDomain — eine Domänen-Autorität)',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest: '∀ e ∈ E: domainClass(port_from(e)) = domainClass(port_to(e))',
    abortCriterion:
      '∃ Leitung zwischen DC_ELV und AC_LV → FAIL (CRITICAL_SAFETY: Einspeisung von Netzspannung in den Kleinspannungskreis)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
  },

  // ────────────────────────────────────────────────────────────────────────
  // PASS 2 — Domain-, Polaritäts- und Topologie-Invarianten
  // ────────────────────────────────────────────────────────────────────────
  {
    id: 'DOM-001-polarity-cross',
    pass: 2,
    title: 'Polaritätskreuz (Plus auf Minus)',
    requirement: 'Im DC-Kreis darf keine Leitung Plus direkt mit Minus verbinden.',
    standard: 'CAMP-Modell (Polaritätsregeln) + physikalische Kurzschlussfreiheit',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest: '∀ e ∈ E_DC: ¬(polarity(from) = positive ∧ polarity(to) = negative)',
    abortCriterion: '∃ Kante positive↔negative → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Serienverschaltung zweier Solarmodule ist die einzige zulässige Ausnahme — sie wird explizit aufgeführt.',
  },
  {
    id: 'DOM-002-positive-to-reference',
    pass: 2,
    title: 'Plus direkt auf Masse/Schutzleiter',
    requirement: 'Der positive Leiter darf nie direkt auf Chassis-Masse oder Schutzleiter geführt werden.',
    standard: 'CAMP-Modell (Referenzsystem) + physikalische Kurzschlussfreiheit',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest: '∀ e ∈ E: ¬(polarity(from) = positive ∧ polarity(to) ∈ {negative, protective-earth})',
    abortCriterion: '∃ Kante positive↔Masse/PE → FAIL (CRITICAL_SAFETY: satter Kurzschluss über Karosserie)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
  },
  {
    id: 'TOPO-001-short-path',
    pass: 2,
    title: 'Kurzschlusspfad ohne Last',
    requirement:
      'Ein Pfad vom positiven Pol (oder einer DC-Plus-Schiene) darf den negativen Pol bzw. die Masse nur über eine definierte Last oder ein Schutzorgan erreichen.',
    standard: 'CAMP-Modell (Graph-Invariante) + physikalische Kurzschlussfreiheit',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest:
      '¬∃ Pfad v⁺ ⇝ v⁻/Masse mit (∀ u ∈ Pfad∖{Endpunkte}: behavior(u) = PASSIVE) ∧ (∀ e ∈ Pfad: protection(e) = ∅)',
    abortCriterion: '∃ Pfad ohne Last und ohne Schutzorgan → FAIL (CRITICAL_SAFETY), Gegenbeispiel = Pfad',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Das Prädikat ist eine FALSIFIKATION im modellierten Graphen: PASS heißt „kein Gegenbeispiel gefunden“, nicht „formal bewiesen“ — der Plan ist ein Einleiter-Modell (s. limitations im Report).',
  },
  {
    id: 'TOPO-002-shunt-direct-bypass',
    pass: 2,
    title: 'Shunt direkt umgangen',
    requirement:
      'Kein Verbraucher darf direkt (in einer Kante) am Batterie-Minuspol hängen, wenn ein Messshunt die Minusseite führt.',
    standard: 'CAMP-Modell (Shunt-Messseite BAT−/LOAD−)',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest: '∀ e ∈ E_minus: ¬(endpoint(e) = battery.minus ∧ other.endpoint ∈ LOAD)',
    abortCriterion: '∃ Direktkante Batterie-Minus ↔ Verbraucher → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Startbatterien (Ladebooster-Starterseite) sind ausgenommen, weil ihr Minus fachgerecht nicht über den Aufbau-Shunt läuft — die Rolle muss dafür im Plan gesetzt sein.',
  },
  {
    id: 'TOPO-003-shunt-cut',
    pass: 2,
    title: 'Sammelminusläufe umgehen die Messseite',
    requirement:
      'Alle negativen Lastrückströme müssen durch die Messseite (LOAD−) des Shunts fließen — die Messseite ist eine Trennebene zwischen Batterieminus und allen Verbrauchern.',
    standard: 'CAMP-Modell (Shunt-Invariante)',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest:
      'G_minus∖{BAT−,LOAD−}: keine Kante zwischen Batterieknoten B (Aufbau) und Lastknoten L im Restgraphen',
    abortCriterion:
      '∃ Pfad B ⇝ L ohne Durchlaufen der Shunt-Terminals → FAIL (CRITICAL_SAFETY), Gegenbeispiel = Pfad',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Die Prüfung setzt voraus, dass der Shunt seine Messseiten über die Handles `minus` (target = BAT−) und `minus` (source = LOAD−) deklariert (Registry-Vertrag).',
  },
  {
    id: 'TOPO-004-ground-loop',
    pass: 2,
    title: 'Geschlossene Masse-/Schutzleiterschleife',
    requirement:
      'Der Referenzleiter (Chassis/PE/DC-Minus) ist als Sternpunkt zu führen — geschlossene Schleifen sind unzulässig.',
    standard: 'CAMP-Modell (Referenzsystem), Fachpraxis Einpunkt-Masse',
    clause: null,
    provenance: 'MODEL_ASSUMPTION',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: 'G_ref ist ein Wald (∄ Zyklus über Referenzknoten)',
    abortCriterion: '∃ Zyklus unter ≥ 2 verschiedenen Referenzknoten → FAIL, Gegenbeispiel = Zyklus',
    severity: 'CODE_VIOLATION',
    defaultKind: 'VIOLATION',
    profile: 'CAMP_MODEL',
    contexts: ALL_CONTEXTS,
    limitation:
      'KEIN Normzitat: Die Einpunkt-Masse ist eine dokumentierte Konstruktionsregel (vermeidet Ausgleichsströme, Korrosion und FI-Fehlauslösungen). Ein zweiter Massepunkt ist nicht per se verboten — er wird hier gemeldet und begründet.',
  },
  {
    id: 'TOPO-005-fluid-electrical-bridge',
    pass: 2,
    title: 'Leitung zwischen Fluidik und Elektrik',
    requirement: 'Ein Fluidikkreis (Wasser/Gas) darf nicht über einen elektrischen Leiter geführt werden.',
    standard: 'CAMP-Datenmodell (getrennte Domänen)',
    clause: null,
    provenance: 'DERIVED',
    testProvenance: 'DERIVED',
    formalTest: '∀ e ∈ E: ¬(class(from) = FLUID ∧ class(to) ∈ {DC_ELV, AC_LV})',
    abortCriterion: '∃ Kante FLUID ↔ elektrisch → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
  },

  // ────────────────────────────────────────────────────────────────────────
  // PASS 3 — Strombelastbarkeit & Schutzkoordination
  // ────────────────────────────────────────────────────────────────────────
  {
    id: 'AMP-001-ib-in-iz',
    pass: 3,
    title: 'Betriebsstrom ≤ Nennstrom ≤ Belastbarkeit',
    requirement: 'Für jeden Stromkreis gilt I_B ≤ I_n ≤ I_z.',
    standard: 'IEC 60364-4-43 (DIN VDE 0100-430)',
    clause: '§433.1 Bedingung (1)',
    provenance: 'VERIFIED_NORM',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: '∀ Kabel: I_b ≤ I_n (Schutzorgan) ∧ I_n ≤ I_z (Tabellenwert × k_ϑ × k_B)',
    abortCriterion: '∃ Kabel mit I_b > I_n oder I_n > I_z → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'I_z ist der Modellwert aus `VDE_AMPACITY × Korrekturfaktoren` (Verlegeart B2, 30 °C Referenz, PVC); die Verlegeart und der Kabeltyp des konkreten Aufbaus (FLRY/FLR2X, Bündel, Kanal) sind nur als Faktoren abgebildet.',
  },
  {
    id: 'AMP-002-i2-vs-iz',
    pass: 3,
    title: 'Großer Prüfstrom ≤ 1,45 × Belastbarkeit',
    requirement: 'Für jeden Stromkreis gilt I_2 ≤ 1,45 × I_z.',
    standard: 'IEC 60364-4-43 (DIN VDE 0100-430)',
    clause: '§433.1 Bedingung (2)',
    provenance: 'VERIFIED_NORM',
    testProvenance: 'VERIFIED_DATASHEET',
    formalTest: '∀ Kabel mit Schutzorgan: I_2 ≤ 1,45 · I_z',
    abortCriterion: '∃ Kabel mit I_2 > 1,45 · I_z → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'I_2 liefert laut §433.1 der Hersteller bzw. die Produktnorm. Fehlt der Wert und ist er für die Bauform nicht belegt (Bolzensicherungen, Class T), meldet die Engine UNPROVABLE statt zu schätzen.',
  },
  {
    id: 'AMP-003-source-protection-position',
    pass: 3,
    title: 'Leitungsabgangsschutz an der Energiequelle',
    requirement:
      'Jede von einer Energiequelle (Batterie, Sammelschiene, Lichtmaschine) abgehende Leitung muss innerhalb der zulässigen ungeschützten Länge abgesichert sein.',
    standard: 'ISO 10133:2000 §8.1 (200 mm); CAMP-Planungsvorgabe (DIN VDE 0100-721 nennt keine Länge)',
    clause: '§8.1',
    provenance: 'VERIFIED_NORM',
    testProvenance: 'DERIVED',
    formalTest: '∀ Kante ab Quelle ohne Schutzorgan: length ≤ 0,2 m ∨ Position(Schutzorgan) ≤ 0,2 m',
    abortCriterion: '∃ ungeschützter Abschnitt > 0,2 m → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Fehlt die Länge (`edge.data.length`) oder ist sie als Annahme markiert, ist die Aussage nur so gut wie die Annahme — der Report weist das je Befund aus.',
  },
  {
    id: 'AMP-004-breaking-capacity',
    pass: 3,
    title: 'Abschaltvermögen ≥ prospektiver Kurzschlussstrom',
    requirement:
      'Das Bemessungs-Abschaltvermögen des Schutzorgans muss den prospektiven Kurzschlussstrom an seinem Einbauort beherrschen.',
    standard: 'Hersteller-Datenblatt / ABYC E-11 AIC-Tabelle (CAMP-Modell lib/shortCircuit.ts)',
    clause: null,
    provenance: 'VERIFIED_DATASHEET',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: '∀ Schutzorgan: I_cn ≥ I_k(fuseOffset)',
    abortCriterion: '∃ Schutzorgan mit I_cn < I_k → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'I_k ist eine Schätzung (Bank-Innenwiderstand, reine Parallelschaltung, 20 °C); Datenblattwerte des konkreten Produkts schlagen die Tabelle.',
  },
  {
    id: 'AMP-005-selectivity',
    pass: 3,
    title: 'Selektivität der Schutzkaskade',
    requirement:
      'Wo Selektivität gefordert ist, muss die vorgelagerte Schutzeinrichtung die nachgelagerte bei einem Fehler nicht mitauslösen.',
    standard: 'IEC 60364-5-53 (DIN VDE 0100-530)',
    clause: '§536',
    provenance: 'VERIFIED_NORM',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest:
      'Datenblatt: I²t_pre-arcing,upstream > I²t_total,downstream @ I_k; ohne Datenblatt: I_n,upstream / I_n,downstream ≥ 1,6',
    abortCriterion:
      '∃ Paar mit widerlegter Selektivität → FAIL (CODE_VIOLATION); ohne Daten beider Geräte → UNPROVABLE',
    severity: 'CODE_VIOLATION',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Das Verhältnis 1,6:1 ist Hersteller-/Fachliteratur für gleichartige Sicherungen (≥ 16 A), KEIN Normzitat. Für LS/LS- und LS/Sicherungs-Paare fordert die Norm Herstellertabellen — ohne sie meldet die Engine UNPROVABLE.',
  },
  {
    id: 'AMP-006-conduit-fill',
    pass: 3,
    title: 'Leerrohr-Füllgrad',
    requirement: 'Der Füllgrad eines Leerrohrs/Kanals darf 40 % des Innenquerschnitts nicht überschreiten.',
    standard: 'DIN VDE 0100-520 (Leerrohr-Füllgrad)',
    clause: null,
    provenance: 'MODEL_ASSUMPTION',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: 'A_Kabel / A_Innenrohr ≤ 0,40',
    abortCriterion: '∃ Leerrohr mit Füllgrad > 40 % → FAIL (CODE_VIOLATION)',
    severity: 'CODE_VIOLATION',
    defaultKind: 'VIOLATION',
    profile: 'CAMP_MODEL',
    contexts: ALL_CONTEXTS,
    limitation:
      'Der Wert 40 % ist im Repo als konservative Korrektur eines unbelegten 60-%-Werts dokumentiert (AUDIT NORM-001); die Leerrohr-Innendurchmesser stammen aus DIN EN 61386.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // PASS 4 — Spannungsfall & Energiebilanz
  // ────────────────────────────────────────────────────────────────────────
  {
    id: 'VDR-001-voltage-drop-edge',
    pass: 4,
    title: 'Spannungsfall einer Leitung',
    requirement:
      'Der Spannungsfall einer Leitung darf das Budget ihrer Lastklasse nicht überschreiten (Ladekreise/Sensorik 1 %, Standard 3 %).',
    standard: 'CAMP-Planungsvorgabe ΔU-Budget (DIN VDE 0298-4 enthält keine Spannungsfall-Grenzwerte)',
    clause: null,
    provenance: 'MODEL_ASSUMPTION',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: 'ΔU = 2·L·I_b·ρ(T)/A; ΔU_% = ΔU/U_n·100 ≤ Budget(Lastklasse)',
    abortCriterion: '∃ Leitung über Budget → FAIL (CODE_VIOLATION); > 4 % → zusätzlich als kritisch gemeldet',
    severity: 'CODE_VIOLATION',
    defaultKind: 'VIOLATION',
    profile: 'CAMP_MODEL',
    contexts: ALL_CONTEXTS,
    limitation:
      'Die Grenzwerte 1 %/3 % sind Planungsvorgaben (fachüblich), keine Normzitate; ρ(T) wird mit der Leiter-Betriebstemperatur gerechnet.',
  },
  {
    id: 'VDR-002-voltage-drop-path',
    pass: 4,
    title: 'Spannungsfall über den Gesamtpfad',
    requirement:
      'Der kumulierte Spannungsfall von der Quelle bis zum Verbraucher darf das Budget nicht reißen.',
    standard: 'CAMP-Planungsvorgabe ΔU-Budget',
    clause: null,
    provenance: 'MODEL_ASSUMPTION',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: 'Σ ΔU(Pfad Quelle → Last) / U_n · 100 ≤ Budget(Lastklasse)',
    abortCriterion: '∃ Pfad über Budget → FAIL (CODE_VIOLATION), Gegenbeispiel = Pfad',
    severity: 'CODE_VIOLATION',
    defaultKind: 'VIOLATION',
    profile: 'CAMP_MODEL',
    contexts: ALL_CONTEXTS,
    limitation:
      'Kanten ohne Längenangabe machen den Pfadwert UNPROVABLE — der Report nennt die Kante, nicht einen geschätzten Ersatzwert.',
  },
  {
    id: 'PWR-001-energy-balance',
    pass: 4,
    title: 'Energiebilanz (Peukert)',
    requirement:
      'Die nutzbare Batteriekapazität (Peukert-gewichtet) muss den Tagesverbrauch des Plans decken.',
    standard: 'CAMP-Modell (Peukert, lib/peukert.ts)',
    clause: null,
    provenance: 'MODEL_ASSUMPTION',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: 'C_nutzbar = C_20 · DoD · (I_ref/I)^(k−1) ≥ Σ (P_i · h_i) / U_n',
    abortCriterion: 'C_nutzbar < Tagesverbrauch → EFFICIENCY_WARNING (Verfügbarkeit, nicht Personenschutz)',
    severity: 'EFFICIENCY_WARNING',
    defaultKind: 'VIOLATION',
    profile: 'CAMP_MODEL',
    contexts: ALL_CONTEXTS,
    limitation:
      'Peukert-Exponenten und DoD sind Chemie-Faustwerte (UNVERIFIED), keine Datenblattwerte; die Bilanz ist eine Auslegungshilfe.',
  },

  // ────────────────────────────────────────────────────────────────────────
  // PASS 5 — Erdung & Personenschutz (RCD)
  // ────────────────────────────────────────────────────────────────────────
  {
    id: 'GND-001-chassis-bond-cross-section',
    pass: 5,
    title: 'Querschnitt der Masseanbindung',
    requirement: 'Die Anbindung an Chassis/Karosserie muss mindestens 16 mm² aufweisen.',
    standard: 'CAMP-Modell (AutoWire-Mindestanbindung) + Fachpraxis Potentialausgleich',
    clause: null,
    provenance: 'MODEL_ASSUMPTION',
    testProvenance: 'DERIVED',
    formalTest: '∀ Kante mit Massepunkt-Endpunkt: A ≥ 16 mm²',
    abortCriterion: '∃ Massekante < 16 mm² → FAIL (CODE_VIOLATION)',
    severity: 'CODE_VIOLATION',
    defaultKind: 'VIOLATION',
    profile: 'CAMP_MODEL',
    contexts: ALL_CONTEXTS,
    limitation:
      'Der Wert stammt aus der AutoWire-Vorgabe im Repo; DIN VDE 0100-721 setzt für die Potentialausgleichsleitung im Fahrzeug einen Mindestquerschnitt (in der Sekundärliteratur 4 mm² PE-flexibel) — die 16 mm² sind die konservativere Planungsvorgabe.',
  },
  {
    id: 'RCD-001-rcd-deviation',
    pass: 5,
    title: 'Fehlerstromschutz je Stromkreis (≤ 30 mA)',
    requirement:
      'Jeder 230-V-Stromkreis in Caravan/Motorcaravan ist mit einer Fehlerstrom-Schutzeinrichtung ≤ 30 mA zu schützen.',
    standard: 'DIN VDE 0100-721:2019-10 (Caravans und Motorcaravans)',
    clause: null,
    provenance: 'VERIFIED_NORM',
    testProvenance: 'DERIVED',
    formalTest: '∀ AC-Endstromkreis: ∃ RCD (IΔn ≤ 0,03 A) im Pfad von der Einspeisung zur Last',
    abortCriterion: '∃ AC-Stromkreis ohne RCD ≤ 30 mA → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: CRAFT_CONTEXTS,
    limitation:
      'Anforderungstext über zwei unabhängige Sekundärquellen belegt (elektro.net 3/2020 zur 0100-721:2019-10; ABB-RCD-Anwendungshandbuch 2CDC420027B0101 zur 0100-721). Die Klauselnummer ist lizenzbedingt nicht belegt und wird deshalb nicht behauptet.',
  },
  {
    id: 'RCD-002-rcd-type',
    pass: 5,
    title: 'Fehlerstromtyp (A/B)',
    requirement:
      'RCDs sind im Allgemeinen Typ A; bei möglichen glatten Gleichfehlerströmen (Wechselrichter/DC-Fehlerströme) ist Typ B/B+ einzusetzen.',
    standard: 'DIN VDE 0100-721:2019-10 + RCD-Anwendungshandbuch (Typwahl)',
    clause: null,
    provenance: 'VERIFIED_NORM',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: 'AC-Insel mit Halbleiterquelle ⇒ residualType ∈ {B} ∨ gerätespezifischer Nachweis',
    abortCriterion: 'Wechselrichter-Insel mit RCD Typ AC/A → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: CRAFT_CONTEXTS,
    limitation:
      'Die Zuordnung „Insel ⇒ glatte Gleichfehlerströme möglich“ ist eine konservative Modellannahme. Liegt ein Herstellernachweis („erzeugt keine glatten Gleichfehlerströme“) vor, ist Typ A zulässig — das Feld dafür ist nicht modelliert.',
  },
  {
    id: 'RCD-003-rcd-position',
    pass: 5,
    title: 'Kein Abzweig vor der Fehlerstrom-Schutzeinrichtung',
    requirement:
      'Zwischen Einspeisestelle und Eingangsklemmen der RCD darf keine Abzweigung liegen; jeder Endstromkreis muss über die RCD geführt werden.',
    standard: 'DIN VDE 0100-721:2019-10 (Einspeisung/Fehlerstromschutz)',
    clause: null,
    provenance: 'VERIFIED_NORM',
    testProvenance: 'DERIVED',
    formalTest:
      '∀ Last L in AC-Insel: jeder Pfad Einspeisung ⇝ L enthält eine RCD (Beobachtung: Abzweigknoten vor der RCD)',
    abortCriterion: '∃ Last/Knoten, der ohne RCD von der Einspeisung erreichbar ist → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: CRAFT_CONTEXTS,
    limitation:
      'Belegt über den Anforderungstext der Sekundärquelle („Eine Abzweigung zwischen Einspeisestelle und den Eingangsklemmen der RCD ist generell unzulässig“). Gemessen am EINLEITER-Modell: N/PE sind nicht als eigene Kanten abgebildet.',
  },
  {
    id: 'RCD-004-two-pole-switching',
    pass: 5,
    title: 'Zweipolige Abschaltung der Einspeisung',
    requirement:
      'Die Schutzeinrichtung der Landstromeinspeisung muss L und N abschalten (zweipolig) — einpolige Schalter sind für die Einspeisung nicht zulässig.',
    standard: 'Fachpraxis Caravan-Einspeisung (im Repo NICHT klausenbelegt)',
    clause: null,
    provenance: 'UNVERIFIED',
    testProvenance: 'DERIVED',
    formalTest: 'Einspeise-Schutzorgan.poles = 2',
    abortCriterion: '∃ Einspeise-Schutzorgan mit poles = 1 → FAIL (CODE_VIOLATION, nur im Profil PRACTICE)',
    severity: 'CODE_VIOLATION',
    defaultKind: 'VIOLATION',
    profile: 'PRACTICE',
    contexts: CRAFT_CONTEXTS,
    limitation:
      'UNVERIFIED: Die Zweipoligkeit ist über Fachpraxis-/Herstellerliteratur dokumentiert, im Repo aber nicht klausenbelegt. Die Regel läuft deshalb nur im Profil PRACTICE und wird im NORM_CORE-Lauf als übersprungen ausgewiesen.',
  },
  {
    id: 'RCD-005-loop-impedance',
    pass: 5,
    title: 'Abschaltbedingung (Schleifenimpedanz)',
    requirement:
      'Im TN-System muss Z_s · I_a ≤ U_0 gelten, damit die Schutzeinrichtung im Fehlerfall sicher abschaltet.',
    standard: 'IEC 60364-4-41 (DIN VDE 0100-410)',
    clause: '§411.3.2',
    provenance: 'VERIFIED_NORM',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: 'Z_s(Leitung) + Z_vorgelagert ≤ (2/3)·U_0/I_a',
    abortCriterion: 'Verdikt `fail` der AC-Bewertung → FAIL (CRITICAL_SAFETY); fehlende Daten → UNPROVABLE',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Die vorgelagerte Netzimpedanz ist eine deklarierte Annahme (0,8 Ω bzw. Niederimpedanz-Grenze 0,15 Ω); ein Messwert vor Ort schlägt sie. Wechselrichter-Ausgänge sind elektronisch strombegrenzt und werden als `inverter-limited` geführt, nicht als bestanden.',
  },
  {
    id: 'RCD-006-rcd-selectivity',
    pass: 5,
    title: 'Selektivität der RCD-Kaskade',
    requirement:
      'Bei zwei RCDs in Reihe soll der vorgelagerte selektiv (zeitverzögert) und mindestens dreimal so unempfindlich sein.',
    standard: 'Fachpraxis RCD-Selektivität (Verhältnis 3:1)',
    clause: null,
    provenance: 'MODEL_ASSUMPTION',
    testProvenance: 'MODEL_ASSUMPTION',
    formalTest: 'upstream.selective = true ∨ IΔn,upstream ≥ 3 · IΔn,downstream',
    abortCriterion:
      '∃ RCD-Paar ohne Selektivität (nicht selektiv und Verhältnis < 3) → FAIL (CODE_VIOLATION)',
    severity: 'CODE_VIOLATION',
    defaultKind: 'VIOLATION',
    profile: 'CAMP_MODEL',
    contexts: ALL_CONTEXTS,
    limitation:
      'Das 3:1-Verhältnis ist Fachpraxis (nicht normbelegt); die Norm fordert die Herstellerprüfung.',
  },
  {
    id: 'NET-001-pen-forbidden',
    pass: 5,
    title: 'Kein PEN-Leiter in der Fahrzeuginstallation',
    requirement:
      'Die Fahrzeuginstallation ist als TN-S-System auszuführen und darf keinen PEN-Leiter besitzen.',
    standard: 'DIN VDE 0100-708/-721-Kontext (Einspeisung Caravan/Tiny-House)',
    clause: null,
    provenance: 'VERIFIED_NORM',
    testProvenance: 'DERIVED',
    formalTest: 'declaredSystemForm ≠ TN-C ∧ N- und PE-Führung getrennt',
    abortCriterion: '∃ Einspeisung mit deklariertem TN-C/PEN → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'NORM_CORE',
    contexts: ALL_CONTEXTS,
    limitation:
      'Wortlaut-Beleg: „Sie sind als TN-S-System auszuführen und dürfen keinen PEN-Leiter besitzen“ (elektropraktiker.de, Fachartikel zu Installationen in alternativen Wohnkonzepten, abgerufen 2026-09-29).',
  },
  {
    id: 'NET-002-island-fault-loop',
    pass: 5,
    title: 'Fehlerschleife der Wechselrichter-Insel',
    requirement:
      'Ein Wechselrichter mit mehr als einem angeschlossenen Verbraucher bildet ein eigenes Netz; der Fehlerschutz muss dort durch N-PE-Bezug + RCD oder durch Schutztrennung je Verbraucher sichergestellt sein.',
    standard: 'CAMP-Modell (Insel-Netzform) + RCD-Anwendungshandbuch (Inselbetrieb)',
    clause: null,
    provenance: 'MODEL_ASSUMPTION',
    testProvenance: 'DERIVED',
    formalTest:
      'Insel mit ≥ 2 Lasten ⇒ (neutralEarthBond ∈ {always, dynamic} ∧ RCD vorhanden) ∨ (je Last eigene Schutztrennung)',
    abortCriterion: 'Insel mit ≥ 2 Lasten ohne N-PE-Bezug und ohne RCD → FAIL (CRITICAL_SAFETY)',
    severity: 'CRITICAL_SAFETY',
    defaultKind: 'VIOLATION',
    profile: 'CAMP_MODEL',
    contexts: ALL_CONTEXTS,
    limitation:
      '`neutralEarthBond` ist ein Datenfeld des Wechselrichters (Datenblatt). Fehlt es, meldet die Engine UNPROVABLE — ein Wechselrichter ohne Angabe wird nicht als „potenzialfrei ⇒ sicher“ angenommen.',
  },
];

/** Regel-Index (ID → Spezifikation). */
const RULE_INDEX: ReadonlyMap<RuleId, RuleSpec> = new Map(RULE_MATRIX.map((rule) => [rule.id, rule]));

/** Spezifikation zu einer Regel-ID. Wirft, wenn die ID nicht deklariert ist. */
export function ruleSpec(id: RuleId): RuleSpec {
  const spec = RULE_INDEX.get(id);
  if (!spec) {
    throw new RangeError(`ruleSpec: Regel „${id}“ ist in der Matrix nicht deklariert`);
  }
  return spec;
}

/** Alle deklarierten Regel-IDs in Prüfreihenfolge. */
export const RULE_IDS: readonly RuleId[] = RULE_MATRIX.map((rule) => rule.id);

const PROFILE_RANK: Record<VerificationProfile, number> = {
  NORM_CORE: 0,
  CAMP_MODEL: 1,
  PRACTICE: 2,
};

/** Deckt das Profil die Herkunftsstufe der Regel ab? */
export function profileCovers(profile: VerificationProfile, rule: RuleSpec): boolean {
  return PROFILE_RANK[profile] >= PROFILE_RANK[rule.profile];
}

/**
 * Regeln, die das Profil im Kontext ausführt — und die übersprungenen.
 *
 * Die übersprungenen werden **zurückgegeben**, nicht verschwiegen: Der Report
 * führt sie namentlich. Ein Prüfbericht, der seinen eigenen Umfang nicht
 * nennt, behauptet mehr, als er geprüft hat.
 */
export function rulesForContext(
  profile: VerificationProfile,
  context: InstallationContext
): { applied: readonly RuleSpec[]; skipped: readonly RuleSpec[] } {
  const applied: RuleSpec[] = [];
  const skipped: RuleSpec[] = [];
  for (const rule of RULE_MATRIX) {
    if (profileCovers(profile, rule) && rule.contexts.includes(context)) applied.push(rule);
    else skipped.push(rule);
  }
  return { applied, skipped };
}

/** Ist das Profil gültig? (Validierung der Außenwelt-Eingabe.) */
export function isVerificationProfile(value: unknown): value is VerificationProfile {
  return typeof value === 'string' && (VERIFICATION_PROFILES as readonly string[]).includes(value);
}
