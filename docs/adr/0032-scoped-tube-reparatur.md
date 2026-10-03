# ADR 0032 — Chirurgische Tube-Reparatur nach der Leiter (scoped tubes)

**Status:** angenommen · **Datum:** 2026-10-03 · **Bezug:** ADR 0015 (harte
Final-Invariante), ADR 0019 (Gate liest das Kollisionsmodell), ADR 0031
(Locus-Regel), ROUTE-BUG-16 (Trassensperren/Tubes), AUDIT ROUTE-001
(Fallback-Kennzeichnung)

## Kontext

Der Produktiv-Router (`findCablePath` → `searchOnce`) fährt eine Versuchs-
Leiter über die Trassensperren: 1. Tubes + volle Freigabe, 2. ohne Tubes,
3./4. gelockert. Kollidiert der **feste Port-Rahmen** (Stubs + Jogs beider
Enden — unverhandelbar, sie definieren die Port-Geometrie) mit einer Tube,
scheitert Versuch 1 komplett, und Versuch 2 opfert **alle** Tubes — auch die,
die mit dem Rahmen nichts zu tun haben. Das ist der „all-or-nothing-Drop":

- **Gemessen (Plan complex):** e-auto-7↔e-auto-8 liefen nach dem Drop 8 px
  parallel auf freien Trassensegmenten — obwohl die Kante nur EINE Sperre am
  eigenen Port hätte meiden müssen.
- **Gemessen (Szenario p02):** Gewinner mit hartem Verstoß (Score 102 =
  1 harte kollineare Überdeckung + 2 gewichtete) gegen eine bereits verlegte
  Trasse, bei length-neutraler Alternative (728 → 728 px, Kreuzungen 1 → 1).

Derselben Untersuchung entsprangen zwei Wurzelfixes in der Leiter selbst:

1. **Frühstopp-Lücke:** `if (bestFound) break` beendete die Leiter nach dem
   ersten Versuch — auch wenn der gefundene Kandidat INTERN defekt war
   (I4-Portkehren, Selbstüberdeckung). p04/p13 endeten mit Defekt-Score 80
   pro betroffener Kante, obwohl der rangniedrigere Versuch einen sauberen
   Pfad hatte.
2. **Blinder Fleck in `hasSelfOverlap`:** geprüft wurde erst ab Segment-
   Abstand j = i + 2 — eine **adjazente Rückwärtsfaltung** (A→B→A′, Segmente
   i↔i+1) war für `routeDefectScore` unsichtbar, während die I2-Invariante
   sie zählt (gemessen: e-auto-8, Plan complex, Segmente 3↔4). Checker und
   Router sahen dieselbe Geometrie unterschiedlich — eine Wahrheit
   verletzt.

## Entscheidung

**1. Leiter-Wurzelfixes** (`components/edges/utils/pathfinding.ts`):

- `hasSelfOverlap` prüft **alle** Segmentpaare über `segmentsOverlap` —
  dieselbe Prüfung wie im Kollisionsmodell und in der I2-Invariante
  (vorwärts-kollineare Nachbarn A→B→C fassen sich nur im Punkt B und werden
  korrekt nicht gemeldet).
- Der Frühstopp der Leiter gilt nur für **mangelfreie** Treffer
  (`bestPenalty <= EPS`); ein defekter Treffer sperrt die rangniedrigeren
  Versuche nicht. Die Garantie-Rangfolge gilt zwischen den Versuchen, nicht
  als Frühstopp beim ersten Treffer.

**2. Reparatur-Schritt nach der Leiter** (nur im Tube-Drop-Fall): Stammt der
gewinnende Pfad aus einem Versuch ohne Trassensperren und durchstößt er
Tubes, dann:

- **Hard-Gate:** Die Reparatur feuert nur, wenn der Gewinner mindestens
  einen **harten** Verstoß (kollineare Überdeckung, 100er-Klasse) gegen
  bereits verlegte Kanten hat. Gewichtete Restverstöße (Abstand knapp unter
  Freigabe) sind dokumentierte Residuen — ihr Fix wiegt die Kaskade nicht
  auf (gemessen: drei gewichtete Fixes im Plan complex verschoben das
  Busbar-Cluster und erzeugten +4 Kreuzungen, ohne einen harten Verstoß zu
  beseitigen).
- **Scoped Tubes:** Erneute Suche mit allen Tubes **außer** den vom festen
  Rahmen getroffenen (`frameHitsTube` über S-S2, S2-S3, T3-T2, T2-T) — die
  Sperren kommen zurück, die der Rahmen ohnehin nicht meiden kann.
- **Kandidaten-Gates:** Selbstüberdeckung schließt aus (niemals eine neue
  I2-Verletzung); **Kreuzungen ≤ Basis** und **Pfadlänge ≤ Basis** — beide
  sind ratchet-gesicherte Budgets, die eine Reparatur nicht aufbauen darf.
- **Lexikographische Auswahl** (Verstöße, Kreuzungen, Abweichung, Pfadlänge,
  Defekt-Score) — die **Abweichung** (Summe der Stützpunktabstände zur
  ursprünglichen Trasse) vor der Länge: Sie misst, wie weit die Tube wandert
  und damit, wie stark später geroutete Kanten gestört werden (Kaskaden-Maß).
- **Gleichstand = Originallösungspfad.** Unbelastete Kanten ändern ihre
  Geometrie nicht.

**3. Eine Wahrheit für die Hart-Zählung:** `countHardInnerViolations`
(Mittelstücke i = 2 … len−3, keine Stubs — die kann kein Kandidat ändern)
mit **Korridor-Ausnahme** nach ADR 0031 (Segmente innerhalb der Bogenlänge
`portFacingClearance` vom eigenen Port sind Bündel-Zone und zählen nicht).
Nur für die Reparatur — siehe Alternativen für die Grenzen.

## Folgen

- **Alle sechs Referenzpläne routen byte-identisch** zum Stand vor dieser
  Entscheidung (`serializeRoutes`, gemessen gegen Commit b9da1a5). Die
  Reparatur ist defensiv: Sie ändert nur Tube-Drop-Gewinner mit hartem
  Verstoß — in den Referenzplänen kommen solche Gewinner nicht vor. Die
  Stress-Szenarien profitieren: p02 verliert die harte Überdeckung
  (Score 102 → 0) bei neutraler Kantenlänge; p04/p13 verlieren je eine
  I4-Portkehre (Defekt-Score 80 → 0, Bends −2/−6, Länge −56/−12 px,
  Clearance-Verstöße 3→0 bzw. 4→0). Gesichert durch Regressionstests
  („finale Routen sind intern mangelfrei", `scripts/regression/
regression.test.ts`) und die byte-genauen Goldens.
- **Versatz-Matrix:** solar I2 2 → 0, acdc I2 12 → 10 (Frühstopp-Fix);
  camper I2 8 → 12 (Gegeneffekt, s. u.). Gesamtsumme unverändert (30 → 30)
  — Umverteilung, kein Niveau-Anstieg. Recapture-Ledger in
  `scripts/routing/audit.ts` (`SHIFT_RATCHET`).
- **Kein Kaskaden-Lauf ins Ufer:** Globale Effekte sind auf Reparatur-
  Kandidaten mit Budget-Guards begrenzt; die Leiter selbst bleibt bei
  interner Bewertung (s. Alternativen).
- **Nachvollziehbarkeit:** Eine ausgeführte Reparatur meldet sich im
  Nicht-Produktionslauf (`console.warn`, dieselbe Konvention wie der
  Fallback-Warn) — Trassenänderungen passieren nie still.

## Alternativen (alle gemessen, alle verworfen)

- **Globale Scoped-Tube-Leiter** (eigene Stufen `{all, scoped, none} ×
{strict, relaxed}` vor der bestehenden Leiter): Plan complex I3 25 → 33,
  Kreuzungen 27 → 34, Kabelweg +1932 px — Tube-Kaskade über alle Kanten.
  Verworfen; Scoping nur noch als Reparatur für konkrete, belastete
  Gewinner.
- **Hart-Kriterium in der Leiter-Auswahl** (kollineare Überdeckung gegen
  verlegte Kanten dominiert interne Strafe; zwei Varianten: mit und ohne
  Frühstopp-Anpassung): Beide Male tauschte der Referenzplan acdc 2
  Kreuzungen und 44 px Kabelweg gegen −2 gewichtete Verstöße ein
  (Kreuzungen 6 → 8, Kabelweg 5710 → 5754 — Ratchet-Brüche). Ursache: Die
  Korridor-Näherung der Bündel-Ausnahme ist **nicht äquivalent** zu
  `isPortBundleOverlap` — die exakte Freistellung braucht die Geometrie
  BEIDER Kanten, `crossingSegments` trägt aber nur flache Segmente. Die
  Hart-Prüfung bleibt deshalb an die Reparatur gebunden, wo Budget-Guards
  den Schaden deckeln. Eine exakte Anbindung wäre ein eigenes ADR
  (`crossingSegments` müsste die Prior-Geometrie mitführen).
- **Reparatur ohne Budget-Guards:** Einzelfälle mit +992 px Umweg für
  Score −105; complex +4 Kreuzungen (27 → 31) über Kaskade. Verworfen —
  Ratchet-Budgets gehen vor Einzelfall-Optimierung.
- **Gewichtete Verstöße reparieren:** s. Hard-Gate — das Kosten-Nutzen ist
  gemessen negativ (complex: +4 Kreuzungen, kein harter Verstoß beseitigt).

## Offene Punkte (dokumentiert, nicht gelöst)

- Die Leiter bewertet Kandidaten nur **intern**; der Kreuzungs-Ausweichlauf
  (`scorePath`) sieht gewichtete Clearance-Verstöße gegen verlegte Kanten
  nicht. Der Frühstopp-Fix machte das sichtbar: Szenario p02 verschiebt sich
  um +13 gewichtete Verstöße (7 → 20) bei unveränderten Kreuzungen/Bends —
  dokumentiert im KNOWN-PROBLEMS-Eintrag zur p02-Kaskade; Hebel wäre die
  gewichtete Bewertung im Ausweichlauf (eigenes ADR, Risikoprüfung wegen
  Kandidaten-Drift).
- Die Korridor-Näherung in `countHardInnerViolations` (Bogenlänge vom
  eigenen Port) kann Bündel-nahen Überdeckungen mit **nicht geteiltem** Port
  freistellen, die der I2-Checker zählen würde — für die Reparatur durch das
  Hard-Gate und die Budget-Guards gedeckelt, für die Leiter-Anbindung
  ungeeignet (s. o.).
