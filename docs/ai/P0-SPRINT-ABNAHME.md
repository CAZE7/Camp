# P0-Sprint — Stellungnahme und Abnahmebericht (2026-11-03)

## 1. Stellungnahme zum Gutachten

Die Gesamtbewertung ist in der Diagnose zutreffend: Das Repo hat eine starke,
testgesicherte technische Basis (Routing, Golden Master, Verifikations-Engine,
AutoWire-Review), war aber **kein vollständig ausgereifter fachlicher
Elektroplaner**, solange drei Dinge galten:

- Der produktive Routinglauf benutzte eine mildere Endpunktprüfung als der
  strenge Validator; fehlende Knoten konnten zu `(0,0)` werden, unbekannte
  gemessene Handle-IDs still auf den ersten Port wechseln.
- BMS-Grenzen waren Eingabefelder und Verifikationsregeln, aber **keine
  Design-Constraint im AutoWire-Vorschlag**: Ein 1500-W-Wechselrichter an einer
  50-A-Bank wurde als Vorschlag ohne kritischen Befund erzeugt.
- Für jede Leitung galt unabhängig vom Einbauort dieselbe Pauschale
  `Tabellenwert × 0,7`; Motorraum, Bündel und Leitungstyp existierten im
  Fachmodell nicht.

Wir teilen auch das Produktziel: _„Der Nutzer zeichnet einen Schaltplan – und
das System versteht, was er gebaut hat."_ Deshalb wurde **keine neue Funktion**
(PWA, Export/Import, Energiebilanz, Multi-Plan), **keine Neuarchitektur** und
**kein neuer Routingalgorithmus** begonnen. Der Sprint blieb bei den drei vom
Gutachten abschließend genannten Aufgaben. Größere neue Funktionen sind weiterhin
nicht freigegeben.

**Scope-Entscheidung bewusst dokumentiert:** Die P0-Tabelle des Gutachtens nennt
zusätzlich „230-V-Modellgrenzen schließen oder explizit absichern". Der finale
Vorschlag definiert den Sprint jedoch als **drei** Aufgaben. 230 V wurde daher
nicht in diesen Sprint gezogen und bleibt offen (siehe §5). Es wird nicht als
„mit erledigt" dargestellt.

---

## 2. P0-1 — Produktive Routingvalidierung · `1f09e48`

**Vorher:** `routeAllCables` übersprang eine Kante nur, wenn _beide_ Endpunkte
fehlten; `resolveHandlePoint` lieferte bei fehlendem Endpunkt `(0,0)` und
ersetzte eine unbekannte gemessene Handle-ID durch den ersten Handle. Die
strenge `routeValidation` lief nicht im normalen produktiven Pfad; der
Store hatte eine zweite, mildere Implementierung.

**Jetzt:** Ein gemeinsames Input-Gate
(`components/edges/utils/routeInput.ts`) liefert `ROUTE-MISSING-NODE` und
`ROUTE-UNKNOWN-HANDLE` plus `routableEdgeIds`. Router, Endpunktauflösung,
Fan-Out-Fallback, Diagnoseskripte, Live-Report und Store-Finalvalidierung
nutzen **dieselbe** Prüfung. `resolveHandlePoint` liefert `undefined`, kein
Ersatzkoordinaten-Fallback zum Ursprung und kein stiller Anschlusswechsel.
Der Store re-exportiert den strengen Validator; die Zweitimplementierung ist
entfernt. Jede nicht routbare Leitung erhält eine eigene Meldung.

**Abweichung beim Review:** Beim ersten Lauf mit gemessener React-Flow-Geometrie
meldete der strenge Validator 9 `ROUTE-OWN-NODE`-Funde für Port-Stubs innerhalb
der Kartenbox. Die Regel wurde auf _Wiedereintritt nach Verlassen des Ports_
präzisiert. Ein echter Restbefund bleibt: `e-batt-minus` → `busbar-minus`,
festgehalten als `ROUTE-018` (P1) und bewusst als `INVALID` in
`routeAll.test.ts` eingefroren, statt die Baseline zu senken.

---

## 3. P0-2 — BMS als Design-Constraint · `21d6973`

**Vorher:** `load-exceeds-limit` existierte nur in der Konfliktbibliothek und
einem Test; `hasCriticalConflict` wurde importiert, aber nicht produktiv
verwendet. Probe: 12,8 V / 50-A-BMS / 1500-W-Wechselrichter ⇒ `conflicts []`,
Bank 50 A, Kantenstrom ≈ 147 A, Kabel 70 mm² / 100 A.

**Jetzt:** `lib/autoWire/designBudget.ts` bewertet **nach** dem Sizing den
Entladestrom der Aufbaubank aus `computeCableCurrents` (nur Lastbeiträge)
gegen `computeCurrentBudget` (BMS · Bauteil · Sicherung · Kabel ·
70-mm²-Modellgrenze). Der Vorschlag weist getrennt aus:

- Kabel kann die Last tragen
- Sicherung ist passend
- Batterie kann die Last **NICHT** liefern
- Gesamtsystem **NICHT** geeignet

`AutoWireReviewModal` zeigt ein rotes Banner „Vorschlag ist fachlich nicht
geeignet", `useLiveValidation` eine BMS-spezifische kritische Warnung mit
Remedies (andere Batteriebank, geeigneterer/kleinerer Wechselrichter, reduzierte
Last, Datenblatt prüfen). Der Laststrom wird **nicht** auf 50 A gekappt.
Fehlender BMS-Wert ⇒ `AUTO-BMS-000` plus offene Frage; Reserve > 90 % ⇒
`AUTO-BMS-002`; eine andere kleinste Grenze ⇒ `AUTO-BUDGET-001` (Warnung).

---

## 4. P0-3 — Fahrzeugspezifische Kabeldimensionierung · `d491700`

**Vorher:** `I_z = VDE_AMPACITY(B2/30 °C) × 0,7` für alle Leitungen; `f₃ = 1`
fest verdrahtet; FLRY/FLR2X und ISO 6722 nicht modelliert; AMP-001 prüfte nur
globale Laufannahmen.

**Jetzt:** `lib/cableConditions.ts` bietet auswählbare Einbausituationen
(Referenz, Innenraum einzeln, Bündel, Hohlraum, Motorraum 60 °C, Dach/Solar,
eigene Werte, Herstellerangabe). **Es wurde kein weiterer pauschaler
Sicherheitsfaktor ergänzt.** Die eine I_z-Rechnung bleibt:

```text
I_z = I_z,Basis × min(0,7, f₁ · f₂ · f₃)
f₁ = √((T_max − ϑ_U)/(T_max − 30 °C))   (IEC 60364-5-52)
f₂ = VDE_GROUP_FACTORS[n]                (n = 1…9)
f₃ = 1,0                                 (keine geprüfte Tabelle ⇒ kein erfundener Wert)
```

Die 0,7-Pauschale bleibt **strikte Untergrenze**: mildere Bedingungen erhöhen
die Belastbarkeit nie. Motorraum/PVC bei 60 °C halbiert I_z (10 mm²: 36,4 A →
26,0 A). Dieselbe Ableitung wirkt auf thermischen Querschnitt, Sicherung,
Infeasibility-Marker, AC-Pfad, Selektivitätskoordination und AMP-001/AMP-002
mit `izBreakdown` im Bericht. Ungültige Eingaben (ϑ_U ≥ T_max, n > 9,
unbekanntes Preset) ⇒ Fehler im Inspektor, `UNVERIFIABLE` in AMP-001/AMP-002 und
„nicht ausführbar" im AutoWire-Plan, **kein stiller Rückfall auf 30 °C**. Nur
Werte außerhalb der Schema-Grenzen werden beim Speichern abgelehnt bzw. beim
Import entfernt. Bewertungsstufen: _rechnerisch mit Referenzmodell bewertet_ /
_mit Annahmen bewertet_ / _Herstellerangabe hinterlegt_ / _nicht bewertbar_.
Siehe §9 zur Review-Korrektur 2026-11-04.

Datengrundlage, Quellenstatus und Grenzen:
[`docs/KABEL-VERLEGEBEDINGUNGEN.md`](../KABEL-VERLEGEBEDINGUNGEN.md). Gespeicherte
Pläne ohne Angabe und alle Golden Master sind **byte-stabil**; es gab keine
Neuerfassung.

**Restbefund ELE-001 bleibt offen:** Die Basistabelle ist eine
Hausinstallations-Verlegeart (B2), keine zitiergeprüfte
Fahrzeugleitungs-Ampazitätstabelle (ISO 6722 / FLRY); echte f₃-Werte fehlen.
Das ist eine P1-Folgeaufgabe mit Golden-Master-Neuerfassung, kein stilles
„Werte verbessern".

---

## 5. Abnahme gegen die Kriterien des Gutachtens

| Kriterium                                                                                   | Stand                                                      | Beleg / Grenze                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keine still akzeptierten fehlenden/ungültigen Anschlüsse                                    | **erfüllt**                                                | gemeinsames Input-Gate, `routeInput.test.ts` (15), `routing:audit` I1–I7 = 0                                                                                                                                                                         |
| Jede nicht routbare Leitung eigene Fehlermeldung, keine Ersatzkoordinaten                   | **erfüllt**                                                | `ROUTE-MISSING-NODE` / `ROUTE-UNKNOWN-HANDLE`; `resolveHandlePoint` → `undefined`                                                                                                                                                                    |
| Keine unbegründeten elektrischen Annahmen                                                   | **weitgehend**                                             | Annahmen werden im Bericht und Inspektor benannt; `UNVERIFIABLE` statt Raten. Rest: `UPSTREAM_IMPEDANCE_ASSUMPTION_OHM = 0.8` (ELE-002, UNVERIFIED) und f₃ = 1,0 ohne Tabelle                                                                        |
| Keine kritischen BMS-/Kabelbelastbarkeitsverletzungen in einem als geeignet bewerteten Plan | **erfüllt im AutoWire-Vorschlag und Prüfbericht**          | Design-Budget + kantenbezogenes AMP-001. **Keine normative Abnahme** — die Basistabelle ist B2/Hausinstallation                                                                                                                                      |
| Alle AC/DC-Domänenregeln technisch geprüft                                                  | **nicht erfüllt**                                          | 24-px-Regel ist kein überprüfbares Gate (ROUTE-003); `checkClearance` prüft nur `cableClearance`                                                                                                                                                     |
| Deterministisches/reproduzierbares Routing                                                  | **erfüllt**                                                | Golden Master 13, Regression 68, `routing:audit` `determ = true` in allen sechs Plänen                                                                                                                                                               |
| Keine unerklärlichen Neuverdrahtungen nach Bauteiländerungen                                | **nicht abschließend abgenommen**                          | Regression Szenarien 13–15 grün; ROUTE-018 und Browser-Oszillation ohne Trace nicht belegt                                                                                                                                                           |
| 230 V: L/N/PE, Netzform, FI/LS, Umschaltung, Rückspeisung, PE zur Karosserie                | **offen**                                                  | bewusst außerhalb der drei Sprint-Aufgaben; Prüfung/Abnahme nur durch qualifiziertes Personal                                                                                                                                                        |
| Anfänger ↔ Experte, AutoWire erklärt Vorschläge, Fehler im Plan auffindbar                  | **teilweise**                                              | Review-Modal mit Rechenweg, kritischem BMS-Banner und (seit §9) Hinweis auf eigene Verlegebedingungen; Inspektor mit eigener I_z. **Restlücke:** keine Vorher/Nachher-Begründung je einzelner Leitung. Tastatur-/Accessibility-Abnahme (M11-3) offen |
| Mobile/Desktop gleichwertig, Stückliste/Bericht gleicher Planstand                          | **unverändert**                                            | vom Nutzer teilweise als erledigt markiert; nicht erneut geprüft                                                                                                                                                                                     |
| Stresstests ≥100 Bauteile/300 Kanten, Lighthouse-/Performance-Gates                         | **teilweise**                                              | `perf:edge-routing` Live-Pfad N=36/E=134: Median 232 ms p90 268 ms gegen Ratchet 300 ms ⇒ OK; ADR-0012-Ziel 16 ms/Frame weiterhin verfehlt (PERF-001). 250/500-Knoten-Benchmarks bleiben dokumentierte Last, kein grünes Gate                        |
| Unit-/Property-/Integrations-/E2E-/Regressionstests                                         | **Unit/Integration/Regression grün; E2E nicht ausgeführt** | 301 Dateien / 3935 Tests (1 skipped); E2E/Playwright und visuelle Pixel-Baselines nicht gelaufen                                                                                                                                                     |

**Damit ist der P0-Sprint in seinen drei Aufgaben abgenommen, aber nicht das
Gesamtprodukt.** Es wurde keine Aussage über normkonforme Abnahme, 230-V-Sicherheit
oder Accessibility-Vollabnahme erzeugt.

---

## 6. Test- und Gate-Evidenz (nach dem letzten Commit-Stand)

| Prüfung                                                              | Ergebnis                                                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npx vitest run` / `npm run check` (Vollsuite)                       | 301 Dateien, 3935 bestanden, 1 skipped, 431,86 s (Coverage-Lauf)                          |
| `npm run check` (Lint, Format, beide Typechecks, Coverage-Vollsuite) | grün nach allen Review-Korrekturen; 301 / 3935 / 1 skipped, 431,86 s                      |
| `npm run routing:audit`                                              | 6 Pläne, I1–I7 = 0, `determ = true`, 0 harte Konflikte                                    |
| `npm run test:goldenmaster`                                          | 13 Tests grün, keine Neuerfassung nötig                                                   |
| `npm run test:regression`                                            | 68 Tests grün                                                                             |
| `npm run perf:edge-routing` (allein, ohne konkurrierende Last)       | Referenz 1,74 ms / p90 1,98 ms ≤ 16 ms; Live-Pfad 189,27 ms / p90 221,16 ms ≤ 300 ms ⇒ OK |
| `npx vitest run lib/`                                                | 104 Dateien / 1707 Tests grün (nach allen Review-Korrekturen)                             |
| Architektur-Gates (Rule A, E, G–J)                                   | in der Vollsuite enthalten und grün                                                       |
| E2E / `npm run build` / PR                                           | **nicht ausgeführt**                                                                      |

Der erste Perf-Lauf parallel zur Vollsuite zeigte 531 ms Median und
„ÜBERSCHRITTEN"; die Messung war durch CPU-Konkurrenz verfälscht. Der allein
wiederholte Lauf ergibt 232 ms (nach der Review-Korrektur erneut 189 ms). Beide Werte sind hier genannt, damit kein
geschönter Gate-Status entsteht.

---

## 7. Nicht angefangen (wie gefordert)

P1 (24-px-Domänengate, inkrementelles Routing/Drag-Vorschau/Web Worker,
Tastatur-/Accessibility-Abnahme), P2 (Herstellerdatenbank, Installations- und
Inbetriebnahmebericht, globale Routingoptimierung/Rip-up & Reroute), die
230-V-Aufgabe aus der P0-Tabelle sowie alle in `AGENTS.md` gesperrten neuen
Funktionen. `ROUTE-018`, `ROUTE-003`, `ELE-001` (Rest), `ELE-002` und
`PERF-001` bleiben in `docs/ai/KNOWN-PROBLEMS.md` sichtbar.

## 8. Commits

Der Workspace wird zwischen Durchläufen als Patchset auf den Basis-Commit
`e0c2cfc` wiederhergestellt: In diesem Durchlauf existierten die zuvor genannten
vier Commit-Hashes nicht mehr, alle Änderungen lagen als uncommitteter Diff vor.
Die Arbeit liegt deshalb **in einem konsolidierten Commit** auf
`arena/eb2e7cd0-camp` (Hash siehe `git log`), logisch gegliedert in:

1. P0-1 — produktive Routingvalidierung
2. P0-2 — BMS als Design-Constraint
3. P0-3 — fahrzeugspezifische Kabeldimensionierung
4. Stellungnahme und Abnahmebericht
5. Review-Korrekturen zum Selbst-Audit (§9)

Ein künstliches Aufteilen in Zwischen-Commits, die einzeln nicht kompilieren,
wäre eine unechte Historie. Kein Merge nach `main`, kein PR, kein Push bislang.

---

## 9. Selbst-Audit 2026-11-04 — „Hast du jedes Detail beachtet?"

**Antwort: nein.** Eine Nachprüfung gegen den eigenen Abnahmetext fand
Abweichungen. Die Punkte 1–7 und 9 sind behoben, Punkt 8 (Verfahren/E2E) ist
transparent offengelegt und nicht rückgängig zu machen.

| #   | Befund                                                                                                                                                                                                                                                                                 | Stand                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Eigene Werte ohne Preset wurden still ignoriert.** `resolveCableConditions({ ambientC: 60 })` lieferte `kind: 'reference'` und I_z(10 mm²) = 36,4 A statt 26,0 A — genau die Zusage „keine unbegründeten Annahmen" war damit verletzt.                                               | **behoben**: solche Felder erzwingen `custom`; Regressionstest in `lib/cableConditions.test.ts`                                                                              |
| 2   | `manufacturerIzA` allein wurde als `assessment: 'reference-model'` geführt, obwohl ein Datenblattwert die Tabelle übersteuert; der Prüfbericht stempelte ihn als `plan-model-und-physik`.                                                                                              | **behoben**: eigener `basis`-Wert `manufacturer-data` und korrektes Assessment                                                                                               |
| 3   | `datasheet` ohne I_z fiel auf 30 °C / 0,7 zurück — eine erfundene Annahme im Modus „Herstellerangabe".                                                                                                                                                                                 | **behoben**: `RangeError` ⇒ Inspektor-Fehler + `UNVERIFIABLE`; Test                                                                                                          |
| 4   | Ungültige, aber schema-gültige Plandaten (z. B. 95 °C bei PVC) ließen `performAutoWiring` mit `RangeError` **abstürzen**; der AC-→70-mm²-Zweig rechnete weiter mit der Referenz-Sicherung.                                                                                             | **behoben**: `cableSizingFor` meldet `valid: false` statt zu werfen, Aufrufer markieren „nicht ausführbar"; AC-Pfad nutzt dieselbe Ableitung; DC- und AC-Regressionstests    |
| 5   | AMP-002 meldete bei ungültigen Bedingungen „Querschnitt fehlt oder unbekannt" — falsche Ursache.                                                                                                                                                                                       | **behoben**: eigener `UNVERIFIABLE`-Zweig mit richtigem Grund; Test                                                                                                          |
| 6   | Der AutoWire-Review erklärte nicht, warum P0-3 Querschnitt/Sicherung von der 0,7-Pauschale abweichen (Kriterium „erklärt jeden Vorschlag").                                                                                                                                            | **behoben**: Hinweis mit Anzahl betroffener Leitungen vor der Übernahme, 2 Modal-Tests. **Restlücke**: keine Vorher/Nachher-Liste je Leitung                                 |
| 7   | Dokumentation teils widersprüchlich: ELE-001 `DESCRIPTION` beschrieb weiter den reinen 0,7-Zustand, der Ledger nannte veraltete Testzahlen, §4 nannte „Feldentfernung" auch für physisch unzulässige Werte, §6 eine grobe `lib/`-Testzahl.                                             | **behoben**: ELE-001 DESCRIPTION/STATUS, Ledger, §4/§5/§6 und `docs/KABEL-VERLEGEBEDINGUNGEN.md` §4.1 präzisiert                                                             |
| 8   | **Verfahren:** `docs/ai/ARCHITECTURE-RULES.md` und `CHANGE-WORKFLOW.md` wurden erst _nach_ den Codeänderungen gelesen (AGENTS.md verlangt „vorher"). `npm run check` lief zunächst vor dem letzten Fix; E2E/Playwright, visuelle Pixel-Baselines und `npm run build` liefen gar nicht. | **offengelegt**: nicht rückgängig zu machen. Lint/Format/beide Typechecks und `npm run check` nach den Korrekturen erneut ausgeführt (Zahlen unten). E2E/Build bleiben offen |
| 9   | **Arbeitsweise:** In einem frischen Durchlauf war der Workspace auf `e0c2cfc` zurückgesetzt; die zuvor genannten vier Commit-Hashes existierten nicht mehr, alle Änderungen lagen als uncommitteter Diff vor, `node_modules` fehlte.                                                   | **behoben**: `npm ci` erneut ausgeführt, Commits neu angelegt (§8), keine festen Hashes mehr im Bericht                                                                      |

**Weiterhin nicht behoben und nicht als erledigt ausgegeben:** 230-V-Modellgrenzen,
24-px-Domänengate (ROUTE-003), ROUTE-018, ELE-002, ISO-6722-Tabelle/f₃
(ELE-001-Rest), PERF-001 (16 ms/Frame), Tastatur-/Accessibility-Abnahme,
E2E/Build/PR und die fehlende Vorher/Nachher-Begründung je Leitung im
AutoWire-Review.

### Gates nach der Korrektur

Alle Prüfungen liefen **nach** den Korrekturen 1–7, ohne konkurrierende Last:

| Prüfung                                                              | Ergebnis                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run check` (Lint, Format, beide Typechecks, Coverage-Vollsuite) | **grün**: 301 Dateien / 3935 Tests / 1 skipped, 431,86 s                 |
| `npx vitest run lib/`                                                | 104 Dateien / 1707 Tests grün                                            |
| `npm run routing:audit`                                              | 6 Pläne, I1–I7 = 0, `determ = true`                                      |
| `npm run test:goldenmaster`                                          | 13 Tests grün, keine Neuerfassung                                        |
| `npm run test:regression`                                            | 68 Tests grün                                                            |
| `npm run perf:edge-routing` (allein)                                 | Referenz 1,74 ms / p90 1,98 ms; Live-Pfad 189,27 ms / p90 221,16 ms ⇒ OK |
| Gezielte UI-/Store-/Verify-Suiten                                    | 5 Dateien / 54 Tests grün                                                |

E2E/Playwright, visuelle Pixel-Baselines und `npm run build` bleiben offen.
_Dies ist der Prüfstand von §9; der Nachlauf in §10 hat daran zwei Punkte
geändert (230 V, Vorher/Nachher) und `npm run build` nachgeholt._

---

## 10. Nachlauf 2026-11-04 — zwei Restlücken, ohne neue Features

Auf die offene Liste aus §9 hin wurden **nacheinander** zwei Punkte bearbeitet.
Der Auftrag blieb „P0-Sprint mit genau drei Aufgaben"; beide Punkte sind
Nachlauf-Arbeiten, **keine** Freigabe für eine neue 230-V-Architektur und
**kein** neues Feature im Sinne von `AGENTS.md` Zeile 95.

**Verfahren, ehrlich benannt:** `docs/ai/ARCHITECTURE-RULES.md` und
`docs/ai/CHANGE-WORKFLOW.md` wurden in diesem Nachlauf **erst nach** den ersten
Codeänderungen gelesen — dieselbe Reihenfolge-Verfehlung wie §9 Punkt 8, hier
nicht beschönigt und nicht rückgängig zu machen. Die Änderungen wurden danach
gegen Regeln A/B/D/M/O-3/O-4, den Electrical-Workflow §22 und die
Review-Checkliste §23 nachgeprüft (§10.6). Die Nachprüfung ergab keinen
Regelverstoß; sie ändert aber nichts an der falschen Reihenfolge.

### 10.1 230-V-Absicherung — „explizit absichern" statt „Modellgrenzen schließen"

Das Gutachten ließ zwei Wege zu. Gewählt wurde der kleine: Das einleiterige
Modell bleibt, aber seine Reichweite wird zu einem **prüfbaren Gate**.

- `NET-003-ac-model-scope` (`lib/verify/acScope.ts`, `RULE_MATRIX`, `runPass5`,
  `ENGINE_LIMITATIONS`): drei `UNVERIFIABLE`-Befunde je Plan mit `AC_LV`-Kanten
  und **neun strukturierte Einzelpunkte** in `details.acScopeItems`. Ohne
  230-V-Kante `PASS`/0 Entitäten — reine 12-V-Pläne bleiben `COMPLIANT`.
- **Drei Bewertungsstufen** werden nie gleichwertig dargestellt:
  rechnerisch bewertet / mit Annahmen bewertet / nicht überprüfbar.
- Sichtbar in `report.limitations`, Warn-Zentrale (`ac-scope-items`),
  Bauteil-Inspektor (`inspector-230v-scope-note`) und Kabel-Inspektor
  (`edge-230v-scope-note`). **Keine** elektrische Rechnung in der UI (Regel D).
- `provenance: 'UNVERIFIED'`, `clause: null`, kein erfundenes Normzitat,
  bewusst auch im `NORM_CORE`-Profil aktiv. 230-V-Prüfung und Abnahme bleiben
  ausschließlich qualifiziertem Personal vorbehalten.
- Datengrundlage und Abgrenzung: `docs/AC-230V-MODELLGRENZEN.md`;
  `docs/ai/KNOWN-PROBLEMS.md` führt `AC-230V-001` als
  „abgesichert, Modellgrenze bleibt offen".

**Nicht gebaut:** L/N/PE als getrennte Kanten, Netzformmodell, Trenn-/Umschalt-
und Rückspeiselogik, reale Messwerte, normative Abnahme. Das war ausdrücklich
nicht freigegeben.

### 10.2 AutoWire — Vorher/Nachher je Leitung

- Neue reine Projektion `lib/autoWire/reviewDiff.ts`: je Leitung
  `before`/`after` für Querschnitt, Sicherung, Verlegebedingung, Domäne und
  Gültigkeit; Status `new`/`changed`/`unchanged`/`removed`; Begründungen aus
  Feldvergleich, I_z-Herkunft und den **namengebundenen** Konflikten desselben
  `AutoWireReport`. Keine Rechnung, keine zweite Fachlogik.
- `components/planner/AutoWireReviewModal.tsx`: klappbare Tabelle
  (`autowire-edge-diff`, `autowire-edge-row`) mit stabiler Sortierung.
  „Vorher" ist der aktuelle Plan aus dem Store; `previousEdgeCount` prüft die
  Konsistenz — bei Abweichung werden **keine** Vorher-Werte erfunden, sondern
  ein Hinweis gezeigt (Regel M).
- **Keine Store-Schema-Änderung**: `autoWirePreview` bleibt unverändert,
  Persistenz-/Import-/Store-Verträge unberührt.
- Dokumentation: `docs/ai/AUTOWIRE-CONTEXT.md` §7.6a,
  `docs/KABEL-VERLEGEBEDINGUNGEN.md` §4.2, `lib/autoWire/README.md`.

### 10.3 Verträge, die durch die neue Regel angepasst werden mussten

Eine neue Pass-5-Regel ändert Bericht und Anzeige. Statt Erwartungen
aufzuweichen, wurden sie **verschärft** und der neue Befund mitgeprüft:

| Datei                                                   | Änderung                                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/verify/protection.test.ts`                         | Pass-5-Liste 9 → 10 IDs                                                                                                                         |
| `lib/verify/pipeline.test.ts`                           | `shorePlan()` muss zusätzlich drei NET-003-Befunde mit Fachpersonal-Hinweis ausweisen                                                           |
| `components/planner/utils/verificationWarnings.test.ts` | `rulesApplied` 29 → 30; vier Hinweise (1× PWR-001 + 3× NET-003), alle `info`/ohne Fokus, strukturierte `acScopeItems` mit drei Stufen           |
| `components/planner/ui/VerificationSeal.test.tsx`       | Pass 5 zeigt 10 Regeln                                                                                                                          |
| `components/planner/hooks/useLiveValidation.test.ts`    | Autark-Vorlage: 4 statt 1 Befund, alles `info`, 3× NET-003 mit `unverified`/`incomplete` und `acScopeItems`                                     |
| `store/usePlannerStoreExtended.test.ts`                 | `NET-003` in der Whitelist benannter Modellgrenzen, zusätzlich **nur** als `info`/`incomplete`/`unverified` und genau 0 oder 3 pro Plan erlaubt |

Neue Suiten: `lib/verify/acScope.test.ts` (8),
`lib/autoWire/reviewDiff.test.ts` (7), vier neue Modal-Fälle und je ein
WarningCenter-/Inspector-Test.

### 10.4 Gates nach dem Nachlauf

Alle Prüfungen liefen **nach** beiden Phasen. `npm run perf:edge-routing`
allein, ohne konkurrierende Last.

| Prüfung                                                               | Ergebnis                                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run lint`                                                        | grün                                                                                 |
| `npm run format:check`                                                | grün („All matched files use Prettier code style!")                                  |
| `npx tsc -p tsconfig.typecheck.json --noEmit` + `tsconfig.tests.json` | grün                                                                                 |
| `npm run check` (Lint, Format, beide Typechecks, Coverage-Vollsuite)  | **grün**: 303 Dateien / 3957 Tests / 1 skipped, 429,38 s                             |
| `npx vitest run lib/`                                                 | 106 Dateien / 1722 Tests grün                                                        |
| `npm run routing:audit`                                               | 6 Pläne, I1–I7 = 0, `determ = true`                                                  |
| `npm run test:goldenmaster`                                           | 13 Tests grün, **keine Neuerfassung**                                                |
| `npm run test:regression`                                             | 68 Tests grün                                                                        |
| `npm run perf:edge-routing` (allein)                                  | Referenz 1,80 ms / p90 2,07 ms ≤ 16 ms; Live 189,85 ms / p90 207,32 ms ≤ 300 ms ⇒ OK |
| Gezielte 8 UI-/Verify-/AutoWire-Suiten                                | 8 Dateien / 117 Tests grün                                                           |
| `npm run build` (`next build` + SEO-Exportprüfung)                    | **grün**, 42 geprüfte Seiten, „Export-Prüfung grün"                                  |

**Erster `npm run check`-Lauf war rot** (4 Verfehlungen in 2 Dateien): zwei
bislang nicht berücksichtigte Verträge in `store/usePlannerStoreExtended.test.ts`
und `components/planner/hooks/useLiveValidation.test.ts` erwarteten für
230-V-Pläne keine neuen Hinweise. Beide wurden wie oben beschrieben verschärft;
der zweite Lauf ist grün. Das ist kein stilles Aufweichen, sondern die
verlangte Regression für eine Verhaltensänderung.

### 10.5 Ehrlich weiterhin offen

- **E2E/Playwright und visuelle Pixel-Baselines:** nicht ausgeführt.
  `npx playwright test --list` findet 696 Tests in 23 Dateien, aber im Sandbox
  ist kein Browser installiert; `npx playwright install chromium` scheitert an
  `ECONNRESET` beim Download von `cdn.playwright.dev` (Netzwerk-Allowlist
  dieses Arbeitsbereichs lässt den Host nicht zu). Diese Grenze ist eine
  Umgebungsbedingung, kein Testergebnis — es wird **kein** „E2E grün"
  behauptet.
- 24-px-Domänengate (ROUTE-003), ROUTE-018, ELE-002 (0,8 Ω, UNVERIFIED),
  ELE-001-Rest (B2 statt ISO 6722, f₃ = 1,0), PERF-001 (16 ms/Frame),
  Tastatur-/Accessibility-Abnahme M11-3.
- Keine normgeprüfte 230-V-Abnahme. PR #601 gegen `main` ist offen, der
  Branch ist gepusht; **kein Merge** in `main` ohne ausdrückliche Anweisung.
- §9 Punkt 8 bleibt protokollarisch offen. Im Nachlauf wurde `npm run build`
  nachgeholt (grün), die Regel-Docs aber erneut zu spät gelesen (siehe §10
  Eingang und §10.6) und E2E/Pixel-Baselines konnten aus
  Umgebungsgründen nicht ausgeführt werden. `docs/ai/CHANGE-WORKFLOW.md` §24 verlangt für UI
  zusätzlich E2E für den Bedienpfad und Vorher/Nachher 375/768/1440 hell+dunkel;
  dieses DoD ist damit **nicht vollständig erfüllt**.

### 10.6 Nachprüfung gegen ARCHITECTURE-RULES / CHANGE-WORKFLOW

| Regel / Schritt                                           | Befund                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** `lib/` importiert keine App-Schicht                 | `lib/verify/acScope.ts` und `lib/autoWire/reviewDiff.ts` importieren nur `lib/**`. `scripts/architecture/libBoundary.test.ts` grün (Allowlist bleibt leer).                                                                                                                                                                 |
| **B / D** kein React, keine UI-Rechnung                   | Beide neuen Module sind reine TypeScript-Projektionen. `WarningCenter.tsx` importiert nur `AC_ASSESSMENT_LABEL` (Anzeigetexte); `EdgeValues` im Review-Modal formatiert vorhandene Zahlen. `scripts/routing/architecture.test.ts`, `lib/routing/tokens.test.ts`, `lib/vde-consistency.test.ts` grün (4 Dateien / 40 Tests). |
| **M / N** kein stiller Fallback, ungültige Daten sichtbar | Ungültige Verlegebedingung ⇒ `valid: false` + „Nicht ausführbar … UNVERIFIABLE"; inkonsistenter Review-Vorher-Stand ⇒ **keine** erfundenen Werte, sondern Hinweis. `NET-003` hat `clause: null`, `provenance: 'UNVERIFIED'` — keine erfundene VDE-Anforderung (§22 Schritt 2).                                              |
| **O-3** Regressionstest + Ledger je Verhaltensänderung    | Zwei neue Suiten (15 Tests), vier neue Modal-Tests, zwei Inspector-/WarningCenter-Tests; LEDGER 2026-11-04 (2) und (3) in `docs/ARCHITECTURE-CHANGES.md`.                                                                                                                                                                   |
| **O-4** keine Tests abschwächen                           | Sechs bestehende Verträge wurden **verschärft** (§10.3); der erste `npm run check`-Lauf war deshalb rot und wurde nicht durch Erwartungs-Senkung grün gemacht.                                                                                                                                                              |
| **§22 Electrical**                                        | Es wurde **keine** physikalische Größe, Formel oder Tabelle geändert ⇒ keine neue G1–G7-Prüfung nötig; Normal-/Grenz-/Negativfälle der Projektion in `reviewDiff.test.ts` (Werte unverändert, ungültige Bedingung, leerer Plan), `tsconfig.tests.json` grün, Golden Master 13 ohne Neuerfassung.                            |
| **§23 Review-Checkliste**                                 | Invariante benannt (Modellreichweite / keine zweite Rechnung), Datenfluss `preview.edges` + `state.edges` → `reviewDiff` → Modal, `Called By` über die Tests abgedeckt, Determinismus über `localeCompare` und ID-Sortierung gesichert (Test), keine versteckte Konstante, keine Routing-/Sizing-Semantik geändert.         |
| **§24 UI-DoD**                                            | Komponententests grün; **E2E für den Bedienpfad und Pixel-Vorher/Nachher fehlen** → nicht vollständig erfüllt, siehe §10.5.                                                                                                                                                                                                 |

### 10.7 Nachtrag — Klartext-Vertrag der Warn-Zentrale (vor dem PR)

Beim Öffnen des Pull Requests lief die CI an; eine Durchsicht der E2E-Verträge
ergab, dass `tests/e2e/fresh-session-retest.spec.ts` im sichtbaren Prüfpanel
**keine** Rohkennungen (`I_[bnz2]`, `AMP-\d{3}`, `(In ≤`) und in den
Modellgrenzen dasselbe erwartet. Die zunächst offene `ac-scope-items`-Liste
hätte technische `basis`-Texte (`AMP-001…006`, `I_z`, `Z_s`) in dieses Panel
gebracht und den Vertrag gebrochen — E2E konnte im Sandbox nicht laufen, der
Vertrag wurde deshalb statisch geprüft.

**Korrektur:** Das Primärpanel nennt nur die Anzahl der Punkte in Klartext; die
vollständige Einzelliste mit Stufe, Grund und nötiger Prüfung steht unter
„Warum? Technische Details" (`toPlainGerman.ts` verlangt genau diese
Trennung). `WarningCenter.test.tsx` prüft mit der **echten**
`AC_230V_SCOPE_ITEMS`, dass das Primärpanel den Vertrag einhält und die
technischen Details nach dem Aufklappen vollständig erscheinen. Der neue
`ENGINE_LIMITATIONS`-Eintrag enthält selbst keine der verbotenen Zeichen
(Probe). Die Doku (§4/§5, VALIDATION-CONTEXT §8.3, LEDGER) ist präzisiert.

### 10.8 Nachtrag — CI-E2E-Befund und Klartext-Vertrag im AutoWire-Review

Der Push von `094862a` hat die CI vollständig durchlaufen. Ergebnis des Laufs
`41808094796` / `41808094797`:

| Check                                           | Ergebnis                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Quality Gate / Typecheck, Tests & Build`       | **pass** (13 min 28 s)                                                                                        |
| `Routing Quality Regression Check`              | **pass** (44 s)                                                                                               |
| `Qualität / Visuelles Gate (nicht blockierend)` | **pass** (4 min 47 s) — der Lighthouse-Fehler des vorherigen Laufs trat nicht erneut auf; kein Pixel-Mismatch |
| `Update Golden Master Baseline`                 | skipping (wie vorgesehen)                                                                                     |
| `Quality Gate / End-to-End (Playwright)`        | **fail** (28 min 55 s): 360 passed / 259 skipped / **1 failed**                                               |

Der Job-Log-Host (`results-receiver.actions.githubusercontent.com`,
`productionresultssa10.blob.core.windows.net`) ist von diesem Arbeitsbereich aus
nicht erreichbar (`EOF`); das Playwright-Report-Artefakt ließ sich deshalb nicht
herunterladen. Über die **Check-Run-Annotations** war der Fall dennoch eindeutig:
`[mobile-375] › tests/e2e/mobile-geometry.spec.ts:844 › Auto-verbinden abbrechen
› der Dialog spricht Klartext und Abbrechen ändert die Befunde nicht`. Der
Dialog muss ohne Rohkennungen auskommen
(`/AUTO-[A-Z0-9-]+|%20|auto-node:|ul248-classT|\bi2A\b/`); die empfangene
Zeichenkette enthielt `AUTO-BMS-000: Benötigt: 59 A …` aus der Spalte
„Begründung“ der in §10.2 ergänzten Leitungstabelle.

**Korrektur (LEDGER 2026-11-04 (4)):** Die Regel-ID steht nur noch als
`data-rule-id` am Element, nicht mehr im Klartext. Leitungslabel und Kanten-ID
werden durch `toPlainGerman` geschrieben; Konflikttexte waren es bereits.
`AutoWireReviewModal.test.tsx` hat jetzt 11 Fälle, darunter ein Vertragstest mit
**genau** dem E2E-Regex gegen `dialog.textContent` (strenger als `innerText`)
und ein Fall für technische Knoten-IDs/`%20`.
Es wurde kein Test entfernt, entschärft oder übersprungen. Die Änderung betrifft
ausschließlich die Anzeige — kein `lib/`-Modul, kein Sizing, keine Topologie,
kein Store-Feld.

**Verfahren:** `AGENTS.md`, `ARCHITECTURE-RULES.md`, `CHANGE-WORKFLOW.md` sowie
die thematischen Kontext-Dokumente (`AUTOWIRE-CONTEXT.md` §7.6a/§7.8,
`TESTING-CONTEXT.md` §9.3) wurden **vor** der Codeänderung gelesen (§23). Für
die früheren Commits bleibt §9 Punkt 8 offen; die falsche Reihenfolge ist nicht
nachträglich heilbar.

**Weiterhin offen:** Der CI-Lauf auf dem neuen Head ist abzuwarten. Lokal können
E2E und Pixel-Baselines wegen des fehlenden Browser-Binaries nicht ausgeführt
werden; §24 verlangt für UI außerdem Vorher/Nachher 375/768/1440 hell+dunkel.
Das DoD ist damit **nicht vollständig erfüllt**, und es wird kein „E2E grün“
behauptet. Der erste Lauf hat aber gezeigt, dass der statisch geprüfte
Klartext-Vertrag aus §10.7 (`fresh-session-retest.spec.ts`) in CI **bestanden**
hat — der einzige Fehler lag im zweiten, erst durch die neue Tabelle
entstandenen Dialogtext.
