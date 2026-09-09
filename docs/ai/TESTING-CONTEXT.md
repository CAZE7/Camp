# TESTING-CONTEXT

Welcher Testtyp existiert, was er beweist und **welcher Typ für welche Änderung verpflichtend
ist**.

**Baseline (verifiziert 2026-09-09):** `npm test` → **2018 Tests / 145 Dateien, grün**.
`npm run typecheck` und `npm run typecheck:tests` grün. `npm run routing:audit`: I1–I7 = 0,
Fallback 0, deterministisch.

---

## 9.1 Testtypen

| Typ                      | Ort                                                                                                                   | Werkzeug                            | Beweist                                                              | Befehl                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| **Unit**                 | `lib/**/*.test.ts`, `components/**/*.test.ts`                                                                         | Vitest (jsdom)                      | Funktion für Funktion, inkl. Grenzfälle                              | `npm test`                                        |
| **Integration**          | `store/*.test.ts`, `components/planner/**/*.test.tsx`                                                                 | Vitest + Testing Library            | Store-Aktionen, Hooks, Komponenten im Zusammenspiel                  | `npm test`                                        |
| **Property**             | `lib/vde-properties.test.ts`, `components/edges/utils/orthogonalRouting.invariants.test.ts`, `hananGridMasks.test.ts` | fast-check                          | Gesetze über tausende erzeugte Fälle (G1–G7, R1–R7)                  | `npm test`                                        |
| **Architektur-Gate**     | `scripts/routing/architecture.test.ts`, `scripts/architecture/libBoundary.test.ts`, `lib/routing/tokens.test.ts`      | Vitest + Dateiscan                  | Schichten, eine Quelle je Zuständigkeit, Token-Drift                 | `npm test`                                        |
| **Routing-Invarianten**  | `lib/routing/invariants.test.ts`, `invariantsCollisionParity.test.ts`, `scripts/routing/finalValidation.test.ts`      | Vitest                              | I1–I10, Ratchet über die sechs Referenzpläne                         | `npm test`, `npm run routing:audit`               |
| **Golden Master**        | `scripts/goldenmaster/`                                                                                               | Vitest + `knownPlans/*.json`        | AutoWire/Electrical/Routing-Ergebnis unverändert oder bewusst besser | `npm run test:goldenmaster`                       |
| **Regression (Routing)** | `scripts/regression/`                                                                                                 | Vitest + `goldenLayouts.json` + SVG | 15 Szenarien: Trassenstruktur, Metrik-Budget, Visual, Verhalten      | `npm run test:regression`                         |
| **Geometrie-Galerie**    | `docs/routing-gallery/` + `routingGallery.test.ts`                                                                    | Vitest                              | 25 konstruierte Szenarien Wegpunkt-genau                             | `npm test` (Recapture: `npm run routing:gallery`) |
| **Visuell (Pixel)**      | `tests/e2e/visual.spec.ts`                                                                                            | Playwright                          | gerenderte Seiten 375/768/1440, hell+dunkel                          | `npm run e2e -- visual`                           |
| **E2E**                  | `tests/e2e/*.spec.ts`                                                                                                 | Playwright gegen `./out`            | echte Bedienung inkl. Persistenz, Touch, a11y                        | `npm run e2e`                                     |
| **Performance**          | `benchmarks/`                                                                                                         | tsx-Sonden                          | Laufzeit-Trends (kein CI-Gate)                                       | `npm run perf:edge-routing`, `perf:route-scaling` |
| **Typ-Ebene**            | `tsconfig.tests.json`, `lib/units.typecheck.test.ts`                                                                  | tsc                                 | Einheiten wirken auch in Tests                                       | `npm run typecheck:tests`                         |
| **Infra-Gates**          | `scripts/ci/workflows.test.ts`, `lib/nextVersion.test.ts`, `lib/designTokens.test.ts`                                 | Vitest                              | Workflow-Sync, Security-Pin, Farb-/Kontrast-Tokens                   | `npm test`                                        |

**Nicht im CI:** `npm run audit:dead-code` (knip) — bewusst kein Gate, Befunde werden geprüft
(ADR 0006 §6).

---

## 9.2 Coverage-Gate

`vitest.config.ts` setzt Schwellen **nur für `lib/**`**:
Zeilen 90 %, Branches 85 %, Funktionen 90 %, Statements 95 %.
`lib/planner/**` ist bewusst ausgenommen; der UI-Baum hat **kein** Coverage-Gate
(Gerüsttests wären Scheinsicherheit).

---

## 9.3 Pflichtmatrix: Änderung → verpflichtende Tests

| Änderung                                                             | verpflichtend                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Routing** (Pfad, Kollision, Lane, Hop, Kosten, Token)              | Unit im betroffenen Modul · Invarianten-Suite · `npm run routing:audit` · Golden Master · Regression (15 Szenarien) · **Regressionstest für den konkreten Fall** · visuell (`npm run e2e -- visual`) · Domänen-Probe `npm run routing:domain-probe` |
| **Routing-Token / geometrische Konstante**                           | `lib/routing/tokens.test.ts` (Drift-Guard erweitern) · Galerie-Recapture (`npm run routing:gallery`) · Golden Master · Regression                                                                                                                   |
| **Electrical** (Strom, Querschnitt, Sicherung, Spannungsfall, Solar) | Unit · **Grenzfalltest** · **Negativtest** · Property-Test (passendes Gesetz G1–G7) · Golden Master                                                                                                                                                 |
| **Neue elektrische Konstante/Tabelle**                               | Unit mit Quellenangabe im Test · Konsistenz-Test (`lib/vde-consistency.test.ts`) · Golden Master                                                                                                                                                    |
| **AutoWire** (Topologie, Heilung, Sizing)                            | Unit · Idempotenz-Test · Golden Master · Final-Validation (Routing auf dem Ergebnis)                                                                                                                                                                |
| **Validierung** (neue/geänderte Regel)                               | Positivfall · Negativfall · Test, dass AutoWire-Pläne **nicht** feuern · Anzeige-Test (Chip/Warn-Zentrale)                                                                                                                                          |
| **Domänenmodell** (Typ, Feld, Schema)                                | `lib/nodeSchema.test.ts` · `store/slices/persistence.test.ts` · `components/nodes/types.test.ts`                                                                                                                                                    |
| **Store / Persistenz**                                               | `store/usePlannerStore*.test.ts` · `persistence.test.ts` · Migrationstest (Altstand)                                                                                                                                                                |
| **UI (Canvas, Panels, Nodes)**                                       | Komponententest (RTL) · E2E für den Bedienpfad · bei Optik: Vorher/Nachher-Screenshots 375/768/1440                                                                                                                                                 |
| **Neues Bauteil**                                                    | `componentRegistry.test.tsx` · `handleLayout.test.ts` · Node-Komponententest · AutoWire-Verhalten (wird es verdrahtet?)                                                                                                                             |
| **ELK / Layout**                                                     | `lib/routing/elk/elk.test.ts` · `routingV2Adapter.test.ts` · `PlannerDashboard.test.tsx` (Engine wird gemeldet)                                                                                                                                     |
| **Performance**                                                      | Benchmark-Sonde + dokumentierte Messung im PR (kein Gate, aber Nachweis)                                                                                                                                                                            |

**Immer zusätzlich:** `npm run check` (lint + format + typecheck ×2 + Tests) vor dem Commit.

---

## 9.4 Die Property-Gesetze (G1–G7)

Quelle: `lib/vde-properties.test.ts` (fast-check, ~1 000 Fälle je Gesetz).

| ID  | Gesetz                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Sicherungs-Sandwich: `Laststrom ≤ Sicherung ≤ FUSE_MAP[Querschnitt]`; die Kabelgrenze bleibt **unter** der derateten Belastbarkeit |
| G2  | Monotonie der Sicherungsauswahl (Strom ↑, Querschnitt ↑ ⇒ Sicherung nie ↓)                                                         |
| G3  | Monotonie des Spannungsfalls (Länge ↑ ⇒ ΔU nie ↓; Querschnitt ↑ ⇒ ΔU nie ↑) + Linearität im Strom                                  |
| G4  | Monotonie der Querschnittsauswahl + Ergebnis immer aus der Normreihe + thermischer Querschnitt trägt inkl. Derating                |
| G5  | Idempotenz von `performAutoWiring` (2. und 3. Lauf identisch)                                                                      |
| G6  | AC/DC-Trennung jeder erzeugten Verbindung · Domänen-Markierung korrekt · Polgleichheit · **jede Kante dimensioniert**              |
| G7  | `sizeDcEdges`-Konvergenz: `sizeDcEdges(sizeDcEdges(x)) == sizeDcEdges(x)`                                                          |

Bekannte Grenze (im Test dokumentiert): eine **widersprüchliche gespeicherte** Domänenmarkierung
gewinnt gegen die Topologie — bewusst, weil gestempelte Daten Vorrang vor Rekonstruktion haben.

Details: `docs/PROPERTY-TESTS.md`.

---

## 9.5 Golden Master & Regression im Detail

**Golden Master** (`scripts/goldenmaster/`) — Pipeline je Plan:
`Input → AutoWire → Electrical → Routing`, eingefroren in `knownPlans/<plan>.json`.
Pro Plan werden geprüft: Knotenliste, Kanten-IDs, `electrical` (Systemspannung, Ströme,
kumulierte Drops), `routing` (Waypoints/Länge/Bends/Crossings/`usedSearch`) — plus ein
byte-genauer Gesamtvergleich und ein Determinismus-Doppellauf.

- Recapture: `npm run goldenmaster:capture`
- Regel: nur mit PR-Begründung + Ledger-Eintrag (`docs/ARCHITECTURE-CHANGES.md`).
- Details: [GOLDEN-PLANS.md](./GOLDEN-PLANS.md)

**Regression** (`scripts/regression/`) — 15 Szenarien, vier Gates:

1. **Golden Layout** — Trassenstruktur Wegpunkt für Wegpunkt.
2. **Metrik-Budget** — Kreuzungen/Bends/Länge ≤ Baseline, Clearance-Verstöße = 0.
3. **Visuell** — neu gerenderte SVGs byte-genau gegen `docs/routing-regression/`.
4. **Verhalten** — p13 Drag-und-zurück, p14 Undo/Redo, p15 Pass-Wechsel ELK→A*→ELK: byte-identisch.

**Geometrie-Galerie** — 25 Szenarien (`components/edges/utils/routingScenarios.ts`) plus
`docs/routing-gallery/nutzerplan-autowire.svg` (realer AutoWire-Plan). Recapture nur mit
Begründung (`npm run routing:gallery`).

---

## 9.6 E2E

- Läuft gegen den **gebauten Static Export** (`./out`), nicht gegen den Dev-Server.
- Vier Projekte: `desktop-1440`, `tablet-768`, `mobile-375`, `touch-pixel5` (echte Touch-Emulation).
- Einrichtung: `npm run e2e:install` (Chromium), dann `npm run e2e`.
- Enthalten: `a11y` (axe, critical/serious = Fail), `planner-flow`, `persistence`, `responsive`,
  `touch`, `controls-overlap`, `expert-panel`, `visual`.
- Selektor-Vertrag: `components/e2eSelectors.test.tsx` prüft die Selektoren **ohne Browser**.
- Ehrlicher Status: die Suite ist vollständig geschrieben und im CI eingebunden; der lokale
  Browser-Download war in der Entwicklungsumgebung blockiert → `docs/E2E-TESTS.md`.

---

## 9.7 Anti-Patterns (was nie getan werden darf)

1. Einen Test löschen oder abschwächen, damit CI grün wird.
2. Eine Baseline **anheben**, ohne zu belegen, dass der Plan insgesamt besser wurde.
3. Golden-Master-Fixtures neu erfassen, nur weil ein Test rot ist.
4. `it.skip` / `.only` einchecken (`forbidOnly` ist im CI aktiv).
5. Einen „Szenario-Test“ schreiben, der nur prüft, dass nichts crasht — Trassenstruktur und
   Metriken sind der Maßstab.
6. Unit-Tests gegen eine **Zwischenrepräsentation** prüfen, die der Renderer nicht benutzt
   (das war der historische Doppel-Router-Fehler: grüne Tests an der falschen Engine).
