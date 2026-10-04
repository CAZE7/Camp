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

## Gesperrte Routen

`isRouteLocked(edge)` (nur `data.locked === true`) nimmt eine Kante aus der Neuberechnung:
Ihre Wegpunkte bleiben, der Router weicht ihr aus. Gesetzt wird das im Inspector
(„Fixiert"). `user` allein sperrt die Route **nicht** — Topologie und Kabelweg sind zwei
verschiedene Zusagen.

## Skalierung (gemessen 2026-10-04, `tests/scale/plannerScale.test.ts`)

| Knoten | Auto-Wire + Routing | Invariantenprüfung |
| ------ | ------------------- | ------------------ |
| 10     | 0,3 s               | 0,07 s             |
| 25     | 1,6 s               | 1,3 s              |
| 50     | 6,0 s               | 4,5 s              |
| 100    | 12,3 s              | 7,5 s              |
| 250    | 62,4 s              | 65,7 s             |

Das ist **kein Erfolg, sondern ein Befund**: Der Aufwand wächst deutlich überlinear
(`validateFinalRouting` ist O(E²) über Kantenpaare, die Wegsuche arbeitet gegen alle
Fremdsegmente). Für die realistische Plangröße (< 60 Bauteile) ist es tragbar, für 250
nicht interaktiv. Die beiden teuren 250er-Fälle laufen deshalb nur mit `SCALE_250=1`;
alle Determinismus- und Konvergenzzusagen werden auch bei 250 Knoten in jedem Lauf
geprüft.

Live-Pfad-Benchmark (`npm run perf:edge-routing`, N=36/E=134) auf dieser Maschine:
Median **310–330 ms** gegen einen Ratchet von 60 ms — **vor und nach** der V2-Arbeit
gleich (Basis-Commit gemessen: 303/330 ms). Der Ratchet stammt von schnellerer Hardware;
die Überschreitung ist vorbestehend und nicht durch V2 verursacht.

## Was hier verboten ist

1. Keine Abstandszahl außerhalb `lib/routing/tokens.ts`.
2. Keine zweite Kollisionsdefinition — alles über `rules/collision.ts`.
3. Kein `setTimeout`, keine Wiederholung-bis-es-klappt, kein Aufweichen von Toleranzen.
4. Kein Schreiben an Kantendaten.
5. Kein React/DOM in `lib/routing/**`.
