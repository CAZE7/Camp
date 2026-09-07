/**
 * lib/domain/cableEdgeData.ts — Datenform einer elektrischen Kante.
 *
 * AUDIT ARCH-001: Der Typ lebte in components/edges/CableEdge.tsx und wurde
 * von lib/autoWire/primitives.ts (typseitig!) importiert — Domänencode hing
 * an einer Komponente. Er ist reine Datenform ohne UI-Bezug und gehört der
 * Domäne; components/edges/CableEdge.tsx re-exportiert ihn für bestehende
 * Importe (kein Verhaltensänderung, nur Schichtenordnung laut ADR-0008).
 */

export type CableEdgeGeometry = {
  points: Array<{ x: number; y: number }>;
};

/** Datenform einer elektrischen Kante (Kabel) im Planer. */
export type CableEdgeData = {
  /**
   * Routing V2: optionale Polyline. Wenn vorhanden, ersetzt sie den Pfad —
   * die UI zeigt damit das obstakelbewusste Ergebnis.
   */
  geometry?: CableEdgeGeometry;
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
};
