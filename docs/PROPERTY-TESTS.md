# Property-Based Tests der VDE-Logik

Stand: 2026-08-21 · Betrifft AGENTS.md **K2** · Datei: `lib/vde-properties.test.ts`

## 1. Warum fast-check?

Die vorhandenen Tests prüfen Beispiele: *„20 A auf 5 m ergibt 6 mm².“* Sie
belegen einzelne Punkte, aber keine Regel. Bei sicherheitsrelevanter
Auslegung ist aber genau die Regel interessant:

> Eine Sicherung darf **niemals** größer sein als das, was das Kabel aushält —
> für *jeden* Strom und *jeden* Querschnitt.

`fast-check` (4.9.0, devDependency) erzeugt dafür tausende Eingaben aus
definierten Wertebereichen, schrumpft ein gefundenes Gegenbeispiel auf den
kleinsten Fall und meldet es reproduzierbar mit Seed.

Der Nutzen ist belegt und nicht behauptet: Abschnitt 4 zeigt einen echten
Fehler, den die Property-Tests gefunden haben und der behoben wurde.

## 2. Die geprüften Gesetze

| ID | Gesetz | Läufe |
|----|--------|-------|
| G1 | Sicherungs-Sandwich: Laststrom ≤ Sicherung ≤ `FUSE_MAP[Querschnitt]` | 1.000 |
| G2 | Monotonie der Sicherungsauswahl (Strom ↑ ⇒ Sicherung nie ↓, Querschnitt ↑ ⇒ Sicherung nie ↓) | 1.000 |
| G3 | Monotonie des Spannungsfalls (Länge ↑ ⇒ Abfall nie ↓, Querschnitt ↑ ⇒ Abfall nie ↑) + Linearität im Strom | 1.000 |
| G4 | Monotonie der Querschnittsauswahl (Strom ↑ ⇒ Querschnitt nie ↓) + Ergebnis immer aus der Normreihe | 1.000 |
| G5 | Idempotenz von `performAutoWiring` (2. Lauf identisch, 3. Lauf ebenfalls) | 1.000 / 200 |
| G6 | AC/DC-Trennung jeder erzeugten Verbindung, Domänen-Markierung, Polgleichheit, „kein Kabel ohne Querschnitt“ | 1.000 |
| — | Systemspannung: immer positiv, endlich, reihenfolgeunabhängig | 1.000 |

Zusätzlich prüft G1 die Tabellen-Invariante `FUSE_MAP[A] ≤ VDE_AMPACITY[A]`
für die gesamte Normreihe.

`seed: 20260821` und `numRuns: 1000` sind fest verdrahtet — jeder Lauf ist
exakt wiederholbar, ein Gegenbeispiel damit reproduzierbar.

## 3. Generatoren

Realistische Wertebereiche statt „alles was `number` kann“:

| Generator | Bereich | Begründung |
|-----------|---------|------------|
| `currentA` | 0.1 – 250 A | LED-Streifen bis Wechselrichter-Einspeisung |
| `lengthM` | 0.1 – 15 m | Batterie→Shunt bis Heck→Fahrerhaus |
| `crossSection` | VDE-Normreihe 1.5 – 70 mm² | nur real beschaffbare Querschnitte |
| `wattage` | 5 – 3000 W | USB-Ladegerät bis Induktionskochfeld |
| `planArbitrary` | 1 Batterie + 0–6 Komponenten | typische Camper-Pläne |
| `planWithUserEdgesArbitrary` | zusätzlich 0–4 Nutzer-Kanten | Pläne, in die der Nutzer schon selbst Kabel gezogen hat |

Der Kantengenerator bildet die Regeln der UI nach: er erzeugt nur
Verbindungen, die `usePlannerStore.isValidConnection` zulassen würde
(domänenrein), und markiert die Domäne entweder gar nicht (Altbestand,
Vorlagen) oder mit genau dem Wert, den der Store beim Verbinden schreibt.
Andernfalls würde das Gesetz gegen Pläne getestet, die im Produkt nicht
entstehen können.

## 4. Echter Fund: undimensionierte 230-V-Leitung

**Symptom.** Das Gesetz *„jede Kante ist nach der Verdrahtung dimensioniert“*
schlug fehl, sobald der Plan eine Nutzer-Kante zwischen Landstrom und einem
230-V-Gerät ohne gespeicherte Domänen-Markierung enthielt.

**Ursache.** `performAutoWiring` teilte die Kanten in zwei Töpfe:

- `sizeDcEdges` bekam alle Kanten mit `!isAcEdge(...)` — die AC-Kante fiel raus.
- `sizeAcEdges` bearbeitete nur Kanten mit `edge.data.edgeDomain === 'AC_230V'`
  — die Kante hatte keinen Marker und fiel ebenfalls raus.

Ergebnis: eine 230-V-Leitung blieb komplett ohne Querschnitt im Plan
(`{ length: 3 }`), also ohne Auslegung, ohne Stückliste, ohne Prüfung.

**Fix** (`lib/autoWire.ts`): Nutzer-Kanten ohne Markierung, die topologisch
AC sind, werden vor der Dimensionierung als `AC_230V` markiert. Danach:
`{ length: 3, crossSection: 1.5, edgeDomain: 'AC_230V' }`.

**Regressionstest**: `Shrinking-Anker (b)` in `lib/vde-properties.test.ts`.

## 5. Belegte Wirksamkeit (Mutationsproben)

Ein grüner Property-Test beweist nichts, wenn er auch bei kaputtem Code grün
bliebe. Drei gezielte Verfälschungen der Produktionslogik:

| # | Mutation | Ergebnis | Geshrinktes Gegenbeispiel |
|---|----------|----------|---------------------------|
| 1 | `selectFuseSize` sucht ohne Obergrenze (`size >= minFuse`) | **3 Tests rot** (G1) | `[16.000000000000004, 1.5]` |
| 2 | `calculateCrossSection` fällt auf 1.5 statt 70 mm² zurück | **1 Test rot** (G4) | `[1.044000000000002, 48.72000000000009, 15]` |
| 3 | `isAcEdge` liefert immer `false` | zunächst **grün** → Lücke! | — |

Mutation 3 deckte eine Schwäche der *Tests* auf: der ursprüngliche Generator
erzeugte keine Nutzer-Kanten, also wurde `isAcEdge` nie erreicht. Nach
Ergänzung von `planWithUserEdgesArbitrary` meldet G6 den Mutanten mit dem
Gegenbeispiel `shorePower-0 → consumer230v-1, edgeDomain: undefined`.

Alle drei Gegenbeispiele sind als klassische Beispieltests im Abschnitt
„Shrinking-Anker“ erhalten und laufen ohne Zufall.

Die Mutationen selbst sind **nicht** committet — sie waren temporäre
Experimente. Zum Nachstellen genügt es, die in der Tabelle genannte Zeile in
`lib/electrical.ts` bzw. `lib/autoWire.ts` zu ändern und
`npx vitest run lib/vde-properties.test.ts` auszuführen.

## 6. Dokumentierte Grenze

Eine Kante zwischen zwei 230-V-Geräten mit gespeichertem
`edgeDomain: 'DC_12V'` wird als DC dimensioniert: die gespeicherte Markierung
gewinnt gegen die Topologie. Über die UI ist dieser Zustand nicht erreichbar
(`isValidConnection` + `getEdgeDomain`), er kann nur aus beschädigten oder
manuell importierten Daten stammen. Der Ist-Zustand ist als Test festgehalten
(„bekannte Grenze“), inklusive der Zusicherung, dass die Kante trotzdem einen
gültigen Querschnitt bekommt.

## 7. Laufzeit

```
$ npx vitest run lib/vde-properties.test.ts
 ✓ lib/vde-properties.test.ts (30 tests) ~5 s
```

Rund 5 Sekunden für ~17.000 generierte Fälle — das Gate bleibt schnell genug
für jeden PR.
