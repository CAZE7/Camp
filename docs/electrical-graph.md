# Der elektrische Graph (`lib/electricalGraph/`)

> Stand: 2026-10-04 · Paketvertrag: [`lib/electricalGraph/README.md`](../lib/electricalGraph/README.md)
> · Einordnung: [`docs/electrical-architecture.md`](./electrical-architecture.md)

## Wozu eine eigene Schicht?

Vor V2 war „die elektrische Wahrheit" über den Code verteilt: `node.type === 'battery'` in
der Validierung, noch einmal in Auto-Wire, noch einmal im Inspector — jeweils mit leicht
anderen Annahmen. Wer eine Regel ändern wollte, musste sie finden. Wer ein Bauteil
hinzufügte, vergaß zuverlässig eine Stelle.

`lib/electricalGraph/` ist die **eine** Antwort auf „was gilt hier elektrisch?".
Geometriefrei, React-frei, ohne Seiteneffekte.

## Module

| Modul              | Beantwortet                                                  |
| ------------------ | ------------------------------------------------------------ |
| `intent.ts`        | Darf die Automatik diese Verbindung ändern?                  |
| `powerSystem.ts`   | 12 V / 24 V / 48 V — und was heißt „passt nicht zusammen"?   |
| `constraints.ts`   | Was hält dieses Bauteil aus (Strom, Spannung, Leistung)?     |
| `batteryBank.ts`   | Wie sind die Batterien verschaltet — und wo weiß es niemand? |
| `currentBudget.ts` | Welcher Grenzwert greift zuerst, und ist eine Last zulässig? |
| `acSystem.ts`      | Welche 230-V-Quelle speist welchen Kreis?                    |
| `graph.ts`         | Alles zusammen + stabiler Inhalts-Hash                       |

### 1. Verbindlichkeit (`intent.ts`)

```
locked   > user   > required > auto   > suggested
festgenagelt  erklärt   Regel      Automat   Vorschlag
```

`edgeIntentOf(edge)` ist die **einzige** Ableitung. Rangfolge:

1. `data.locked === true` → `locked` (eine Sperre ist eine Tatsache, kein Etikett —
   ein widersprüchliches `data.intent` hebt sie nicht auf)
2. gültiges `data.intent`
3. `data.autoWired === true` → `auto`, `=== false` → `user`
4. ID beginnt mit `AUTO_EDGE_PREFIX` → `auto` (Altdaten)
5. sonst `user`

Abgeleitetes `user` (Schritt 3/5) ist **nicht** gepinnt: Wer eine Kante zieht, hat damit
noch keine Aussage über ihre Verbindlichkeit getroffen. Erst die ausdrückliche Erklärung
im Inspector (`setEdgeIntent`) schreibt `intent: 'user'` und schützt sie.

> `mayOverride(kandidat, bestehend)` ist **strikt**: gleich stark ersetzt nicht.
> Sonst hinge das Ergebnis an der Reihenfolge der Auto-Wire-Phasen.

### 2. Spannungsebenen (`powerSystem.ts`)

| Klasse    | Bereich (V)  | Nennspannung LiFePO₄/Li-Ion | sonst |
| --------- | ------------ | --------------------------- | ----- |
| `12V`     | 10 ≤ U < 18  | 12,8                        | 12    |
| `24V`     | 18 ≤ U < 36  | 25,6                        | 24    |
| `48V`     | 36 ≤ U < 72  | 51,2                        | 48    |
| `unknown` | alles andere | —                           | —     |

Außerhalb der Bereiche gibt es **keinen 12-V-Rückfall**. Eine erfundene Spannung wäre
eine erfundene Sicherung und ein erfundener Querschnitt.

### 3. Bauteilgrenzen (`constraints.ts`)

Ersetzt die verstreuten `node.type ===`-Zweige durch eine Tabelle. Unbekannter Typ ⇒ `{}`
(keine Grenze behauptet). Werte ≤ 0 oder unparsbar werden verworfen, nicht geraten.
`componentCurrentLimit = continuousCurrent ?? maxDischargeCurrent ?? maxCurrent`.

### 4. Batteriebänke (`batteryBank.ts`)

- Schlüssel ist die **erklärte** `data.bankId`, sonst `single:<id>`.
- **Mehr als eine nicht zugeordnete Hausbatterie ⇒ eine Frage**, keine Annahme.
  Zwei 12-V-Batterien sind nicht automatisch parallel: Dieselbe Zeichnung kann 12 V/200 Ah
  oder 24 V/100 Ah bedeuten — der Unterschied entscheidet über jede Sicherung im Plan.
- Serie: Spannung × n, Kapazität = Minimum. Parallel: Kapazität summiert, Ströme nur,
  wenn **alle** Werte vorliegen (`sumIfComplete`). Series-Parallel: Spannung × Reihen,
  Kapazität und vollständige BMS-Ströme × Parallelstränge.
- `single`, `series` und `parallel` müssen zur Mitgliederzahl passen; `series-parallel`
  verlangt positive ganze Zahlen mit `bankSeries × bankParallel = Mitgliederzahl`.
  Widersprüchliche/ungültige Deklarationen führen zu `unassigned`, einer strukturierten
  Frage und **keinen** abgeleiteten internen Verbindungen.
- Gültige Deklarationen bekommen im Graphen deterministische interne Bankverbindungen.
  Mitglieder-ID-Sortierung ist nur kanonische Graphdarstellung, **keine physische
  Verdrahtungsanweisung**; diese internen Verbindungen erscheinen nicht als Planerkabel.
- Jede Batterie gehört zu genau einer Bank (Invariante, property-getestet).

### 5. Strombudget (`currentBudget.ts`)

```
allowedCurrent = min(BMS, Bauteil, Sicherung, Kabel, System)
```

Bei Gleichstand entscheidet `CURRENT_LIMIT_PRECEDENCE` (BMS zuerst) — damit die Meldung
die Ursache nennt, die der Nutzer ändern muss. Fehlt jeder Grenzwert, ist das Ergebnis
`undefined` **plus Warnung**, niemals `ok`.

`evaluateLoadFeasibility` kennt zwei Stufen: Überschreitung (kritisch) und
„keine Reserve" ab `LOAD_HEADROOM_FRACTION = 0,9`. Die Reservestufe gilt für
**Abschaltschwellen** (BMS): Ein 30-A-Laderegler, der 30 A liefert, arbeitet dagegen im
Nennbetrieb — die Live-Regel `ELE-010` meldet deshalb nur die echte Überschreitung.

### 6. AC-System (`acSystem.ts`)

Endpunktrollen `emit | consume | pass`. Landstrom → Wechselrichter → Steckdose ergibt
**zwei** Kreise (`ac:shore`, `ac:inv`), nicht einen. Konflikte: `multiple-sources`,
`no-source`, `unknown-source-reference`.

### 7. Zusammenbau und Hash (`graph.ts`)

DC-Stromkreise sind die ungerichteten Zusammenhangskomponenten, benannt nach ihrer
kleinsten Knoten-ID (`dc:<id>`) — stabil gegenüber Umsortierung. Kanten ins Leere werden
verworfen. `electricalGraphHash` (FNV-1a) deckt Knoten, Grenzen, Verbindungen **mit
Absicht** und Bänke ab — und **keine Position**: Verschieben eines Bauteils ändert den
Hash nicht, Umverdrahten schon. Genau das braucht die Routing-Generation
([`docs/routing.md`](./routing.md)).

## Eigenschaften (fast-check, 300 Läufe, Seed 20261004)

`lib/electricalGraph/properties.test.ts`:

| ID  | Gesetz                                                                |
| --- | --------------------------------------------------------------------- |
| E1  | Absicht ist total — jede Kante bekommt genau einen Wert               |
| E2  | `mayOverride` ist strikt und transitiv                                |
| E3  | Spannungsklassen sind disjunkt und lückenlos im Gültigkeitsbereich    |
| E4  | Jede Batterie liegt in genau einer Bank                               |
| E5  | Bankspannung wächst monoton mit der Zahl der Serienzellen             |
| E6  | `allowedCurrent` ist das Minimum und nie größer als jede Einzelgrenze |
| E7  | AC-Kreise partitionieren die AC-Knoten                                |
| E8  | Graph-Hash ist invariant gegen Verschieben und Umsortieren            |

Ergänzend `lib/autoWire/conflicts.test.ts`: **E9** (Bericht unabhängig von der
Meldereihenfolge) und **E10** (Deduplizierung schluckt keinen anderen Befund).

## Was diese Schicht NICHT tut

- keine Positionen, keine Wegpunkte, kein React, kein Store-Zugriff
- keine Reparaturen: Sie stellt fest, sie ändert nicht
- keine VDE-Tabellen — die liegen in `lib/electrical.ts` / `lib/vde-standards.ts`
