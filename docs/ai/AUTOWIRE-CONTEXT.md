# AUTOWIRE-CONTEXT

AutoWire baut aus einer Bauteilliste eine **verdrahtete, dimensionierte und abgesicherte**
Topologie. Es ist eine **reine Domänenfunktion** — kein React, kein React-Flow-Runtime, keine
Seiteneffekte auf dem Store (der Store übernimmt das Ergebnis in die Historie).

Eintrag: `performAutoWiring(initialNodes, existingEdges)` — `lib/autoWire.ts`.
Modul-README: [`lib/autoWire/README.md`](../../lib/autoWire/README.md).

---

## 7.1 Signatur

```ts
performAutoWiring(
  initialNodes: Node[],           // lib/domain/graph.ts
  existingEdges: CableEdge[] = [] // Edge<CableEdgeData>
): { nodes: Node[]; edges: CableEdge[] } | null
```

- **Rückgabe `null`** ⇔ kein Akku im Plan (`pickHouseBattery` findet keinen). Der Store zeigt
  dann „Bitte zuerst eine Batterie platzieren …“ (`store/slices/graphSlice.ts`).
- **Keine Exception im Normalbetrieb.** Die beiden historisch bekannten Crash-Pfade sind
  geschlossen: Länge 0 (`crossSectionForDrop`, AUDIT AUTO-001) und AC-Querschnitt > 70 mm²
  (`sizeAcEdges`, AUDIT CRASH-001).

---

## 7.2 Pipeline

```
Input
  ↓  Nutzer-Knoten + vorhandene Kanten
Analysis
  ↓  buildDictionaries (nodesByType / nodesByLabel)
  ↓  pickHouseBattery  (role='house' > kein Starter-Label > erste Batterie)
  ↓  getSystemVoltage  (Aufbaubatterie hat Vorrang)
  ↓  Längenschätzung für Nutzer-Kanten ohne data.length (px / PX_PER_METER, min 1 m)
Topology (Knoten anlegen/heilen)
  ↓  resolveRails()          Plus-/Minus-Schiene (find-or-create)
  ↓  findOrCreate()          Sicherungskasten, Smart Shunt, MPPT (nur bei Solar)
  ↓  Starterbatterie         nur, wenn ein Ladebooster sie braucht
  ↓  healUserEdges()         unsichere Nutzer-Kanten umhängen oder entfernen
Wiring Strategy
  ↓  Backbone, Verbraucher, Wechselrichter, Solar, Lader, Booster, Landstrom, Masse
Sizing
  ↓  sizeDcEdges()     Querschnitt (thermisch + Spannungsfall, iterativ)
  ↓  applyFuseSizes()  Sicherungsnennstrom je Plus-Kante
  ↓  applyFuseTypes()  Sicherungs-BAUFORM aus dem Kurzschlussstrom
  ↓  sizeAcEdges()     AC-Querschnitt + AC-Schutzorgan + AC-Sicherung
  ↓  Masse-Kanten auf ≥ 16 mm² · Sicherungskasten-Rating aus der Zuleitung
Placement
  ↓  applyFlowLayout() — NUR selbst erzeugte Knoten (M11-2/R-8)
Result
     { nodes, edges }   (Nutzerknoten bleiben positionsgleich)
```

**Routing ist NICHT Teil von AutoWire.** Die Platzierung (`applyFlowLayout`) verändert nur
Knotenpositionen; die Kabelgeometrie entsteht später im globalen Routing-Pass
(siehe [ROUTING-CONTEXT.md](./ROUTING-CONTEXT.md)).

---

## 7.3 Zieltopologie

```
Batterie+  ──(≤0,2 m, abgesichert)──▶  Plus-Schiene  ──▶ 12V-Sicherungskasten ──▶ Verbraucher
                                            ├──▶ Wechselrichter (eigene Sicherung)
                                            └──▶ Ladequellen (MPPT, Booster, Ladegerät)

Batterie−  ──(≤0,2 m)──▶  Smart Shunt  ──▶  Minus-Schiene ──▶ Rückleiter / Masse
```

Der **Shunt sitzt ausschließlich in der Minus-Leitung.** Plus/Minus-Schienen werden
wiederverwendet, wenn der Plan sie schon enthält (`resolveRails`).

Kantenlängen sind **Planungsannahmen** (Meter, aus `lib/autoWire.ts`):
Backbone 0,2 m · Shunt→Minus-Schiene 0,5 m · Schiene→Sicherungskasten 1 m ·
Verbraucher 3 m · Wechselrichter 1 m · Solar-Zuleitung 5 m · MPPT→Schiene 2 m ·
Lader 3 m · Booster 3 m · AC 2 m · Masse 1 m.

Sie sind bewusst keine Messwerte: sie stecken das Drop-Budget ab, das der Nutzer nach dem
Verlegen mit echten Längen überschreiben kann.

---

## 7.4 Was AutoWire **entscheidet**

| Entscheidung                | Wo                                   | Regel                                                                                            |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Hausbatterie                | `pickHouseBattery`                   | `role='house'` > kein Starter-Label > erste Batterie                                             |
| Systemspannung              | `getSystemVoltage`                   | Aufbaubatterie vor Starterbatterie; `nominalVoltage` > Chemie > Default                          |
| Schienen anlegen            | `resolveRails`                       | `find-or-create` nach Rolle/Label (Plus: `plus`/`positiv`; Minus: `minus`/`negativ`)             |
| Hilfsknoten anlegen         | `findOrCreate`                       | Sicherungskasten, Smart Shunt, MPPT (nur bei Solar)                                              |
| Starterbatterie             | `pickExistingStarter` / `ensureNode` | nur bei vorhandenem Ladebooster; nie „zweite AGM“ bei ≥ 3 Batterien                              |
| MPPT-Nennstrom              | `performAutoWiring`                  | `amps ≥ ceil(Σ Solar-W / U_sys)`                                                                 |
| Parallelschaltung von Akkus | `safeToParallel`                     | **gleiche Nennspannung UND gleiche Chemie-Gruppe** (`chemistriesParallelSafe`)                   |
| Kanten anlegen              | `addDcEdge` / `addAcEdge`            | Duplikat-Schutz über `connectionKey`                                                             |
| Nutzer-Kanten heilen        | `healUserEdges`                      | Shunt-Bypass, Direktverbindungen, falsche Solar-Pfade, verpolte Akku-Paare                       |
| Querschnitt                 | `sizeDcEdges`                        | max(Spannungsfall, thermisch, Nutzerquerschnitt), aufgerundet auf Normreihe; **nie verkleinern** |
| Sicherung                   | `applyFuseSizes`                     | `selectFuseSize` — nie über der Kabelgrenze                                                      |
| Bauform                     | `applyFuseTypes`                     | kleinste Bauform, deren Abschaltvermögen den Bank-Ik am Einbauort trägt                          |
| AC-Schutzorgan              | `sizeAcEdges`                        | Default `{kind:'mcb', characteristic:'B', breakingCapacityKA:6}`; Nutzer-Eintrag bleibt          |
| Masseanbindung              | `performAutoWiring`                  | ≥ 16 mm² auf jeder direkten Minus-Schiene/Shunt ↔ Masse-Kante                                    |
| Domänen-Stempel             | `performAutoWiring`                  | jede Nutzer-Kante erhält `edgeDomain`                                                            |
| Platzierung                 | `applyFlowLayout`                    | nur **selbst erzeugte** Knoten, 16-px-Raster, überlappungsfrei                                   |

---

## 7.5 Was AutoWire **nicht** entscheidet

| Nicht                                                     | Begründung / Ort der Entscheidung                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Kein Kabel-Routing                                        | zentraler Produktionspass (`routePlan`)                                     |
| Kein Verschieben von Nutzerknoten                         | `applyFlowLayout` arbeitet nur auf `autoCreatedNodeIds`                     |
| Kein globales Auto-Layout                                 | bewusst dem „Aufräumen“-Knopf vorbehalten (M11-2/R-8)                       |
| **Kein** automatisches Setzen von `hasRcd`                | ein gesetzter FI würde einen fehlenden FI verschleiern (Stromschlaggefahr)  |
| Kein `fuseOffset`                                         | Nutzerangabe im Leitungs-Inspektor; ohne Wert gilt „Sicherung am Pol“       |
| Keine Batterie-Chemie/-Kapazität für **bestehende** Akkus | nur für selbst angelegte Defaults (100 Ah LiFePO4 / 80 Ah AGM)              |
| Keine Serien-Strings (24 V)                               | nicht modelliert; verpolte Akku-Paare werden **entfernt**, nicht umgedeutet |
| Keine Leerrohr-Zuordnung                                  | `conduit`-Knoten werden vom Nutzer gepflegt                                 |
| Keine Auswahl von Produkten/Marken                        | keine Artikelstammdaten im Modell                                           |
| Kein Überschreiben von Nutzerquerschnitten nach unten     | „nie verkleinern“ ist hart                                                  |

---

## 7.6 Datenwirkungen

**Verändert (auf Kopien bzw. denselben Kantenobjekten):**

| Ziel        | Felder                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `node.data` | `amps` (MPPT), `continuousPower` (WR, aus `watts`), `rating` (Sicherungskasten)                                                     |
| `edge.data` | `length` (nur wenn vorher leer), `crossSection`, `fuseSize`, `fuseType`, `acProtection`, `edgeDomain`, `dropWarning`, `fuseWarning` |
| Knotenmenge | + Sicherungskasten, + Shunt, ggf. + Schienen, + MPPT, + Aufbaubatterie, + Starterbatterie                                           |
| Kantenmenge | + Backbone, + Verbraucher, + WR, + Solar, + Lader, + Booster, + AC, + Masse                                                         |

**Konventionen:**

- Auto-Kanten haben die ID `e-auto-<n>` (`AUTO_EDGE_PREFIX`). Der Store **ersetzt** pro Lauf
  alle Auto-Kanten; Nutzer-Kanten bleiben erhalten (Idempotenz).
- `dropWarning` wird zu Beginn von `sizeDcEdges` **zurückgesetzt** (`false`), weil ein
  geänderter Plan eine Kette wieder lösbar machen kann; `fuseWarning` wird je Kante **neu
  gesetzt** (`true`/`false` in `applyFuseSizes`, `true` in `sizeAcEdges`). Ein Marker darf
  nicht veralten.
- Selbst erzeugte Knoten-IDs sind zufällig (`lib/id.ts`); die Golden-Master-Pipeline
  normalisiert sie zu `auto:<index>:<slug>`, damit Diffs stabil sind.

---

## 7.7 Fehler- und Grenzfälle

| Fall                                          | Verhalten                                                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kein Akku                                     | `return null` (Store zeigt Hinweis)                                                                                                              |
| Nur Starterbatterie + Booster                 | es wird eine Aufbaubatterie (100 Ah LiFePO4) angelegt                                                                                            |
| Booster ohne Starterbatterie                  | es wird eine Starterbatterie (80 Ah AGM) angelegt                                                                                                |
| Zusätzliche Akkus                             | nur bei gleicher Spannung **und** parallelsicherer Chemie auf die Schienen; sonst **nicht** verbunden (kein 24-V-auf-12-V, kein AGM-auf-LiFePO4) |
| Nutzer-Kante verpolt (Akku × Akku plus↔minus) | wird **entfernt** (sonst Kurzschluss über die gemeinsamen Schienen)                                                                              |
| Solar direkt auf Batterie/Verbraucher         | wird **entfernt**                                                                                                                                |
| Shunt-Bypass                                  | Kante wird auf Shunt/Minus-Schiene **umgehängt** oder entfernt                                                                                   |
| Nutzer-Querschnitt > 70 mm²                   | unverändert gelassen, Sicherung auf 70-mm²-Höchstwert, `fuseWarning`                                                                             |
| Kette reißt 3-%-Budget trotz 70 mm²           | `dropWarning = true` auf dem Pfad (**sichtbar**, nicht still)                                                                                    |
| Länge 0 (Sammelschiene)                       | `crossSectionForDrop` liefert 1,5 mm² (kein `RangeError`)                                                                                        |
| Bank-Ik nicht schätzbar                       | **keine** Bauform gestempelt („ehrlich schweigen“ statt raten)                                                                                   |

---

## 7.8 Tests

| Datei                                                              | Absicherung                                                                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/autoWire.test.ts` (1424)                                      | Topologie, Heilung, Idempotenz, Solar, AC, Crash-Regression (95/0/NaN/3 mm²)                                                                        |
| `lib/vde-properties.test.ts`                                       | **G5** Idempotenz (2. und 3. Lauf identisch) · **G6** AC/DC-Trennung, Domänen-Stempel, „jede Kante dimensioniert“ · **G7** `sizeDcEdges`-Konvergenz |
| `lib/autoWire/sizing.test.ts`                                      | Querschnitt, Sicherung, Spannungsfall-Budgets, Solar-Sonderfaktoren                                                                                 |
| `lib/autoWire/placement.test.ts`                                   | Raster, Flussrichtung, Überlappungsfreiheit                                                                                                         |
| `store/usePlannerStore.test.ts`, `usePlannerStoreExtended.test.ts` | Store-Integration, Historie, Nutzerkanten-Erhalt                                                                                                    |
| `scripts/goldenmaster/goldenMaster.test.ts`                        | AutoWire-Ergebnis aller sechs Referenzpläne eingefroren                                                                                             |
| `scripts/routing/finalValidation.test.ts`                          | Routing-Invarianten auf dem **auto-verdrahteten** Plan                                                                                              |

**Bei einer AutoWire-Änderung ist der Golden Master der Maßstab.** Er schlägt fehl bei
Topologie-, Sizing- oder Routing-Änderung. Zulässige Ausgänge: Fix (Regression) **oder**
bewusste Verbesserung mit `npm run goldenmaster:capture` + Begründung im PR + Ledger-Eintrag
(`docs/ARCHITECTURE-CHANGES.md`).
