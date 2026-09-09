# Beispiel: dichtes Routing (Fan-Out, enger Raum, viele Kanten)

Drei Dichte-Fälle mit ihren Erwartungswerten. Alle Angaben verifiziert am 2026-09-09.

---

## Fall A — Port-Fan-Out (`p03-busbar-fanout`)

**Input:** eine Sammelschiene, mehrere Verbraucher an **derselben Bauteilseite**.

**Erwartetes Routing-Verhalten:**

- Alle Kanten derselben **(Bauteil, Seite)**-Gruppe verlassen den Port als Bündel
  (`portFanOutLanes`, Gruppenschlüssel `${nodeId}|${position}`).
- `assignFanOut` sortiert nach dem **Quer-Versatz des Gegenübers** und vergibt Lanes
  `…, −2, −1, 0, +1, +2, …` mit `laneIndex × laneGrid` (= ±16 px je Stufe).
- Der Stub wird um `|lane|` px gestaffelt und um `lane` px seitlich versetzt.
- **Erlaubt** ist genau der gemeinsame Abschnitt **innerhalb der Stubs beider Kanten**
  (Port-Bündel-Ausnahme zu I2). Danach müssen sich die Trassen trennen.

**Erwartete Validierung:** I2 = 0 (die Bündel-Ausnahme greift), I5 = 0 (Stub ≥ 24 px),
I6 = 0 (Segmente ≥ 16 px).

**Relevante Tests:** `scripts/regression/regression.test.ts` → `p03`;
`lib/routing/rules/portFanOut.test.ts`; `components/edges/utils/routeAll.test.ts`.

---

## Fall B — enger Raum (`p08-enger-raum`)

**Input:** Batterie → Verbraucher, dazwischen zwei Blöcke (`fuse`) mit schmaler Gasse.

**Erwartetes Routing-Verhalten:**

- Hindernisse werden um `OBSTACLE_MARGIN = 14 px` aufgebläht; gesucht wird auf dem Hanan-Grid
  der aufgeblähten Boxen.
- Ist die Gasse breiter als `2 × 14 px + cableClearance`, läuft die Leitung hindurch
  (`usedSearch: 'astar'`, wenn der Katalog nicht frei ist).
- Ist sie schmaler, weicht die Route darüber/darunter aus — **kein** Durchbruch durch ein
  Bauteil (I1 ist hart).

**Erwartete Validierung:** I1 = 0, I3 = 0, kein `fallback`
(der Notfallpfad würde `fallbackHitsObstacles` setzen und im Audit auftauchen).

**Relevante Tests:** `scripts/regression/regression.test.ts` → `p08`;
`components/edges/utils/pathfinding.test.ts` (Labyrinth-Szenen);
`components/edges/utils/hananGridMasks.test.ts` (Äquivalenz zur alten Schleife).

---

## Fall C — dichter Gesamtplan (`complex`, 23 Kanten)

**Input:** `TEMPLATE_AUTARK` nach AutoWire.

**Erwartetes Routing-Verhalten** (`npm run routing:audit`):

| Kennzahl                     | Wert                    |
| ---------------------------- | ----------------------- |
| I1–I7                        | 0                       |
| Fallback                     | 0                       |
| Deterministisch              | true                    |
| Kreuzungen (Segment-Paare)   | 29                      |
| `usedSearch`                 | 5 × catalog, 18 × astar |
| Gesamtlänge / Bends          | 10 908,8 px / 60        |
| Kanten mit `tightMarginUsed` | 0                       |

**Erwartete Validierung:** `validateFinalRouting` → `INVALID` ist hier **nicht** erwartet
(0 Verletzungen), d. h. `VALID`.

**Bekannte Grenze:** bei N=120/E=585 liegt die Laufzeit über dem Frame-Budget
([PERF-001](../KNOWN-PROBLEMS.md#perf-001--große-pläne-überschreiten-das-frame-budget)).
Der Live-Betrieb wird durch die 100-ms-Drossel abgefedert.

---

## Fall D — parallele Trassen (`p10-parallele-trassen`)

Mehrere Kanten auf demselben Korridor.

**Erwartetes Routing-Verhalten:**

- Bereits verlegte Kanten werden als **Tubes** gesperrt (halbe Breite = `cableClearance`),
  damit die nächste Kante denselben Korridor nicht doppelt belegt (ROUTE-BUG-16).
- Bleibt danach nur der Notfallpfad, wird **ohne** Tubes neu gesucht (Rangfolge der Garantien:
  I3 schlägt I2).
- `nudgeOrthogonalPaths` löst verbleibende Überlappungen mit Schrittweite `laneGrid` (16 px)
  auf — nur, wenn die Variante nicht schlechter ist (`routeDefectScore`).
- `mergeCloseBends` entfernt danach Mini-Stufen.

**Erwartete Validierung:** I2 = 0, I3 = 0, I7 = 0.

**Relevante Tests:** `scripts/regression/regression.test.ts` → `p10`;
`components/edges/utils/nudge.test.ts`; `components/edges/utils/routeAll.test.ts`.

---

## Anti-Erwartungen (häufige Fehlannahmen)

| Annahme                                          | Richtigstellung                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| „Kreuzungen werden vermieden.“                   | Nein — minimiert über Kosten (120), nicht verboten.                                                                                              |
| „Zwei Kanten dürfen nie auf einer Linie liegen.“ | Doch, innerhalb der **Port-Stubs** (Bündel-Ausnahme).                                                                                            |
| „Der Router findet das Optimum.“                 | Nein — er garantiert Korrektheit (I1–I7), nicht Optimalität.                                                                                     |
| „Ich kann Lanes über `LaneRegistry` steuern.“    | Heute nicht — sie ist nicht angebunden ([ROUTE-001](../KNOWN-PROBLEMS.md#route-001--laneregistry-ist-nicht-an-den-produktiv-router-angebunden)). |
| „Ein Fallback ist ein Fehler.“                   | Nicht zwingend, aber er wird **sichtbar** (`fallbackHitsObstacles`) und im Audit gezählt. Aktuell: 0.                                            |
