# ADR 0027 — Port-Freigabe für ELK: zwei Lane-Schritte statt einem

**Status:** angenommen · **Datum:** 2026-09-28 · **Bezug:** ADR 0016, ADR 0017,
ADR 0023 (Kartenabstand = Port-Freigabe), ADR 0024, ADR 0025, ROUTE-002
(Teil 2b), ROUTE-BUG-31/34/35; Messung 2026-09-28 („Lane-Vergabe am Port“)

## Kontext

ADR 0023 hat die Port-Freigabe als Kartenabstand für ELK eingeführt und sie auf
`stubMin + EIN·laneGrid + cableClearance` = **52 px** festgelegt („größer als ein
Schritt ist die Forderung bewusst nicht“). Das Ziel war erreicht: I1 = 0,
I2 = 21 → 9, I3 = 17 → 1 über die sechs Referenzpläne.

Offen blieb der Rest: der ELK-Pfad hatte weiterhin **I2 = 5** — vier davon
Fan-Out/Fan-In an einem geteilten Handle (`e-fuse-light ↔ e-fuse-usb`,
`e-auto-4 ↔ e-auto-8`, `e-auto-5 ↔ e-auto-9`, `e-batt-minus ↔ e-auto-8`), dazu
`e-fuse-heat ↔ e-auto-3`. `docs/ai/KNOWN-PROBLEMS.md` führte diese fünf Paare
als „Port-Bündel-/Fan-Out-Ebene (`portFanOutLanes`, ROUTE-002 Teil 2b)“ — dort
sei die Lane eine Vergabe-, keine Ausweichfrage.

**Gemessen wurde das Gegenteil.** Vier Varianten einer Lane-Vergabe am Port
wurden gebaut und über beide Pfade geprüft; keine verbesserte den ELK-Pfad ohne
Schaden im Produktivpfad (Zahlen in ROUTE-002, „Teil 2b“). Die Ursache liegt
eine Ebene tiefer, in der Geometrie der Stubs:

| Plan     | Paar                        | Lane (S/T) | gewünschter Stub | tatsächlicher Stub |
| -------- | --------------------------- | ---------- | ---------------- | ------------------ |
| camper   | `e-fuse-light ↔ e-fuse-usb` | −16 / −16  | 40 px            | **28 / 24 px**     |
| inverter | `e-auto-5 ↔ e-auto-9`       | 16 / 16    | 40 px            | **28 / 24 px**     |
| complex  | `e-batt-minus ↔ e-auto-8`   | 0 / 16     | 24 / 40 px       | **28 / 24 px**     |
| complex  | `e-fuse-heat ↔ e-auto-3`    | 0 / 0      | 24 px            | **28 / 24 px**     |
| inverter | `e-auto-4 ↔ e-auto-8`       | −32 / −16  | 56 / 40 px       | 56 / 40 px         |

Vier der fünf Paare sind an **beiden** Enden gekappt (`capStep`,
ROUTE-BUG-31/34/35): Der Korridor ist 52 px breit, die Freigabe frisst 12 px,
für den Stub bleiben 40 — und `capStep` kappt bei zwei Leitungen an einem Handle
auf `stubMin` (24 px) herunter, weil die Rang-Treppe nur im Band
`cap − stubMin` Platz hat. In diesem Regime ist die vergebene Lane **nicht
ausdrückbar**: Beide Kanten laufen auf derselben Quer-Linie weiter, egal welche
Lane der Fan-Out vergibt. Nur das fünfte Paar (Stubs 40/40) wäre über die Lane
lösbar — kostet aber im dichtesten Plan `complex` Kreuzungen und war damit
gegen die Ratchet.

**Gegenprobe (nur gemessen, Token danach unverändert):** mit
`portFacingClearance = 68` (= `stubMin + 2·laneGrid + cableClearance`) fällt der
ELK-Pfad auf **I2 = 0**, und kein betroffenes Paar greift mehr auf die Kappung.

## Entscheidung

1. **Die Port-Freigabe wird ein Token-Schritt größer:**
   `ROUTING_TOKENS.portFacingClearance = 68` = `stubMin + 2·laneGrid +
cableClearance`. Begründung: An einer Klemme hängen im Referenzbestand
   regelmäßig **zwei** Leitungen; erst mit zwei Lane-Schritten ist jede der
   beiden Lanes ohne Stub-Kappung ausdrückbar. Die Konsistenzregel in
   `lib/routing/tokens.test.ts` und die Erwartung in
   `lib/autoWire/placement.test.ts` pinnen jetzt die Summe mit zwei Schritten.
2. **Kein neuer Platzierungs-Mechanismus.** Der Wert fließt wie bisher über
   `generateElkLayoutOptions` in `elk.spacing.nodeNode` und
   `elk.layered.spacing.nodeNodeBetweenLayers` (ADR 0016: genau eine
   Eingabestelle).
3. **Der Fest-Raster-Pfad bleibt unangetastet.** Seine Korridore
   (`FLOW_COLUMN_SPACING` − 192 = 96 px, `FLOW_ROW_SPACING` − 120 = 72 px)
   erfüllen beide Werte, und die Plan-Fixtures tragen absolute Koordinaten —
   Goldens, Regressions-Szenarien, die Kreuzungs-Ratchet und die
   Kabellängen-Baseline sind **byte-identisch** (nachgemessen: `routing:audit`
   mit 52 und 68 liefert dieselbe Tabelle).
4. **Gemessenes Ergebnis im ELK-Pfad** (sechs Referenzpläne,
   `applyAdvancedLayout` → `routeAllCables` → Σ über alle Pläne):

   | Metrik             | 52 px         | 68 px         |
   | ------------------ | ------------- | ------------- |
   | I1 / I2 / I3       | 0 / **5** / 3 | 0 / **0** / 3 |
   | I6 / I7 (complex)  | 2 / 1         | **0 / 0**     |
   | Kreuzungs-Paare    | 122           | **107**       |
   | Überdeckungs-länge | 1 039 px      | 1 155 px      |
   | Kabelweg Σ         | 25 129 px     | 27 967 px     |
   | längste Kante      | 1 360 px      | 1 597 px      |

   Die Überdeckungs-**Länge** steigt, obwohl I2 = 0: die verbleibenden
   kollinearen Abschnitte sind die erlaubten Port-Bündel-Stubs, und die werden
   mit größerem Kartenabstand länger. I2 zählt genau die Verstöße außerhalb der
   Stubs — und die sind null.

5. **Der Preis wird benannt, nicht versteckt:** Im ELK-Pfad („Plan ordnen“)
   liegen die Karten weiter auseinander, die Kabel wachsen um **2 838 px
   (+11,3 %)**. Der Nutzer hat diese Abwägung mit den Zahlen vor der Umsetzung
   bestätigt (I2 = 0 und 15 Kreuzungspaare weniger gegen längere Kabel im
   ELK-Pfad).

## Konsequenzen

**Gut:** Der ELK-Pfad ist erstmals **I2-frei**; alle fünf port-nahen Paare aus
ROUTE-006 sind geschlossen. Kreuzungen sinken, Kurzsegmente und Treppenmuster
(complex) verschwinden. Die Änderung berührt **keinen** eingefrorenen
Referenzstand: Goldens, Regression, Ratchets und Sampling bleiben identisch,
weil nur der ELK-Platzierungspfad den Token liest.

**Preis:** +11,3 % Kabelweg im ELK-Pfad, größere Gesamtfläche der geordneten
Pläne. Wer „möglichst kurze Kabel“ über „überdeckungsfreie Trassen“ stellt, kann
den Token auf 52 zurückdrehen; der Test pinnt dann wieder einen Schritt.

**Nicht entschieden:** `preferredLaneBonus` (`rules/costModel.ts`) bleibt ohne
Produktiv-Konsumenten. Mit 68 px wäre der Boden für einen Registry-Anschluss
erstmals frei (die Bündel-Lanes sind ausdrückbar) — die Anbindung selbst ist eine
eigene Scheibe (ROUTE-002, ROUTE-001). Ebenso bleibt offen, ob die dritte Lane
eines Bündels eine weitere Erhöhung rechtfertigt: `capStep` degradiert dort
weiterhin kontrolliert (dokumentiert, sichtbar als I2).

**Nachtrag (2026-09-28, nach der Messung):** Der Registry-Anschluss
(`preferredLaneBonus`) ist inzwischen gebaut und gemessen — vier Varianten, jede
über beide Pfade. Potenzial ist belegt (50 freie, ungenutzte Registry-Linien im
ELK-Pfad, 22 im Fest-Raster), die beste Variante kürzt `acdc` um 483 px und senkt
die Kreuzungen 107 → 104, verlängert aber `complex` um 44 px und verletzt damit
die Längen-Ratchet. Entscheidung: **nicht ausgeliefert**; Werkzeug und Zahlen in
`npm run routing:lane-probe` bzw. `docs/ai/KNOWN-PROBLEMS.md` (ROUTE-002 Teil 3).
