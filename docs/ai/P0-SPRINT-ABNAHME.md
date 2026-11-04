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
