# Routing-Invarianten

Stand: 2026-08-21 · Betrifft AGENTS.md **K3**
Quelle: `components/edges/utils/orthogonalRouting.ts`

## 1. Vertrag

`buildOrthogonalPath(input)` ist eine **reine, deterministische** Funktion.
Sie bekommt zwei orientierte Anschlusspunkte, optional Hindernis-Rechtecke,
optional die genäherten Verläufe fremder Leitungen — und liefert einen
SVG-Pfad, den Label-Ankerpunkt und die Zahl der Kreuzungen.

Seit K3 ist die Geometrie von der Formatierung getrennt:

| Funktion              | Aufgabe                                                  |
| --------------------- | -------------------------------------------------------- |
| `routeWaypoints`      | Basisroute aus Richtung und Lage (Z-Weg, Schlaufe, Ecke) |
| `avoidObstacles`      | Umfahren von Bauteil-Boxen                               |
| `orthogonalWaypoints` | Routenwahl inkl. Ausweich-Lanes → **Wegpunkte**          |
| `buildOrthogonalPath` | Wegpunkte → SVG-Pfad mit runden Ecken                    |

Dadurch prüfen die Tests die Geometrie direkt statt einen SVG-String zu parsen.

## 2. Die sieben Invarianten

| ID     | Invariante                                                                                                                                                                                                                        | Geprüft in                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **R1** | Der Pfad beginnt **immer exakt** am Quell-Anschlusspunkt und endet immer exakt am Ziel-Anschlusspunkt. Ein Lane-Offset _o_ versetzt den Zwischenkorridor (Bündelung als Trasse), ohne die Enden vom Bauteil-Anschluss zu trennen. | 25 Szenarien + 1.000 Zufallsfälle        |
| **R2** | Jedes Segment ist achsenparallel — keine Diagonalen.                                                                                                                                                                              | 25 Szenarien + 1.000 Zufallsfälle        |
| **R3** | Kein Segment schneidet eine Hindernis-Box. Ausnahme nur, wenn Quelle oder Ziel **innerhalb** der Box liegt (Fälle 20/21) — dann ist ein kollisionsfreier Pfad geometrisch unmöglich.                                              | 25 Szenarien + gezielte Zufallsgeometrie |
| **R4** | Pfadlänge ≤ `maxDetourRatio` × Manhattan-Distanz. Der Faktor steht pro Szenario in `routingScenarios.ts`, typisch 1.05 (gerade Strecke) bis 4 (Stressszene).                                                                      | 25 Szenarien                             |
| **R5** | Determinismus: gleiche Eingabe ⇒ byte-gleicher Pfad.                                                                                                                                                                              | 25 Szenarien + 1.000 Zufallsfälle        |
| **R6** | Reinheit: die Eingabe wird nicht verändert (Prüfung mit `Object.freeze` + JSON-Vergleich).                                                                                                                                        | 25 Szenarien + 1.000 Zufallsfälle        |
| **R7** | Terminierung: 1 bis 64 Wegpunkte, alle endlich. Ein einzelner Wegpunkt entsteht nur, wenn Quelle und Ziel exakt aufeinanderliegen — dann gibt es nichts zu zeichnen (`path === ''`).                                              | 25 Szenarien + 1.000 Zufallsfälle        |

Zusätzlich: der erzeugte SVG-Pfad beginnt mit `M` auf dem ersten und endet auf
dem letzten Wegpunkt, und enthält nie `NaN` oder `Infinity`.

## 3. Zwei behobene Routing-Fehler

Beide wurden erst durch die Invarianten sichtbar — die vorhandenen Beispieltests
liefen grün.

### 3.1 Zickzack-Schleife bei einem Hindernis auf der Ideallinie

**Symptom.** Ein einzelnes Bauteil zwischen Quelle und Ziel führte zu einem
Pfad aus **51 Wegpunkten**, der zwölfmal um dieselbe Box kreiste — und am Ende
trotzdem mitten durch das Bauteil lief.

```
Quelle (0,0) → Ziel (600,0), Hindernis (220,-60,192×120)

vorher:  0,0 → 206,0 → 206,74 → 426,74 → 426,0 → 206,0 → 206,74 → … (12×) → 600,0
nachher: 0,0 → 206,0 → 206,74 → 426,74 → 426,0 → 600,0
```

**Ursache.** Der Detour endet an der _Außenkante_ der aufgeblähten Box
(x = 426). Der nächste Original-Wegpunkt lag bei x = 300 — also **hinter** dem
Detour-Ende. Der Pfad lief zurück in das gerade umfahrene Hindernis, was im
nächsten Durchlauf einen neuen Detour auslöste. Zwölf Iterationen später gab
die Schleife auf.

**Fix.** Wegpunkte, die der Detour bereits überholt hat, werden verworfen
(`isBehind`). Der Zielpunkt wird dabei nie verworfen.

### 3.2 Verlorener Zielpunkt

**Symptom.** Nach dem Fix aus 3.1 endete der Pfad an der Hinderniskante statt
am Ziel.

**Ursache.** Ein latenter Fehler in `avoidObstacles`: die Segmentschleife
übernahm pro Durchlauf nur die Segment-_Anfänge_. Den Schlusspunkt hängte
allein der Detour-Zweig an. Endete ein Durchlauf ohne Detour, fehlte der
Zielpunkt. Vorher war der Fehler unsichtbar, weil die Endlosschleife aus 3.1
immer im Detour-Zweig endete.

**Fix.** Ein Durchlauf ohne Detour hängt den Schlusspunkt explizit an.

### 3.3 Folgefehler: Diagonalen

Das Verwerfen überholter Wegpunkte kann zwei Punkte nebeneinander bringen, die
weder x noch y teilen. `enforceOrthogonal` fügt dort einen deterministischen
Ellbogen ein (erst waagerecht, dann senkrecht). Gefunden durch R2 in der
Stressszene und durch einen fast-check-Fall mit Quelle = Ziel und Lane −32.

## 4. Die Galerie

`docs/routing-gallery/` enthält 25 Szenarien als SVG plus `gallery.json`:

| Gruppe          | Szenarien                                                                      |
| --------------- | ------------------------------------------------------------------------------ |
| Grundfälle      | 01 gerade, 02 Höhenversatz, 05 senkrecht, 19 sehr kurz, 18 Quelle = Ziel       |
| Richtungen      | 03 Ziel hinter Quelle, 04 diagonal, 16 Eintritt oben, 25 unten→oben            |
| Hindernisse     | 06 eines, 07 zwei, 08 oberhalb, 23 direkt an der Quelle, 17 mit Eintritt unten |
| Labyrinth       | 09 drei versetzte Reihen, 10 enger Durchlass                                   |
| Parallele Kabel | 11 Lane 0, 12 Lane +16, 13 Lane −16                                            |
| Kreuzungen      | 14 fünf Fremdleitungen, 15 dichtes Gitter                                      |
| Ausnahmen       | 20 umschlossenes Ziel, 21 umschlossene Quelle                                  |
| Last            | 22 Stressszene (12 Hindernisse + 12 Fremdleitungen), 24 lange Strecke          |

**Regressionsschutz.** `routingGallery.test.ts` rechnet jedes Szenario neu und
vergleicht Wegpunkte, Pfad-String, Kreuzungszahl und Label-Position mit
`gallery.json`. Eine gewollte Routing-Änderung erfordert:

```bash
npm run routing:gallery     # JSON + SVGs neu erzeugen
git diff docs/routing-gallery/   # Diff im PR begründen
```

Ohne diese Schritte schlägt der Test fehl und nennt das betroffene Szenario.

## 5. Bekannte Grenzen

- **Zwei Routing-Ebenen.** `buildOrthogonalPath`/`orthogonalWaypoints` bleiben ein
  iteratives Ausweichverfahren (12 Durchläufe, kein A*). Für automatisch
  verdrahtete Kabel (R-5+) liegt darüber `routeAllCables` mit A*-Wegfindung
  (`findCablePath`), Glow-Fallback und Retry — siehe Abschnitt 6. Ein
  „Optimum“ garantiert keine der beiden Ebenen; die Invarianten garantieren
  Korrektheit (orthogonal, kollisionsfrei, begrenzt).
- **Fremdleitungen sind genähert.** Die Kreuzungszählung nutzt
  Mittelpunkt-zu-Mittelpunkt-Strecken, weil eine Kante die exakten
  Handle-Koordinaten fremder Kanten nicht kennt (React-Flow-Architektur).
- **Kein Pixel-Vergleich in der Geometrie-Galerie.** Die visuelle Regression
  vergleicht Geometrie (Wegpunkte, Pfad-String), nicht gerenderte Bilder.
  Gerenderte Seiten (inkl. Planner unter `/elektrik-planung/`) deckt das
  Pixel-Gate aus D-9 (`tests/e2e/visual.spec.ts`, 375/768/1440 px) ab.
- **`maxDetourRatio` ist pro Szenario gesetzt**, nicht global hergeleitet. Die
  Werte stammen aus den tatsächlichen Ergebnissen mit Sicherheitsaufschlag und
  sind damit eine Regressionsbremse, keine bewiesene Schranke.

## 6. Qualität & Messung (R-Block)

Die Routing-Qualität wird seit R-1 **gemessen**, nicht gefühlt
(`components/edges/utils/routingQuality.ts`, Dashboard via
`buildRoutingQualityReport`):

| Metrik           | Ziel                                                     |
| ---------------- | -------------------------------------------------------- |
| Kabellänge       | ≤ 1,3 × Manhattan-Optimum (mehr nur mit Hindernis-Grund) |
| Richtungswechsel | ≤ 2 Bends ohne Grund; U-Turns: 0                         |
| Clearance        | ≥ 12 px Abstand zu fremden Nodes inkl. Label-Fläche      |

**Stand nach R-10** (`npx vitest run components/edges/utils/routingQuality.test.ts`,
Tabelle via `formatQualityTable`): worstRatio 1,33 (Szenario 07), sumUTurns 1
(22), sumClearanceHits 4 — ausschließlich in 20/21/22, wo Quelle bzw. Ziel
geometrisch in oder an Hindernissen liegen (dokumentierte Ausnahmen, siehe
Invariante R3). Gegenüber der R-1-Baseline (identische Werte) ist keine
Verschlechterung eingetreten; der reale Auto-Wire-Nutzerplan in
`docs/routing-gallery/nutzerplan-autowire.svg` hat **0** Clearance-Verstöße.

**Clearance-Modell seit R-10 (Zwei-Raum-Suche).** `findCablePath` inflatiert
Hindernisse um `OBSTACLE_MARGIN = 14` px (≥ Clearance-Ziel 12). Handles
(inkl. überstehender Anschlusspunkte) zählen zur Node-Box. Ein enger
Ausnahme-Raum existiert nur für **Stub-Blocker**: Sitzt das Ziel-Bauteil so
nah am Handle, dass Stub-Punkt plus Ziel-Freigabe die 12-px-Zone schneiden,
darf die A*-Suche dort auf 2 px Restabstand deflationieren (`deepSet`); die
Akzeptanz bleibt gestuft — 12-px-Pfad vorzugsweise, sonst nur, wenn
ausschließlich Stub-Segmente im deep-Band liegen, sonst Fallback. Damit ist
die dokumentierte Ausnahme eng: **2 px nur an an Handle geklebten Bauteilen,
nirgendwo sonst auf der Route.**

**Fallback-Semantik (bewusster Trade-off).** Der Notfall-Fallback
(vollständig verbaute Szene) garantiert **keine** Clearance — er preferiert
Erreichbarkeit über Abstand und ist als Ausnahme im Test markiert
(R-3-Abweichung). Im Referenzplan und allen Regressions-Szenarien wird er
nicht gebraucht (Fallback-Quote 0).

**Layout-Kopplung.** Clearance ≥ 12 px ist nur haltbar, wenn Zeilenabstände
zwei Kabel passen lassen: `FLOW_ROW_SPACING = 192` (72-px-Korridor) statt
zuvor 160 (40 px — unterhalb von zwei Kabeln à 12 px plus Stub).
