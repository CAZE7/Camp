# Verfahrensvergleich

Recherche: 2026-10-14. Quellen wurden über GitHub und npm eingesehen; theoretische
Eigenschaften sind keine CAMP-Messwerte. Die experimentellen Adapter bleiben von
Produktdaten isoliert. Eine globale Optimalitätsgarantie wird nicht behauptet.

| Verfahren                     | Qualität / Korrektheit                                                                                                     | Stabilität / Inkrementalität                                                                                    | Aufwand / Browser / Risiko                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Hanan + Richtungs-A*          | kürzeste gewichtete Einzelwege auf diskretem Graphen; keine globale Mehrkantenoptimalität; Clearance braucht harte Prüfung | deterministische Tie-Breaker möglich; Reihenfolge erzeugt Belegungskaskaden                                     | bestehender TS-Kern; kartesisches Grid wächst quadratisch; Suchbudget nötig                            |
| Orthogonaler Visibility Graph | weniger irrelevante Gitterpunkte; Hindernisumgehung und Biegungen explizit; keine automatische Kapazitätsgarantie          | dynamische Sichtbarkeitskanten möglich                                                                          | anspruchsvolle Geometrie; libavoid liefert eine etablierte Umsetzung                                   |
| libavoid/WASM                 | objektvermeidende orthogonale Trassen, Crossing-Penalty und Nudging; CAMP-Portbündel und Locks nicht automatisch identisch | Transaktionen und inkrementelle Änderungen laut Upstream; Reproduzierbarkeit in eigenen Wiederholungen gemessen | `libavoid-js@0.5.0-beta.5`, LGPL-2.1-or-later; 813.186 Byte npm-unpacked; kein gemessener Transferwert |
| ELK Layered                   | gemeinsames Node-Layout und orthogonale Kanten; Port-Constraints verfügbar                                                 | interaktive Ordnungsconstraints sind keine Garantie unveränderter Weltkoordinaten                               | bereits vorhanden; 8.046.232 Byte npm-unpacked; EPL-2.0 OR GPL-3.0-or-later laut Paket                 |
| Rip-up-and-reroute            | global bewertete lokale Kandidaten, nur harte gültige Pareto-Verbesserungen                                                | deterministische Auswahl und begrenzte Versuche; andere Wege bleiben fest                                       | Browser-TS; messbar teurer als Initialrouting, deshalb expliziter Worker-Auftrag                       |
| Korridore + Kapazitäten       | Breite begrenzt Lane-Zahl; globale Zuordnung kann lokale Sackgassen vermeiden                                              | stabile Korridor-IDs wären zusätzliche Arbeit                                                                   | Portkapazität existiert; vollständiger globaler Korridorgraph noch nicht implementiert                 |
| MILP / CP-SAT                 | exakte Lösung nur für **das modellierte** diskrete Problem und bei Optimalitätsnachweis                                    | deterministische Budgets/Seeds nötig; Timeout liefert keinen Beweis                                             | HiGHS-JS/WASM real verfügbar; OR-Tools dokumentiert C++/Python/C#/Java, keinen offiziellen Browserpfad |
| Hybrid                        | lokale Suche + gemeinsame Lane-Constraints + harte globale Annahme                                                         | nur vollständige Transaktionen veröffentlichen                                                                  | ausgewählte Produktionsrichtung; zusätzlicher Konflikt-Reihenfolge-Prototyp bleibt Experiment          |

## Experiment und Entscheidung

Gemessen werden identische feste Positionen und dieselben CAMP-Validatoren:
`legacy` (exakter Ausgangscommit), `baseline` (gehärteter Initialpass), `libavoid`,
`rip-up` und `hybrid` (zusätzlich Konfliktgraph-Arbeitsreihenfolge).

Der erste 28-Plan-Vergleich zeigte libavoid auf mehreren Fällen deutlich schneller
und teilweise besser, aber nur 12/28 vollständig gültige Ergebnisse unter dem
**damaligen** Prüfvertrag. Die anschließende Portprüfung verschärft diesen Vertrag;
Vorher-Daten dürfen deshalb nicht als abschließender aktueller Vergleich gelten.
Libavoid wird nicht ausgeliefert. Konkrete Integrationsbefunde: fehlender
`OrthogonalRouting`-Export im Beta-Binding (numerischer Upstream-Wert nötig),
unpassender Types-Exportpfad und keine Gleichsetzung von Checkpoints mit immutable
Locks. LGPL-Verteilung, Quellcode-/Austauschmöglichkeiten und Notices müssten vor
Auslieferung gesondert geprüft werden. Dies ist keine Rechtsfreigabe.

Ausgewählt: vorhandener Lokalsolver, transaktionale globale Qualitätsprüfung,
begrenztes Rip-up, gemeinsame Lane-Propagation mit begrenzten Lane-Tauschversuchen.
Kein pauschaler ELK-Ersatz: verschobene Geräte wären ein unfairer Routingvergleich.
Kein neuer allgemeiner MILP-Solver: für E Kabel und A gerichtete Graphkanten benötigt
schon das Flussmodell O(E·A) Binärvariablen, plus Konflikt-/Richtungskopplung. Bei
74 Kabeln und beispielhaft 20.000 Graphkanten wären das 1,48 Millionen Variablen.
Das ist eine Modellabschätzung, **kein** eigener Solverbenchmark. Kleine
Lane-Konfliktgruppen sind der sinnvollere erste diskrete Suchraum.

## Primärquellen

- [Adaptagrams/libavoid README, Paper-Verweise](https://github.com/mjwybrow/adaptagrams/blob/master/cola/libavoid/README): Wybrow/Marriott/Stuckey, _Incremental connector routing_ (GD 2005/2006), _Orthogonal connector routing_ (GD 2009/2010). Die Papers wurden bibliographisch identifiziert; keine eigenen Replikationen ihrer Versuche.
- [libavoid Routingparameter](https://github.com/mjwybrow/adaptagrams/blob/master/cola/libavoid/router.h), [Visibility-Implementierung](https://github.com/mjwybrow/adaptagrams/blob/master/cola/libavoid/orthogonal.cpp), [LGPL-Text](https://github.com/mjwybrow/adaptagrams/blob/master/cola/libavoid/LICENSE.LGPL).
- [libavoid-js](https://github.com/Aksem/libavoid-js): Browser/Node, Emscripten-Build und Wartungsumfang. GitHub `pushed_at` beim Abruf: 2026-09-06; Adaptagrams: 2025-10-29. Kein Qualitätsnachweis allein durch Aktivität.
- [ELK Layered Optionen](https://github.com/eclipse-elk/elk/blob/master/plugins/org.eclipse.elk.alg.layered/src/org/eclipse/elk/alg/layered/Layered.melk), [elkjs](https://github.com/kieler/elkjs).
- [HiGHS-JS](https://github.com/lovasoa/highs-js): LP/MILP/convex QP, Browser/Node-WASM; npm `highs@1.15.3`, MIT, 4.016.114 Byte unpacked.
- [OR-Tools README](https://github.com/google/or-tools): Solver und unterstützte Sprachbindungen.

Sparse-Visibility-Eigenimplementierung, vollständige Kapazitätsplanung und
MILP/CP-SAT wurden nicht experimentell implementiert. Der Vergleich ist deshalb
keine erschöpfende Best-of-all-algorithms-Behauptung.
