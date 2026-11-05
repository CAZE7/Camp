# Release Gates — Camp (Qualitätsgates für Merge und Release)

**Stand:** 2026-11-04  
**Status:** Verbindlich  
**Verantwortlich:** Quality Engineering (Gates), Product Owner (Release-Freigabe)  
**Übergeordnet:** `docs/engineering/ENGINEERING-CONSTITUTION.md` (§10 CI und Releasefreigaben), `docs/engineering/DEFINITION-OF-DONE.md`, `docs/CI.md`, `docs/architecture/ARCHITECTURE-RULES.md`  
**Zweck:** Definition verbindlicher Qualitätsgates und welcher Fehler Merge oder Release blockiert.

---

## 1. Grundsätze

| # | Grundsatz |
|---|-----------|
| G-1 | Ein grüner CI-Lauf ist notwendig, aber nicht hinreichend für einen Release. |
| G-2 | Sicherheitskritische Anforderungen (Klasse S) blockieren Merge und Release, bis der Verifikationsnachweis vorliegt (SAFETY-CASE). |
| G-3 | Keine Testabschwächung, keine Baseline-Anhebung ohne Nachweis, dass der Plan insgesamt besser wurde (O-4). |
| G-4 | Alle Merge-Gates müssen grün sein, bevor ein PR gemergt werden darf (Branch Protection). |
| G-5 | Alle Release-Gates müssen grün sein, bevor ein Release freigegeben wird. |
| G-6 | Ein Release erfordert zusätzlich: aktuellen Safety-Case, aktuellen Risk-Report, Release-Report, reproduzierbaren Build. |

---

## 2. Merge-Gates ( Pull Request )

Ein Pull Request darf nur gemergt werden, wenn **alle** folgenden Gates grün sind:

| # | Gate | Befehl / Ort | Blockiert Merge |
|---|------|--------------|-----------------|
| M-1 | Build | `npm run build` (Next.js Static Export) | Ja |
| M-2 | Type Safety | `npm run typecheck` + `npm run typecheck:tests` | Ja |
| M-3 | Lint | `npm run lint` (ESLint) | Ja |
| M-4 | Format | `npm run format:check` (Prettier) | Ja |
| M-5 | Unit- & Integrationstests mit Coverage | `npm run test:coverage` (vitest; Coverage-Gate `lib/**`: Zeilen 90 %, Branches 85 %, Funktionen 90 %, Statements 95 %) | Ja |
| M-6 | Architekturtests | `npx vitest run scripts/architecture/libBoundary.test.ts` (Rule A); `npx vitest run scripts/routing/architecture.test.ts` (Regeln E, G, H, I, J) | Ja |
| M-7 | Routing-Invarianten & Audit | `npm run routing:audit` (I1–I3 = 0, Ratchet, Determinismus); `npx vitest run lib/routing/invariants.test.ts scripts/routing/finalValidation.test.ts` | Ja |
| M-8 | Elektrik (Golden Master, Property) | `npm run test:goldenmaster`; `npx vitest run lib/vde-properties.test.ts` (G1–G7) | Ja |
| M-9 | Routing-Regression | `npm run test:regression` (15 Szenarien; I1=I2=I3=0 je Szenario, byte-identisch) | Ja |
| M-10 | Komponenten- & Datenvalidierung | `npx vitest run lib/nodeSchema.test.ts lib/edgeSchema.test.ts components/registry/componentRegistry.test.tsx components/nodes/types.test.ts` | Ja |
| M-11 | Warnsystem | `npx vitest run components/edges/CableEdge.test.tsx components/edges/utils/voltageDrop.test.ts` (collectEdgeErrors); `useLiveValidation.test.ts` | Ja |
| M-12 | Persistenz & Migration | `npx vitest run store/slices/persistence.test.ts store/storage.test.ts` | Ja |
| M-13 | Security | Keine Secrets im Repo (`.env.example`, Review); Lockfile-Gate `npm run ci:verify-lockfile-gate` | Ja |
| M-14 | Accessibility | `npx playwright test tests/e2e/a11y.spec.ts` (axe: critical/serious = Fail) | Ja |
| M-15 | E2E (blockierende Specs) | `npm run e2e` gegen `./out` (alle außer dem meldenden Pixel-Job) | Ja |

**Merge erst nach M-1 bis M-15.** Required Status Checks in der Branch Protection (`.github/workflows/quality.yml` → `ci.yml`).

---

## 3. Release-Gates (öffentlicher Release / Deploy auf Default-Branch)

Ein Release darf nur freigegeben werden, wenn zusätzlich zu M-1–M-15:

| # | Gate | Befehl / Ort | Blockiert Release |
|---|------|--------------|-------------------|
| R-1 | Alle Merge-Gates grün | CI-Lauf für den Release-Commit | Ja |
| R-2 | E2E alle Projekte (375/768/1440/touch) grün | `npm run e2e` (alle Projekte) | Ja |
| R-3 | Visual Regression (Baselines eingefroren) | `tests/e2e/visual.spec.ts` (maxDiffPixelRatio 0,02) | Bei UI-Freigabe Ja (sonst melden, siehe TEST-002) |
| R-4 | Performance-Gate | `npm run perf:edge-routing` (Live-Routing-Ratchet 300 ms, begründet); Render ≤ 16 ms (Ziel) | Nein (Zielkonflikt dokumentiert, PERF-001; Gate existiert, Überschreitung nicht blockierend) |
| R-5 | Safety-Case aktuell | `docs/safety/SAFETY-CASE.md` (alle Klasse-S-Claims erfüllt oder dokumentierte Restrisiken) | Ja |
| R-6 | Risk Register aktuell | `docs/safety/RISK-REGISTER.md` (keine unbehandelten RPN ≥ 12 ohne akzeptiertes Restrisiko) | Ja |
| R-7 | Requirements Matrix aktuell | `docs/verification/REQUIREMENTS-MATRIX.md` (alle Klasse-S-Anforderungen verifiziert) | Ja |
| R-8 | Release-Report | Version, Änderungen, Verifikationsergebnisse, offene Risiken, Freigabeunterschrift | Ja |
| R-9 | Dokumentation aktuell | Architecture, Safety, Verification, Datenqualität, Release Engineering auf aktuellem Stand | Ja |
| R-10 | Reproduzierbarer Build | `npm ci` ohne Lockfile-Manipulation; Node-Version aus `.nvmrc`; Actions per SHA gepinnt | Ja |
| R-11 | Post-Deploy Smoke-Check | HTTP 200 + Bundle-Dateinamen präsent (`deploy.yml`) | Ja (nach Deploy) |
| R-12 | Security-Headers / CSP | ADR 0038; geprüft auf ausgelieferter Seite | Ja |

**Release erst nach R-1 bis R-12.**

---

## 4. Welche Fehler Merge oder Release blockieren

| Fehlerart | Blockiert Merge | Blockiert Release | Beispiel |
|-----------|-----------------|-------------------|----------|
| Build fehlgeschlagen | Ja | Ja | `npm run build` rot |
| Typecheck Fehler | Ja | Ja | `tsc` Fehler |
| Lint / Format Fehler | Ja | Ja | ESLint / Prettier |
| Test fehlgeschlagen (Unit/Integration) | Ja | Ja | vitest rot |
| Coverage-Gate unterschritten (`lib/**`) | Ja | Ja | Zeilen < 90 % etc. |
| Architekturtest fehlgeschlagen (A, E–J) | Ja | Ja | `lib/` importiert App-Schicht |
| Routing I1–I3 ≠ 0 (hart) | Ja | Ja | Kabel durch Bauteil, Überlappung |
| Routing-Ratchet gestiegen (I3-Delta > 0) | Ja | Ja | Clearance-Verstöße mehr als vorher |
| Golden Master geändert ohne Begründung | Ja | Ja | Recapture ohne Ledger-Eintrag |
| Regression-Szenario nicht byte-identisch | Ja | Ja | Trassenstruktur geändert |
| I1=I2=I3=0 je Regression-Szenario verletzt | Ja | Ja | Hartes Gate seit 2026-10-06 |
| `critical`-Validierungsregel ohne Test / ohne Negativfall | Ja | Ja | Regel S-5 |
| Datenlücke als `critical` dargestellt | Ja | Ja | Regel S-3 |
| Sicherheitskritische Anforderung ohne Verifikationsnachweis | Ja | Ja | SAFETY-CASE Claim offen |
| E2E blockierende Spec fehlgeschlagen | Ja | Ja | Playwright rot |
| a11y critical/serious Verstoß | Ja | Ja | axe-Fehler |
| Visual Regression > 0,02 | Melden (nicht blockierend) | Bei UI-Freigabe Ja | Pixel-Drift |
| Performance-Ratchet überschritten | Nein (bestehendes Gate dokumentiert) | Nein (Zielkonflikt offen) | PERF-001 Live-Routing |
| Sicherheit: Secrets im Repo | Ja | Ja | `OPENAI_API_KEY` im Code |
| Lockfile-Abweichung | Ja | Ja | `npm ci` vs `package-lock.json` |

---

## 5. Reproduzierbare Builds und Versionen

| Aspekt | Anforderung | Nachweis |
|--------|-------------|----------|
| Paket-Manager | `npm ci` (kein `npm install` Fallback) | `.github/workflows/quality.yml`, `packageManager: npm@10.9.8` |
| Lockfile | `package-lock.json` muss mit `package.json` konsistent sein | `npm run ci:verify-lockfile-gate` |
| Node-Version | Aus `.nvmrc` (Node ≥ 22) | `node-version-file: .nvmrc` |
| Actions | Alle GitHub Actions per 40-Zeichen Commit-SHA gepinnt | `.github/workflows/*` |
| Storage-Version | `PLANNER_STORAGE_VERSION = 1`; Storage-Key `elektroplaner-planner-v1` | `store/slices/persistence.ts` |
| Golden Master | `knownPlans/*.json` eingefroren; Änderung nur mit Recapture + Begründung | `scripts/goldenmaster/` |
| Release-Version | Semantische Versionierung; Release-Report mit Versionsnummer | Git-Tag + Release-Report |

---

## 6. Automatisierte Prüfberichte

Nach jedem CI-Lauf wird (wo technisch umsetzbar) ein Prüfbericht erzeugt, der enthält:

1. Build-Status und Typecheck-Ergebnis,
2. Test-Ergebnisse (Gesamt, bestanden, fehlgeschlagen, übersprungen) inkl. Coverage für `lib/**`,
3. Architekturtest-Ergebnisse (Regel, Status),
4. Routing-Audit (I1–I7, Fallback, Determinismus, Kreuzungen je Plan),
5. Golden-Master-Vergleich (byte-identisch / Abweichung),
6. Regression-Ergebnis (15 Szenarien, Metriken, Ratchet),
7. E2E-Ergebnis (alle Projekte, a11y),
8. Performance-Messung (Render, Live-Routing),
9. Sicherheitsstatus (offene Klasse-S-Anforderungen, Risk-Register-Zustand),
10. Release-Freigabe-Entscheidung (ja/nein, Begründung).

Der Prüfbericht wird im Release-Report archiviert und ist Bestandteil des Safety Case.

---

## 7. Rollback bei fehlerhaftem Release

Siehe `docs/CI.md` §6:

- **Option A:** Rerun des letzten guten Deploy-Runs (schnellste Sofortmaßnahme).
- **Option B:** `git revert` des fehlerhaften Commits + Push.
- **Option C:** Hotfix-Branch → PR → Quality Gate → Merge.

Ein fehlgeschlagener Deploy lässt die zuletzt erfolgreich deployte Version live — es gibt keinen unvollständigen Zustand (Statischer Export, Pages).

---

## 8. Ausnahme von Gates

Ausnahmen von Merge- oder Release-Gates benötigen:

1. Eine schriftliche Begründung im `ARCHITECTURE-CHANGES.md`-Ledger,
2. Bei sicherheitskritischen Gates: Product-Owner- und Safety-Verantwortlicher-Freigabe,
3. Einen Eintrag im Risk Register als offenes Restrisiko mit Zieltermin,
4. Die Ausnahme ist zeitlich begrenzt und wird beim nächsten Release neu bewertet.

Stillschweigende Gate-Ausnahmen sind nicht zulässig.
