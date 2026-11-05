# Definition of Done (DoD) — Camp

**Stand:** 2026-11-04  
**Status:** Verbindlich  
**Geltung:** Jeder Code-Change, jeder Pull Request, jeder Release und jede sicherheitskritische Änderung.  
**Übergeordnet:** `docs/engineering/ENGINEERING-CONSTITUTION.md`, `docs/architecture/ARCHITECTURE-RULES.md`  
**Ergänzt:** `docs/verification/RELEASE-GATES.md`, `docs/safety/SAFETY-CASE.md`

---

## 1. Zweck

Die Definition of Done legt fest, wann eine Aufgabe als „erledigt“ gilt. Sie verhindert, dass Aufgaben im Git-Log als abgeschlossen stehen, obwohl fachlich, sicherheitstechnisch oder qualitätssichernd noch Lücken bestehen. Ein grüner CI-Lauf allein ist **kein** Abschlusskriterium (vgl. SAFETY-CASE §3).

---

## 2. DoD für jeden Code-Change (Commit / PR)

Eine Änderung gilt erst dann als erledigt, wenn **alle** der folgenden Punkte erfüllt sind:

| # | Kriterium | Nachweis / Befehl |
|---|-----------|-------------------|
| D-1 | `npm run check` grün (lint + format + typecheck ×2 + Coverage) | `npm run check` |
| D-2 | Alle betroffenen Unit- und Integrationstests grün | `npx vitest run <betroffene Pfade>` |
| D-3 | Pflichtmatrix der Constitution §4.1 vollständig erfüllt | Verfassung §4.1 |
| D-4 | Kein `any`, kein `@ts-ignore`, kein `as unknown as` als Dauerzustand | ESLint / Review |
| D-5 | Keine Tests gelöscht, abgeschwächt, `skip` oder `only` eingebracht | `forbidOnly`, grep, Review |
| D-6 | Keine Baseline angehoben ohne Nachweis, dass der Plan insgesamt besser wurde | Review + Messung |
| D-7 | Architekturregeln eingehalten (A–N, S-1–S-10, C-1–C-8) | `ARCHITECTURE-RULES.md` §E, Review |
| D-8 | Bei Routing-Änderung: `npm run routing:audit` (I1–I3 = 0, Ratchet, Determinismus) | `npm run routing:audit` |
| D-9 | Bei Elektrik-Änderung: Golden Master neu gerechnet, Abweichung begründet | `npm run goldenmaster:capture` → `test:goldenmaster` |
| D-10 | Bei Validierungs-Regel-Änderung: Positiv-, Negativ- und „AutoWire-Pläne feuern nicht“-Test | `useLiveValidation.test.ts`, `CableEdge.test.tsx` |
| D-11 | Jeder Bugfix hat einen Regressionstest | `ARCHITECTURE-CHANGES.md` + Test |
| D-12 | Jede Verhaltensänderung hat einen Ledger-Eintrag | `docs/ARCHITECTURE-CHANGES.md` |
| D-13 | Betroffene Dokumentation aktualisiert (Architecture, Safety, Verification, Datenqualität, soweit betroffen) | ENGINEERING-CONSTITUTION §8 |
| D-14 | Review-Pflicht erfüllt (1 Review; bei sicherheitskritisch: 2 Reviews, davon 1 extern) | GitHub PR Review |
| D-15 | Keine TODOs ohne Area-Tag; keine nackten `TODO` | `ARCHITECTURE-RULES.md` O-5 |
| D-16 | Keine Änderungen an parallelen PRs/Branches; keine Überschreibung bestehender Arbeiten | Git-Workflow |

**Ein Change ist erst „Done“, wenn D-1 bis D-16 erfüllt sind.** Ein Commit ohne diese Punkte ist kein fertiger Arbeitsschritt, sondern ein Zwischenstand.

---

## 3. DoD für einen Pull Request

Ein Pull Request gilt als merge-reif, wenn zusätzlich zu D-1–D-16:

| # | Kriterium | Nachweis |
|---|-----------|----------|
| PR-1 | Qualität Gate (`.github/workflows/quality.yml`) grün: Install, Lint, Format, Typecheck, Tests mit Coverage, Perf-Gate, Build | CI-Lauf |
| PR-2 | E2E-Gate (Playwright gegen `./out`) grün | CI-Lauf `ci.yml` |
| PR-3 | Required Status Checks bei Branch Protection (geplant, noch nicht aktiv in GitHub) |  §4 (manuelle Einrichtung durch Repo-Admin nötig) |
| PR-4 | Genehmigtes Review (bei sicherheitskritisch: 2 Reviews, davon 1 extern) | GitHub PR Review |
| PR-5 | Branch ist up-to-date mit dem Ziel-Branch | Branch Protection „Require branches to be up to date“ |
| PR-6 | Ledger-Einträge für alle Verhaltensänderungen vorhanden | `ARCHITECTURE-CHANGES.md` |
| PR-7 | Keine erfundenen Nachweise; alle Behauptungen durch Code, Tests oder Dokumente belegt | Review |

**Merge erst nach PR-1 bis PR-7.** Ein PR, der diese Punkte nicht erfüllt, wird nicht gemergt.

---

## 4. DoD für sicherheitskritische Änderungen

Sicherheitskritisch sind Änderungen an:

- `lib/electrical.ts`, `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`
- `lib/routing/invariants.ts`, `lib/routing/rules/collision.ts`, `lib/routing/tokens.ts`
- Validierungsregeln mit `severity: critical` (`collectEdgeErrors`, `useLiveValidation`, `lib/verify/`)
- Bauteildaten und Komponentenregister mit sicherheitsrelevanten Werten

Zusätzlich zu D-1–D-16 und PR-1–PR-7:

| # | Kriterium | Nachweis |
|---|-----------|----------|
| S-1 | Risk-Register-Eintrag erstellt oder aktualisiert | `docs/safety/RISK-REGISTER.md` |
| S-2 | Verifikationsnachweis gemäß SAFETY-CASE §4 (mathematisch nachgewiesen / durch Tests verifiziert / anhand externer Datenquellen belegt / fachlich unabhängig geprüft / noch ungeklärt) | `docs/safety/SAFETY-CASE.md` + Tests |
| S-3 | Anforderung in REQUIREMENTS-MATRIX erfasst und mit Implementierung, Test und Ergebnis verknüpft | `docs/verification/REQUIREMENTS-MATRIX.md` |
| S-4 | Zwei Reviews, davon eine Person nicht am Code beteiligt | GitHub PR Review |
| S-5 | Keine Datenlücke als `critical` dargestellt; „nicht bewertbar“ bleibt `incomplete` | `lib/validationSeverity.ts` + Review |
| S-6 | Freigabe im Safety Case dokumentiert (Argumentation + Nachweise) | `docs/safety/SAFETY-CASE.md` |

**Ein sicherheitskritischer Fehler gilt nicht als erledigt durch niedrige Priorisierung oder einen grünen Testlauf.** Er erfordert S-1 bis S-6.

---

## 5. DoD für eine Veröffentlichung (Release)

Eine Veröffentlichung (öffentlicher Release, Deploy auf Default-Branch) gilt als freigegeben, wenn:

| # | Kriterium | Nachweis |
|---|-----------|----------|
| R-1 | Alle Merge-Gates von RELEASE-GATES grün | CI + Qualität Gate |
| R-2 | Alle sicherheitskritischen Anforderungen verifiziert und im Risk Register behandelt (offene Restrisiken dokumentiert) | SAFETY-CASE, RISK-REGISTER |
| R-3 | Release-Report erstellt (Version, Änderungen, Verifikationsergebnisse, offene Risiken) | Release-Dokumentation |
| R-4 | Dokumentation auf aktuellem Stand (Architecture, Safety, Verification, Datenqualität, Release Engineering) | Alle DOKUMENTE |
| R-5 | Reproduzierbarer Build: `npm ci` ohne Lockfile-Manipulation, feste Node-Version aus `.nvmrc`, Actions per SHA gepinnt | `docs/CI.md`, `package-lock.json` |
| R-6 | Post-Deploy Smoke-Check erfolgreich (HTTP 200, Bundle-Dateinamen präsent) | `deploy.yml` Smoke-Check |
| R-7 | Sicherheit: keine Secrets im Repo, statischer Export ohne Backend, CSP-Header | `ARCH-001`, `docs/adr/0038` |

**Release erst nach R-1 bis R-7.**

---

## 6. DoD für Dokumentationsänderungen

| # | Kriterium |
|---|-----------|
| DOC-1 | Keine doppelten Wahrheitsquellen; bestehende Dokumente werden verbessert statt dupliziert |
| DOC-2 | Widerspruch zwischen Dokument und Code aufgelöst oder dokumentiert |
| DOC-3 | Datum und Status im Dokumentkopf aktualisiert |
| DOC-4 | Bei Änderung von Architektur-, Safety-, Verifikations- oder Datenqualitätsdokumenten: Review durch eine zweite Person |

---

## 7. Eskalation bei nicht erfüllbarem DoD

Wenn ein DoD-Kriterium aus fachlichen oder technischen Gründen nicht erfüllt werden kann:

1. Begründung im `ARCHITECTURE-CHANGES.md`-Ledger festhalten.
2. Bei sicherheitskritischen Kriterien: Risk-Register-Eintrag als **offenes Restrisiko** mit Verantwortlichem und Zieltermin.
3. Die Änderung darf nur mit ausdrücklicher Freigabe durch den Product Owner und den Safety-Verantwortlichen gemergt werden.
4. Der offene Punkt wird in die `ENGINEERING-QUALITY-ROADMAP.md` aufgenommen.
