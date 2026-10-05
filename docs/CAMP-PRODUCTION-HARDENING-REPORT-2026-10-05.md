# CAMP-Elektroplaner — Produktionshärtungsbericht

**Prüfstand:** 2026-10-05
**Checkout:** `arena/01a10bb0-camp`, Basis `de4e06011d647ca3ca456e6a81ce7ec159c1b43c`
**Geltungsbereich:** aktueller Arbeitsstand dieses Checkouts; kein Release- oder Normkonformitätszertifikat.

## Gesamturteil

**Nicht abnahmebereit für die vollständigen Produktionskriterien.** Die Änderungen härten die
unveränderliche Nutzerabsicht für gesperrte Leitungen und die elektrische Modellierung explizit
erklärter Batterie-Bänke. Typecheck, Lint, Format, Build und die automatisierte Vitest-Suite sind
(laut abschließender Prüftabelle) getrennt zu bewerten. Drei konkrete Abnahmehindernisse bleiben:

1. Der Live-Routing-Performance-Ratchet überschreitet sein 60-ms-Ziel deutlich.
2. Die deklarierte 24-px-Domänentrennung wird im Produktivrouting nicht durchgesetzt; der aktuelle
   Domänen-Probe findet 16 zu nahe Segmentpaare.
3. Der Regressions-Parcours enthält weiterhin Nichtnull-I2/I3-Befunde, die sein Vergleichsratchet
   gegen eine Nichtnull-Baseline akzeptiert. Damit ist die Forderung „I1/I2/I3 = 0 für alle
   Golden-Master- und Regression-Szenarien“ **nicht erfüllt**.

Die E2E-Spezifikationen konnten mangels installierter Playwright-Browser nicht im Browser
ablaufen. Ein vollständiger Auto-Wire-/Routing-/Final-Validation-Lauf für 500 Knoten wurde nicht
gemessen. Die bestandenen Code-Gates ändern diese offenen Befunde nicht.

## Befundklassifikation

| Bereich                                  | Status                            | Ergebnis                                                                                                                                                                                                    |
| ---------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gesperrte Nutzertrassen                  | **FIXED**                         | Nutzerwegpunkte werden als exakter Snapshot persistiert und in Routing, Hashing, Nudge/Separation und Final-Validation berücksichtigt. Gesperrte Geometrie wird nicht automatisch verschoben.               |
| Mutationen gesperrter Kanten             | **FIXED**                         | Verschieben, Löschen, Ersetzen oder Layout-Mutationen werden abgewiesen und als strukturierter Store-Befund erfasst; Entsperren ist explizit.                                                               |
| Routingwarnungen im WarningCenter        | **FIXED**                         | Geometrie-/Endpunktbefunde aus dem Final-Validation-Report und blockierte Mutationen werden kantenbezogen und anklickbar angezeigt; keine Tooltip-Texte werden geparst.                                     |
| Batterie-Banktopologien                  | **FIXED**                         | Deklarierte Serie, Parallel- und Serie-Parallel-Topologien erzeugen deterministische interne Graphverbindungen. Widersprüchliche oder ungültige Deklarationen werden strukturiert abgewiesen statt erraten. |
| I1/I2/I3 im 6-Pläne-Routing-Audit        | **FIXED für dieses Szenario-Set** | Die sechs dort geprüften Referenzpläne melden I1–I7 = 0. Das ist nicht gleichbedeutend mit null Befunden in der separaten Regression-Suite.                                                                 |
| I1/I2/I3 in allen Regression-Szenarien   | **OPEN**                          | I1 ist in allen 15 gemessenen Fällen 0; p02 hat zwei I3-Verstöße, p11 eine I2-Überdeckung und zwei I3-Meldungen. Das bestehende Regressionstest-Ratchet verlangt nur „nicht schlechter als Baseline“.       |
| 24-px-Domänentrennung                    | **OPEN**                          | Regeln/Helfer existieren, haben aber keinen Produktionskonsumenten im Router. 16 parallele Segmentpaare liegen im aktuellen Probe unter 24 px.                                                              |
| Live-Routing-Performance                 | **OPEN / FAIL**                   | Median 276,37 ms gegenüber dem 60-ms-Ratchet bei N=36/E=134; Exit-Code 1.                                                                                                                                   |
| Auto-Wire-Vorschau / Intent / Idempotenz | **PARTIALLY VERIFIED**            | Bestehende Unit-/Property- und Scale-Idempotenztests bestehen; der Browserablauf bleibt wegen fehlendem Playwright-Browser unverifiziert.                                                                   |
| 12/24/48-V- und AC-Modell                | **PARTIALLY VERIFIED**            | Spannungsklassen und AC-Graph-Regeln sind automatisiert getestet; die angenommene vorgelagerte AC-Netzimpedanz (ELE-002) bleibt offen.                                                                      |
| Browser-E2E                              | **UNVERIFIED**                    | Playwright konnte Chromium nicht starten; der Lauf ist kein E2E-PASS und kein Nachweis eines App-Fehlers.                                                                                                   |
| Normative/physische Installationsgrenzen | **PARTIALLY FIXED / OPEN**        | Das Modell enthält elektrische Grenzen und Annahmen, ersetzt aber weder eine vollständige Installationsbewertung noch fachliche Abnahme nach den einschlägigen Normen.                                      |

## Umgesetzte Härtungen

### 1. Gesperrte Leitungen bewahren Nutzerabsicht

- `CableEdgeData.lockedWaypoints` speichert den konkreten Routen-Snapshot. Der Routingeingabe-Hash
  enthält nun die tatsächlichen Koordinaten; `ROUTING_TOKENS_VERSION` wurde dafür erhöht.
- Der Produktivrouter registriert gesperrte Wege vor freien Routen, überspringt für sie Nudge,
  Geometrie-Bereinigung und Clearance-Separation und gibt die gespeicherte Geometrie unverändert
  zurück. Ein altes/fehlerhaftes Lock ohne gültigen Snapshot wird als ROUTE-LOCK-MISSING bzw.
  ROUTE-LOCK-INVALID gemeldet; ein automatisch berechneter Ersatzweg gilt nicht als erhaltener
  Nutzerweg.
- Die Graph-Aktionen schützen gelockte Kanten vor Verschieben, Löschen, Ersetzen und Layout-
  Änderungen. Ein blockierter Versuch landet zusätzlich im separaten `lockedMutationErrors`-
  Store; er hängt nicht ausschließlich an `plannerErrors`. Ein explizites Entsperren ist nötig,
  bevor die Trasse geändert werden kann.
- Die Final Validation meldet fehlende/ungültige Snapshots, Geometrieabweichungen und nicht mehr
  passende Anschlusspunkte als strukturierte, kantenbezogene Befunde. `WarningCenter` kann den
  betroffenen Eintrag öffnen/selektieren.

Abgesichert sind unter anderem Snapshot-/Hash-Änderungen, Unverändertheit beim Routing,
blockierte Store-Mutationen, Persistenz-Roundtrip, strukturierte Final-Validation-Warnungen und
deren Darstellung im WarningCenter. Die bestehenden Generation-/Konvergenzmechanismen wurden
nicht ersetzt.

### 2. Batterie-Bänke ohne Topologie-Raten

- Deklarierte Serien- und Parallelverschaltungen sowie Serie-Parallel-Bänke werden mit
  deterministischen internen `ElectricalConnection`s modelliert; die Serie-Parallel-Zuordnung
  verwendet eine kanonische, nach Batterie-ID sortierte Matrix.
- Ungültige Topologieangaben, widersprüchliche Mitgliederangaben, nichtpositive/nichtganzzahlige
  Stückzahlen und eine nicht passende Mitgliederzahl erzeugen strukturierte Fragen. Bis zur
  Klärung entstehen keine erfundenen Bankverbindungen.
- Explizite Plan-Kanten werden nicht doppelt als interne Bankverbindung gezählt; interne Links
  fließen in die elektrische Graph-Identität ein.

Das ist keine Bestätigung, dass jede reale Batterieinstallation durch das Modell vollständig
abgebildet wird. Die Annahmen und Grenzen unter **ELE-001/ELE-002** bleiben bestehen.

## Offene Befunde und Risiken

### ROUTE-003 — Domänentrennung wird nicht durchgesetzt

Der aktuelle Lauf `npm run routing:domain-probe` über sechs Referenzpläne ergab **80 gemischte
Paare**, davon 12 kreuzend, und **16 parallele Segmentpaare unter 24 px**: 4 in `acdc` und 12 in
`complex`. Das engste gemessene Paar ist `e-auto-8 × e-auto-ac-13` mit **16 px** in `acdc`; in
`complex` ist `e-shore-inv × e-auto-2` mit **12 px** am engsten. Die 24-px-Regel aus den
Domänentrennregeln ist in `routeAll.ts`/`pathfinding.ts` nicht angeschlossen. Die älteren Zahlen
(23 Paare, Minimum 0,8 px) sind durch diese aktuelle Messung überholt.

Die sechs Referenzpläne können zugleich I1/I2/I3 = 0 melden: Das allgemeine 12-px-Clearance-Gate
ist nicht dieselbe Anforderung wie die 24-px-Domänentrennung. Die Regel anzuschließen kann
Port-Fan-Out, Kabellängen und eingefrorene Layouts verändern; deshalb wurde sie nicht durch eine
bloße Lockerung oder eine ungemessene Tuben-Aufblähung „grün“ gemacht. Siehe
[`KNOWN-PROBLEMS.md`](ai/KNOWN-PROBLEMS.md).

### ROUTE-010 — Regression-Ratchet akzeptiert Nichtnull-Befunde

Eine direkte Messung aller 15 `REGRESSION_SCENARIOS` ergab:

- `p02-batterie-10-verbraucher`: I1 = 0, I2 = 0, aber zwei I3-Meldungen unter 12 px
  (0 px und 4 px) zwischen `e-fuse-cons-1 × e-fuse-cons-4` bzw.
  `e-fuse-cons-7 × e-fuse-cons-9`.
- `p11-zwangskreuzung`: I1 = 0, aber I2 = 1 (`e-down × e-up`, kollineare Überdeckung) und
  I3 = 2 Meldungen bei 0 px. Die beiden Kanten teilen einen horizontalen Abschnitt außerhalb
  eines Anschlusses; das ist keine saubere rechtwinklige Kreuzung.

`npm run test:regression` kann trotzdem bestehen, weil der Metriktest nur `≤ Baseline` prüft und
in den eingefrorenen Fixtures Nichtnull-Werte stehen. Die sechs Pläne im separaten
`routing:audit` belegen daher nicht die geforderte Nullrate über alle Regression-Szenarien. Das
ist ein tatsächlicher offener Routingbefund, keine Freigabe, die Testschwelle zu lockern. Siehe
[`KNOWN-PROBLEMS.md`](ai/KNOWN-PROBLEMS.md).

### PERF-001 — Live-Routing deutlich über dem Ratchet

| Pfad                                 | Plan        |                         Messung | Gate                       |
| ------------------------------------ | ----------- | ------------------------------: | -------------------------- |
| Legacy-Einzelkanten-Render           | N=36/E=134  |     Median 2,07 ms; p90 2,95 ms | 16 ms: **PASS**            |
| Live `routeAllCables`                | N=36/E=134  | Median 276,37 ms; p90 297,03 ms | 60 ms: **FAIL**            |
| Routing-only Kette                   | N=500/E=499 |                 Median 178,2 ms | kein Final-Validation-Lauf |
| Routing-only Spannkanten, Worst Case | N=500/E=250 |               Median 5.568,6 ms | kein Final-Validation-Lauf |
| Route + Final Validation             | N=250       |      54,1 s; Scale-Suite 71,7 s | I1/I2/I3: PASS             |

Der Live-Pfad-Ratchet ist verletzt (Benchmark-Exit-Code 1); p90/Median = 1,07 besteht nur das
Streuungsverhältnis. Die 250er-Messung wurde mit `SCALE_250=1` explizit ausgeführt. Eine
vollständige 500-Knoten-Auto-Wire-/Final-Validation wurde nicht gemessen. Weder Schwelle noch
Validierung wurden für dieses Ergebnis angehoben oder deaktiviert. Siehe
[`KNOWN-PROBLEMS.md`](ai/KNOWN-PROBLEMS.md).

### Weitere offene Grenzen

- **ROUTE-001/002:** `LaneRegistry` und Teile des Routing-Kostenmodells sind getestete Bausteine,
  aber nicht als vollständige Produktions-Lane-/Clearance-Bewertung angeschlossen.
- **ROUTE-009:** Der Kreuzungs-Ausweichlauf berücksichtigt gewichtete Clearance gegen bereits
  verlegte Kanten nicht zuverlässig als Auswahlkriterium; eine vollständige Bewertungsänderung
  wurde wegen messbarer Golden-/Layout-Trade-offs nicht ausgeliefert.
- **ELE-001:** Das Leitungsmodell setzt eine bestimmte Verlegeart/Belastbarkeit voraus; reale
  Fahrzeugverlegung, Temperatur, Bündelung und Installationsbedingungen sind nicht vollständig
  modelliert.
- **ELE-002:** Die AC-Abschaltbewertung beruht auf einer angenommenen vorgelagerten
  Netzimpedanz. Das ist keine Messung der realen Installation.
- **E2E/Browser:** `npm run e2e` wurde gestartet, aber alle 203 fehlgeschlagenen Browserstarts
  meldeten ein fehlendes Playwright-Executable (`chromium_headless_shell`); 21 Tests waren
  übersprungen. Die Tests wurden daher nicht im Browser ausgeführt. Das ist als
  **Umgebungsblockade / FALSE POSITIVE für einen Produktfehler**, jedoch als **UNVERIFIED** für
  das E2E-Gate klassifiziert. `npx playwright install --list` scheiterte zusätzlich beim
  Scannen eines nicht vorhandenen `.links`-Verzeichnisses.

## Regression- und False-Positive-Einordnung

- **REGRESSION:** Die 13 Golden-Master- und 53 Regressionstests bestehen; in diesen Testausgaben
  wurde keine neu eingeführte Abweichung gegenüber den Fixtures beobachtet. Die I3-/I2-Befunde
  aus p02 und p11 stehen bereits in den unveränderten Regression-Baselines und sind deshalb als
  **geerbte offene Befunde** (ROUTE-010), nicht als durch diese Änderungen verursachte Regression,
  klassifiziert. Ein separater A/B-Lauf gegen den Basis-Commit fand nicht statt; daraus folgt
  keine allgemeine Aussage „regressionsfrei“.
- **FALSE POSITIVE (Umgebung):** Die 203 E2E-Fehler sind nachweislich Browser-Launch-Fehler wegen
  des fehlenden Chromium-Executables, keine ausgeführten Assertions gegen die Anwendung. Das
  E2E-Gate bleibt trotzdem **UNVERIFIED**.

## Abschluss-Gates

Diese Prüftabelle wurde nach dem Anlegen dieses Berichts im aktuellen Checkout erneut
abgearbeitet. Ein **PASS** bei Code-Gates bedeutet nicht, dass die fachlichen, Performance- oder
E2E-Restpunkte geschlossen sind.

| Gate                                            | Ergebnis                 | Hinweis                                                                                                |
| ----------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `npm run typecheck` / `npm run typecheck:tests` | **PASS**                 | Beide TypeScript-Projekte.                                                                             |
| `npm run lint` / `npm run format:check`         | **PASS**                 | ESLint und Prettier über das Repository.                                                               |
| `npm run build`                                 | **PASS**                 | Next.js Build; SEO-Export-Audit prüfte 30 Seiten.                                                      |
| `npm test`                                      | **PASS**                 | 235 Dateien, 3.240 bestanden, 1 übersprungen (3.241 gesamt).                                           |
| Golden Master / Regression                      | **PASS, mit Restbefund** | 13 Golden-Master- und 53 Regressionstests bestanden; ROUTE-010 bleibt wegen Nichtnull-Baselines offen. |
| `npm run routing:audit`                         | **PASS**                 | 6 Referenzpläne: I1–I7 = 0; deterministisch, keine Fallbacks.                                          |
| `npm run routing:domain-probe`                  | **BEFUND**               | 16 parallele Segmentpaare <24 px; siehe ROUTE-003.                                                     |
| `npm run perf:edge-routing`                     | **FAIL**                 | Live-Median 276,37 ms vs. 60 ms; Ratchet-Exitcode 1.                                                   |
| Browser-E2E (`npm run e2e`)                     | **UNVERIFIED**           | 203 Browserstarts scheiterten am fehlenden Chromium-Executable; 21 Tests übersprungen.                 |
| 500-Knoten-End-to-End                           | **UNVERIFIED**           | Kein vollständiger Auto-Wire-/Final-Validation-Lauf gemessen.                                          |

## Änderungsscope und Freigabe

Die bestehende Architektur wurde beibehalten; insbesondere wurden Batterie-Bank-, AC-, Intent-,
Auto-Wire-, Routing-V2-, Final-Validation-, Generation- und Konvergenzsysteme nicht ersetzt.
Die neuen Sperr-/Warnpfade und Batterie-Graphverbindungen sind additiv getestet. Dieser Bericht
ist keine normative oder elektrische Fachabnahme.

**Freigabeempfehlung:** keine Produktionsfreigabe mit der Behauptung „alle Abnahmekriterien
bestanden“. Vor einer solchen Aussage müssen mindestens ROUTE-003, ROUTE-010, PERF-001 und die
Browser-E2E-Verifikation geschlossen oder ausdrücklich als akzeptierte Restgefahren entschieden
werden; außerdem ist die Installationsannahme fachlich zu prüfen.
