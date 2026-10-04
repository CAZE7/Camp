# Auto-Wire (`lib/autoWire/`)

> Stand: 2026-10-04 · Paketvertrag: [`lib/autoWire/README.md`](../lib/autoWire/README.md)
> · Einordnung: [`docs/electrical-architecture.md`](./electrical-architecture.md)

## Der Satz, aus dem alles folgt

> **Auto-Wire vervollständigt einen Plan. Es erfindet keinen.**

Daraus ergeben sich drei Regeln, die über jeder Implementierungsfrage stehen:

1. **Was der Nutzer erklärt hat, bleibt.** Gepinnte Kanten (`locked`, `user`, `required`)
   werden nicht umgehängt, nicht ersetzt, nicht gelöscht.
2. **Was mehrdeutig ist, wird gefragt — nicht geraten.** Zwei nicht zugeordnete
   12-V-Hausbatterien sind keine Parallelschaltung, sondern eine offene Frage.
3. **Was einer Regel widerspricht, wird gemeldet.** Ein Konflikt zwischen Nutzerabsicht
   und Regel erscheint als Warnung („Benutzerentscheidung widerspricht Regel X"), nie als
   stille Korrektur.

## Ablauf eines Laufs

`performAutoWiring(nodes, existingEdges?) → { nodes, edges, report } | null`
(`null` genau dann, wenn keine Batterie im Plan ist.)

```
 1 Wörterbücher aufbauen (Knoten/Kanten indizieren)
 2 Hausbatterie bestimmen            pickHouseBattery
 3 DC-DC-Lader / Starterbatterie
 4 Bankmodell + Systemspannung       deriveBatteryBanks → sysVoltage
 5 Schienen auflösen                 resolveRails
 6 Sicherungskasten
 7 Shunt
 8 Laderegler (MPPT)
 9 Nutzerkanten heilen               healUserEdges   ← meldet jede Änderung
10 Backbone (Trunk)
11 Bank-Schleife (Serien-/Parallelverbinder)
12 Verbraucher
13 Wechselrichter
14 Solar
15 Ladegeräte
16 Starter → Booster
17 AC-Block                          buildAcSystem
18 Massebonds
19 IDs vergeben, Nutzerdaten erhalten
20 Sizing (Querschnitt, Sicherung, Bauform)
21 Sicherungskasten-Nennwert
22 Platzierung selbst erzeugter Knoten   applyFlowLayout
```

Die Reihenfolge ist Teil des Vertrags: Sie ist die Ursache dafür, dass das Ergebnis
deterministisch ist. Phasen dürfen nicht vertauscht werden, ohne die Golden Master neu zu
bewerten (`scripts/goldenmaster/`).

## Nutzerkanten: heilen, nicht überfahren

`healUserEdges` fädelt eine unsichere Nutzerkante in die Zieltopologie ein (z. B.
Verbraucher direkt an der Batterie → über Sicherungskasten). Das ist eine **Änderung am
Plan des Nutzers** und wird deshalb immer berichtet:

| Konfliktart                  | Bedeutung                                      |
| ---------------------------- | ---------------------------------------------- |
| `pinned-edge-violates-rule`  | gepinnt, widerspricht Regel → **nur gemeldet** |
| `healed-user-edge`           | Nutzerkante umgehängt                          |
| `dropped-user-edge`          | Nutzerkante entfernt (fachlich unzulässig)     |
| `ambiguous-battery-topology` | Verschaltung unklar → Frage                    |
| `ambiguous-ac-source`        | 230-V-Quelle unklar → Frage                    |
| `load-exceeds-limit`         | Last über BMS-/Bauteilgrenze                   |
| `voltage-mismatch`           | Bauteil passt nicht zur Spannungsebene         |

Regel-IDs: `ELE-001/002`, `AUTO-SHUNT-BYPASS`, `AUTO-FUSE-BYPASS`, `AUTO-RAIL-NORMALISE`,
`ELE-AC-DIRECT`, `AUTO-AC-SOURCE`, `AUTO-BANK-001`, `AUTO-AC-001/002`.

## Der Bericht (`lib/autoWire/conflicts.ts`)

```ts
const collector = createConflictCollector();
collector.add({ kind, severity, ruleId, message, edgeIds, nodeIds });
collector.ask('Zwei 12-V-Batterien: parallel oder seriell?');
const report = collector.report(); // { conflicts, questions }
```

Eigenschaften, die der Bericht garantiert:

- **Deterministisch sortiert** — kritisch vor Warnung vor Hinweis, dann nach Regel-ID,
  Kanten-IDs, Knoten-IDs.
- **Dedupliziert** über `kind | ruleId | Kanten | Knoten`. Dieselbe Regel an derselben
  Kante ist ein Befund, auch wenn zwei Phasen sie melden.
- **Die stärkere Aussage gewinnt** (Befund V2-CONFLICT-002): Meldet eine Phase dieselbe
  Tatsache als Hinweis und eine andere als kritisch, bleibt _kritisch_ — unabhängig von
  der Reihenfolge. Vorher gewann die zuerst gemeldete Schwere, womit ein kritischer
  Befund durch Umsortieren der Phasen zum Hinweis werden konnte.

Der Bericht landet im Store (`autoWireReport`) und erscheint in der Warn-Zentrale:
Konflikte als Warnung/kritischer Befund, offene Fragen als Hinweis
(`AUTO-OPEN-QUESTION`). Befunde, deren Bauteile oder Leitungen es nicht mehr gibt, werden
ausgeblendet — der Bericht ist eine Momentaufnahme des letzten Laufs.

## Idempotenz

Ein zweiter Lauf auf dem Ergebnis des ersten ändert nichts. Geprüft für alle Plangrößen
in `tests/scale/plannerScale.test.ts` und als Eigenschaft **G5** in
`lib/vde-properties.test.ts`. Mechanik: Auto-Kanten früherer Läufe werden an ihrem
`AUTO_EDGE_PREFIX` erkannt und neu gebaut; alles andere bleibt unangetastet.

## Grenzen (Stand heute)

- Serienverschaltung ist im **Bankmodell** beschrieben (`lib/electricalGraph/batteryBank.ts`),
  Auto-Wire **baut** sie aber nicht selbsttätig: Es fragt und erzeugt keine Serienbrücke.
- `hasRcd` wird nie automatisch gesetzt — ein gesetzter FI würde einen fehlenden
  verschleiern.
- Nutzerquerschnitte werden nie verkleinert.
- Verpolte Akku-Paare werden entfernt, nicht umgedeutet.

## Tests

| Datei                              | Schutz                                                  |
| ---------------------------------- | ------------------------------------------------------- |
| `lib/autoWire.test.ts`             | Topologie, Heilung, Solar, AC, Idempotenz, Regressionen |
| `lib/autoWire/conflicts.test.ts`   | Bericht: Dedup, Sortierung, Schwere-Gewinner, E9/E10    |
| `lib/autoWire/sizing.test.ts`      | Querschnitt, Sicherung, Drop-Budgets                    |
| `lib/autoWire/placement.test.ts`   | Raster, Flussrichtung, Überlappungsfreiheit             |
| `store/edgeIntent.test.ts`         | gepinnte Kante überlebt einen Lauf                      |
| `tests/scale/plannerScale.test.ts` | Determinismus + Idempotenz bei 10…250 Knoten            |
