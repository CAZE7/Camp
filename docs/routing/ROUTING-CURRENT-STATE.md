# Routing: Ausgangszustand und verifizierte Befunde

Stand: 2026-10-14. Ausgangscommit: `498c57ba596e46c16dea62687a4839f622af815b`.
Dies ist ein Entwicklungsstand, kein Nachweis aller Abschlusskriterien des Master-Prompts.

## Tatsächlicher Produktionspfad am Ausgangscommit

1. Manuelle Verbindungen entstehen im Graph-Slice; `lib/autoWire.ts` orchestriert
   Topologie, Rails, Platzierung, Sizing und Nutzerkanten-Heilung. Elektrische
   Berechnungen liegen in `lib/electrical.ts`, `lib/electricalGraph/currentFlow.ts`,
   `lib/autoWire/sizing.ts` und der Verifikationspipeline, nicht im Router.
2. `store/slices/graphSlice.ts:onLayoutV2` verwendet ELK für **Knotenpositionen**.
   ELK-Kabelgeometrie wird nicht veröffentlicht. Gesperrte elektrische Kanten
   blockieren diesen Layout-Eingriff.
3. React Flow misst Karten und Handles. `nodeGeometry.ts` priorisiert absolute
   Internals, gemessene Abmessungen und Handle-Bounds vor Persistenz/Fallbackmaßen.
   `routableNodes.ts` entfernt Präsentationsknoten. `nodesToObstacles` bildet die
   Vereinigung von Kartenbox und überstehenden Handles.
4. `CableRouteSync` signiert Geometrie/Topologie, drosselt Änderungen und ruft
   `routeAllCables` auf. Der Ausgangszustand berechnete synchron im UI-Thread.
5. Der globale Pass sortiert nach ID, registriert Locks zuerst, verteilt
   Port-Fan-out und routet **sequenziell**. Bereits geroutete Kabel bilden Tubes
   und Kreuzungssegmente für spätere Kabel.
6. `findCablePath`: Katalog, richtungsabhängiges Hanan-A*, gestaffelte
   Clearance-/Tube-Versuche, räumliche Hindernisfenster und diagnostischer Fallback.
   Suchbudget: 48.000 Expansionen pro A*-Versuch; LRU für Einzelrouten.
7. Danach folgen Nudge, Bend-Merge, Basis-Clearance-Trennung, optional
   domänenabhängige Trennung, Kreuzungs-/Hop-Analyse und Labelplatzierung.
8. Externer Route-Store → `useCableRoute` → `CableEdge`/SVG. Keine Speicherung
   automatisch erzeugter SVG-Geometrie in elektrischen Edge-Daten; Locks speichern
   explizite Wegpunkte. Der Renderer besaß zusätzlich einen Einzelrouten-Fallback.
9. `validateFinalRouting` prüfte I1–I3 und endliche Koordinaten;
   `computeCableRouteFinalValidation` ergänzte Lock-Snapshots. Live-Validierung und
   Status-Badge lesen den Bericht. I4–I7 waren Audit-/Testprüfungen, kein vollständiger
   Anschlussvertrag. Insbesondere I4 prüft U-Turns, **nicht** die deklarierte Portseite.

## Nachgewiesene Fehler

- Fehlende freie Routen wurden vor der Final-Validation übersprungen: eine
  unvollständige Ergebnismenge konnte als gültig erscheinen.
- Exakte Endpunkte wurden nur für Locks geprüft. Benannte, aber fehlende gemessene
  Handles fielen still auf das erste Handle zurück.
- Route, Bericht und Generation wurden separat publiziert; ungültige neue Routen
  ersetzten vorherige gültige Geometrie. Kein vollständiger Fehler-/Stale-Vertrag.
- Der Verkürzungsnachlauf von `separation.ts` konnte einen Port-Stummel löschen.
  Reproduziert: `complex/e-auto-2`, Top-Port `(514.4,688)`, erste Strecke nach rechts.
  I1–I7 waren trotzdem null. Auch die vier Zeilenwechsel des 50-Knoten-Sparse-Seeds
  verloren ihre Rechts-Stummel. Ein Richtungs-Veto allein ließ im complex-Plan eine
  8-px-Clearance zwischen `e-auto-2` und `e-auto-7` zurück. Erst eine gemeinsame
  Lane-Transaktion mit Nachbarn behebt beide Anforderungen gleichzeitig.

## Dokumentation versus Code

`ROUTING-V2.md` ist eine eingefrorene Spezifikation, `ROUTING-MULTIPHYSICS.md` ein
Entwurf. `orthogonalRouting.ts` ist Galerie-/Test-Legacy. LaneRegistry und Teile des
Kostenmodells sind Forschungsmechanik, keine durchgängige globale Korridorplanung.
Einzelne ältere Aussagen in `docs/ai/LEGACY.md` zu nicht angebundenen Domänenregeln
sind durch den zweiten Clearance-Pass überholt. Maßgeblich sind Code und Messungen.

## Verbleibende technische Schulden

Lokaler Solver liegt weiterhin in `components/edges/utils` und importiert das
React-Flow-Position-Enum. Der neue Transfervertrag ist UI-unabhängig, nicht jedoch
jede interne Implementierung. Domänen-Paarabstände und die Basis-Final-Validation
haben noch nicht denselben vollständigen Prüfvertrag. Label-/Hop-Bögen werden nicht
als vollständige SVG-Flächen validiert. Inkrementelle Neuberechnung nach jeder
Gerätebewegung und ein globaler Korridor-Kapazitätsnachweis bleiben offen.
