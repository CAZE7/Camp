# ADR 0030 — Streuungs-Ratchet im Perf-Gate: das p90 gehört zum Median

**Status:** angenommen · **Datum:** 2026-09-28 · **Bezug:** ADR 0012
(16-ms-Budget am Referenzplan), PERF-001, Audit P1/P2 (2026-09-28)

## Kontext

ADR 0012 bindet das Frame-Budget **ausdrücklich an den Referenzplan
N=36 / E=134** und wertet den **Median** über die Läufe aus — begründet damit,
dass einzelne Scheduler-Ausreißer des CI-Runners das Gate nicht flackern lassen
sollen. Der Live-Pfad (`routeAllCables`) läuft seit dem Audit P1 als
zusätzlicher, blockierender **Ratchet** (60 ms) mit.

Die Audit-Nachmessung (2026-09-28) zeigt die Lücke dieser Konstruktion: Das
Gate vergleicht **nur** den Median. Fünf isolierte Läufe ergaben Medians von
48,7–51,4 ms — also grün — bei **p90 59,0–66,6 ms**; unter Nebenlast (parallele
Builds) 124 ms Median und 292 ms p90 bei **unverändertem** Code. Zwei Aussagen
stecken darin:

1. Der Kopf der Verteilung ist stabil, der **Schwanz** ist es nicht.
2. Absolute Millisekunden sind auf geteilten Runnern kein portables Kriterium.
   Ein absolutes p90-Budget wäre entweder zu locker (nutzlos) oder zu streng
   (Flackern) — je nachdem, was sonst noch auf der Maschine läuft.

## Entscheidung

Der Live-Pfad-Ratchet bekommt eine zweite, **relative** Bedingung:

```text
p90 ≤ 2 × Median   (dieselben Proben, derselbe Prozess, derselbe Lauf)
```

Beide Zahlen und das Verhältnis werden ausgegeben; ein Verstoß lässt das Gate
mit Exit-Code 1 fehlschlagen. Der Median-Ratchet (60 ms) und das 16-ms-Ziel
bleiben **unverändert** — es wird nichts angehoben und nichts entfernt.

> **Nachtrag 2026-10-06:** Der absolute Median-Ratchet wurde mit ADR 0033 auf
> **300 ms** nachgezogen (neue Zusicherung Kabel-Freigabe I3 = 0; gemessen
> 223–234 ms nach ergebnisidentischen Optimierungen). Die hier entschiedene
> **relative** Bedingung `p90 ≤ 2 × Median` bleibt davon unberührt und ist der
> eigentliche Regressionsschutz auf geteilten Runnern.

## Begründung

- **Selbstkalibrierend:** Median und p90 stammen aus denselben Messproben. Eine
  allgemeine Verlangsamung (Last, Takt, Maschine) bewegt beide Werte und ändert
  das Verhältnis nicht — eine Regressionsaussage bleibt trotzdem möglich.
- **Es fängt die richtige Fehlerklasse:** Ein Median verdeckt einzelne Kanten mit
  entgleisender Suche (A*-Expansion, Trassenkonflikt). Genau solche Ausreißer
  erzeugen im Live-Betrieb sichtbare Ruckler, auch wenn der Durchschnitt passt.
- **Gemessene Spanne:** p90/Median lag über sieben isolierte Läufe bei 1,11,
  1,15, 1,21, 1,24, 1,33, 1,34, 1,35, 1,36, 1,49 und 1,56. Der Faktor ist
  deshalb **2** und nicht 1,5: Die erste Fassung mit 1,5 scheiterte sofort an
  einem Lauf mit 1,56 — der Median schwankt stärker als der Schwanz, ein zu
  enger Faktor wäre ein Flacker-Gate. 2 fängt die grobe Entgleisung (Faktor
  ≫ 2), nicht das Rauschen. Verbesserungen ziehen ihn nach unten.

## Alternativen

| Alternative                        | Warum nicht                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| Absolutes p90-Budget (z. B. 90 ms) | Nicht portabel: 292 ms p90 bei unverändertem Code unter Last (gemessen)            |
| Verhältnis 1,5 (erste Fassung)     | Scheiterte sofort an einem Lauf mit 1,56 (Median schwankt stärker als der Schwanz) |
| p90 nur messen, nicht bewerten     | Eine ungeprüfte Zahl driftet still — die Lücke aus PERF-001 bliebe bestehen        |
| Nur Median (Status quo ante)       | Genau der Befund: grünes Gate bei p90 über der Median-Ratchet                      |
| Optimierung mit eigenem ADR (Ziel) | Bleibt das Ziel (16 ms, große Pläne) — dieser ADR schließt nur die Messlücke       |

## Folgen

**Gut:** Der zweite, dokumentierte Messpunkt aus PERF-001 ist umgesetzt; der
Schwanz ist ab jetzt Teil des Gates, ohne dass eine Maschinenzahl behauptet
wird. Kein Produktivcode ändert sich, keine Baseline verschiebt sich.

**Offen:** Der **absolute** Rahmen für große Pläne bleibt Arbeit: N=120/E=585
liegt bei ≈21 ms, N≈500 bei ≈2 s pro vollem Durchlauf (Drossel
`ROUTE_THROTTLE_MS` = 100 ms fängt es im Betrieb ab). Das ist eine
Optimierungs- oder Produktentscheidung mit eigenem ADR — nicht durch Anheben
dieses Tokens zu lösen.
