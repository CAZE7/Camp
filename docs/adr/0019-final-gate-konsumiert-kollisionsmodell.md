# ADR 0019 — Das Final-Gate konsumiert das geteilte Kollisionsmodell

**Status:** angenommen · **Datum:** 2026-09-08 · **Bezug:** ADR 0015, PERF-001 (Fix 2026-09-08), AUDIT-EXTREM-2026-09 ROUTE-003

## Kontext

Das Kollisionsmodell `lib/routing/rules/collision.ts` (`classifyCollision`,
WP-3) trägt den Anspruch „EIN Modell für beide Pässe — kein Router besitzt
eigene Kollisions-/Abstandsbegriffe". AUDIT ROUTE-003 prüfte den Anspruch am
Import-Graphen und fand ihn unerfüllt: `classifyCollision` wurde nur von
Tests/Scripts konsumiert. Drei Stellen besaßen eigene Begriffe:

1. **Der Produktiv-A\*** (`components/edges/utils/pathfinding.ts`) — prüft per
   eigenem `segmentHitsRect`. Der PERF-001-Fix dokumentiert jedoch: hard ist
   bitweise `segmentHitsRect` — die innere Schleife ist zur Modell-Begriffswelt
   **semantisch äquivalent**, nur günstiger. `classifySegmentAgainstNode` dort
   aufzurufen wäre ~20× teurer (die 'weighted'-Distanz würde pro Kandidat
   berechnet und verworfen) und änderte keine einzige Entscheidung.
2. **Das Final-Gate** (`lib/routing/invariants.ts` — die eigentliche
   **Freigabe-Prüfung**, ADR 0015; Report landet im `RoutingStatusBadge`) —
   re-implementierte I1/I2/I3 als dritte, parallele Begriffswelt über
   `./geometry`, statt `rules/collision.ts` zu konsumieren.
3. **`routeAllCollisionGuarantee.test.ts`** — beweist die Äquivalenz beider
   Welten für den Produktivpfad bereits testseitig.

Harmonisieren heißt also nicht „`classifyCollision` in den A\*-Innenloop" — das
ist der teure No-Op, den PERF-001 gerade entfernt hat. Harmonisieren heißt:
die **eine Stelle**, an der binäre Freigabe-Urteile materiell erzeugt werden,
spricht die Begriffe des Modells.

## Entscheidung

`lib/routing/invariants.ts` leitet die Hartinvarianten aus dem Modell ab:

- **I1 (Leitung × Bauteil):** `classifySegmentAgainstNode(...).class === 'hard'`
- **I3 (Freigabe/Clearance):** `classifySegmentAgainstNode(...).class === 'weighted'`
  (das bisherige EPS von 1e-6 px unter der Schwelle war eine Toleranz der alten
  Implementierung; das Modell definiert `< clearance` exakt — die Schärfe
  ändert sich um sub-nanometrische Größen, der Ratchet entscheidet mit Zahlen)
- **I2 (kollineare Überdeckung):** `classifySegmentAgainstSegment(...).class === 'hard'`

Dieselbe Segment×Node-Klassifikation liefert hard und weighted aus einem Aufruf
— dieselbe Quelle für einmal „einmal verboten" und einmal „zu dicht".

**Nicht geändert:** Der A\* selbst (Innenloop bleibt `segmentHitsRect`,
PERF-001 steht), `validateFinalRouting`-Signatur und Report-Form,
`RoutingStatusBadge`, die Baselines (Ratchet muss **ohne** Nachzug grün bleiben
— andernfalls ist das Delta zu messen, zu begründen und im Ledger festzuhalten).

## Konsequenzen

**Gut:** Eine Begriffswelt weniger (drei → zwei, und die verbleibende
A\*-Fassung ist als Äquivalenz dokumentiert + testgesichert); das Freigabe-Gate
ist jetzt buchstäblich „das Modell, binär gelesen"; jede künftige
Modell-Schärfung (z. B. neue Klassen) wirkt sofort auf die Freigabe.

**Pflichten:** Parity-Test (`invariantsCollisionParity.test.ts`) sichert die
Übereinstimmung Checker ⇔ Modell über synthetische Fälle; die Golden-Master-
Baselines in `invariants.test.ts` (LEGACY_BASELINE) und der Ratchet
(`scripts/routing/finalValidation.test.ts`) sind der Zähl-Beweis, dass die
Ableitung die Zahlen nicht verschiebt.
