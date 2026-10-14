# ROUTING-CURRENT-STATE: Analyse der bestehenden Routing-Architektur

**Datum:** 2026-10-14  
**Rolle:** Principal Routing Engineer & Software Architect  
**Ziel:** Vollständige Bestandsaufnahme des tatsächlichen Routing-Pfades im CAMP-Elektroplaner, Identifikation von Stärken, Schwächen, Risiken und technischen Schulden.

---

## 1. Datenfluss & Produktionspfad

Entgegen historischer Notizen in älteren Dokumenten (z. B. `ROUTING-V2.md`, das teilweise veraltete Verzeichnispfade zitiert) ist der tatsächliche Produktionspfad für das Kabel-Routing wie folgt aufgebaut:

```text
React Flow Canvas (FlowCanvas.tsx)
   │
   ▼
<CableRouteSync /> (components/edges/utils/cableRouteStore.ts)
   │  - Reagiert auf signatureState: nodeLayoutSignature() & edgeTopologySignature()
   │  - Drosselung mit createThrottledRunner (100 ms)
   │  - Konvergenzwächter / Generation Tracker (createRouteGenerationTracker)
   ▼
routeAllCables() (components/edges/utils/routeAll.ts)
   │
   ├── 1. Normalisierung & Filterung
   │      - Filterung via collectRoutableNodes (ignoriert reine Darstellungsknoten wie Rahmen)
   │      - Feste Sortierung der Kanten (Standard compareIds, gated greedyConflictOrder)
   │      - Locked Routes werden vorgezogen und bleiben unveränderlich (Snapshot)
   │
   ├── 2. Port-Fan-Out & Stub-Planung (lib/routing/rules/portFanOut.ts)
   │      - Port-Bündel-Gruppierung je (Node, Seite)
   │      - Zuweisung deterministischer Lanes (laneGrid = 16 px)
   │      - Stub-Berechnung (stubMin = 24 px) mit stubCap gegen Hindernisse
   │
   ├── 3. Sequenzielles Detail-Routing je Kante
   │      - Hindernis-Fenster mit OBSTACLE_REGION_PAD (240 px)
   │      - findCablePath (components/edges/utils/pathfinding.ts):
   │          a) Katalog-Kandidaten (catalogCandidates, bestFreeCatalog)
   │          b) Hanan-Grid A*-Suche (hananAStar mit Tubes und Fallback)
   │          c) Tube-Durchstoß / Notfall-Fallback
   │      - Fenster-Nachzug (bis zu 3 Runden bei Verlassen der BBox)
   │      - Hinzufügen der gelegten Kante zu `tubes` (Sperrflächen) & `priorGeometries`
   │
   ├── 4. Postprocessing-Phasen
   │      - nudgeOrthogonalPaths (components/edges/utils/nudge.ts): Löst Überlappungen
   │      - mergeCloseBends (lib/routing/geometry/bends.ts): Treppen-Eliminierung (I7)
   │      - separateCableClearance (components/edges/utils/separation.ts): Trassen-Trennung (I3)
   │      - resolveHops (lib/routing/rules/hopping.ts): Berechnung von Sprungbögen
   │      - placeLabelClearOfLabels & labelAnchorClearOfNodes: Chip-Platzierung
   │
   └── 5. Veröffentlichung & Validierung
          - computeCableRouteFinalValidation -> validateFinalRouting (I1/I2/I3)
          - publishCableRoutes -> Reaktive Aktualisierung im Store
          - publishCableRouteFinalValidation -> Report für Live-Validation
          - publishCableRouteGeneration -> Status
```

---

## 2. Verantwortlichkeiten der Module

| Modul                       | Pfad                                               | Hauptaufgabe                                                                    |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Store & Synchronisation** | `components/edges/utils/cableRouteStore.ts`        | React-Anbindung an React Flow, Hashes, Generation-Tracking, Throttling.         |
| **Globaler Router**         | `components/edges/utils/routeAll.ts`               | Orchestriert Arbeitsreihenfolge, Tubes, Nudging, Separation, Label-Platzierung. |
| **Wegsuche & Geometrie**    | `components/edges/utils/pathfinding.ts`            | Hanan-Grid, A*-Algorithmus, Katalog-Pfade, Tube-Collision, Stub-Handling.       |
| **Nudge-Engine**            | `components/edges/utils/nudge.ts`                  | Verschiebt parallele Segmente auf freie Lanes, um Überdeckungen zu lösen.       |
| **Separations-Pass**        | `components/edges/utils/separation.ts`             | Garantiert I3 (`cableClearance`), minimiert Annäherung von Kabeln.              |
| **Kollisionsregeln**        | `lib/routing/rules/collision.ts`                   | Einheitliche Definition von `hard`, `soft` und `weighted` Kollisionen.          |
| **Port-Bündel & Fan-Out**   | `lib/routing/rules/portFanOut.ts`, `portBundle.ts` | Fan-Out-Berechnung an Ports, Bündel-Ausnahme für I2/I3.                         |
| **Kreuzungs-Hops**          | `lib/routing/rules/hopping.ts`                     | Bestimmt Priorität (Spannungsdomäne, Querschnitt, Backbone), wer springt.       |
| **Invarianten & Gates**     | `lib/routing/invariants.ts`, `finalValidation.ts`  | Mathematische Prüfung von I1 (Node), I2 (Overlap), I3 (Clearance), I4–I7.       |
| **ELK Layout**              | `lib/routing/elk/*`                                | Globales Node- und Edge-Layout (vor allem für AutoWire / Neuordnen).            |

---

## 3. Kritische Befunde & Technische Schulden

1. **Sequenzielle Pfadfindung (Gieriger Ansatz):**
   - Kanten werden nacheinander geroutet. Bereits gelegte Kanten werden zu „Tubes“ (Sperrflächen), die spätere Kanten umgehen müssen.
   - Wenn frühere Kanten ungünstige Umwege nehmen oder Korridore blockieren, geraten spätere Kanten in Fallbacks oder erzeugen unnötige Kreuzungen.
   - _Befund:_ Eine echte Rip-up-and-reroute-Schleife oder ein globales Korridormodell fehlt im aktuellen Produktionspfad; es gibt lediglich lokale Fallback-Wiederholungen ohne Tubes.

2. **Kopplung und Heuristiken in `pathfinding.ts`:**
   - Mit über 117 kB Code ist `pathfinding.ts` ein monolithisches Modul, das Hanan-Grid-Generierung, A*-Suche mit 4 Versuchen, Katalogkandidaten, Notfallpfade und Tube-Verletzungs-Reparaturen vermischt.
   - Zahlreiche Ad-hoc-Heuristiken (z. B. `ADR-0032-Reparatur`, `ROUTE-010-Reparatur`) flicken lokale Einzelfälle.

3. **Stabilität und Inkrementalität:**
   - Jede Positionsänderung löst eine Neuberechnung aller Kanten via `CableRouteSync` aus (gedrosselt auf 100 ms). Bei bis zu 50 Komponenten skaliert dies noch im zweistelligen/dreistelligen Millisekundenbereich, bindet aber den Hauptthread.
   - Bei 100 Knoten (`tests/scale/plannerScale.test.ts`) benötigt ein vollständiger Lauf bis zu 7 Sekunden.

4. **Stärken des aktuellen Bestands:**
   - **Perfekte Invarianten-Einhaltung auf den Referenzplänen:** I1=0 (keine Bauteildurchdringung), I2=0 (keine Überlappung), I3=0 (Mindestabstand gewahrt).
   - **Deterministisch und translationsinvariant:** Durch strenge ID-Sortierung (`compareIds`), quantisierte Hashes und feste Tie-Breaker.
   - **Umfassende Test- und Ratchet-Suite:** `finalValidationRatchet`, `goldenMaster`, `regression.test.ts`.

---

## 4. Fazit für die Neuentwicklung

Die bestehende Architektur verfügt über ein exzellentes mathematisches Invarianten- und Testmodell (`lib/routing/invariants.ts`, `lib/routing/rules/collision.ts`), das unbedingt erhalten bleiben muss. Die Schwachstelle ist der sequenzielle A*-Monolith mit nachträglichen Flick-Schritten, der durch eine modulare, globale Routing-Engine (Global Rip-up & Reroute + Korridor-Management) ersetzt bzw. auf ein neues Niveau gehoben werden muss.
