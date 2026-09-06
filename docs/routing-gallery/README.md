# Routing-Galerie

Automatisch erzeugt von `npm run routing:gallery` aus
`components/edges/utils/routingScenarios.ts`. **Nicht von Hand bearbeiten.**

Jedes SVG zeigt eine Szene: dunkle Kästen sind Hindernisse (Bauteile),
gestrichelte Linien sind fremde Leitungen, die hellblaue Linie ist die
gerechnete Route. Grün = Start, Orange = Ziel.

`gallery.json` ist die Referenz für den Regressionstest
`components/edges/utils/routingGallery.test.ts`. Ändert sich ein Pfad,
schlägt der Test fehl. Die Galerie darf nur neu erzeugt werden, wenn die
Änderung im Pull Request begründet ist (AGENTS.md K3).

## Nutzerpläne

Zusätzlich zu den 25 konstruierten Szenarien zeigt
`nutzerplan-autowire.svg` einen realen Nutzerplan (Batterie, Solar,
zwei Verbraucher) nach Auto-Verdrahtung (R-8) und Routing (R-5/R-7/
R-10): 13 Kabel, Gesamtlänge 5771 px, 0 Clearance-Verstöße (Ziel: 0 bei 12 px).
Er ist die „nachher“-Referenz für die Vorher/Nachher-Betrachtung des
R-Blocks; die „vorher“-Zahlen stehen in `docs/ROUTING-INVARIANTS.md`
(Abschnitt Qualität & Messung).

| ID | Szenario | Wegpunkte | Länge | Manhattan | Hindernisfrei |
|----|----------|-----------|-------|-----------|---------------|
| `01-direct-right-left` | Gerade Strecke Rechts → Links | 2 | 400 | 400 | ja |
| `02-vertical-offset` | Versatz in der Höhe | 4 | 660 | 660 | ja |
| `03-backwards-loop` | Ziel liegt hinter der Quelle | 3 | 400 | 400 | ja |
| `04-diagonal-source-target` | Diagonale Quelle/Ziel | 3 | 700 | 700 | ja |
| `05-vertical-stack` | Senkrechter Stapel | 2 | 400 | 400 | ja |
| `06-single-obstacle` | Ein Hindernis in der Bahn | 6 | 748 | 600 | ja |
| `07-two-obstacles` | Zwei Hindernisse hintereinander | 10 | 1196 | 900 | ja |
| `08-obstacle-above` | Hindernis oberhalb der Ideallinie | 6 | 728 | 600 | ja |
| `09-labyrinth-3-rows` | Labyrinth aus drei versetzten Reihen | 14 | 1324 | 1000 | ja |
| `10-labyrinth-vertical-gap` | Labyrinth mit engem Durchlass | 2 | 700 | 700 | ja |
| `11-parallel-lane-0` | Parallele Kabel — Lane 0 | 4 | 620 | 620 | ja |
| `12-parallel-lane-plus-16` | Parallele Kabel — Lane +16 px | 4 | 620 | 620 | ja |
| `13-parallel-lane-minus-16` | Parallele Kabel — Lane −16 px | 4 | 620 | 620 | ja |
| `14-crossing-avoidance` | Ausweichen bei vielen Kreuzungen | 2 | 600 | 600 | ja |
| `15-crossing-dense-grid` | Dichtes Kreuzungsgitter | 4 | 840 | 840 | ja |
| `16-target-top-entry` | Eintritt von oben | 3 | 700 | 700 | ja |
| `17-target-bottom-entry-with-obstacle` | Eintritt von unten mit Hindernis | 7 | 1012 | 800 | ja |
| `18-same-point` | Quelle und Ziel am selben Punkt | 1 | 0 | 0 | ja |
| `19-very-short-hop` | Sehr kurze Verbindung | 2 | 24 | 24 | ja |
| `20-enclosed-target` | Umschlossenes Ziel | 2 | 500 | 500 | nein — Ziel liegt innerhalb der Hindernis-Box; ein kollisionsfreier Pfad ist geometrisch unmöglich. |
| `21-source-enclosed` | Umschlossene Quelle | 2 | 500 | 500 | nein — Quelle liegt innerhalb der Hindernis-Box; der Austritt kreuzt sie zwangsläufig. |
| `22-stress-scene` | Stressszene: 12 Hindernisse, 12 Fremdleitungen | 8 | 2000 | 1700 | ja |
| `23-obstacle-touching-source` | Hindernis direkt an der Quelle | 6 | 748 | 600 | ja |
| `24-long-haul` | Lange Strecke quer durch den Plan | 4 | 3000 | 3000 | ja |
| `25-bottom-to-top` | Von unten nach oben mit Gegenrichtung | 3 | 400 | 400 | ja |
