# Migration, Review und offene Abschlusskriterien

Diese Änderung wird als **Draft** vorgelegt. Sie implementiert funktionsfähige
Verbesserungen, erklärt aber nicht alle elf Phasen des Master-Prompts für abgeschlossen.

## Migration

Keine Änderung des gespeicherten elektrischen Planschemas. `lockedWaypoints` bleibt
unverändert. Der Routing-Signaturzähler steigt von 3 auf 4. Die neue Worker-Nachricht
enthält ausschließlich normalisierte routingrelevante Daten. libavoid ist eine
isolierte, exakt gepinnte **Dev-Abhängigkeit**, nicht Teil des produktiven Routings.

Der bekannte API-Einstieg `computeCableRouteFinalValidation` wird weiter aus
`cableRouteStore.ts` exportiert; Implementierung liegt nun in `routeValidation.ts`.
Produktive Veröffentlichung erfolgt über einen vollständigen Snapshot. Alte einzelne
Publisher bleiben für bestehende Tests/Integrationsstellen verfügbar.

Bewusster Golden-Recapture: ausschließlich Routing in `knownPlans/complex.json`,
vier Kanten. Grund ist eine reproduzierte falsche Anschlussrichtung, kein gelockerter
Validator. Die Kreuzungsratchet wird von 25 auf 24 **verschärft**. Alle 15 bestehenden
Regression-SVGs bleiben unverändert; elektrische Golden-Daten bleiben unverändert.

## Review vor Freigabe

- Abschließende Vergleichsmatrix mit dem aktuellen strengen Prüfvertrag erzeugen.
- Full Suite, Lint, beide Typechecks, Build, Performance-Gates und Browsermatrix
  auf dem finalen Commit laufen lassen. Frühere grüne Stände nicht gleichsetzen.
- Neue Cluster-Suche auf degenerierte/gesperrte Pfade und Budgetgrenzen weiter fuzzten.
- UI-Flächen-/Toolbar-Regressionen auf Mobil/Tablet prüfen.
- Mit parallel offenem PR #528 koordinieren: beide ändern die Route-Publikation.
  Dieser PR übernimmt oder überschreibt dessen Änderungen nicht.

## Abschlussmatrix zum Master-Prompt

| Thema                                                    | Status                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Produktionspfad und konkrete Fehleranalyse               | umgesetzt; keine Behauptung, jede Altdatei vollständig auditiert zu haben        |
| Vergleich von Bestand, Bibliothek, Rip-up, Hybrid        | Prototypen und erste Messung vorhanden; finale Matrix offen                      |
| Harte Endpunkt-/Richtungs-/Vollständigkeitsprüfung       | integriert und gezielt getestet                                                  |
| Globale Pareto-Annahme, Locks, gemeinsame Lane-Korrektur | integriert und gezielt getestet                                                  |
| Atomare Veröffentlichung, Stale-Schutz, Fehlererhalt     | integriert und gezielt getestet                                                  |
| Worker und tatsächlicher Timeout-Abbruch                 | integriert; Build und Desktop-Test am Integrationsstand grün                     |
| Determinismus, Idempotenz, Translation                   | gezielte Tests grün; letzte Gesamtmatrix aktualisieren                           |
| Elektrische Regeln                                       | unverändert; geometrische Gültigkeit ist kein Sicherheitszertifikat              |
| Schwierige 50-Komponenten-Pläne                          | klare Invalid-Diagnosen; nicht sämtlich gelöst                                   |
| Vollständige Kapazitätsplanung, exakte Solververgleiche  | offen                                                                            |
| Lokales inkrementelles Routing nach Geräteänderungen     | offen; unveränderte Eingaben und festgehaltene Optimierungsrouten bereits stabil |
| Label-/SVG-Flächenprüfung, vollständige Domänenprüfung   | offen                                                                            |
| Alle Abschlusskriterien / Produktionsfreigabe            | **nicht erreicht**, deshalb Draft                                                |
