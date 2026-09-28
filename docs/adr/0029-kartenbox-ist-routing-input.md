# ADR 0029 — Die Kartenbox ist Routing-Input: Übersichtsstufe skaliert nicht

**Status:** angenommen · **Datum:** 2026-09-28 · **Bezug:** ADR 0007, ADR 0014,
ADR 0022, ADR 0028; Messung 2026-09-28 (Badge „Routing: 5 Zwänge nicht erreicht“)

## Kontext

Der Detailgrad-Schalter („Übersichtlich“ / „Mit Werten“) war bewusst CSS-only
(`docs/planer-uebersicht/RECHERCHE.md`, M8-1): Die Übersichtsstufe schrumpfte
`.node-card` (`width: auto`, `min-width: 7.5rem`, kleineres Padding) und blendete
die Messwerte mit `display: none` aus.

Der Canvas misst die gerenderten Karten (React Flow: `measured` + Handle-Bounds),
und der Routing-Pass (`CableRouteSync`) liest genau diese Maße: Kartenbox,
Anschlüsse, Hindernisse, Lane-Korridore. Die Anzeige-Entscheidung war damit
faktisch ein Routing-Input — sichtbar daran, dass der Status-Chip
„Routing: n Zwänge“ mit der Ansichtsstufe kippte.

Reproduziert auf **denselben** ELK-Positionen (AutoWire-Autark, 23 Kanten):

| Karten-Geometrie            | Befund                          |
| --------------------------- | ------------------------------- |
| Detailboxen (192×126 … 202) | INVALID — 1× I2                 |
| Übersichtsboxen (~120×84)   | INVALID — 3× I2 + 2× I3 = **5** |

Die fünf Zwänge im Badge des Nutzers waren also kein Planfehler, sondern ein
Anzeige-Artefakt: Kleinere Karten rücken die Anschlüsse zusammen, während die
Routing-Tokens absolut sind (`stubMin` 24, `laneGrid` 16, `cableClearance` 12,
`portFacingClearance` 68).

## Entscheidung

1. **Die Übersichtsstufe blendet nur noch aus, sie skaliert nicht mehr.**
   `.planner-detail-overview .node-card .measure { visibility: hidden; }` —
   Messwerte verschwinden, ihr Platz bleibt im Layout. Es gibt **keine**
   `.planner-detail-overview .node-card`-Regel mehr: `width`, `min-width` und
   `padding` der Karte sind in beiden Stufen identisch.
2. **Die Invariante ist getestet, nicht nur kommentiert.**
   `components/planner/FlowCanvas.test.tsx` pinnt, dass `app/globals.css` keine
   Kartenbox-Regel der Übersichtsstufe enthält und die Messwerte per
   `visibility` (nicht `display`) ausgeblendet werden. Der Grund steht als
   Kommentar an der CSS-Regel.
3. **Der Titel sagt, was der Schalter tut:** „Messwerte ausblenden —
   Kartengröße bleibt (Routing-Stabilität)“ (`CanvasDisplayOptions`).
4. **Sicherheit vor Kompaktheit bleibt:** Warnflächen (z. B. „Überlastung!“)
   und der Status-Rand werden nicht angefasst (Rule F).

## Konsequenzen

**Gut:** Der Routing-Status hängt nicht mehr an der Ansichtsstufe — dieselben
Positionen liefern in beiden Stufen dieselbe Geometrie und damit denselben
Befund. Zusammen mit ADR 0028 sind alle sieben geprüften Pläne im ELK-Pfad
VALID.

**Preis:** „Übersichtlich“ ist keine Platzspar-Stufe mehr; große Pläne gewinnen
durch den Schalter keinen Platz zurück. Der ursprüngliche Zweck (mehr Plan auf
dem Schirm) ist damit bewusst zurückgestellt.

**Nicht entschieden:** eine echte Kompaktstufe für sehr große Pläne, die die
Routing-Geometrie _nicht_ verändert — z. B. eine feste Routing-Box je Bauteil
mit davon entkoppelter Darstellung. Die Alternative (der Router liest eine
kanonische Karten-Geometrie statt der gemessenen Box) ist die größere Änderung:
Adapter, Signatur und Abschlussvalidierung müssten dieselbe kanonische Quelle
lesen. Beides ist eine eigene Scheibe.
