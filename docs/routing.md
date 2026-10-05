# Routing (`lib/routing/`, `components/edges/utils/`)

> Stand: 2026-10-04 · Paketvertrag: [`lib/routing/README.md`](../lib/routing/README.md)
> · Spezifikation: [`docs/ROUTING-V2.md`](./ROUTING-V2.md)
> · Invarianten: [`docs/ROUTING-INVARIANTS.md`](./ROUTING-INVARIANTS.md)

## Die Grenze, die alles trägt

> **Routing liest Topologie und Geometrie. Es schreibt nur Wegpunkte.**

Kein Querschnitt, keine Sicherung, keine Domäne, keine Länge (ADR 0008/0014). Ein Router,
der Daten anfasst, macht aus einem Darstellungsproblem ein Elektrikproblem.

## Pipeline

```
Positionen + Boxmaße            (Layout-Schicht, ELK/dagre/Nutzer)
        │
        ▼
routableNodes.ts   Was ist Hindernis? (Darstellungsknoten sind es NICHT, ADR 0022)
        │
        ▼
routeAll.ts        Reihenfolge nach routingPriority → pathfinding.ts je Kante
        │          (Hanan-Gitter, A*, Lane-Vergabe, Hopping)
        ▼
finalValidation.ts I1…I7 — binäres Gate, keine Toleranzschraube
        │
        ▼
cableRouteStore.ts Veröffentlichung an die UI (Throttle 100 ms) + Generation
```

## Determinismus

- **Kein `Math.random()`** in `lib/routing/**` (ESLint-Verbot, kein Review-Versprechen).
- Jede Iteration läuft über nach ID sortierte Listen; Gleichstände werden über stabile
  Schlüssel entschieden, nie über Einfügereihenfolge.
- Gleiche Eingabe ⇒ byte-gleiche Wegpunkte (`serializeRoutes`, Golden Master).
- Verschiebt man den **ganzen** Plan, verschieben sich die Routen mit (Shift-Matrix in
  `scripts/routing/audit.ts`).

## Generation und Konvergenz (`lib/routing/generation.ts`)

Das Problem: Layout → Messung → Routing → Layout kann im Kreis laufen. Jede Runde sieht
für sich plausibel aus; zusammen flackert der Plan.

```ts
const hash = routingInputHash(nodeSignature, edgeSignature); // FNV-1a, 8 Zeichen
const status = tracker.begin(hash);
if (!status.allowed) return; // bestehende Routen bleiben stehen
```

- **Eingabe-Hash** aus Knoten- und Kantensignatur, getrennt durch `\n#\n` — damit
  `('ab','c')` und `('a','bc')` verschiedene Hashes haben.
- **Neuer Hash** ⇒ neue Generation, Revision 1. **Gleicher Hash** ⇒ Revision + 1.
- `MAX_ROUTE_REVISIONS_PER_GRAPH = 4`: Revision 1 ist der Normallauf, 2 und 3 decken
  Vor-/Nach-Messung und einen Layout-Effekt ab, ab 5 liegt eine Schleife vor.
- Die Sperre ist **ein Zähler, kein Timer** (AGENTS §5 verbietet `setTimeout`-Umgehungen).
  Sie ist klebrig pro Hash: Nur eine echte Eingabeänderung hebt sie auf. Ein Nutzer-Drag
  erzeugt immer einen neuen Hash und kann deshalb nie blockiert werden.
- `A → B → A` ist kein Abbruch: Jede Rückkehr zu A ist eine neue Revision von A, erst die
  fünfte stoppt.

`components/edges/utils/routingDebug.ts` erkennt zusätzlich Periode-2-Zyklen — rein
diagnostisch, ohne Eingriff.

## Invarianten (Final-Gate)

| ID  | Bedeutung                             | Ziel |
| --- | ------------------------------------- | ---- |
| I1  | Kante ↔ Knoten-Kollision              | 0    |
| I2  | Kante ↔ Kante-Überlappung (kollinear) | 0    |
| I3  | Mindestabstand (Clearance)            | 0    |
| I4  | U-Turn am Handle                      | 0    |
| I5  | Stub-Länge am Port                    | 0    |
| I6  | Mindest-Segmentlänge                  | 0    |
| I7  | Treppenmuster                         | 0    |

Kreuzungen sind **erlaubt**, Überlappungen nicht (ADR 0009): Zwei sich kreuzende Kabel
sind lesbar, zwei deckungsgleiche nicht.

Messung `npx tsx scripts/routing/audit.ts` (2026-10-04, unverändert zur Baseline):

| Plan     | Kanten | I1  | I2  | I3  | I4–I7 | Fallback | Kreuzungen | Kabelweg |
| -------- | ------ | --- | --- | --- | ----- | -------- | ---------- | -------- |
| simple   | 9      | 0   | 0   | 0   | 0     | 0        | 1          | 2665 px  |
| camper   | 12     | 0   | 0   | 0   | 0     | 0        | 4          | 3677 px  |
| solar    | 11     | 0   | 0   | 0   | 0     | 0        | 2          | 3200 px  |
| inverter | 10     | 0   | 0   | 0   | 0     | 0        | 2          | 3710 px  |
| acdc     | 14     | 0   | 0   | 0   | 0     | 0        | 6          | 5646 px  |
| complex  | 23     | 0   | 0   | 0   | 0     | 0        | 25         | 8646 px  |

> Historische Prosa „I3 = 41" in `lib/routing/finalValidation.ts`,
> `scripts/routing/finalValidation.test.ts` und älteren Audit-Texten beschreibt einen
> Zustand **vor** dem Ratchet-Abbau. Der Ratchet steht heute auf 0 und ist kein Qualitätsziel,
> sondern eine Rückfallsperre.

## Trunk / Backbone

`components/planner/utils/backbone.ts` bündelt Batterie → Sicherungskasten → Verteilung
zu einer Haupttrasse; die Anzeige schaltet `trunkMode` / `backboneGrouping`. Die Trasse ist
eine **Darstellungs- und Kostenentscheidung**, keine zusätzliche elektrische Verbindung.

## Gesperrte Routen — produktiver Vertrag

`user` allein sperrt die Route **nicht**: Topologie und Kabelweg sind zwei verschiedene
Zusagen. Beim expliziten Fixieren speichert der Inspector den aktuell veröffentlichten Weg
als `data.lockedWaypoints`; ohne gültigen Snapshot wird die Sperre abgelehnt und eine
strukturierte Warnung erzeugt.

Im Produktivrouter (`components/edges/utils/routeAll.ts`) bedeutet `data.locked === true`
oder `data.intent === 'locked'`:

1. Die unveränderliche Snapshot-Geometrie wird vor freien Routen verarbeitet und in der
   aktuellen Routing-Generation exakt übernommen.
2. Der gesperrte Weg wird nicht mit A*, Fallback, Hop, Nudge, Bend-Merge oder
   Clearance-Separation verändert. Freie Trassen weichen den gespeicherten Segmenten aus.
3. Der Snapshot ist Teil der Routing-Signatur; ein echter Lock-/Geometriewechsel erzeugt
   eine neue Generation.
4. Unterstützte Store-Mutationspfade blockieren Löschen, Ersetzen, Umhängen und das
   Verschieben von Endpunkten, solange die Leitung fixiert ist. Explizites Entsperren ist
   der Weg, solche Änderungen vorzunehmen. Undo/Redo lassen höchstens die Sperre selbst
   wechseln, nicht zugleich Topologie oder Endpunktposition.

Die unveränderte Trasse wird **nicht repariert**, wenn sie mit einem Bauteil, einer anderen
Leitung oder dem Mindestabstand kollidiert. Die finale Validierung meldet Snapshot-,
Endpunkt- und I1/I2/I3-Konflikte strukturiert und klickbar im `WarningCenter`; ein
blockierter Mutationsversuch kommt ergänzend aus einem separaten flüchtigen Store-Befund.
Beim expliziten Entsperren werden zugehörige Mutationswarnungen entfernt. Alte Locks ohne
Snapshot erhalten eine „nicht verifizierbar"-Warnung; eine historische Trasse wird nicht
erfunden.

Die Absicht wird zentral über `isRouteLocked(edge)` aus
`lib/electricalGraph/intent.ts` bestimmt. Siehe auch den produktiven Vertrag in
[`ROUTING-V2.md`](./ROUTING-V2.md) §8.

## Skalierung und Performance (Messung 2026-10-05)

Der gezielte 250-Knoten-Lauf (`SCALE_250=1 npx vitest run tests/scale/plannerScale.test.ts`)
bestand **25/25** Tests. Der 250-Knoten-I1/I2/I3-Routingtest dauerte 54,1 s; der volle
Scale-Lauf 71,7 s. Die normale Suite überspringt nur diesen bewusst teuren 250er-Routingtest;
Determinismus, Idempotenz, Intent und Generation werden weiterhin geprüft. Das ist korrekt,
aber nicht interaktiv.

Die separate Routing-only-Probe (`npm run perf:route-scaling`, je drei Messläufe) ergab:

| Form / Größe        | Knoten | Kanten |     Median |            Min–Max | Fallbacks |
| ------------------- | -----: | -----: | ---------: | -----------------: | --------: |
| Kette               |     10 |      9 |     1,5 ms |         0,7–2,7 ms |         0 |
| Kette               |     50 |     49 |    15,4 ms |       14,5–20,4 ms |         0 |
| Kette               |    100 |     99 |    15,6 ms |       15,4–18,8 ms |         0 |
| Kette               |    250 |    249 |    48,3 ms |       46,3–54,6 ms |         0 |
| Kette               |    500 |    499 |   178,2 ms |     175,1–180,5 ms |         0 |
| Spannkanten (Worst) |    100 |     50 |   239,6 ms |     234,1–254,0 ms |         0 |
| Spannkanten (Worst) |    250 |    125 | 2.244,4 ms | 2.166,8–2.301,0 ms |         0 |
| Spannkanten (Worst) |    500 |    250 | 5.568,6 ms | 5.405,8–5.606,3 ms |         0 |

Das ist nur Routing, keine Ende-zu-Ende-Aussage über Auto-Wire oder vollständige
Validierung bei 500 Knoten. Die planweite Worst-Case-Spannkante liegt bei 500 Knoten deutlich
über der 100-ms-Drossel; `0` Fallbacks in dieser Probe sind keine Aussage über I1/I2/I3.

`npm run perf:edge-routing` wurde ebenfalls ausgeführt. Der alte Einzelkanten-Renderpfad
bestand sein 16-ms-Gate (N=36/E=134: Median 2,07 ms, p90 2,95 ms). Der produktive
`routeAllCables`-Pfad **verfehlte** jedoch den 60-ms-Ratchet: Median 276,37 ms, p90
297,03 ms; der Befehl endete mit Exit-Code 1. Das bleibt ein offenes Performance-Problem,
kein Grund, die Schwelle anzuheben oder den Gate-Ausfall zu verschweigen. Ein 500-Knoten-
Ende-zu-Ende-Lauf ist hier nicht gemessen.

## Was hier verboten ist

1. Keine Abstandszahl außerhalb `lib/routing/tokens.ts`.
2. Keine zweite Kollisionsdefinition — alles über `rules/collision.ts`.
3. Kein `setTimeout`, keine Wiederholung-bis-es-klappt, kein Aufweichen von Toleranzen.
4. Kein Schreiben an Kantendaten.
5. Kein React/DOM in `lib/routing/**`.
