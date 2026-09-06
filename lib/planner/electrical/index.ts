/**
 * lib/planner/electrical/index.ts
 *
 * Öffentliche API des getrennten Elektrik-Moduls.
 *
 * Früher lag alles in einer 551-Zeilen-Datei (lib/vde-standards.ts) mit
 * mehreren Verantwortlichkeiten. Jetzt ist der Bereich sauber aufgeteilt:
 *
 *   standards.ts    → normative Tabellen & Konstanten
 *   ampacity.ts     → Strombelastbarkeit (Ampacity)
 *   voltageDrop.ts  → Spannungsabfall
 *   fuseSizing.ts   → Sicherungs-Auslegung
 *   cableSizing.ts  → Kabel-Dimensionierung
 *   conduit.ts      → Leerrohr / Kabelkanal
 *   validation.ts   → VDE-Validierung
 *
 * `lib/vde-standards.ts` bleibt als re-Export-Barrel bestehen, damit besteh-
 * ende Imports (Store, Komponenten, Routing) unverändert funktionieren.
 */
export * from './standards';
export * from './ampacity';
export * from './voltageDrop';
export * from './fuseSizing';
export * from './cableSizing';
export * from './conduit';
export * from './validation';
