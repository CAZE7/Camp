# ADR 0022 — Darstellungs-Knoten sind kein Routing-Input

**Status:** angenommen · **Datum:** 2026-09-26 · **Bezug:** ADR 0007, ADR 0014, ADR 0015, Bug „Routing springt zwischen 0 und 20 Zwängen“

## Kontext

Der Planer zeigte im Betrieb ein pendelndes Routing-Badge: „Routing
verifiziert“ (0 Verstöße) und „Routing: 20 Zwänge nicht erreicht“ wechselten
sich ab, während die Kabel sichtbar neu verlegt wurden. Kein Timer war
beteiligt — auch kein periodisches Auto-Wire (es gibt keinen Aufruf außerhalb
der beiden Knöpfe).

Ursache war eine Kette aus zwei Fehlern:

1. **Der Hauptstromkreis-Rahmen lief im Router mit.** `withBackboneGroup()`
   erzeugt einen Knoten `type: 'backboneGroup'` (Kommentar: „presentation-only“).
   Er landet als Prop in `<ReactFlow>`, damit in React Flows `nodeLookup` — und
   `CableRouteSync` las `[...nodeLookup.values()]` ungefiltert. Der Rahmen war
   damit Hindernis (`routeAllCables`) **und** Prüfgegenstand
   (`validateFinalRouting`). Er umschließt die Kern-Bauteile: Jede Leitung, die
   ein Kern-Bauteil verlässt, schneidet seinen Rand und zählt als I1 — obwohl
   kein Kabel durch ein Bauteil läuft. Der Rahmen war die Ursache der 20.
2. **Seine Geometrie hing an der DOM-Messung.** React Flow 12 übernimmt einen
   Knoten nur bei identischem Objekt unverändert in den internen Bestand
   (`adoptUserNodes`, `checkEquality`). Sonst baut es den internen Knoten neu
   auf und setzt `measured` auf den Wert des neuen Objekts — also auf
   `undefined`, weil der Rahmen nie in den Planner-Store zurückgeschrieben wird.
   Der ResizeObserver maß danach erneut. Zwei Zustände (844 × 392 vs. 192 × 120
   Fallback) bedeuteten zwei Hindernisbilder und zwei Validierungs-Reports —
   genau das sichtbare 0 ↔ 20. Dasselbe Muster traf auf Touch-Geräten alle
   Knoten, weil `interactiveNodes` bei jedem Store-Schreibvorgang neue Objekte
   erzeugte (`{ ...node, className }`).

## Entscheidung

1. **Darstellungs-Knoten sind kein Routing-Input.** Sie sind weder Hindernis,
   noch Port, noch Prüfgegenstand, und sie stehen nicht in der
   Layout-Signatur. Die Grenze ist ausführbar, nicht dokumentiert:
   `components/edges/utils/routableNodes.ts` (`isPresentationOnlyNode`,
   `routableNodes`, `collectRoutableNodes`).
2. **Die Filterung sitzt an der Grenze, nicht an der Aufrufstelle.**
   `routeAllCables` und `computeCableRouteFinalValidation` filtern selbst;
   `CableRouteSync` filtert Signatur und Routing-Eingabe. Ein Aufrufer (Skript,
   Test, Canvas) kann die Regel damit nicht vergessen.
3. **Die Kennzeichnung ist doppelt:** `data.presentationOnly === true` (Marker
   für künftige Overlays) **und** der UI-Typ (`backboneGroup`, damit auch
   gespeicherte Pläne ohne Marker geschützt sind).
4. **Darstellungs-Knoten sind identitätsstabil.** `withBackboneGroup` gibt für
   unveränderte Kern-Geometrie dasselbe Rahmen-Objekt zurück; die
   Interaktions-Flags (`className`, `dragHandle`) laufen über
   `withNodeInteractionState` mit WeakMap-Cache. Ein unveränderter Knoten
   erreicht React Flow damit als dasselbe Objekt.
5. **Diagnose ist zuschaltbar, nicht Dauerzustand:** `routingDebug.ts`
   protokolliert pro Lauf die gerouteten und die übersprungenen Knoten samt
   Geometrie-Änderung gegenüber dem vorherigen Lauf — aktiviert über
   `NEXT_PUBLIC_ROUTING_DEBUG=1` oder `globalThis.__PLANNER_ROUTING_DEBUG__ = true`.

## Konsequenzen

**Gut:** Der Rahmen kann das Routing-Ergebnis nicht mehr verfälschen; die
Statusanzeige spiegelt den Plan statt der DOM-Messung. Die Kabel laufen nicht
mehr um eine Darstellungsbox herum. Auf Touch-Geräten entfällt der
Neuaufbau aller Knoten pro Store-Schreibvorgang. Und der Befund ist
nachvollziehbar, wenn er wieder auftritt: Die Diagnose zeigt im Zweifel
`frame -44,-56:844×392 → -44,-56:—×—` als Änderung zwischen zwei Läufen.

**Preis:** Zwei zusätzliche Module an der UI/Engine-Grenze und zwei Caches
(Rahmen, Interaktions-Flags), die jeweils eine `reset…`-Funktion für Tests
brauchen. Beide sind an Objekt-Identität gebunden und können keine veralteten
Geometrien liefern: Der Rahmen-Cache ist über seine vollständige Box gekeyt,
der Interaktions-Cache über den Basis-Knoten plus Flags.

## Alternativen

- _Nur in `FlowCanvas` filtern:_ verworfen — die Regel hinge an der
  Aufrufstelle; Skripte und Tests umgingen sie.
- _Den Rahmen aus dem `nodes`-Prop herausnehmen und per CSS/Portal zeichnen:_
  verworfen — der Rahmen muss im Canvas-Koordinatensystem mitskalieren und
  Aktionen wie Pan/Zoom mitmachen; React Flow ist dafür die vorgesehene
  Schicht (ADR 0002/0007).
- _Nur den `type` prüfen (oder nur den Marker):_ verworfen — der Typ allein
  lässt künftige Overlays durch, der Marker allein lässt gespeicherte Pläne
  ohne `data` durch.

## Nachweis

- `components/edges/utils/routableNodes.test.ts` — Grenze und Identität.
- `components/edges/utils/routeAll.test.ts` — derselbe Plan routet mit und ohne
  Rahmen identisch; ein echtes Bauteil an derselben Stelle ändert die Routen.
- `components/edges/utils/cableRouteStore.test.ts` — der Rahmen erzeugt keine
  I1-Verletzung und keine Signaturänderung; dieselbe Box als Bauteil schon.
- `components/planner/utils/backboneGroup.test.ts`,
  `components/planner/utils/nodeInteractionState.test.ts` — Objekt-Identität.
- `components/edges/utils/routingDebug.test.ts` — Format und
  „gemessen ⇄ nicht gemessen“-Erkennung.
