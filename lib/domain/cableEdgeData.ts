import type { AcProtectionDescriptor } from '../acProtection';
import type { EdgeIntent } from '../electricalGraph/intent';

/** Geometriepunkt eines gesperrten, persistierten Kabelwegs. */
export type CableWaypoint = { x: number; y: number };

/**
 * lib/domain/cableEdgeData.ts — Datenform einer elektrischen Kante.
 *
 * AUDIT ARCH-001: Der Typ lebte in components/edges/CableEdge.tsx und wurde
 * von lib/autoWire/primitives.ts (typseitig!) importiert — Domänencode hing
 * an einer Komponente. Er ist reine Datenform ohne UI-Bezug und gehört der
 * Domäne; components/edges/CableEdge.tsx re-exportiert ihn für bestehende
 * Importe (kein Verhaltensänderung, nur Schichtenordnung laut ADR-0008).
 */

/** Datenform einer elektrischen Kante (Kabel) im Planer. */
export type CableEdgeData = {
  // Kein `geometry`-Feld: Kabelgeometrie lebt ausschließlich im
  // Route-Publish des globalen Passes (`useCableRoute` / `routeAllCables`,
  // ADR 0014). Ein persistiertes Geometrie-Feld in `edge.data` war das
  // Einfallstor der zweiten, parallel laufenden Engine und ist entfernt
  // (DOM-005); scripts/routing/architecture.test.ts bewacht das Verbot.
  /**
   * Leitungslänge in Metern. Optional, weil Kanten aus älteren gespeicherten
   * Plänen, Vorlagen und Importen sie nicht zwingend mitbringen. Jeder
   * Lesezugriff in der Fachlogik hat deshalb einen benannten Ersatzwert
   * (`planningLength` in lib/autoWire/primitives.ts — eingetragene Länge,
   * sonst Luftlinie aus der Geometrie; `quantityOr` in lib/vde-standards.ts).
   */
  length?: number;
  /**
   * Ist `length` eine PLANUNGSANNAHME statt eines Messwerts?
   *
   * AutoWire legt seine Kanten mit Annahmen an (0,2 m Backbone, 3 m
   * Verbraucher, 5 m Solar-Zuleitung …), die laut
   * `docs/ai/AUTOWIRE-CONTEXT.md` §7.3 ausdrücklich **keine Messwerte** sind:
   * Sie stecken das Spannungsfall-Budget ab, bis der Nutzer die verlegten
   * Längen einträgt. Ohne diese Kennzeichnung stand im Tooltip „(eingetragen)“
   * und der Nutzer konnte eine Vorlagen-Annahme nicht von seiner eigenen
   * Messung unterscheiden — dieselbe Sorte stiller Behauptung wie ein
   * erfundener Datenblattwert.
   *
   * Der Inspektor setzt das Feld auf `false`, sobald ein eigener Wert
   * eingegeben wird; AutoWire führt es bei der Regeneration mit.
   */
  lengthIsAssumption?: boolean;
  crossSection?: number;
  fuseSize?: number;
  /**
   * Elektrische Domäne der Leitung. 'Solar' ist bewusst Teil des Typs:
   * Solar-Zuleitungen werden beim Verbinden (Store) und bei Auto-Wire als
   * 'Solar' gespeichert — sonst ginge die Domäne beim Speichern/Laden
   * verloren und die Leitung würde als DC_12V behandelt.
   */
  edgeDomain?: 'DC_12V' | 'AC_230V' | 'Solar';
  /**
   * Von `sizeDcEdges` gesetzt, wenn der Versorgungspfad trotz 70-mm²-Obergrenze
   * das 3-%-Spannungsfall-Budget reißt — die Leitung ist fachlich nicht
   * ausführbar dimensionierbar (AUDIT-AUTOWIRE Issue 3). Datenmarkierung;
   * die Anzeige erfolgt über die vorhandene Spannungsfall-Logik.
   */
  dropWarning?: boolean;
  /** Gesetzt, wenn selbst der größte Normquerschnitt den Laststrom nicht absichern kann. */
  fuseWarning?: boolean;
  /**
   * Position der Sicherung entlang der Leitung in Metern, gemessen ab der
   * Batterie(-Seite) der Kante (AUDIT ELE-004). Ohne Angabe gilt der alte
   * Vertrag: eine vorhandene `fuseSize` sitzt „am Pol" (≤ 20 cm ungeschützt).
   * Nur für DC-Plus-Kanten mit Batterie-Endpunkt relevant.
   */
  fuseOffset?: number;
  /**
   * Bauform der Sicherung (AUDIT DOM-002): bestimmt mit der Tabelle in
   * lib/shortCircuit.ts das typische Abschaltvermögen (kA) für den
   * Kurzschluss-Check. Ohne Angabe ist das Abschaltvermögen nicht
   * bewertbar — die Live-Validierung meldet das Datenfeld dann als offen.
   */
  fuseType?: string;
  /**
   * AC-Schutzorgan (AUDIT DOM-001): Bauform/Charakteristik/Abschaltvermögen
   * des Leitungsschutzschalters nach IEC 60898-1 (LS/MCB oder FI/LS/RCBO).
   * `fuseSize` bleibt der Bemessungsstrom In. Bewertet wird damit die
   * Abschaltbedingung (Schleifenimpedanz-Schätzung, lib/acProtection.ts);
   * ohne Angabe ist sie unbewertet statt angenommen.
   */
  acProtection?: AcProtectionDescriptor;
  /**
   * Explizites Abschaltvermögen (A) aus dem Datenblatt des konkreten
   * Produkts — schlägt die Bauform-Tabelle (AUDIT DOM-002).
   */
  fuseBreakingCapacity?: number;
  /**
   * Herkunft der Kante (AUDIT D2): `true` = von `performAutoWiring` erzeugt,
   * `false` = vom Nutzer gezogen. AutoWire ersetzt bei jedem Lauf seine
   * eigenen Kanten (Idempotenz) und behält Nutzerkanten — diese Entscheidung
   * hing vorher am ID-Präfix `e-auto-`, also an einem STRING: eine Nutzerkante
   * mit einer zufällig so beginnenden ID (Import, Hand-Edit, ältere Tools)
   * wurde still gelöscht und durch zwei Auto-Kanten ersetzt.
   *
   * Das Flag ist die Autorität. Der Präfix-Vergleich bleibt als ausdrücklich
   * dokumentierter Migrations-Fallback für Pläne, die vor dem Flag gespeichert
   * wurden (`isAutoWiredEdge` in lib/autoWire/primitives.ts) — er greift nur,
   * solange das Flag fehlt, und der Schreibpfad setzt es seitdem immer.
   */
  autoWired?: boolean;
  /**
   * VERBINDLICHKEIT der Verbindung (V2, `lib/electricalGraph/intent.ts`).
   *
   * `autoWired` beantwortet „wer hat die Kante gebaut?". Diese Frage reicht
   * nicht: AutoWire musste wissen, ob es sie ÄNDERN darf. Vorher hat
   * `healUserEdges` Nutzerkanten umgehängt und gelöscht, ohne dass im Plan
   * stand, ob der Nutzer diese Topologie bewusst wollte.
   *
   * Rangfolge `locked > user > required > auto > suggested`. Eine
   * ausdrücklich gesetzte Absicht (`locked`/`user`/`required`) wird von
   * AutoWire NIE überschrieben — stattdessen entsteht ein Konflikt-Hinweis.
   * Fehlt das Feld, gilt die Ableitung aus `autoWired` (Rückwärts-
   * kompatibilität für gespeicherte Pläne).
   */
  intent?: EdgeIntent;
  /**
   * Vom Nutzer FESTGENAGELTE Leitung: weder Topologie noch Kabelweg werden
   * automatisch geändert (`docs/ROUTING-V2.md` §8 — die Hop-Priorität liest
   * das Feld bereits seit WP-7). Eine gesperrte Leitung, die einen Konflikt
   * erzeugt, wird gemeldet, nicht verschoben.
   */
  locked?: boolean;
  /** Exakte Wegpunkte des Nutzersnapshots; bleibt bis zum expliziten Entsperren erhalten. */
  lockedWaypoints?: CableWaypoint[];
};
