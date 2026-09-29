/**
 * lib/verify/types.ts — FORMALE TYPDEFINITIONEN der Verifikations-Engine.
 *
 * Zweck
 * =====
 * Die Engine prüft einen Plan gegen harte Invarianten (Graph-Ebene) und
 * normative Bemessungsregeln (Norm-Ebene). Dafür braucht sie ein Modell, das
 * **nicht** die UI-Sicht ist (Knoten = Kachel mit Icon), sondern die
 * elektrische Sicht: Ports mit Domäne und Polarität, Leitungen als
 * Konduktionskanten, Schutzorgane als typisierte Geräte, Netze als
 * Äquivalenzklassen. Alles, was nicht beweisbar ist, ist hier ein **eigener
 * Zustand** (`UNPROVABLE`) und niemals „gültig":
 *
 *   - `CheckStatus.PASS` verlangt einen Beweis (Prädikat gilt für alle
 *     betrachteten Entitäten, kein Gegenbeispiel gefunden).
 *   - `CheckStatus.FAIL` verlangt ein **Gegenbeispiel** (Pfad, Kante, Paar).
 *   - `CheckStatus.UNPROVABLE` = Datenlage reicht nicht (Regel M: „kein
 *     stiller Fallback“). Der Gesamtverdikt kann dann nie `COMPLIANT` sein.
 *
 * Norm-Herkunft ist Teil der Daten (`Provenance`), nicht der Prosa. Eine
 * Aussage ohne belegten Normtext ist `UNVERIFIED` und wird als solche im
 * Report geführt — sie darf nie als Zitat gelesen werden.
 *
 * Schichten: Diese Datei importiert ausschließlich `lib/`-Typen (ADR 0008).
 */

import type { HandleDomainValue } from '../domain/handleDomains';

// ============================================================================
// 1. GRUNDVOKABULAR
// ============================================================================

/**
 * Elektrische Domänenklasse des Verifikationsmodells.
 *
 * Bewusst NICHT dasselbe wie `HandleDomainValue` ('DC_12V' | 'AC_230V' |
 * 'Solar'): Die Verifikation fragt nicht „welcher Norm-Bereich“, sondern
 * „welche Gefährdungs- und Rechenklasse“. Solar-Zuleitungen sind z. B.
 * gefährdungsmäßig DC-Kleinspannung, rechnerisch aber MPP (18 V-Basis) — sie
 * landen in `DC_ELV` und tragen den Träger `solar` in der Kante.
 */
export type DomainClass =
  /** DC-Kleinspannung ≤ 60 V DC (Bordnetz 12/24/48 V, Solar-Zuleitung). */
  | 'DC_ELV'
  /** 230 V AC — Landstrom-Einspeisung ODER Wechselrichter-Insel. */
  | 'AC_LV'
  /** Signal-/Messkreis (Shunt-Sense, BMS, CAN): darf keinen Laststrom führen. */
  | 'SENSOR_DATA'
  /** Wasser/Gas-Führung. */
  | 'FLUID'
  /** Kein Leiter (Dach-Fläche, Leerrohr-Hülle, Hintergrund). */
  | 'NON_ELECTRICAL';

/**
 * Polarität/Rolle eines Ports im Stromkreis.
 *
 * `line` deckt L (Außenleiter) und die Wechselrichter-Ausgänge ab; das Modell
 * ist (wie der Planer selbst) ein Einleiter-Schema — N und PE existieren als
 * abgeleitete Zusammensetzung (`acCableComposition`), nicht als eigene Kanten.
 */
export type Polarity = 'positive' | 'negative' | 'line' | 'neutral' | 'protective-earth' | 'signal' | 'none';

/** Port-Rolle in der Kantenrichtung (Quelle/Ziel des Plan-Werkzeugs). */
export type PortRole = 'source' | 'target';

/** Gefährdungsklasse eines Befunds — genau drei Stufen (Auftragsvorgabe). */
export type VerificationSeverity = 'CRITICAL_SAFETY' | 'CODE_VIOLATION' | 'EFFICIENCY_WARNING';

/** Alle gültigen Schweregrade (Reihenfolge = Sortierreihenfolge im Report). */
export const SEVERITY_ORDER: readonly VerificationSeverity[] = [
  'CRITICAL_SAFETY',
  'CODE_VIOLATION',
  'EFFICIENCY_WARNING',
];

/**
 * Art des Befunds — die Unterscheidung, die eine reine Severity-Skala nicht
 * leisten kann:
 *
 *   - `VIOLATION`:   Ein Prädikat ist WIDERLEGT (Gegenbeispiel vorhanden).
 *   - `UNVERIFIABLE`: Ein Prädikat ist mit der Datenlage NICHT ENTSCHEIDBAR.
 *
 * Ohne diese Trennung würde „fehlende Angabe“ wie „Regelverstoß“ aussehen
 * (und umgekehrt „Regelverstoß“ wie „fehlende Angabe“). Die Severity bleibt
 * trotzdem aussagekräftig: Sie benennt die Schutzwirkung, um die es geht.
 */
export type FindingKind = 'VIOLATION' | 'UNVERIFIABLE';

/** Alle gültigen Befundarten. */
export const FINDING_KINDS: readonly FindingKind[] = ['VIOLATION', 'UNVERIFIABLE'];

/**
 * Herkunft einer Regel/Grenze. Steuert, ob eine Regel im Profil überhaupt
 * angewandt wird, und steht als Pflichtfeld in jedem Audit-Event:
 *
 *   - `VERIFIED_NORM`:      Normtext belegt (Wortlaut/Zitat oder lizenzierte
 *                           Sekundärquelle mit Wortlaut-Exzerpt).
 *   - `VERIFIED_DATASHEET`: Herstellerdatenblatt/Produktnorm.
 *   - `MODEL_ASSUMPTION`:   bewusste, dokumentierte Modellannahme — keine
 *                           Normbehauptung (z. B. 3 % Spannungsfall-Budget).
 *   - `UNVERIFIED`:         offen. Wird als solches berichtet und nie als
 *                           Normzitat ausgegeben.
 *   - `DERIVED`:            Invariante des Datenmodells (Graph-Eigenschaft).
 */
export type Provenance =
  'VERIFIED_NORM' | 'VERIFIED_DATASHEET' | 'MODEL_ASSUMPTION' | 'UNVERIFIED' | 'DERIVED';

/** Alle gültigen Herkunftsstufen. */
export const PROVENANCES: readonly Provenance[] = [
  'VERIFIED_NORM',
  'VERIFIED_DATASHEET',
  'MODEL_ASSUMPTION',
  'UNVERIFIED',
  'DERIVED',
];

/** Ergebnis EINES Regeltests. */
export type CheckStatus = 'PASS' | 'FAIL' | 'UNPROVABLE';

/** Alle gültigen Testzustände. */
export const CHECK_STATUSES: readonly CheckStatus[] = ['PASS', 'FAIL', 'UNPROVABLE'];

/** Gesamtverdikt des Plans. */
export type VerificationVerdict = 'COMPLIANT' | 'NON_COMPLIANT' | 'INCOMPLETE';

/** Nummer des Validierungs-Passes (Reihenfolge = Abbruchreihenfolge). */
export type PassNumber = 1 | 2 | 3 | 4 | 5;

/**
 * Prüfprofil (kumulativ):
 *
 *   - `NORM_CORE`:  nur Regeln mit belegter Norm-/Datenblattgrundlage.
 *   - `CAMP_MODEL`: zusätzlich die dokumentierten Modellannahmen des Planers
 *                   (Derating, 3-%-Budget, 16-mm²-Masseanbindung …). DEFAULT.
 *   - `PRACTICE`:   zusätzlich Fachpraxis-Regeln mit `UNVERIFIED`-Herkunft.
 *
 * Der Report nennt die Regeln, die das Profil NICHT geprüft hat — ein
 * stillschweigend weggelassener Test wäre genau der stille Fallback, den
 * dieses Modul verbietet.
 */
export type VerificationProfile = 'NORM_CORE' | 'CAMP_MODEL' | 'PRACTICE';

/** Alle gültigen Profile, aufsteigend nach Prüfumfang. */
export const VERIFICATION_PROFILES: readonly VerificationProfile[] = ['NORM_CORE', 'CAMP_MODEL', 'PRACTICE'];

/**
 * Installationskontext. Die Normsätze sind NICHT austauschbar:
 *
 *   - `VEHICLE`:    Caravan/Wohnmobil → DIN VDE 0100-721 (Caravans und
 *                   Motorcaravans), DIN VDE 0100-410/-430, DIN VDE 0298-4,
 *                   ISO 10133 (DC an Bord von Wasserfahrzeugen ist hier
 *                   bewusst NICHT angewandt, s. `MARINE`).
 *   - `MARINE`:     Wasserfahrzeug → ISO 10133 (DC) / ISO 13297 (AC).
 *   - `STATIONARY`: feste Anlage → DIN VDE 0100-410/-430 ohne 721/708.
 *
 * Die Auswahl ist eine **Deklaration des Aufrufers** (`context`), kein
 * Rückschluss aus Bauteilen: Ein Plan mit Landstrom-Einspeisung ist nicht
 * automatisch ein Campingplatz.
 */
export type InstallationContext = 'VEHICLE' | 'MARINE' | 'STATIONARY';

/** Alle gültigen Kontexte. */
export const INSTALLATION_CONTEXTS: readonly InstallationContext[] = ['VEHICLE', 'MARINE', 'STATIONARY'];

// ============================================================================
// 2. REGEL-IDENTITÄT
// ============================================================================

/**
 * Alle Regel-IDs der Engine. Die Union ist geschlossen: Ein Audit-Event kann
 * nur eine ID tragen, die in der Regelmatrix (`rules.ts`) mit Normbezug,
 * formalem Test und Abbruchkriterium deklariert ist.
 */
export type RuleId =
  // Pass 1 — Syntax & Connectivity
  | 'SYN-001-dangling-endpoint'
  | 'SYN-002-unmodeled-component'
  | 'SYN-003-unknown-port'
  | 'SYN-004-domain-crossing'
  // Pass 2 — Domain & Polarität
  | 'DOM-001-polarity-cross'
  | 'DOM-002-positive-to-reference'
  | 'TOPO-001-short-path'
  | 'TOPO-002-shunt-direct-bypass'
  | 'TOPO-003-shunt-cut'
  | 'TOPO-004-ground-loop'
  | 'TOPO-005-fluid-electrical-bridge'
  // Pass 3 — Ampazität & Schutz
  | 'AMP-001-ib-in-iz'
  | 'AMP-002-i2-vs-iz'
  | 'AMP-003-source-protection-position'
  | 'AMP-004-breaking-capacity'
  | 'AMP-005-selectivity'
  | 'AMP-006-conduit-fill'
  // Pass 4 — Spannungsfall & Energiebilanz
  | 'VDR-001-voltage-drop-edge'
  | 'VDR-002-voltage-drop-path'
  | 'PWR-001-energy-balance'
  // Pass 5 — Erdung & Personenschutz
  | 'GND-001-chassis-bond-cross-section'
  | 'RCD-001-rcd-deviation'
  | 'RCD-002-rcd-type'
  | 'RCD-003-rcd-position'
  | 'RCD-004-two-pole-switching'
  | 'RCD-005-loop-impedance'
  | 'RCD-006-rcd-selectivity'
  | 'NET-001-pen-forbidden'
  | 'NET-002-island-fault-loop';

// ============================================================================
// 3. ENTITÄTEN (GEGENSTAND EINES BEFUNDS)
// ============================================================================

export type EntityKind = 'edge' | 'node' | 'net' | 'path' | 'system';

/** Verweis auf die verletzende Entität (Kante, Knoten, Netz, Pfad). */
export interface EntityRef {
  kind: EntityKind;
  id: string;
}

/** Eindeutige, stabile Kennung eines Ports (Knoten + Handle + Rolle). */
export type PortKey = string;

/**
 * Ein Anschluss eines Bauteils im elektrischen Modell.
 *
 * `sourceDomain` ist der Wert der **einen** Domänen-Autorität
 * (`getHandleDomain`, `lib/domain/handleDomains.ts`); `domain` ist die
 * abgeleitete Gefährdungsklasse (`domainClassOf` in `graph.ts`). Beide werden
 * gespeichert, damit die Ableitung nicht an zwei Stellen unterschiedlich
 * ausfallen kann.
 */
export interface PortRef {
  key: PortKey;
  nodeId: string;
  nodeType: string;
  handleId: string | null;
  role: PortRole;
  sourceDomain: HandleDomainValue;
  domain: DomainClass;
  polarity: Polarity;
}

// ============================================================================
// 4. KOMPONENTEN-VERHALTEN
// ============================================================================

/** Lastklasse — steuert das Spannungsfall-Budget und die Meldeklasse. */
export type LoadClass =
  /** Ladekreise (Batterie-Bank, Ladegeräte): 1 % Budget. */
  | 'charging'
  /** Mess-/Sensoriklast (Shunt-Auswertung, Funkanlage): 1 % Budget. */
  | 'sensitive'
  /** Standardverbraucher: 3 % Budget. */
  | 'standard'
  /** Sicherheitsrelevante Last (Kühlung Medikamente, Warnanlage): 1 % Budget. */
  | 'safety';

/** Rolle einer DC-Quelle. */
export type SourceRole = 'house-battery' | 'starter-battery' | 'shore-entry' | 'pv-array';

/**
 * Verhaltensklasse eines Bauteils (NICHT die UI-Kachel).
 *
 * Jeder registrierte Bauteiltyp wird hier genau einmal abgebildet
 * (`componentBehavior` in `graph.ts`). Ein unbekannter Typ ist
 * `{ kind: 'UNKNOWN' }` — niemals stillschweigend DC-Quelle oder -Verbraucher.
 */
export type ComponentBehavior =
  | {
      kind: 'SOURCE';
      carrier: 'dc' | 'ac' | 'solar';
      role: SourceRole;
      nominalVoltageV: number | null;
      /** Landstrom: Netzimpedanz/Form deklariert? (s. NET-001/NET-002). */
      declaredSystemForm?: 'TN-S' | 'TN-C' | 'TT' | 'IT' | null;
    }
  | {
      kind: 'CONVERTER';
      inputDomain: DomainClass;
      outputDomain: DomainClass;
      efficiency: number | null;
      continuousPowerW: number | null;
      /** Wechselrichter: interner N-PE-Erdungsschlüssel laut Datenblatt. */
      neutralEarthBond?: 'always' | 'dynamic' | 'never' | null;
      /**
       * Integrierter FI am AC-Ausgang (`inverter.data.hasRcd`). `null` =
       * nicht angegeben — die Engine meldet das als Datenlücke, statt
       * „kein FI“ zu unterstellen.
       */
      hasIntegratedRcd?: boolean | null;
    }
  | {
      kind: 'LOAD';
      loadClass: LoadClass;
      ratedPowerW: number | null;
      currentA: number | null;
    }
  | { kind: 'PROTECTION'; device: ProtectionDevice }
  | { kind: 'MEASUREMENT'; measurement: 'shunt' | 'other' }
  | { kind: 'REFERENCE'; reference: 'chassis' | 'pe' }
  | { kind: 'PASSIVE' }
  | { kind: 'NON_ELECTRICAL' }
  | { kind: 'UNKNOWN'; reason: string };

// ============================================================================
// 5. SCHUTZORGANE
// ============================================================================

/**
 * Bauform-/Produktklasse eines Überstrom-Schutzorgans. Entscheidet, aus
 * welcher Produktnorm der konventionelle Auslösestrom `I2` stammt
 * (`deviceClasses.ts`) — und ob er überhaupt belegt ist.
 */
export type FuseProductClass =
  /** gG/gL nach IEC 60269-1 (NH/Sicherungseinsatz, konventionelle Ströme genormt). */
  | 'iec60269-gg'
  /** Kfz-Flachsicherung (ATO/Mini/Maxi) nach ISO 8820-3. */
  | 'iso8820-blade'
  /** Bolzen-/Streifensicherung (MIDI/MEGA/ANL/MRBF) — Produktdatenblatt nötig. */
  | 'bolt-down'
  /** Class T (UL 248) — Produktdatenblatt nötig. */
  | 'ul248-classT';

/** Bauform des DC-Überstromschutzorgans inkl. Produktklasse. */
export interface FuseDevice {
  type: 'fuse';
  productClass: FuseProductClass;
  /**
   * Konkrete Bauform des Planers (`lib/shortCircuit.ts` FUSE_TYPES) — nötig,
   * um Tabellenwerte (Abschaltvermögen) zuzuordnen. Fehlt sie, bleibt der
   * Tabellenwert unbelegt: kein stiller Rückgriff auf die kleinste Bauform.
   */
  variant?: 'ato' | 'midi' | 'mega' | 'anl' | 'mrbf' | 'classT' | null;
  /** Bemessungsstrom In in A. */
  ratedCurrentA: number;
  /** Konventioneller Auslösestrom I2 (A) — explizit aus Datenblatt. */
  i2A?: number | null;
  /** Bemessungs-Abschaltvermögen (A) — explizit aus Datenblatt. */
  breakingCapacityA?: number | null;
  /** Vorbelegung I²t (A²s) für die Selektivitätsprüfung (Datenblatt). */
  clearingI2tA2s?: number | null;
  preArcingI2tA2s?: number | null;
}

/** Leitungsschutzschalter nach IEC 60898-1. */
export interface McbDevice {
  type: 'mcb';
  /** Charakteristik; `null` = im Plan nicht angegeben (⇒ Abschaltbedingung UNPROVABLE). */
  characteristic: 'B' | 'C' | 'D' | null;
  ratedCurrentA: number;
  i2A?: number | null;
  breakingCapacityKA?: number | null;
  /** Anzahl geschalteter Pole: 1 = nur L, 2 = L+N. */
  poles?: 1 | 2 | null;
  clearingI2tA2s?: number | null;
  preArcingI2tA2s?: number | null;
}

/** Fehlerstrom-Schutzeinrichtung (RCD). */
export interface RcdDevice {
  type: 'rcd';
  /** Bemessungsdifferenzstrom IΔn in A (z. B. 0,03). */
  ratedResidualCurrentA: number;
  /** Fehlerstromtyp nach IEC 60755/61008/61009 (AC/A/F/B). */
  residualType: 'AC' | 'A' | 'F' | 'B';
  poles?: 1 | 2 | null;
  /** Selektiv (zeitverzögert, Typ S)? */
  selective?: boolean | null;
}

/** Diskriminierte Union aller Schutzorgane. */
export type ProtectionDevice = FuseDevice | McbDevice | RcdDevice;

/**
 * Ein Schutzorgan mit Einbauort. Zwei Orte sind modelliert:
 *
 *   - `edge-data`: Das Organ sitzt IN der Leitung (`edge.data.fuseSize` /
 *     `acProtection`), Position aus `edge.data.fuseOffset` — nur so lässt sich
 *     die 200-mm-Regel messen.
 *   - `node`: Das Organ ist ein eigener Knoten in Reihe (`fuse`, `rcd`).
 */
export interface ProtectionPlacement {
  device: ProtectionDevice;
  host: 'edge-data' | 'node';
  hostId: string;
  /** Position ab der Quelle in Meter (nur bei `edge-data` bekannt), sonst null. */
  positionFromSourceM: number | null;
  /** Gilt das Organ als am Quellenpol sitzend (fuseOffset fehlt)? */
  assumedAtSource: boolean;
}

// ============================================================================
// 6. NETZMODELL (KONDUKTIONSGRAPH)
// ============================================================================

/** Modellierte Leitung zwischen zwei Ports. */
export interface CableModel {
  edgeId: string;
  from: PortRef;
  to: PortRef;
  domain: DomainClass;
  sourceDomain: HandleDomainValue;
  /** Träger der Leitung — 'solar' rechnet gegen MPP-Spannung. */
  carrier: 'dc' | 'ac' | 'solar' | 'water';
  /** Länge in Metern; `null` = nicht angegeben (nicht 0!). */
  lengthM: number | null;
  lengthIsAssumption: boolean;
  crossSectionMm2: number | null;
  /** Betriebsstrom Ib in A; `null` = nicht bestimmbar (Datenlücke). */
  currentA: number | null;
  /** Quelle des Stromwerts (Modellkennzeichnung, z. B. `calculateEdgeCurrent`). */
  currentSource: string;
  /** Schutzorgane, die IN dieser Leitung sitzen (Kantendaten), mit Einbauort. */
  protections: readonly ProtectionPlacement[];
}

/** Shunt-Knoten mit seinen beiden Messseiten. */
export interface ShuntModel {
  nodeId: string;
  /** Batterieseite (BAT−): Port, über den die Batterie einspeist. */
  batterySide: PortRef | null;
  /** Lastseite (LOAD−): Port, von dem die Verbraucher abgehen. */
  loadSide: PortRef | null;
}

/** Ein Bauteil im elektrischen Modell. */
export interface CircuitComponent {
  nodeId: string;
  nodeType: string;
  behavior: ComponentBehavior;
  ports: readonly PortRef[];
  label: string;
}

/**
 * Der vollständige Konduktionsgraph eines Plans — die Eingabe ALLER Prüfungen.
 *
 * Enthält bewusst auch die Datenlücken (`danglingEdges`, `unknownPorts`,
 * `unmodeledComponents`) statt sie wegzufiltern: Ein Prüfbericht, der nur die
 * interpretierbaren Teile zeigt, ist eine Teilwahrheit.
 */
export interface ConductionGraph {
  components: ReadonlyMap<string, CircuitComponent>;
  cables: readonly CableModel[];
  /** Kanten-ID → Modell (nur interpretierbare Kanten). */
  cableById: ReadonlyMap<string, CableModel>;
  /** Kanten, die Fluidik und Elektrik verbinden würden (TOPO-005). */
  fluidBridges: ReadonlyArray<{ edgeId: string; fluidNodeId: string; otherNodeId: string }>;
  /** Knoten-ID → angeschlossene Leitungen (undirektional). */
  cablesByNode: ReadonlyMap<string, readonly CableModel[]>;
  /** Kanten mit fehlendem Endknoten (Kanten-ID → Kantenbeschreibung). */
  danglingEdges: ReadonlyArray<{ edgeId: string; missingNodeId: string }>;
  /** Kanten mit unbekanntem Bauteiltyp (Kanten-ID → Typ). */
  unmodeledComponents: ReadonlyArray<{ edgeId: string; nodeId: string; nodeType: string }>;
  /** Kanten mit unbekanntem Handle (Kanten-ID → Handle). */
  unknownPorts: ReadonlyArray<{ edgeId: string; nodeId: string; handleId: string | null }>;
  shunts: readonly ShuntModel[];
  /** Systemspannung der DC-Auslegung in V (aus `getSystemVoltage`). */
  systemVoltageV: number;
}

// ============================================================================
// 7. BEFUNDE (AUDIT-EVENTS)
// ============================================================================

/**
 * Ein normatives Audit-Event. Jeder Befund trägt:
 *   - die Regel-ID (maschinenlesbar, in der Matrix deklariert),
 *   - Norm + Klausel + Herkunft,
 *   - die verletzende Entität,
 *   - Rechenwert gegen Grenzwert (jeweils in derselben Einheit),
 *   - die formale Gleichung des Tests,
 *   - das Gegenbeispiel (Pfad/Paar), falls es sich um eine Widerlegung handelt,
 *   - eine exakte Remediation („Querschnitt auf 10 mm² erhöhen ODER Sicherung
 *     auf höchstens 25 A verringern“).
 */
export interface AuditEvent {
  ruleId: RuleId;
  severity: VerificationSeverity;
  kind: FindingKind;
  standard: string;
  /** Klausel/Abschnitt — `null`, wenn nicht belegt (nie geraten). */
  clause: string | null;
  provenance: Provenance;
  entity: EntityRef;
  /** Formale Bedingung, die geprüft wurde, z. B. `I_b ≤ I_n ≤ I_z`. */
  equation: string;
  /** Berechneter Ist-Wert (Zahl) oder null, wenn keiner existiert. */
  calculatedValue: number | null;
  /** Grenzwert (Zahl) oder null, wenn keiner existiert. */
  allowedLimit: number | null;
  unit: string;
  /** Klartext für den Nutzer (deutsch, ohne Engineering-Jargon). */
  message: string;
  /** Exakte Dimensionierungs-/Umbauvorgabe. Nie leer. */
  autoFixRemedy: string;
  /** Gegenbeispiel/Trace (z. B. Pfad Knoten→Knoten), falls vorhanden. */
  counterexample?: readonly string[];
}

/** Ergebnis eines Regeltests über den gesamten Plan. */
export interface CheckResult {
  ruleId: RuleId;
  status: CheckStatus;
  events: readonly AuditEvent[];
  /** Anzahl der geprüften Entitäten (Kanten/Netze/Paare) — macht Abdeckung sichtbar. */
  evaluatedEntities: number;
}

/** Ergebnis eines Validierungs-Passes. */
export interface PassResult {
  pass: PassNumber;
  name: string;
  status: CheckStatus;
  checks: readonly CheckResult[];
}

/** Abdeckungsstatistik: wie viel des Plans ist WIRKLICH geprüft. */
export interface Coverage {
  /** Regeln, die das Profil ausführt (Regelmatrix-Filter). */
  rulesApplied: number;
  /** Regeln, die das Profil nicht ausführt ODER deren Gegenstand fehlt. */
  rulesSkipped: number;
  /** Alle Regelprüfungen des Laufs. */
  checks: number;
  /** Prüfungen mit mindestens einer betrachteten Entität. */
  exercised: number;
  /** Prüfungen ohne Gegenstand im Plan (leere Quantifizierung, nicht »bestanden«). */
  notApplicable: number;
  /** Bestandene Prüfungen (ohne die nicht anwendbaren). */
  passed: number;
  failed: number;
  unprovable: number;
  /** Verhältnis entschiedener Tests zu allen AUSGEFÜHRTEN (0…1). */
  decisionRatio: number;
}

/** Reproduzierbarer Prüfnachweis (deterministisch über der Eingabe). */
export interface VerificationCertificate {
  /** FNV-1a-Hash über die kanonisch serialisierte Prüfeingabe. */
  planFingerprintHash: string;
  /** Hash über Verdikt + Regel-Status (der Prüfnachweis selbst). */
  certificateHash: string;
  engineVersion: string;
  profile: VerificationProfile;
  context: InstallationContext;
  decidedRules: number;
  totalRules: number;
}

/** Gesamtreport der Engine. */
export interface VerificationReport {
  verdict: VerificationVerdict;
  passes: readonly PassResult[];
  events: readonly AuditEvent[];
  coverage: Coverage;
  certificate: VerificationCertificate;
  /** Regeln, die das Profil absichtlich NICHT ausgeführt hat. */
  skippedRules: readonly RuleId[];
  /** Modellgrenzen, die für dieses Verdikt gelten (nie leer). */
  limitations: readonly string[];
}
