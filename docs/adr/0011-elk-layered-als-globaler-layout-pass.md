# ADR 0011 — ELK Layered (elkjs) als globaler Layout-Pass

**Status:** angenommen · **Datum:** 2026-09-06 · **Bezug:** WP-4 (#393), agent.md S-5, ROUTING-V2.md §6

## Kontext

Der bestehende Router (ADR 0003: Katalog + Hanan-A\*) routet Kanten einzeln auf
fixierten Knotenpositionen. Er hat keine globale Sicht: Crossing-Minimization
über den ganzen Plan, Schichtzuordnung und Port-Reihenfolgen in einem Durchgang
kann er prinzipbedingt nicht leisten. Für „Aufräumen“/AutoWire braucht der Plan
einen globalen Pass. Negotiated Congestion / PathFinder wurde als Overkill für
die Graphgröße verworfen (Change Ledger 2026-09-06).

## Entscheidung

**elkjs** (JS-Port von Eclipse ELK, EPL-2.0) mit dem **Layered-Algorithmus**
wird der globale Layout-Pass des Routing V2 (`lib/routing/elk/`):

1. **Konfiguration wird generiert, nicht gepflegt:** alle Geometrie-Optionen
   (`spacing.edgeEdge`, `spacing.edgeNode`, …) kommen aus dem Token-Generator
   (`generateElkLayoutOptions`, WP-1). Config-Sync-Test schlägt bei Hardcode fehl.
2. **Spec-Schalter:** `EdgeRouting: ORTHOGONAL`, `mergeEdges: false`,
   Junction Points aktiv, Port-Constraints `FIXED_ORDER` (Plus oben, Minus
   unten), Edge-Labels nativ zentriert. Interaktiver Modus (INTERACTIVE
   Cycle-Breaking/Layering, `semiInteractive`, `considerModelOrder`) respektiert
   Nutzerplatzierungen.
3. **Asynchron mit Fallback:** dynamischer Import (elkjs bleibt aus dem
   Initial-Bundle, Lighthouse-Gate M11-5); Timeout (`ElkTimeoutError`) →
   der bestehende Router bleibt vollständiger Fallback.
4. **Worker-Vertrag (P-6):** Der ELK-Graph ist strukturiert klonbar
   (testgesichert); `createElkSession` serialisiert Anfragen — die **letzte
   Anfrage gewinnt**, veraltete Antworten werden als `stale` verworfen.
   Keine Race-Pfade bei Drag-Updates.
5. **Ein Kollisionsmodell:** ELK-Pass und A\*-Pass konsumieren dieselben
   Regeln (WP-3) — kein Router besitzt eigene Kollisions-/Abstandsbegriffe.

### A/B-Nachweis (Gate aus AGENT-PLAN, Messung 2026-09-06)

Golden-Master-Pläne nach AutoWire, Metriken aus `ab-compare.ts`
(paarweise echte Kreuzungen, Summe 90°-Bends), CI-gesichert in
`ab-compare.test.ts`:

| Plan      | Kreuzungen alt→ELK | Bends alt→ELK | Kanten |
| --------- | ------------------ | ------------- | ------ |
| simple    | 1 → 1              | 22 → 10       | 9      |
| camper    | 3 → 2              | 33 → 16       | 12     |
| solar     | 3 → 1              | 25 → 10       | 11     |
| inverter  | 2 → 1              | 24 → 10       | 10     |
| acdc      | 4 → 2              | 35 → 18       | 14     |
| complex   | 40 → 6             | 60 → 28       | 23     |
| **Summe** | **53 → 13**        | **199 → 92**  | 79     |

Gate „besser oder gleich“ auf jedem Plan erfüllt; in Summe −75 % Kreuzungen,
−54 % Bends.

## Konsequenzen

**Gut:** globale Crossing-Minimization + orthogonales Routing + Ports in einem
Durchgang; zyklische Camper-Ladekreise werden vom Cycle-Breaking behandelt
(testgesichert); deterministisch (Doppellauf-Test, ADR 0010).

**Preis:** ~1,4 MB Bundle nur via dynamischem Import beherrschbar;
Child-Koordinaten sind parent-relativ (Umrechnung in `parseElkResult`);
ELK layoutet Knoten NEU — für reine Kanten-Re-Routes auf fixen Positionen
bleibt der inkrementelle Pass (WP-6/WP-8) zuständig.

**ADR 0003** ist damit für den globalen Pass **überlagert**; es bleibt gültig
für den Katalog-/A\*-Fallback und den inkrementellen Pass.

## Alternativen

- _Negotiated Congestion (PathFinder):_ verworfen — Overkill für 100–300 Kanten.
- _dagre:_ nur Node-Layout, kein orthogonales Edge-Routing mit Ports/Junctions.
- _Bestandsrouter global weiterentwickeln:_ Crossing-Minimization über alle
  Kanten wäre ein Neubau dessen, was ELK produktionsreif mitbringt.
