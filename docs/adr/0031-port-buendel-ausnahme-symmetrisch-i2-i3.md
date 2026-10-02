# ADR 0031 — Die Port-Bündel-Ausnahme gilt symmetrisch für I2 und I3

**Status:** angenommen · **Datum:** 2026-10-02 · **Bezug:** ADR 0009 (Overlaps
verboten, Bündel-Ausnahme), ADR 0015 (harte Final-Invariante), ADR 0019 (Gate
liest das Kollisionsmodell), ADR 0025 (Port-Bündel-Ausnahme, eine Wahrheit),
AUDIT ROUTE-012 (I3 Segment×Segment)

## Kontext

Zwei Kanten, die sich eine Anschlussstelle teilen, konvergieren zwangsläufig
auf gemeinsamen Stubs und Fan-Out-Jogs — das ist die seit ADR 0009/0025
dokumentierte, legitime Port-Bündelung. I2 (kollineare Überdeckung, **hard**)
stellt genau diese Geometrie über `isPortBundleOverlap` frei.

Die mit AUDIT ROUTE-012 erweiterte I3-Prüfung (Clearance, **weighted**) hatte
keine solche Ausnahme: Sie zählte **jede** Segment×Segment-Abstands-
Unterschreitung — inklusive derselben Bündel-Geometrie, die I2 freistellt.
Zwei Kanten am gemeinsamen Handle berühren sich dort zwangsläufig (Abstand 0),
und das Lane-Ausweichen am Fan-Out kreuzt die Strecke, auf der die Nachbar-
kante weiterläuft (gemessen: 0 px am Fan-Out-Punkt, 24–40 px vom Port).

**Gemessen über die sechs Referenzpläne:** 98 I3-Verletzungen, davon **69
strukturelle Bündel-Fälle** (52 Stub×Stub, 17 Fan-Out-Jog×Stub/Jog) —
unerfüllbar by construction für jeden Plan mit geteiltem Port. Die Invariante
konnte nie 0 erreichen; die Ratchet verwaltete Rauschen, und **29 echte**
Verletzungen (Paare ohne gemeinsamen Port, Unterschreitungen an freien
Trassensegmenten) versteckten sich darin. Dasselbe Bild in der Versatz-Matrix
(`routing:audit -- --shifts`): I3 425–2040 je Plan, großteils Bündel-Rauschen.

Dasselbe Problem, spiegelbildlich zu ADR 0025: Die Ausnahme lebte nur in der
härteren Invariante — die weichere zählte die freigestellte Geometrie.

## Entscheidung

1. **Die Freigabe-Ausnahme ist eine Regel der Rules-Schicht** — neben der
   Überdeckungs-Ausnahme, in `lib/routing/rules/portBundle.ts` (die EINE
   Wahrheit, ADR 0025): `portCorridor` (Stub + Fan-Out-Jog je Route-Ende) und
   `isPortBundleProximity`. Kriterium, exakt gespiegelt zu `isPortBundleOverlap`:

   - Die Kanten teilen eine **Anschlussstelle** (identischer Endpunkt).
   - **Beide** beteiligten Segmente liegen im **Port-Korridor der jeweiligen
     Kante am gemeinsamen Port** (maximal Stub + angrenzender Jog: die ersten
     zwei bzw. letzten zwei Segmente; bei kürzeren Routen konservativ weniger).
   - Alles andere bleibt gemeldet: Paare ohne gemeinsamen Port, und jedes
     **freie (gesuchte) Trassensegment** — seine Nähe war Router-
     Entscheidungsraum, kein Bündel-Zwang.

   Keine zusätzliche Token-Schwelle: Der Korridor folgt der eigenen Geometrie
   der Kante (rangskaletierte Stubs sind genauso Bündel wie der Mindest-Stub).
   Das Modul bleibt framework- und token-frei (ADR 0025, Modul-Vertrag).

2. **`checkClearance` konsumiert die Ausnahme** (`lib/routing/invariants.ts`)
   und prüft Segment×Segment jetzt über dieselbe **vereinfachte** Geometrie
   wie `checkEdgeEdgeOverlaps` (`routedPathGeometry`): eine Geometrie-Wahrheit
   für beide Invarianten; keine Doppelzählung durch Kollinear-Splits in rohen
   Stützpunkten.

3. **Nicht geändert:** Das Kollisionsmodell (`classifySegmentAgainstSegment`
   liefert für Touch weiterhin `weighted`), der Router (keine Geometrie-Änderung
   — gemessen: Kreuzungen, Kabelweg, Determinismus, Fallbacks unverändert),
   I1 (hart 0), I2 (0), I4–I7 (0), Segment×Node-Clearance (0).

## Folgen

- **I3-Rest über die Referenzpläne: 98 → 41** (simple 6→2, camper 21→7,
  solar 4→**0**, inverter 12→6, acdc 13→3, complex 42→23). Jede verbleibende
  Meldung ist echt: Paar ohne gemeinsamen Port oder freies Trassensegment.
  Versatz-Matrix: I3 sinkt um 60–85 % (z. B. complex 2040 → 1127).
- **Ratchets nachgezogen** (dürfen nur sinken): `FINAL_VALIDATION_RATCHET`,
  `LEGACY_BASELINE` (`lib/routing/invariants.test.ts`), `SHIFT_RATCHET`
  (`scripts/routing/audit.ts`).
- **Buchhaltungs-Test** (`scripts/routing/portBundleModel.test.ts`): I3 zählt
  je Kantenpaar genau die `weighted`-Segmentpaare, auf die die Ausnahme NICHT
  greift — keine stille Ausnahme, keine Doppelzählung. Plus Einheitstests in
  `lib/routing/rules/portBundle.test.ts` (Korridor, Fan-Out-Jog, Fan-In,
  freie Trasse, Gegen-Ende, ohne gemeinsamen Port) und Invarianten-Regression
  in `lib/routing/invariants.test.ts` (ADR-0031-Block).
- **Der verbleibende Rest ist Arbeit am Port-Fan-Out/Platzierung** — die
  Hebel dafür sind in ADR 0027 (zwei Lane-Schritte) und ROUTE-002 Teil 2b/3
  (vier gemessene, verworfene Varianten) dokumentiert. Diese Entscheidung
  macht den Rest sichtbar und zählbar; sie löst ihn nicht.

## Alternativen

- _Ausnahme über Port-Distanz-Schwelle (z. B. `stubMin + 2·laneGrid`):_ verworfen
  — eine zweite, token-basierte Schwelle neben der Geometrie des Moduls; sie
  hätte entweder echte Fälle geschluckt (freie Trasse nahe dem Port) oder
  rangskaletierte Bündel falsch gezählt.
- _Router ändern (Tube-Relaxierung scoped statt all-or-nothing):_ bewusst nicht
  in dieser Entscheidung — die verbleibenden Fälle sind überwiegend feste
  Port-Rahmen gegeneinander; die freien Anteile zu trennen ändert die
  eingefrorenen Golden Master bei unklarem Gewinn (vier Varianten wurden in
  ROUTE-002 Teil 2b/3 bereits gemessen und verworfen). Erst messen, dann
  entscheiden — das Recapture-Ledger steht dafür bereit.
- _Ratchet einfach auf 0 senken:_ verworfen — das wäre die verbotene
  Abschwächung (Regel 14): die 41 Meldungen sind echte Befunde.
