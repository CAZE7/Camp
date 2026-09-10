import type { AcProtectionDescriptor } from '../acProtection';

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
   * (`edgeLength` in lib/autoWire.ts, `quantityOr` in lib/vde-standards.ts).
   */
  length?: number;
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
};
