# Engineering Constitution — Camp

**Stand:** 2026-11-04  
**Status:** Verbindliches Regelwerk für alle Entwickler und KI-Agenten  
**Geltung:** Jede zukünftige Änderung am Camp-Repository muss diese Regeln einhalten.  
**Übergeordnet:** `docs/architecture/SYSTEM-ARCHITECTURE.md`, `docs/architecture/ARCHITECTURE-RULES.md`  
**Untergeordnet:** `docs/engineering/DEFINITION-OF-DONE.md`, `docs/safety/*`, `docs/verification/*`, `docs/CI.md`

---

## Vorwort

Camp ist ein Planungswerkzeug für Camper-Elektrik (12 V / 230 V / Solar). Es ist **kein** Nachweis einer normgerechten Auslegung. Mehrere Werte sind bewusst Modellannahmen. Die Constitution dient einem Ziel: ein nachweisbar zuverlässiges Produkt und ein dauerhaft funktionierender Entwicklungsprozess — kein möglichst großes Testsystem.

Jede Regel ist so formuliert, dass sie von Menschen gelesen und, soweit möglich, von Maschinen (Tests, CI, Linter, TypeChecker) geprüft werden kann.

---

## 1. Architekturregeln

Die Architekturregeln in `docs/architecture/ARCHITECTURE-RULES.md` (Regeln A–N sowie S-1 bis S-10) sind verbindlicher Teil dieser Constitution.

Zusätzlich gilt für alle Änderungen:

| # | Regel | Durchsetzung |
|---|-------|--------------|
| C-1 | Die Schichtentrennung (SYSTEM-ARCHITECTURE §2) ist einseitig: UI → Application → Domain → Electrical Engine → Graph & Routing. Nie umgekehrt. | `libBoundary.test.ts`, `routing/architecture.test.ts`, Code-Review |
| C-2 | `lib/` importiert nichts aus `components/`, `store/`, `app/`, `benchmarks/`. | `libBoundary.test.ts` (erzwungen) |
| C-3 | Routing schreibt keine elektrische Semantik; UI implementiert keine elektrischen Berechnungen. | `ARCHITECTURE-RULES.md` C, D; Code-Review |
| C-4 | Determinismus: gleiche Eingabe ⇒ byte-identisches Ausgabe; kein `Math.random`, keine unsortierte Iteration im Routing/Domain. | `goldenMaster.test.ts`, `regression.test.ts`, `routing:audit` |
| C-5 | Eine Quelle je Zuständigkeit (SSOT-Tabelle SYSTEM-ARCHITECTURE §4). Duplikate sind ein Architekturverstoß. | Architektur-Review |
| C-6 | Keine stillen Fallbacks bei sicherheitskritischen Werten (Regel M). Unbekannt ist ein eigener Zustand. | `units.ts`, Code-Review |
| C-7 | Keine Änderungen an parallelen PRs oder Branches; keine Überschreibung bestehender Arbeiten (Aufgabe 13). | Prozess / Git-Workflow |
| C-8 | Keine Testabschwächung, keine erfundenen Nachweise (Aufgabe 13). | Code-Review, CI |

---

## 2. Anforderungen und Abnahmekriterien

### 2.1 Anforderklassen

| Klasse | Bedeutung | Beispiel |
|---|---|---|
| **S** (Sicherheit) | Sicherheitskritisch; darf nicht durch niedrige Priorisierung oder grünen Testlauf als erledigt gelten. | Abschaltvermögen, I_B ≤ I_n ≤ I_z, 20-cm-Regel, RCD |
| **F** (Funktion) | Fachlich geforderte Funktion. | AutoWire-Topologie, Spannungsfall-Budget |
| **Q** (Qualität) | Code- und Testqualität, Determinismus, Performance. | 16-ms-Render, 60-ms-Live-Routing-Ratchet |
| **D** (Daten) | Datenherkunft, Versionierung, Verifizierungsstatus. | Bauteildaten, Quellenangaben |
| **P** (Prozess) | CI, Release, Review, Dokumentation. | Merge-Gates, Ledger-Einträge |

### 2.2 Abnahmekriterien

Jede Anforderung muss vor der Implementierung (oder, bei Bestand, vor der Freigabe als erledigt) folgende Kriterien erfüllen:

1. **Nachvollziehbare fachliche Grundlage** (Norm, Datenblatt, Modellannahme mit Quellenangabe).
2. **Einzelne Implementierungsstelle** (SSOT).
3. **Mindestens ein Test** (Unit, Property oder Integration) mit Positiv- und Negativfall.
4. **Akzeptanz im Review** durch eine zweite Person (bei sicherheitskritisch: zwei Personen, davon eine nicht am Code beteiligt).
5. **Nachweis im Release** (REQUIREMENTS-MATRIX + Release-Report).
6. **Dokumentation aktualisiert** (Architecture, Safety, Verification, Datenqualität, soweit betroffen).

Sicherheitskritische Anforderungen (Klasse S) benötigen zusätzlich:
- Einen Verifikationsnachweis (mathematisch nachgewiesen / durch Tests verifiziert / anhand externer Datenquellen belegt / fachlich unabhängig geprüft / noch ungeklärt — SAFETY-CASE §4).
- Einen Eintrag im Risk Register.
- Einen Release-Gate-Eintrag, der den Merge blockiert, solange der Nachweis fehlt.

---

## 3. Codequalität

| # | Regel | Mittel |
|---|-------|--------|
| Q-1 | Kein `any`, kein `@ts-ignore`, kein `as unknown as` als Dauerzustand. (O-1) | ESLint, TypeScript `noImplicitAny`, Code-Review |
| Q-2 | `npm run typecheck` und `npm run typecheck:tests` grün. | tsc (zwei tsconfigs) |
| Q-3 | `npm run lint` grün. | ESLint |
| Q-4 | `npm run format:check` grün. | Prettier |
| Q-5 | Coverage-Gate für `lib/**`: Zeilen 90 %, Branches 85 %, Funktionen 90 %, Statements 95 %. (`lib/planner/**` bewusst ausgenommen.) | vitest `--coverage` |
| Q-6 | Keine Tests löschen oder abschwächen, damit CI grün wird. (O-4) | Code-Review, CI |
| Q-7 | `forbidOnly` aktiv; kein `it.skip` / `.only` einchecken. | vitest CI |
| Q-8 | Neue Konstanten mit physikalischer/geometrischer Bedeutung an SSOT-Stelle (tokens.ts / Normtabelle), nie inline. (O-2) | Code-Review |
| Q-9 | TODOs mit Area-Tag (`TODO[ROUTING]:` …); nackte `TODO` unzulässig. (O-5) | Code-Review / grep |
| Q-10 | Kein Hex in TSX/TS; Farben nur über CSS-Variablen `var(--de-*)`. | `designTokens.test.ts`, GOVERNANCE.md |

---

## 4. Testpflichten

### 4.1 Pflichtmatrix (Änderung → verpflichtende Tests)

| Änderung | Verpflichtend |
|---|---|
| **Routing** (Pfad, Kollision, Lane, Hop, Kosten, Token) | Unit im Modul · Invarianten-Suite · `npm run routing:audit` · Golden Master · Regression (15 Szenarien) · Regressionstest für den konkreten Fall · visuell (`npm run e2e -- visual`) · Proben `routing:domain-probe` / `routing:lane-probe` |
| **Routing-Token / geometrische Konstante** | `lib/routing/tokens.test.ts` (Drift-Guard erweitern) · Galerie-Recapture · Golden Master · Regression |
| **Electrical** (Strom, Querschnitt, Sicherung, Spannungsfall, Solar) | Unit · Grenzfalltest · Negativtest · Property-Test (passendes Gesetz G1–G7) · Golden Master |
| **Neue elektrische Konstante / Tabelle** | Unit mit Quellenangabe im Test · Konsistenz-Test (`lib/vde-consistency.test.ts`) · Golden Master |
| **AutoWire** (Topologie, Heilung, Sizing) | Unit · Idempotenz-Test · Golden Master · Final-Validation (Routing auf dem Ergebnis) |
| **Validierung** (neue / geänderte Regel) | Positivfall · Negativfall · Test, dass AutoWire-Pläne nicht feuern · Anzeige-Test (Chip / Warn-Zentrale) |
| **Domänenmodell** (Typ, Feld, Schema) | `lib/nodeSchema.test.ts` · `store/slices/persistence.test.ts` · `components/nodes/types.test.ts` |
| **Store / Persistenz** | `store/usePlannerStore*.test.ts` · `persistence.test.ts` · Migrationstest (Altstand) |
| **UI** (Canvas, Panels, Nodes) | Komponententest (RTL) · E2E für Bedienpfad · bei Optik: Vorher/Nachher-Screenshots 375/768/1440 |
| **Neues Bauteil** | `componentRegistry.test.tsx` · Node-Komponententest · `app/handleGeometry.test.ts` (Handle-Pixel) · AutoWire-Verhalten (wird es verdrahtet?) |
| **ELK / Layout** | `lib/routing/elk/elk.test.ts` · `routingV2Adapter.test.ts` · `PlannerDashboard.test.tsx` (Engine wird gemeldet) |
| **Performance** | Benchmark-Sonde + dokumentierte Messung im PR (kein Gate, aber Nachweis) |

### 4.2 Immer zusätzlich

- `npm run check` (lint + format + typecheck ×2 + Coverage) vor jedem Commit.
- Bei sicherheitskritischen Änderungen: Review durch zwei Personen, davon eine nicht am Code beteiligt.
- Bei Änderungen an `lib/electrical.ts`, `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`: Golden Master neu rechnen und Abweichung begründen.

### 4.3 Anti-Patterns (nie tun)

1. Einen Test löschen oder abschwächen, damit CI grün wird.
2. Eine Baseline anheben, ohne zu belegen, dass der Plan insgesamt besser wurde.
3. Golden-Master-Fixtures neu erfassen, nur weil ein Test rot ist.
4. `it.skip` / `.only` einchecken (`forbidOnly` ist im CI aktiv).
5. Einen „Szenario-Test“ schreiben, der nur prüft, dass nichts crasht — Trassenstruktur und Metriken sind der Maßstab.
6. Unit-Tests gegen eine Zwischenrepräsentation prüfen, die der Renderer nicht benutzt (historischer Doppel-Router-Fehler).

---

## 5. Umgang mit sicherheitskritischen Berechnungen

| # | Regel |
|---|-------|
| SC-1 | Sicherungskritische Dateien sind eingefroren außer mit Tests + explizitem Review: `lib/electrical.ts` (Sicherungsgrenzen), `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`, `lib/routing/invariants.ts` (I1–I7), `lib/routing/rules/collision.ts`, `lib/routing/tokens.ts`. |
| SC-2 | `I_B ≤ I_n ≤ I_z` per Konstruktion. `selectFuseSize` gibt niemals mehr als `FUSE_MAP[crossSection]` zurück (ELEC-001). |
| SC-3 | Keine Normbehauptung ohne Quelle. `UNVERIFIED` im Code ⇒ Dokumentation darf nicht härten. |
| SC-4 | Datenlücke ⇒ „nicht bewertbar“, niemals geschätzter Grenzwert (Regel S-3). Keine Datenlücke erscheint als `critical`. |
| SC-5 | Eine neue `critical`-Regel ist ein Versprechen: sie braucht (1) eine benannte Quelle im `source`-Feld, (2) einen Test mit Negativfall, (3) den Nachweis, dass sie im auto-verdrahteten Referenzplan nicht aus Versehen feuert. Gegenprobe: `npm run goldenmaster:capture` → `npm run test:goldenmaster`. |
| SC-6 | Sicherheitskritische Fehler dürfen nicht durch niedrige Priorisierung oder einen grünen Testlauf als erledigt gelten. Sie benötigen einen Risk-Register-Eintrag und einen Verifikationsnachweis (SAFETY-CASE). |
| SC-7 | Die 230-V-Modellgrenze ist ausgewiesen (`NET-003-ac-model-scope`, `INCOMPLETE`). Ein 230-V-Plan wird niemals als „geprüft“ dargestellt. (`docs/AC-230V-MODELLGRENZEN.md`) |

---

## 6. Datenherkunft und Versionierung

| # | Regel |
|---|-------|
| DH-1 | Jede technische Komponente trägt: Hersteller, Modell, Datenblatt, Quellenreferenz, Datenversion, technische Eigenschaften mit Einheiten, Gültigkeitsbereich, Annahmen, Verifizierungsstatus, Änderungshistorie. |
| DH-2 | Ungeprüfte Herstellerangaben dürfen nicht als unabhängig verifizierte technische Fakten dargestellt werden. Verifizierungsstatus muss einsehbar sein. |
| DH-3 | Bauteildaten werden versioniert (Datenversion je Bauteil). Änderungen an technischen Daten benötigen einen Ledger-Eintrag und, falls sie Berechnungen betreffen, ein Golden-Master-Recapture mit Begründung. |
| DH-4 | Plan-Datei: `PLANNER_STORAGE_VERSION = 1`, Storage-Key `elektroplaner-planner-v1`. Migration wendet Feldschemas an, entfernt falsch getippte bekannte Felder, behält unbekannte (Forward-Kompatibilität). |
| DH-5 | Messwerte (`measured`/`width`/`height`) sind kein Planinhalt und werden nicht persistiert (Rule R). |
| DH-6 | Jede Kante, deren Länge aus AutoWire stammt, trägt `lengthIsAssumption: true`; sobald der Nutzer einen Wert einträgt, gilt er als Messwert. |

---

## 7. Reviewpflichten

| Änderung | Review | Besonderheit |
|---|---|---|
| Normale Feature-/Bugfix-Änderung | 1 genehmigtes Review (Branch Protection) | `npm run check` grün |
| Sicherheitskritisch (SC-1, Klasse S) | 2 Reviews, davon 1 nicht am Code beteiligt | Risk-Register-Eintrag + Verifikationsnachweis |
| Architekturregel (A–N, S-1–S-10, C-1–C-8) | Architektur-Review + ggf. ADR | Widerspruch dokumentieren, Heilungspfad im Ledger |
| Elektrische Formeln / Berechnungsdaten | 2 Reviews + Golden-Master-Nachweis | In Phase 1 verboten (Aufgabe 13) |
| CI / Release-Gates | 1 Review + Repo-Admin für Workflow-Dateien | `workflows:write` nötig |
| Dokumentation (Architecture, Safety, Verification, Datenqualität) | 1 Review | Bei betroffenem Bereich Pflicht |

**CODEOWNERS:** `.github/CODEOWNERS` (`* @CAZE7`).

---

## 8. Dokumentationspflichten

| Änderung | Zu aktualisierende Dokumentation |
|---|---|
| Neue / geänderte Architekturregel | `ARCHITECTURE-RULES.md`, `SYSTEM-ARCHITECTURE.md`, `ARCHITECTURE-CHANGES.md` (Ledger) |
| Neue / geänderte Sicherheitssachverhalt | `SAFETY-PLAN.md`, `RISK-REGISTER.md`, `SAFETY-CASE.md` |
| Neue / geänderte Anforderung | `REQUIREMENTS-MATRIX.md` |
| Neue / geänderte Verifikationsmethode | `VERIFICATION-STRATEGY.md` |
| Neue / geänderte Daten / Komponente | Datenqualitätsdokument (Komponentenregister, Datenversion, Quellen) |
| Neue / geänderte CI / Release-Gate | `RELEASE-GATES.md`, `.github/workflows/`, `CI.md` |
| Neue / geänderte technische Berechnung | `ELECTRICAL-CONTEXT.md` (bzw. Fachdoku), Golden Master, Ledger |
| Verhaltensänderung (jeder Art) | `ARCHITECTURE-CHANGES.md` (Ledger-Eintrag mit Datum und Begründung) |

**Vermeide doppelte Wahrheitsquellen und veraltete Dokumente.** Bei Widerspruch zwischen Dokument und Code: Code ist autoritativ für das Ist, Dokument für das Soll. Widerspruch muss aufgelöst werden, bevor der Merge erfolgt.

---

## 9. Umgang mit Migrationen

| # | Regel |
|---|-------|
| M-1 | Migrationen wenden Feldschemas an (`sanitizeNodeDataBySchema`, `sanitizeEdgeData`): falsch getippte bekannte Felder werden entfernt, unbekannte bleiben erhalten. Kein stiller Default. |
| M-2 | Speicherversion (`PLANNER_STORAGE_VERSION`) wird nur erhöht bei inkompatiblen Schema-Änderungen. Jeder Versionsschritt braucht einen Migrationspfad und einen Test (`persistence.test.ts`, Migrationstest Altstand). |
| M-3 | Bestehende Projekte (v1) müssen lesbar bleiben. Rückwärtskompatibilität ist eine harte Anforderung. |
| M-4 | Migrationen dürfen keine elektrischen Berechnungsdaten still verändern. |
| M-5 | Jede Migration braucht einen Test mit Altbestand-Fixture und einen Ledger-Eintrag. |

---

## 10. CI und Releasefreigaben

| Gate | Blockiert Merge | Blockiert Release |
|---|---|---|
| Build & Type Safety (`npm run build`, `typecheck` ×2) | Ja | Ja |
| Lint & Format | Ja | Ja |
| Unit- & Integrationstests (Coverage-Gate `lib/**`) | Ja | Ja |
| Architekturtests (A, E–J, P, Q, R) | Ja | Ja |
| Routing-Invarianten (I1–I3 hart 0, Ratchet, Determinismus) | Ja | Ja |
| Elektrische Berechnungen (Golden Master, vde-properties G1–G7) | Ja | Ja |
| Graph & Routing (Regression 15 Szenarien, audit) | Ja | Ja |
| Komponenten- & Datenvalidierung (Schemas, Registry) | Ja | Ja |
| Warnsystem (Validierungsregeln, keine Datenlücke als critical) | Ja | Ja |
| Persistenz & Migration (Migrationstests) | Ja | Ja |
| Exporte (BOM, PDF — soweit vorhanden) | Ja (bei Änderung) | Ja |
| Security (keine Secrets im Repo, CSP, statischer Export) | Ja | Ja |
| Accessibility (axe critical/serious = Fail) | Ja | Ja |
| E2E (Playwright gegen `./out`) | Ja | Ja |
| Visual Regression (Pixel, soweit baselines gefroren) | Melden (nicht blockierend, siehe TEST-002) | Bei UI-Freigabe blockierend |

**Releasefreigabe:** Erst wenn alle Merge-Gates grün, alle Release-Gates grün, alle sicherheitskritischen Anforderungen verifiziert und im Risk Register behandelt sind, und der Release-Report unterschrieben ist (SAFETY-CASE).

---

## 11. Umgang mit technischen Schulden

| # | Regel |
|---|-------|
| TD-1 | Technische Schulden sind kontrolliert und dokumentiert (KNOWN-PROBLEMS.md, Risk Register, Architektur- Ledger). Keine stillen Schulden. |
| TD-2 | Jeder Eintrag in KNOWN-PROBLEMS.md ist ein echtes, im Code nachweisbares Problem — keine Wunschliste, keine allgemeinen TODOs. |
| TD-3 | Bekannte Lücken (z. B. ROUTE-003 Domänen-Trennregeln nicht angebunden, ELE-001 Fahrzeug-Leitungskontext teilweise, PERF-001 Live-Performance) bleiben als offene Restrisiken im Risk Register sichtbar. |
| TD-4 | Tilgung von Schulden benötigt einen eigenen ADR / Ledger-Eintrag mit Messung vor/nachher. Keine stillen „Werte verbessern“ ohne Golden-Master-Recapture und Quellenangabe. |
| TD-5 | Leistungsbudgets (16 ms Render, 60 ms Live-Routing) werden als Ratchet gehalten, nicht still angehoben. |

---

## 12. Verbindlicher Arbeitsmodus (Phase 1)

In dieser ersten Phase gilt zusätzlich (Aufgabe 13):

- Keine Implementierung.
- Keine Änderungen an elektrischen Formeln.
- Keine Änderungen an bestehenden Berechnungsdaten.
- Keine unnötigen Refactorings.
- Keine Änderungen an parallelen PRs oder Branches.
- Keine Überschreibung bestehender Arbeiten.
- Keine Testabschwächung.
- Keine erfundenen Nachweise.

Zuerst die gesamte bestehende Architektur und die vorhandenen Arbeiten erfassen — dieses Dokument und die zugehörigen Architecture-/Safety-/Verification-Dokumente sind das Ergebnis dieser Erfassung.

---

## 13. Inkrafttreten

Diese Constitution ist mit Erstellung verbindlich. Abweichungen benötigen eine begründete Ausnahme im `ARCHITECTURE-CHANGES.md`-Ledger und, bei sicherheitskritischen Abweichungen, einen Risk-Register-Eintrag sowie einen Verifikationsnachweis.
