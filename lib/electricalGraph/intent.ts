/**
 * lib/electricalGraph/intent.ts — BESITZVERHÄLTNIS EINER VERBINDUNG.
 *
 * Problem bis hierher (Befund V2-INTENT-001): Eine Kante kannte genau ein
 * Herkunftsbit — `edge.data.autoWired` (AUDIT D2). Damit ließen sich nur zwei
 * Fragen beantworten („hat AutoWire das gebaut?" / „hat es der Nutzer
 * gezogen?"). Nicht beantwortbar war die dritte, fachlich entscheidende:
 * **Darf AutoWire diese Verbindung ändern?** `healUserEdges` hat deshalb
 * Nutzerkanten umgehängt und gelöscht, ohne dass irgendwo stand, ob der
 * Nutzer diese Topologie bewusst wollte. Eine Planungssoftware, die eine
 * bewusste Entscheidung still überschreibt, ist nicht benutzbar — der Nutzer
 * kann dem Plan nicht trauen.
 *
 * Das Modell trennt deshalb **Herkunft** (wer hat die Kante erzeugt) von
 * **Absicht** (wie verbindlich ist sie):
 *
 * ```text
 * LOCKED      vom Nutzer festgenagelt — weder Topologie noch Route ändern
 *   ↓
 * USER        vom Nutzer gezogen und ausdrücklich als Absicht erklärt
 *   ↓
 * REQUIRED    von einer Regel erzwungen (Schutzleiter, Massebond)
 *   ↓
 * AUTO        von AutoWire erzeugt — wird bei jedem Lauf neu gebaut
 *   ↓
 * SUGGESTED   Vorschlag, noch nicht Teil des Plans
 * ```
 *
 * Kleinere Zahl = höhere Priorität. Bei Konflikten gewinnt IMMER die stärkere
 * Absicht; die schwächere wird **gemeldet**, nicht ausgeführt
 * (`lib/autoWire/conflicts.ts`).
 *
 * Rückwärtskompatibilität ist Pflicht: Gespeicherte Pläne tragen kein
 * `intent`-Feld. `edgeIntentOf` leitet es deshalb aus dem vorhandenen
 * `autoWired`-Flag ab (und, als letzter Migrationsschritt, aus dem
 * ID-Präfix — dieselbe Rangfolge wie `isAutoWiredEdge`).
 *
 * Schichten: reine Domäne, keine UI-Abhängigkeit (ADR 0008 / ARCH-001).
 */

import { AUTO_EDGE_PREFIX } from '../autoWire/primitives';

/** Verbindlichkeit einer elektrischen Verbindung. */
export type EdgeIntent = 'locked' | 'user' | 'required' | 'auto' | 'suggested';

/** Alle gültigen Werte — Reihenfolge = Priorität (stärkste zuerst). */
export const EDGE_INTENTS: readonly EdgeIntent[] = ['locked', 'user', 'required', 'auto', 'suggested'];

/**
 * Priorität je Absicht (kleiner = stärker). Als Tabelle statt als
 * Index-Suche in `EDGE_INTENTS`, damit die Rangfolge an genau einer Stelle
 * steht und ein neuer Wert nicht versehentlich „irgendwo in der Mitte" landet.
 */
export const EDGE_INTENT_PRIORITY: Readonly<Record<EdgeIntent, number>> = {
  locked: 0,
  user: 1,
  required: 2,
  auto: 3,
  suggested: 4,
};

/** Laufzeitprüfung für Werte aus `edge.data` (JSON, localStorage, Import). */
export const isEdgeIntent = (value: unknown): value is EdgeIntent =>
  typeof value === 'string' && (EDGE_INTENTS as readonly string[]).includes(value);

/** Schmale Sicht auf das, was die Absicht bestimmt. */
export type IntentCarrier = {
  id: string;
  data?: { intent?: unknown; locked?: unknown; autoWired?: unknown } | null;
};

/**
 * Absicht einer Kante — die EINE Ableitung.
 *
 * Rangfolge (jede Stufe schlägt die darunter):
 *   1. `data.locked === true`      → `'locked'` (Sperre ist eine Tatsache,
 *      kein Label: sie darf nicht durch ein widersprüchliches `intent`-Feld
 *      aufgehoben werden)
 *   2. gültiges `data.intent`      → dieser Wert
 *   3. `data.autoWired === true`   → `'auto'`
 *   4. `data.autoWired === false`  → `'user'`
 *   5. ID-Präfix `e-auto-`         → `'auto'` (Migration, s. `isAutoWiredEdge`)
 *   6. sonst                       → `'user'`
 *
 * Schritt 6 ist bewusst konservativ: Eine Kante unbekannter Herkunft gehört
 * im Zweifel dem Nutzer. Das Gegenteil („im Zweifel AutoWire") würde fremde
 * Pläne beim ersten Klick umbauen.
 */
export function edgeIntentOf(edge: IntentCarrier): EdgeIntent {
  const data = edge.data;
  if (data?.locked === true) return 'locked';
  if (isEdgeIntent(data?.intent)) return data.intent;
  if (data?.autoWired === true) return 'auto';
  if (data?.autoWired === false) return 'user';
  return edge.id.startsWith(AUTO_EDGE_PREFIX) ? 'auto' : 'user';
}

/**
 * Hat der Nutzer die Absicht AUSDRÜCKLICH erklärt? (Gepinnt)
 *
 * Diese Frage ist von `edgeIntentOf` getrennt, und das ist Absicht: Jede
 * importierte Kante ohne Flag ist nach obiger Rangfolge `'user'` — sie
 * deshalb unantastbar zu machen, würde die bestehende Heilung unsicherer
 * Altpläne abschalten (Serienkurzschluss, Solar-Direktanschluss; AUDIT
 * ELE-001/ELE-002 sind sicherheitskritisch). Gepinnt ist deshalb nur, was
 * ausdrücklich im Plan steht:
 *
 *   - `data.locked === true`                          (UI: „Leitung sperren")
 *   - `data.intent ∈ {locked, user, required}`        (ausdrücklich gesetzt)
 *
 * AutoWire darf eine gepinnte Kante **niemals** umhängen oder löschen; ein
 * Regelkonflikt wird als `AutoWireConflict` gemeldet und der Nutzer
 * entscheidet.
 */
export function isIntentPinned(edge: IntentCarrier): boolean {
  const data = edge.data;
  if (data?.locked === true) return true;
  if (!isEdgeIntent(data?.intent)) return false;
  return data.intent === 'locked' || data.intent === 'user' || data.intent === 'required';
}

/**
 * Darf das Routing die Geometrie dieser Leitung frei wählen?
 * `false` ausschließlich bei `locked` — eine „nur" erklärte Nutzer-Absicht
 * bindet die TOPOLOGIE, nicht den Kabelweg (ADR 0008: Topologie ≠ Geometrie).
 */
export const isRouteLocked = (edge: IntentCarrier): boolean => edgeIntentOf(edge) === 'locked';

/** Vergleich für `Array.prototype.sort` — stärkste Absicht zuerst. */
export const compareIntentPriority = (left: EdgeIntent, right: EdgeIntent): number =>
  EDGE_INTENT_PRIORITY[left] - EDGE_INTENT_PRIORITY[right];

/** Die stärkere von zwei Absichten (bei Gleichstand die linke). */
export const strongerIntent = (left: EdgeIntent, right: EdgeIntent): EdgeIntent =>
  EDGE_INTENT_PRIORITY[left] <= EDGE_INTENT_PRIORITY[right] ? left : right;

/**
 * Darf `candidate` eine bestehende Kante mit `existing` ersetzen?
 *
 * Regel: nur eine STRENG stärkere Absicht darf ersetzen. Gleichstand heißt
 * „beides gleich verbindlich" — dann entsteht ein Konflikt, keine stille
 * Überschreibung (insbesondere `auto` ersetzt nie `auto` einer anderen
 * Quelle, sondern wird dedupliziert).
 */
export const mayOverride = (candidate: EdgeIntent, existing: EdgeIntent): boolean =>
  EDGE_INTENT_PRIORITY[candidate] < EDGE_INTENT_PRIORITY[existing];
