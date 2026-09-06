# ADR 0007 — React Flow bleibt UI-Adapter

**Status:** angenommen · **Datum:** 2026-09-06 · **Bezug:** WP-0c (#403), CAMP V2

## Kontext

React Flow (seit ADR 0013 `@xyflow/react@12`, agent.md S-1 erledigt) ist Canvas, Interaktions- und Messschicht des Planners. Historisch ist
Fachlogik in RF-nahe Komponenten gesickert: `CableEdge.tsx` routet im Fallback
selbst (`findCablePath` pro Kante), die Routing-Engine lebt physisch unter
`components/edges/utils/`. Ohne explizite Entscheidung wächst der Adapter zur
zweiten Domänenschicht — jede RF-Major-Migration wird dann zum Fachlogik-Risiko.

## Entscheidung

React Flow ist **ausschließlich UI-Adapter** (Schicht 2 des Schichtenmodells,
`docs/ARCHITECTURE-V2.md` §1):

1. RF-Komponenten (Nodes, Edges, Canvas) berechnen keine Elektrik, keine
   VDE-Regeln, keine Routen. Sie rufen Domain/Engine auf und rendern Ergebnisse.
2. Alles, was RF-Typen oder -Hooks zur Laufzeit braucht, gehört in die
   Adapter-Schicht — und nur dorthin. Umgekehrt importiert keine tiefere Schicht
   RF-Laufzeitwerte (Typen-Importe sind als Übergang erlaubt, siehe ADR 0008).
3. Der Adapter besitzt nur UI-nahen Zustand (Messungen, Selektion, Viewport).
   Plan-Zustand liegt im Planner-Store, Routen in der Routing-Engine-Fassade.

## Konsequenzen

**Gut:** RF-Migrationen (S-1) bleiben mechanisch (API-Umzug), nicht fachlich;
Domain/Engine sind ohne Browser testbar; ADR 0002 (React Flow als Canvas) bleibt
unangetastet gültig.

**Preis:** Bestehende Verstöße (CableEdge-Fallback-Routing, Routing-Code unter
`components/`) müssen schrittweise ausgezogen werden (WP-2, WP-8) — bis dahin
dokumentierter Altbestand, kein neuer Code nach diesem Muster.

## Alternativen

- _RF-zentrische Architektur (Fachlogik in Edges/Nodes):_ verworfen — koppelt
  Fachkorrektheit an eine UI-Bibliotheks-API, macht Golden-Master-Tests
  browserabhängig.
- _Eigenes Canvas statt RF:_ verworfen (siehe ADR 0002) — Kosten ohne Nutzen.
