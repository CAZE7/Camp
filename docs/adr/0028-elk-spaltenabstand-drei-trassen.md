# ADR 0028 — ELK-Spaltenabstand: eigener Korridor-Token (drei Trassen)

**Status:** angenommen · **Datum:** 2026-09-28 · **Bezug:** ADR 0016, ADR 0018,
ADR 0023, ADR 0024, ADR 0027; Messung 2026-09-28 („Automatisch verbinden →
ELK-Strukturierung“, Wunsch des Nutzers)

## Kontext

ADR 0027 hat `portFacingClearance` auf **zwei** Lane-Schritte gehoben
(`stubMin + 2·laneGrid + cableClearance` = 68 px) und diesen Wert über
`generateElkLayoutOptions` auf **beide** ELK-Abstände gelegt:
`elk.spacing.nodeNode` (Karten derselben Spalte) **und**
`elk.layered.spacing.nodeNodeBetweenLayers` (Korridor zwischen den
Rollen-Spalten). Ergebnis damals: der ELK-Pfad ist über die sechs
Referenzpläne **I2 = 0**.

Nachgemessen mit den **echten gemessenen Kartenboxen** (Fixture
`tests/fixtures/routing/complex-measured-geometry.json`, Höhen 126–202 px) und
dem **Auto-Wire-Plan** (`complex`/`autark`, 23 Kanten) bleibt bei 68 px
**1× I2** stehen — zwei Läufe teilen sich eine Trasse im Korridor
(`e-busbar-fuse ↔ e-busbar-inv-minus`, beide mit `tightMarginUsed`):

| Spaltenabstand (Korridor) | `complex`                | `autark`                 | Kabellänge `complex` / `autark` |
| ------------------------- | ------------------------ | ------------------------ | ------------------------------- |
| 68 px (Status quo)        | INVALID — I2 = 1         | INVALID — I2 = 1         | 8 396 / 8 436 px                |
| 100 px                    | **VALID — I1=I2=I3 = 0** | **VALID — I1=I2=I3 = 0** | 9 540 / 9 580 px                |

Die Auflösung (eigene Messung, einheitliche 192×146-Karten, `buildElkGraph` →
`routeAllCables` → Abschlussvalidierung; sieben Pläne = sechs Referenzpläne +
AutoWire-Autark, `nodeNode` bleibt bei 68):

| Korridor              | 68  | 84  | 86  | 88–92 | 94–98 | 100     |
| --------------------- | --- | --- | --- | ----- | ----- | ------- |
| Pläne ohne Verletzung | 3/7 | 3/7 | 3/7 | 5/7   | 5/7   | **7/7** |

Bis 86 px scheitern zusätzlich `solar`/`acdc` (I3); in `complex`/`autark`
bleiben bis 98 px I3-Überschreitungen (3 bei 88–92, 2 bei 94–98) — erst
100 px ist sauber.

Ursache ist die **Geometrie des Korridors**, nicht die Port-Staffel: Die
Handle-Boxen stehen 21 px über die Karte hinaus (44 px breit, Mitte auf dem
Kartenrand). Bei 68 px Kartenlücke bleiben davon nur **26 px** freier Korridor;
zwei Trassen brauchen `2·cableClearance + laneGrid` = 40 px, drei
`2·cableClearance + 2·laneGrid` = 56 px. Der Router weicht dann auf die
Not-Freigabe aus (`tightMarginUsed`) und legt beide Läufe auf dieselbe
x-Linie; genau das misst I2.

## Entscheidung

1. **Der Korridor zwischen den ELK-Spalten bekommt einen eigenen Token-Wert:**
   `elkColumnSpacing = portFacingClearance + 2·laneGrid` = **100 px**. Er wird
   in `generateElkLayoutOptions` **berechnet**, nicht gepflegt (ADR 0016), und
   nur für `elk.layered.spacing.nodeNodeBetweenLayers` benutzt.
   `elk.spacing.nodeNode` (Karten derselben Spalte) bleibt bei
   `portFacingClearance` — dort ist die Port-Staffel am Bauteil der Engpass,
   nicht der Trassen-Korridor.
2. **Herleitung statt Setzung** (im Token dokumentiert): Handle-Überstand
   `2 × 21` px + drei Trassen `2·cableClearance + 2·laneGrid` (= 56 px) =
   98 px ⇒ 100 px sind die nächste Summe aus Tokens. Der Token-Test pinnt die
   Formel (`tokens.test.ts`: „Korridor zwischen ELK-Spalten ist Port-Freigabe +
   zwei Lane-Schritte“).
3. **Der Fest-Raster-Pfad bleibt unangetastet.** Die Plan-Fixtures tragen
   absolute Koordinaten; `npm run routing:audit` misst unverändert
   I1 = I2 = I3 = 0 über alle sechs Pläne (nur der ELK-Optionssatz ändert sich).
4. **Gemessenes Ergebnis** (sieben Pläne, AutoWire + ELK-Strukturierung, echte
   Kartenboxen): alle sieben **VALID**, I1 = I2 = I3 = 0; `complex` und `autark`
   je 2 Leitungen mit Not-Freigabe (`tightMarginUsed`, Stub endet an der
   Bauteil-Freigabe — im grünen Badge als Hinweis genannt, kein Zwang).

## Konsequenzen

**Gut:** Der ELK-Pfad ist mit echten Kartenboxen erstmals vollständig
I1–I3-frei; damit darf „Automatisch verbinden“ den Plan strukturieren, ohne
einen Zwang im Badge zu erzeugen. Die Änderung ist auf den ELK-Pfad begrenzt —
Goldens, Regression, Kreuzungs- und Längen-Ratchet bleiben identisch.

**Preis:** +13,6 % Kabelweg im ELK-Pfad (`complex` 8 396 → 9 540 px,
`autark` 8 436 → 9 580 px), benannt und mit den Zahlen entschieden — derselbe
Trade-off wie in ADR 0027 („überdeckungsfreie Trassen vor kurzen Kabeln“).

**Nicht entschieden:** ob der **Fest-Raster**-Pfad (Korridor 96 px) denselben
Korridor-Token braucht. Er misst heute I1 = I2 = I3 = 0 (absolute Fixtures,
eigener Corridor in `lib/autoWire/placement.ts`) und bleibt eine eigene
Scheibe.
