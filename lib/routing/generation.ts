/**
 * lib/routing/generation.ts — EINGABE-HASH, GENERATION UND KONVERGENZSCHRANKE.
 *
 * Befund V2-ROUTE-001: Das Re-Routing wurde über zwei Signatur-Strings
 * ausgelöst (`nodeLayoutSignature` + `edgeTopologySignature`, R-9) und über
 * ein 100-ms-Fenster gedrosselt. Das beantwortet „hat sich etwas geändert?",
 * aber zwei andere Fragen blieben offen:
 *
 *   1. **Welcher Stand ist das?** Routen wurden veröffentlicht, ohne zu sagen,
 *      zu welcher Eingabe sie gehören. Ein spät eintreffendes Ergebnis konnte
 *      ein neueres überschreiben (kein Monotoniebeweis).
 *   2. **Wann ist Schluss?** Ein Zyklus Layout → Messung → Routing → Layout
 *      konnte unbegrenzt weiterlaufen. Der bisherige Schutz war ein
 *      DIAGNOSE-Log (`detectAlternatingRoutingCycle`) — er beschrieb das
 *      Flattern, verhinderte es aber nicht.
 *
 * Diese Datei liefert beides, deterministisch und ohne Zeitbezug:
 *
 *   - `routingInputHash` verdichtet die Eingabe zu einem stabilen Schlüssel.
 *   - `createRouteGenerationTracker` vergibt je ÄNDERUNG eine neue Generation
 *     und zählt die Revisionen INNERHALB derselben Eingabe.
 *   - `MAX_ROUTE_REVISIONS_PER_GRAPH` ist die harte Obergrenze: Wird sie
 *     erreicht, meldet der Tracker `converged: false` und verweigert weitere
 *     Läufe für diese Eingabe, statt sie endlos zu wiederholen.
 *
 * Ausdrücklich NICHT erlaubt (AGENTS.md §5): `setTimeout` als Bremse,
 * zufällige Verzögerung, „so lange wiederholen bis es passt". Die Schranke
 * ist eine Zahl, kein Timer — damit ist sie im Test reproduzierbar.
 *
 * Diese Datei kennt keine Geometrie und keine React-Welt: Sie bekommt
 * Zeichenketten und gibt Zahlen zurück.
 */

import { fnv1a } from '../electricalGraph/graph';

/**
 * Höchstzahl an Routing-Läufen für EINE unveränderte Eingabe.
 *
 * Warum 4? Ein korrekter Lauf braucht genau einen. Zwei sind normal (erster
 * Lauf vor der Messung durch React Flow, zweiter nach der Messung). Drei
 * deckt einen nachgelagerten Layout-Effekt ab. Ab dem vierten identischen
 * Lauf ohne Eingabeänderung liegt ein Zyklus vor — das ist ein Fehler im
 * System und wird als solcher gemeldet, nicht weggedrosselt.
 */
export const MAX_ROUTE_REVISIONS_PER_GRAPH = 4;

/** Ergebnis einer Anmeldung beim Tracker. */
export interface RouteGenerationStatus {
  /** Hash der Eingabe, zu der dieser Lauf gehört. */
  hash: string;
  /** Fortlaufende Nummer der EINGABE (steigt nur bei echter Änderung). */
  generation: number;
  /** Wievielter Lauf für genau diese Eingabe (1 = erster). */
  revision: number;
  /** Darf dieser Lauf ausgeführt werden? */
  allowed: boolean;
  /** `false`, sobald die Revisionsschranke gerissen wurde. */
  converged: boolean;
  /** Menschenlesbarer Grund, wenn `allowed === false`. */
  reason?: string;
}

export interface RouteGenerationTracker {
  /** Meldet einen beabsichtigten Lauf an und entscheidet, ob er laufen darf. */
  begin: (hash: string) => RouteGenerationStatus;
  /** Letzter Stand ohne Zustandsänderung (für Diagnose/Anzeige). */
  peek: () => RouteGenerationStatus | undefined;
  /** Setzt den Zähler zurück (Plan geladen, Tests). */
  reset: () => void;
}

/**
 * Verdichtet die Routing-Eingabe zu einem Schlüssel.
 *
 * Die Bestandteile bleiben die bewährten Signaturen aus
 * `components/edges/utils/cableRouteStore.ts` (R-9) — sie sind vollständig
 * und inhaltsbasiert. Neu ist nur, dass das Ergebnis eine kurze, vergleichbare
 * IDENTITÄT bekommt, die man protokollieren und in den Report schreiben kann.
 */
export function routingInputHash(nodeSignature: string, edgeSignature: string): string {
  return fnv1a(`${nodeSignature}\n#\n${edgeSignature}`);
}

/**
 * Zählt Generationen und Revisionen einer Routing-Eingabe.
 *
 * Verhalten:
 *   - neuer Hash  ⇒ `generation + 1`, `revision = 1`, erlaubt
 *   - gleicher Hash ⇒ `revision + 1`; erlaubt, solange
 *     `revision <= MAX_ROUTE_REVISIONS_PER_GRAPH`
 *   - darüber     ⇒ `allowed: false`, `converged: false`, mit Begründung
 *
 * Ein Wechsel der Eingabe setzt die Revisionszählung zurück: Ein Nutzer, der
 * ein Bauteil hin und her schiebt, erzeugt jedes Mal eine neue Eingabe und
 * wird nie geblockt. Geblockt wird ausschließlich die Wiederholung OHNE
 * Änderung — also genau der Zyklus.
 */
export function createRouteGenerationTracker(
  maxRevisions: number = MAX_ROUTE_REVISIONS_PER_GRAPH
): RouteGenerationTracker {
  let generation = 0;
  let currentHash: string | undefined;
  let revision = 0;
  let last: RouteGenerationStatus | undefined;

  return {
    begin(hash: string): RouteGenerationStatus {
      if (hash !== currentHash) {
        currentHash = hash;
        generation += 1;
        revision = 1;
        last = { hash, generation, revision, allowed: true, converged: true };
        return last;
      }

      revision += 1;
      if (revision > maxRevisions) {
        last = {
          hash,
          generation,
          revision,
          allowed: false,
          converged: false,
          reason: `Routing hat für dieselbe Eingabe ${revision} Läufe angefordert (Grenze ${maxRevisions}). Weitere Läufe würden nichts ändern — die Ursache liegt in einer Rückkopplung zwischen Layout, Messung und Routing.`,
        };
        return last;
      }
      last = { hash, generation, revision, allowed: true, converged: true };
      return last;
    },
    peek(): RouteGenerationStatus | undefined {
      return last;
    },
    reset(): void {
      generation = 0;
      currentHash = undefined;
      revision = 0;
      last = undefined;
    },
  };
}
