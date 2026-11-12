/**
 * Die drei Domänen des Elektrikplans — Typ und Reihenfolge ohne Abhängigkeiten.
 *
 * Warum ein eigenes Modul: Der Filter (`components/planner/utils/domainFilter`)
 * zieht die Elektrik-Regeln und die Komponenten-Registry. Der Store braucht nur
 * die LISTE (Standard: alle drei aktiv). Ein Import aus `domainFilter` in den
 * Store erzeugte einen Zyklus (Store → domainFilter → lib/electrical → …), der
 * beim Laden `DOMAINS` als `undefined` zurückließ. Diese Datei hat keine
 * Importe; `domainFilter` re-exportiert sie, damit es EINE Liste bleibt.
 */

export type Domain = 'DC_12V' | 'AC_230V' | 'Solar';

export const DOMAINS: Domain[] = ['DC_12V', 'AC_230V', 'Solar'];

export const DOMAIN_LABELS: Record<Domain, string> = {
  DC_12V: '12V',
  AC_230V: '230V',
  Solar: 'Solar',
};
