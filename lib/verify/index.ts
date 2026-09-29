/**
 * lib/verify/index.ts — ÖFFENTLICHE API DER VERIFIKATIONS-ENGINE.
 *
 * Aufbau (drei Artefakte des Auftrags):
 *
 *   1. FORMALE TYPDEFINITIONEN   → `./types` (Knoten, Ports, Netze, Schutzorgane,
 *                                   Regeln, Befunde, Zertifikat)
 *   2. VALIDIERUNGS-CORE         → `./physics` (ρ(T), ΔU, I_z, Z_s, I_k,min, I²t)
 *                                   `./ampacity` (I_b ≤ I_n ≤ I_z, I_2 ≤ 1,45·I_z,
 *                                   0,2-m-Regel, Abschaltvermögen, Selektivität)
 *                                   `./topology` (Kurzschlussfreiheit, Shunt-Invariante,
 *                                   Masseschleifen, Domänentrennung)
 *                                   `./protection` (RCD/Netzform/Personenschutz)
 *                                   `./pipeline` (5-Pass-Orchestrierung)
 *   3. NORMEN-REGELMATRIX        → `./rules` (Anforderung → formaler Test →
 *                                   Abbruchkriterium, mit Klausel + Herkunft)
 *
 * Ein Aufruf genügt für einen vollständigen Prüfbericht:
 *
 *     const report = verifyPlan({ nodes, edges, options: { profile: 'NORM_CORE' } });
 *
 * Der Bericht ist deterministisch (Zertifikat-Hash) und weist seine
 * Modellgrenzen selbst aus (`limitations`) — die Engine gibt keinen Zustand
 * als »geprüft« aus, den sie nicht geprüft hat.
 */

export * from './types';
export * from './rules';
export * from './events';
export * from './physics';
export * from './deviceClasses';
export * from './graph';
export * from './topology';
export * from './pathSearch';
export * from './ampacity';
export * from './powerPath';
export * from './protection';
export * from './context';
export * from './pipeline';
