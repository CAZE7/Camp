# ADR 0025 — Port-Bündel-Ausnahme, das Kostenmodell und die Diagnose teilen eine Regel

**Status:** angenommen · **Datum:** 2026-09-27 · **Bezug:** ADR 0009
(Überdeckungen verboten, Kreuzungen erlaubt), ADR 0019 (Gate liest das
Kollisionsmodell), ROUTE-002, ROUTE-004; Finding 2026-09-27 („Stub-Kenntnis des
Nachbarn ins Modell“)

## Kontext

Zwei Leitungen an derselben Anschlussstelle verlassen sie zwangsläufig auf
demselben Stub; ihre ersten Segmente liegen kollinear übereinander. ADR 0009
verbietet kollineare Überdeckungen (I2) und macht dafür genau eine Ausnahme:
Erlaubt ist der gemeinsame Abschnitt, solange er **vollständig innerhalb der
Stubs beider Kanten** liegt. Diese Ausnahme lebte als private Funktion
`isPortBundleOverlap` in `lib/routing/invariants.ts` — und ein zweites Mal, in
abweichender Form (`stubMin`-Fenster um den Anschlusspunkt), im
Diagnose-Skript `scripts/routing/audit.ts`.

Genau daraus entstanden zwei belegte Fehlurteile:

1. **Die Diagnose widersprach dem Gate.** `npm run routing:audit` meldete vor
   dieser Entscheidung `ovl=3/1 · 7/3 · 2/2 · 1/3 · 3/7 · 6/9` — also 25 Paare
   „Überdeckung außerhalb des Ports“, während I2 im selben Lauf 0 sagte. Wer
   dem Audit glaubte, suchte 25 Fehler, die es nicht gab.
2. **Das Kostenmodell konnte die Ausnahme nicht kennen.** `segmentExtraCost`
   (`rules/costModel.ts`) klassifiziert eine kollineare Überdeckung korrekt als
   `hard ⇒ Infinity`; ohne Stub-Kenntnis verwirft es damit aber **jedes**
   legitime Bündel. Über die sechs Referenzpläne gemessen: 47 Kantenpaare sind
   kollinear überdeckt, **alle 47 sind Port-Bündel**, echte I2-Verstöße 0. Der
   Anschluss der räumlichen Kostenhälfte (`segmentExtraCost`) war deshalb keine
   Verkabelung, sondern eine Modellfrage.

## Entscheidung

1. **Die Ausnahme ist eine Regel der Rules-Schicht.** Sie lebt in
   `lib/routing/rules/portBundle.ts` (framework-frei, ohne Tokens):
   `routedPathGeometry` (vereinfachte Stützpunkte → Segmente + Stubs),
   `sharesPort`, `overlapInterval`, `isPortBundleOverlap`. Alle drei Nutzer
   lesen dieselbe Funktion:

   | Nutzer                                | Ort                              | Rolle                   |
   | ------------------------------------- | -------------------------------- | ----------------------- |
   | I2 (harte Invariante)                 | `lib/routing/invariants.ts`      | `checkEdgeEdgeOverlaps` |
   | räumliche Kosten (`segmentExtraCost`) | `lib/routing/rules/costModel.ts` | `options.portBundle`    |
   | Diagnose (Spalte `ovl`)               | `scripts/routing/audit.ts`       | `analyzeOverlaps`       |

2. **Das Modell bekommt die Stub-Kenntnis als Option, nicht als Annahme.**
   `segmentExtraCost(segment, index, { portBundle: { own, otherOf } })`:
   `own` ist die Geometrie der eigenen Kante, `otherOf` löst ein
   Index-Segment auf die Geometrie der zugehörigen Fremdkante auf.
   Fehlt `otherOf` oder liefert es `undefined`, bleibt jede Überdeckung hart
   (**fail-safe**) — ein fälschlich verworfenes Segment ist schlimmer als ein
   nicht ausgenutztes Bündel. Durchgelassene Überdeckungen werden als
   `portBundleShared` gezählt (sichtbar statt still).
3. **Die Diagnose folgt dem Gate.** `analyzeOverlaps` trennt jetzt
   `atPort` (Ausnahme greift) von `elsewhere` (echter Fehler). Die
   Gate-Prüfung in `audit.ts` koppelt beide Urteile hart:
   `(elsewhere > 0) !== (I2 > 0)` ⇒ Exit 1. Eine künftige Drift der beiden
   Regeln ist damit ein Testversagen, kein stiller Widerspruch.

## Folgen

- `ovl` in `npm run routing:audit` zeigt den gemessenen Bestand:
  `4/0 · 10/0 · 4/0 · 4/0 · 10/0 · 15/0` (Σ 47 Bündel, 0 echte Fehler) statt der
  früheren 25 Phantom-Fehler.
- `segmentExtraCost` ist im Suchloop noch **nicht** verschaltet — das bleibt
  offen, weil 121 `nearby`-Paare gegen die gewollten Bündel-Lanes (16-px-Raster)
  drücken und erst mit der LaneRegistry (ROUTE-001) sauber bewertbar sind. Was
  jetzt existiert, ist die fehlende Fähigkeit des Modells; der Aufruf ist
  vorbereitet und getestet.
- `isPortBundleOverlap` ist eine private Funktion weniger in `invariants.ts`
  (−57 Zeilen) — die Invariante liest dieselbe Geometrie wie das Modell.
- Die Aussage „ohne Stub-Kenntnis wären alle 47 Bündel hart“ ist als Test
  gepinnt (`scripts/routing/portBundleModel.test.ts`: I2 = 0, Modell ohne/mit
  Kenntnis, Audit `atPort`/`elsewhere`, Ratchet-Zahlen je Plan).

## Nachweis

- `scripts/routing/portBundleModel.test.ts` (8 Tests, 6 Referenzpläne): I2 = 0;
  47 kollineare Kantenpaare, alle 47 als Bündel erlaubt, 0 außerhalb; Modell
  liefert ohne Kenntnis genau für diese Paare `Infinity`, mit Kenntnis für
  keines; Audit `atPort` ≥ Paare und `elsewhere` = 0.
- `lib/routing/rules/portBundle.test.ts` (10 Tests): Geometrie, `sharesPort`,
  `overlapInterval`, drei Fälle der Ausnahme-Entscheidung inklusive der
  Rückkehr auf die Stub-Linie über ein Mittelstück (bleibt hart).
- `lib/routing/rules/costModel.test.ts` (23 Tests): fail-safe ohne Kenntnis,
  erlaubt/kostenfrei mit Kenntnis, Übereinstimmung mit I2, Gegenprobe.
- `npm run routing:audit` Exit 0 mit der neuen Kopplungsprüfung.

## Nicht in dieser Entscheidung

`preferredLaneBonus` (Registry-Lane) und der Produktiv-Einsatz von
`segmentExtraCost` im Suchloop — beides braucht die LaneRegistry-Anbindung
(ROUTE-001), die den Bündel-Begriff ohnehin zentralisiert. Siehe
`docs/ai/KNOWN-PROBLEMS.md`, ROUTE-002.
