# `lib/electricalGraph/` — die elektrische Wahrheit

## What is this?

Die **oberste Schicht** des Planers: ein geometriefreies Modell dessen, was elektrisch
tatsächlich gilt. Keine Positionen, keine Kabelwege, kein React. Alles, was weiter unten
passiert (Prüfung, Auto-Wire, Layout, Routing, Rendering), liest hier — und schreibt hier
nicht zurück.

```
intent.ts        Verbindlichkeit einer Verbindung (locked > user > required > auto > suggested)
powerSystem.ts   Spannungsebenen 12 V / 24 V / 48 V, Kompatibilitätsprüfung
constraints.ts   Bauteilgrenzen als Tabelle statt verstreuter `node.type ===`-Zweige
batteryBank.ts   Explizite Batteriebänke (single/series/parallel/series-parallel)
currentBudget.ts Kleinste zulässige Belastung aus BMS/Bauteil/Sicherung/Kabel/System
acSystem.ts      230-V-Quellen, -Kreise, -Verteilung, -Verbraucher
graph.ts         Zusammenbau + stabiler Inhalts-Hash (FNV-1a)
index.ts         öffentliche API (nur hierüber importieren)
```

> Warum `electricalGraph/` und nicht `electrical/`? `lib/electrical.ts` existiert bereits
> (VDE-Tabellen). Zwei Module mit fast gleichem Namen wären eine Falle.

## What is the public API?

| Symbol                                                        | Datei              | Zweck                                                    |
| ------------------------------------------------------------- | ------------------ | -------------------------------------------------------- |
| `buildElectricalGraph(nodes, edges)`                          | `graph.ts`         | **Einstieg.** Vollständige elektrische Sicht eines Plans |
| `electricalGraphHash(graph)`                                  | `graph.ts`         | Inhalts-Hash OHNE Geometrie (Routing-Generation)         |
| `systemVoltageOf(graph)`                                      | `graph.ts`         | Versorgungsspannung (Bank schlägt Einzelbatterie)        |
| `edgeIntentOf(edge)` / `isIntentPinned` / `isRouteLocked`     | `intent.ts`        | Absicht lesen, Unantastbarkeit prüfen                    |
| `mayOverride(candidate, existing)`                            | `intent.ts`        | Darf eine Verbindung eine andere ersetzen?               |
| `classifySystemVoltage` / `checkVoltageCompatibility`         | `powerSystem.ts`   | Spannungsebene bestimmen/prüfen                          |
| `resolveComponentConstraints(node)` / `componentCurrentLimit` | `constraints.ts`   | Grenzen eines Bauteils                                   |
| `deriveBatteryBanks(nodes, fallback)` / `primaryHouseBank`    | `batteryBank.ts`   | Bänke + offene Fragen                                    |
| `computeCurrentBudget(limits)` / `evaluateLoadFeasibility`    | `currentBudget.ts` | Belastbarkeit und Machbarkeit einer Last                 |
| `buildAcSystem(nodes, edges)` / `resolveAcSourceForLoad`      | `acSystem.ts`      | 230-V-Kreise und Quellenzuordnung                        |

## What does it own?

- **Die Absicht** jeder Verbindung — und damit die Antwort auf „darf Auto-Wire das ändern?“.
- **Die Spannungsebene** der Anlage (12/24/48 V) als benannter Begriff.
- **Die Batteriebänke** mit ihrer ERKLÄRTEN Verschaltung und den daraus folgenden
  Kennwerten (Spannung, Kapazität, Strombelastbarkeit). `series`/`parallel` müssen zur
  Mitgliederzahl passen; `series-parallel` verlangt positive ganze Zahlen und exakt
  `bankSeries × bankParallel = Mitgliederzahl`. Widersprüche/ungültige Angaben lassen die
  Bank `unassigned` und erzeugen eine strukturierte Frage; dafür entstehen keine internen
  Links. Eine gültige deklarierte Matrix wird im geometriefreien Graphen als deterministische
  kanonische Verknüpfung repräsentiert (Mitglieder-ID-sortiert). Das ist **keine physische
  Verdrahtungsanweisung** und wird nicht als React-Flow-Kabel gerendert; tatsächliche
  Einbau-/String-Zuordnung bleibt separat zu planen.
- **Die Grenzen** jedes Bauteils, inklusive BMS — als Daten, nicht als if-Kette.
- **Die 230-V-Struktur**: welche Quelle speist welchen Kreis und welchen Verbraucher.
- **Die offenen Fragen** (`questions`): alles, was das Modell NICHT entscheiden darf.

## What must not happen here?

1. **Keine Geometrie.** Kein `x`, `y`, `width`, `measured`, `waypoints`. Ein Property-Test
   (E1) prüft, dass Verschieben den Hash nicht ändert.
2. **Kein Raten.** Mehrdeutigkeit wird zu einer `question`, nie zu einem Default
   (AGENTS.md Regel M). Insbesondere: zwei gleiche Batterien sind **nicht** automatisch
   parallel.
3. **Keine zweite Stromquelle.** Ströme kommen weiterhin aus `calculateEdgeCurrent` (DC)
   bzw. `acCurrentA` (AC); hier leben nur die **Grenzen**.
4. **Keine Normbehauptungen.** Die Klassenfenster (10–18 / 18–36 / 36–72 V) sind eine
   dokumentierte Modellannahme, keine zitierte Norm.
5. **Keine UI-Importe** (ARCH-001) und keine Mutation der Eingabeknoten.
6. **Keine Reihenfolgeabhängigkeit.** Jede Traversierung sortiert vorher über
   `compareIds` (ADR 0010).

## Which tests protect it?

| Datei                   | Schutz                                                                   |
| ----------------------- | ------------------------------------------------------------------------ |
| `intent.test.ts`        | Rangfolge, Ableitung aus Altdaten, „abgeleitet ≠ gepinnt“, Transitivität |
| `powerSystem.test.ts`   | Klassenfenster, Rundlauf Nennspannung ↔ Klasse, Kompatibilitätsgründe    |
| `constraints.test.ts`   | Synchronität mit `lib/nodeSchema.ts`, „fehlt ≠ unbegrenzt“               |
| `batteryBank.test.ts`   | Serie/Parallel/2s2p, Rückfragen statt Annahmen, Determinismus            |
| `currentBudget.test.ts` | Minimum + Rangfolge, 90-%-Reserve, „unbekannt ist nie ok“                |
| `acSystem.test.ts`      | Zwei Kreise am Wechselrichter, Mehrquellen-Konflikt, `acSourceId`        |
| `graph.test.ts`         | Geometriefreiheit, Kreise, Fragen, Hash-Verhalten                        |
| `properties.test.ts`    | E1–E8: Geometrie-, Reihenfolge-, Determinismus- und Monotoniegesetze     |
| `lib/autoWire.test.ts`  | Zusammenspiel mit Auto-Wire (erklärte Bänke, AC-Zuordnung)               |

## Fehlerverhalten

Keine Funktion wirft im Normalbetrieb. Unbekanntes wird als `undefined` geführt und
getrennt sichtbar gemacht:

- `classifySystemVoltage` → `'unknown'` statt 12 V,
- `componentCurrentLimit` → `undefined` statt „unbegrenzt“,
- `computeCurrentBudget` → `limitedBy: 'unknown'` und Schweregrad `warning` (nie `ok`),
- `resolveAcSourceForLoad` → `undefined`, worauf Auto-Wire **nicht** verdrahtet.

Weitere Details: [`docs/electrical-graph.md`](../../docs/electrical-graph.md) und
[`docs/electrical-architecture.md`](../../docs/electrical-architecture.md).
