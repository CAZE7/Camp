# Routing-Benchmarks und Prüfstand

## Reproduktion

```sh
npm ci
npm run routing:compare
npm run routing:audit
npm run perf:edge-routing
npm run test:goldenmaster
npm run test:regression
```

`routing:compare` unterstützt `--quick`, `--plan=substring`, `--candidate=name` und
`--output=path`. 28 Eingaben: sechs Golden Plans (einmal AutoWire vor Vergleich),
15 bestehende Regressionspläne, Lock/Moved-Lock, asymmetrisches Gerät und feste Seeds
7/42/73/97 mit 10/25/50/50 Komponenten. Verbindungsmuster und Dichte variieren.
Kein Kandidat darf Knoten neu platzieren. `legacy.ts` lädt den exakten Ausgangscommit
in einen isolierten Cache, ohne den Arbeitsbranch zu wechseln.

Der JSON-Bericht enthält Eingabe-SHA256, Komponenten/Ports/Kabel, Qualität, harte
Befunde, Fallbacks, geänderte Routen, Laufzeiten, Heap-Deltas und Ausgabefingerprint.
Drei Wiederholungen, Translation `(137,-83)` und umgekehrte Eingabereihenfolge werden
geprüft. Heap-Deltas sind **kein** Peak-RAM und enthalten keinen vollständigen WASM-
Speicher. Korridorüberlastung, Labelkollisionen und Peak-RAM sind explizit `null`.

## Gesicherte Messungen

- Ausgangs-Testsuite: 246 Dateien, 3365 bestanden, 1 übersprungen.
- Ausgangs-Perf-Parcours: 36 Nodes / 134 Kabel, 234,02 ms Median, 278,37 ms p90;
  Render-Cache-Parcours 2,30 ms Median. Die bestehenden Gates bleiben unverändert.
- Nach Port-/Clusterkorrektur: Routing-Audit alle sechs Pläne I1–I7 = 0,
  Fallbacks = 0, Determinismus bestanden.
- `complex`: 8645,6 px vorher/nachher; Kreuzungen **25 → 24**. Biegungen **53 → 54**,
  weil der vorher gelöschte zwingende Anschlussstummel wieder existiert. Alter Pfad
  ist unter dem neuen Anschlussvertrag INVALID, neuer Pfad VALID. Vier Routen ändern
  sich; keine elektrischen Daten, keine Gerätepositionen.
- Explizites Rip-up in früher Messung: camper 4 → 3 Kreuzungen, 3677,2 → 3663,8 px;
  solar 18 → 16 Biegungen bei 3200 px; p04 2 → 1 Kreuzung und 12 → 10 Biegungen bei
  2592 px. Diese Fälle besitzen gezielte Tests bzw. Vergleichsdaten.

## Datenstand und offene Messung

`benchmarks/routing/results-before-port-fix.json` ist bewusst **historisch** benannt:
112 Messreihen des ersten Vier-Verfahren-Vergleichs, vor der zuletzt entdeckten
Port-Stummel-Korrektur. 28/28 Wiederholungs-, Translations- und Permutationsprüfungen
bestanden je Kandidat. Diese Datei ist **nicht** der Performance-/Qualitätsnachweis
des finalen Codes. Der abschließende Fünf-Verfahren-Lauf steht im Draft-PR noch aus.

Die schwierigen Seeds waren schon dort ungelöst: 25 Nodes / 36 Kabel und 50 Nodes /
74 Kabel blieben INVALID. Im 50er-Dense-Fall lagen die Initial-/Optimierungsläufe im
Sekundenbereich. Deshalb Worker und harter Abbruchstatus statt UI-Blockade oder
unbemerktem Notfallrouting. Eine nachgewiesene gültige Lösung aller dichten Pläne
und ein verbindliches Geräteklassen-Performance-SLA sind noch offen.

## Ausgeführte Checks im Entwicklungsverlauf

- 1067 Routing-/Regressions-/Golden-Tests vor der letzten Portkorrektur bestanden.
- Nach Port-/Clusterkorrektur: 115 gezielte Tests bestanden (Lane-Cluster,
  Anschlussvertrag, Optimierer, Final-Validation, Golden Master, 15 byte-exakte
  Routing-Regressionen). Nur `knownPlans/complex.json` musste neu erfasst werden.
- Produktionsbuild und Export-Audit bestanden am Worker-Integrationsstand.
- Desktop-Browser: vorhandener Routing-Stabilitätstest und neuer Optimierungs-
  Bedienpfad bestanden am Worker-Integrationsstand. Browserbereitstellung erfolgte
  isoliert über npm-Chromium; kein Browserbinary wird eingecheckt.
- Finaler Full-Suite-/Build-/Perf-Lauf nach der Clusterkorrektur: noch ausstehend.
