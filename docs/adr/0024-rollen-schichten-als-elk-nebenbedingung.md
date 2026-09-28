# ADR 0024 — Rollen-Schichten sind eine ELK-Nebenbedingung

**Status:** angenommen · **Datum:** 2026-09-27 · **Bezug:** ADR 0016, ADR 0018,
ADR 0023, Finding 2026-09-27 („Rollen-Schichten", P1)

## Kontext

Der Planer kennt seit jeher eine fachliche Schichtenfolge: **Quelle** (Solar,
Landstrom, Wassertank) → **Wandler** (MPPT, Ladebooster, Ladegerät, Pumpe) →
**Speicher & Hauptverteilung** (Batterie, Shunt, Schienen, Sicherungskasten) →
**Wechselrichter** → **Verbraucher** (12 V/230 V, Masse).

Diese Ordnung lebte bis hierher **nur im UI-Aufräumen**
(`components/planner/utils/layout.ts`, `getNodeLayoutRank`) und erreichte den
ELK-Layout-Pass nie: `ElkLayoutEngine` setzte jeden Knoten auf `x = 0`,
`y = 0` und ließ ELK allein nach Topologie und Kreuzungsminimum legen. Ergebnis
waren kompakte, aber nicht immer fachlich lesbare Pläne — „kompakt" statt
„logisch".

Zusätzlich war die Rang-Tabelle dabei, sich zu verdoppeln: `LAYOUT_TYPE_ORDER`
und die fünf Rang-Mengen standen in `components/`, der ELK-Pass liegt in
`lib/` — und `lib/` darf `components/` nicht importieren (lib-Grenze,
`scripts/architecture/libBoundary.test.ts`).

## Entscheidung

1. **Die Rang-Tabelle lebt in `lib/`:** `lib/planner/layout-engine/ranks.ts`
   (`getLayoutRank`, `LAYOUT_DEFAULT_RANK`, `LAYOUT_RANK_COUNT`). Das UI-Aufräumen
   importiert sie nur noch (`getNodeLayoutRank` ist ein Wrapper) — eine
   Wahrheit, zwei Aufrufer.
2. **ELK bekommt die Rollen als INTERACTIVE-Layering-Nebenbedingung:**
   `ElkPlan.ranked` wählt `generateElkRankedOptions`
   (`layering.strategy: INTERACTIVE`, `considerModelOrder.strategy:
PREFER_EDGES`) und `rankSpacing` (Layout-Token) ist der Seed-Abstand:
   `x = Rang × rankSpacing`, `y = 0`. ELK hält die fachliche Reihenfolge ein,
   die endgültigen Abstände rechnet es selbst.
3. **Der Modus ist NICHT der interaktive Nutzermodus.** Gemessen über die
   sechs Referenzpläne (ELK-Platzierung → Produktiv-Router → Kreuzungen):

   | Optionen                                                  | Σ Kreuzungen       |
   | --------------------------------------------------------- | ------------------ |
   | ohne Rang-Seed (vorher)                                   | 41                 |
   | + `cycleBreaking`/`layering` INTERACTIVE, semiInteractive | 44                 |
   | + wie vor, ohne semiInteractive                           | 47                 |
   | layering INTERACTIVE + `PREFER_EDGES` (gewählt)           | **36**             |
   | + `y`-Seed (Index oder Ist-Position)                      | 36 (keine Wirkung) |

   `crossingMinimization.semiInteractive` friert die Reihenfolge **innerhalb**
   der Schicht ein und hebt damit genau die Minimierung auf, die den Plan
   übersichtlich macht; `cycleBreaking: INTERACTIVE` kostete weitere Kreuzungen.
   Beides bleibt `generateElkInteractiveOptions` (Nutzerplatzierungen
   respektieren, Spec §6.2) vorbehalten.

4. **Kreuzungen bekommen eine Grenze.** `npm run routing:audit` führt je Plan
   eine Kreuzungs-Ratchet (`CROSSING_RATCHET`); eine Überschreitung ist ein
   Gate-Fehler, eine Unterschreitung ein Nachzieh-Hinweis. Die Test-Ratchet für
   beide Router-Pässe existierte bereits (`lib/routing/invariants.test.ts`,
   `LEGACY_BASELINE`/`ELK_BASELINE`).

## Konsequenzen

**Gut:** „Plan ordnen" ordnet fachlich (Quelle links, Verbraucher rechts) und
ist gleichzeitig kreuzungsärmer: **Σ 42 → 34** Kreuzungen über die sechs
Referenzpläne im Produktivpfad (ELK-Platzierung + A\*). Der Rang ist in beiden
Layout-Pfaden derselbe. Die Ratchet macht „übersichtlich" dauerhaft prüfbar.

**Preis / Grenzen:** Die Wirkung ist je Plan unterschiedlich — solar 3 → 0,
complex 17 → 11, camper 6 → 4, acdc 8 → 6, aber simple 4 → 5 und inverter 4 → 8.
Die Summe sinkt deutlich, einzelne Pläne werden um wenige Kreuzungen
schlechter; die Ratchet steht deshalb auf dem gemessenen Stand **nach** dieser
Änderung, nicht auf einem Wunschwert. Und: Die Rollenfolge ist eine
_Nebenbedingung_, keine Garantie — wo die Topologie ihr widerspricht, gewinnt
die Topologie (sonst müsste ELK Leitungen erfinden).

**Nicht betroffen:** Golden Master und Regression (beide laufen ohne ELK),
sowie die Referenzgeometrie — der Rang-Seed wirkt ausschließlich im
ELK-Platzierungspfad („Plan ordnen").
