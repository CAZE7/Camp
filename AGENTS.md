# Elektrikplaner — Agentenleitfaden

Next.js-App (TypeScript, Tailwind, React Flow, Zustand) zur Planung von Camper-Elektrik.
Tests: Vitest (Unit/Property) + Playwright (E2E).

Dieses Projekt hat ein **zweistufiges Handbuch**: diese Datei als Routing-Tabelle und
[`docs/ai/README.md`](docs/ai/README.md) als Einstieg in die Detaildokumentation.
**Beginne jede Aufgabe mit diesen beiden Dateien.**

---

## 1. Vor jeder Code-Änderung lesen

| #   | Pflichtlektüre                                                   | Warum                                         |
| --- | ---------------------------------------------------------------- | --------------------------------------------- |
| 1   | [`docs/ai/README.md`](docs/ai/README.md)                         | Einstieg + Aufgaben-Routing                   |
| 2   | [`docs/ai/ARCHITECTURE-RULES.md`](docs/ai/ARCHITECTURE-RULES.md) | Regeln A–N, jede mit erzwingendem Test        |
| 3   | Das Kontextdokument deines Themas (siehe §2)                     | echte Namen, echte Werte                      |
| 4   | [`docs/ai/CHANGE-WORKFLOW.md`](docs/ai/CHANGE-WORKFLOW.md)       | Verstehen → Planen → Umsetzen → Prüfen        |
| 5   | [`docs/ai/KNOWN-PROBLEMS.md`](docs/ai/KNOWN-PROBLEMS.md)         | echte Fallen, vor allem ROUTE-001 und ELE-003 |
| 6   | [`docs/ai/LEGACY.md`](docs/ai/LEGACY.md)                         | zwei Routing-Generationen, Spec vs. Code      |

Zur **Orientierung im Code**: [`docs/ai/CODE-MAP.md`](docs/ai/CODE-MAP.md) (Modulkarte) und
[`docs/ai/SYMBOL-INDEX.md`](docs/ai/SYMBOL-INDEX.md) (A–Z aller wichtigen Symbole).

Modul-READMEs (jeweils: Was ist es · Public API · Besitz · Verbote · schützende Tests):
[`lib/README.md`](lib/README.md) (Elektro/Domain) ·
[`lib/routing/README.md`](lib/routing/README.md) ·
[`lib/autoWire/README.md`](lib/autoWire/README.md) ·
[`components/edges/utils/README.md`](components/edges/utils/README.md).

## 2. Aufgaben-Routing: Thema → Dokument

| Die Aufgabe enthält …                                                                                                                                                                                                                                                                                                                                                                | → Dokument                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Pfad, Wegpunkte, Stub, Kehre, Kurzsegment, Treppe, Kollision, Überlappung, Crossing, Lane, Korridor, Hop, Bogen, ELK, A*, Hanan-Grid, Raster/Snap, Bounds/Overflow, Kabelgeometrie, SVG-Pfad                                                                                                                                                                                         | [`docs/ai/ROUTING-CONTEXT.md`](docs/ai/ROUTING-CONTEXT.md)       |
| Spannung, Strom, Leistung, Widerstand, Querschnitt, Ampacity, Derating, Spannungsfall, Kabellänge, Batterie, Ah, Bank, BMS, Sammelschiene, Solar, MPPT/PWM, Wechselrichter, Ladegerät, DC-DC/Booster, Lichtmaschine, Landstrom, AC/230 V, Gleichstrom/12 V, Polarität, Sicherung, FI/RCD, Schutzleiter, Abschaltbedingung, Kurzschluss, Abschaltvermögen, Leerrohr, Domänenzuordnung | [`docs/ai/ELECTRICAL-CONTEXT.md`](docs/ai/ELECTRICAL-CONTEXT.md) |
| `performAutoWiring`, automatisch verdrahten, Rails, Heilung, Platzierung von Auto-Knoten, Sizing/Querschnitt wählen, AC-Sizing                                                                                                                                                                                                                                                       | [`docs/ai/AUTOWIRE-CONTEXT.md`](docs/ai/AUTOWIRE-CONTEXT.md)     |
| `PlannerNode`, `PlannerEdge`, `PlannerConnection`, Port/Handle, `ComponentKind`, Bauteilregistrierung, `node.data`, Schema, Persistenz, Migration                                                                                                                                                                                                                                    | [`docs/ai/DOMAIN-CONTEXT.md`](docs/ai/DOMAIN-CONTEXT.md)         |
| `isConnectionAllowed`, Live-Validierung, collectEdgeErrors, Warnzentrale, Severity, Regel-ID                                                                                                                                                                                                                                                                                         | [`docs/ai/VALIDATION-CONTEXT.md`](docs/ai/VALIDATION-CONTEXT.md) |
| „Welchen Test brauche ich?“, Vitest/fast-check/Playwright, Coverage-Gates, Perfgate, Regression                                                                                                                                                                                                                                                                                      | [`docs/ai/TESTING-CONTEXT.md`](docs/ai/TESTING-CONTEXT.md)       |
| Golden Plans, Referenzpläne, Golden Master, Byte-Vergleich, Fixtures                                                                                                                                                                                                                                                                                                                 | [`docs/ai/GOLDEN-PLANS.md`](docs/ai/GOLDEN-PLANS.md)             |
| Konkrete Beispieleingaben                                                                                                                                                                                                                                                                                                                                                            | [`docs/ai/examples/`](docs/ai/examples/)                         |

**Mehrere Themen?** Erst `ARCHITECTURE-RULES.md`, dann je Thema das Kontextdokument.
**Nichts davon?** Dann ist es wahrscheinlich UI/Store/Tooling — frage nach, statt zu raten.

## 3. Wenn du Routing änderst

1. `docs/ai/ROUTING-CONTEXT.md` lesen (§4.2 Pipeline, §4.3 Regeln, §4.5 Invarianten).
2. Feststellen, **welcher** Router betroffen ist (`routeAll.ts` produktiv,
   `orthogonalRouting.ts` Legacy — [LEGACY.md](docs/ai/LEGACY.md)).
3. Betroffene Invariante benennen: **I1–I10**.
4. Prüfen, ob die Änderung eine **Größe** einführt → sie gehört in
   `lib/routing/tokens.ts` (nie inline; Test verbietet das).
5. Kollisionen nur über `lib/routing/rules/collision.ts` — nie neu erfinden.
6. Determinismus erhalten: kein `Math.random`, keine ungeordnete Iteration.
7. `npx tsx scripts/routing/audit.ts` → I1–I7 müssen **0** bleiben, Fallback **0**.
8. `npm run perf:edge-routing` → Median **≤ 16 ms**.
9. `npm run test:regression` → Layout, Metriken und **byte-exakte SVGs** unverändert
   (Abweichung ⇒ bewusste Entscheidung + Recapture + Begründung im PR).
10. Kein Routing-Fix darf `crossSection`, `fuseSize`, `edgeDomain` oder `length` anfassen.

Ausführlich: [CHANGE-WORKFLOW §21](docs/ai/CHANGE-WORKFLOW.md).

## 4. Wenn du Elektro änderst

1. `docs/ai/ELECTRICAL-CONTEXT.md` lesen (§5.1 Einheiten … §5.7 Kette).
2. **Eine** Stromquelle verwenden: `calculateEdgeCurrent` (DC) bzw.
   `calculateAcEdgeCurrent` (AC) — nie einen zweiten Strompfad bauen.
3. `I_B ≤ I_n ≤ I_z` durch Konstruktion: Sizing und Sicherungsgrenze nutzen
   denselben `DERATE_FACTOR`.
4. Längen nur über `PX_PER_METER` umrechnen, nie über eine eigene Konstante.
5. Domänen nur über `getEdgeDomain` / `getHandleDomain` bestimmen.
6. Goldene Pläne neu berechnen und **jede** Abweichung einzeln begründen
   (`npm run goldenmaster:capture`, dann `npm run test:goldenmaster`).
7. `npx vitest run lib/` grün, inkl. `vde-properties.test.ts` (G1–G7) und
   `vde-consistency.test.ts`.
8. Keine Warnung „wegoptimieren“ — stattdessen die Datenlage klären
   (`fuseType`, `fuseBreakingCapacity`, `maxPvVoltage`, `hasRcd`).
9. Anzeige folgt der Rechnung (`components/planner/utils/voltage.ts`), nie umgekehrt.
10. **Nie** eine VDE-/Normaussage erfinden. Unbewiesen ⇒ `UNVERIFIED` im Kommentar und
    `UNKNOWN` im Dokument.

Ausführlich: [CHANGE-WORKFLOW §22](docs/ai/CHANGE-WORKFLOW.md).

## 5. Niemals tun

- VDE-Regeln, Grenzwerte oder Normabschnitte **erfinden**.
- Elektrische Semantik ändern, um ein **visuelles** Problem zu lösen.
- `crossSection`, `fuseSize`, `edgeDomain` oder `length` aus dem Routing heraus schreiben.
- Abstands-Zahlen im Routing hardcoden (→ `lib/routing/tokens.ts`).
- Unbekannte elektrische Daten als „gültig“ behandeln oder Sicherheitsurteile raten.
- Validierung umgehen, „nur für den Test“ deaktivieren oder Fälle ausblenden.
- Still auf einen Default zurückfallen (Regel M: „kein stiller Fallback“).
- Fehlgeschlagene Tests löschen oder `skip`en, um CI grün zu bekommen.
- `edge.data.geometry` lesen/schreiben (Architekturtest verbietet es).
- Golden-Fixtures „reparieren“, ohne den Grund zu dokumentieren (→ ELE-003).
- Den Legacy-Router (`orthogonalRouting.ts`) so tunen, als würde er gerendert.

## 6. DO NOT TOUCH (nur mit Tests + expliziter Review)

| Bereich                                                                                                     | Warum                     |
| ----------------------------------------------------------------------------------------------------------- | ------------------------- |
| `lib/electrical.ts` Sicherungsgrenzen, `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts` | sicherheitskritisch       |
| `lib/routing/invariants.ts` (I1–I7), `lib/routing/rules/collision.ts`                                       | Routing-Garantien         |
| `lib/routing/tokens.ts`                                                                                     | ändert alle Referenz-SVGs |
| `scripts/goldenmaster/snapshots/*`, `knownPlans/*`, `scripts/regression/__snapshots__/*`                    | eingefrorene Wahrheit     |
| `store/slices/persistence.ts`, `lib/nodeSchema.ts`                                                          | echte Nutzerdaten         |

Details: [ARCHITECTURE-RULES.md](docs/ai/ARCHITECTURE-RULES.md) und
[KNOWN-PROBLEMS.md](docs/ai/KNOWN-PROBLEMS.md).

## 7. Befehle

- `npm run dev` · `npm run build` · `npm test` (Vitest) · `npm run typecheck` · `npm run lint`
- E2E: einmalig `npm run e2e:install`, dann `npm run e2e`
- Routing: `npm run routing:audit` (I1–I7 über 6 Pläne) · `npm run routing:gallery`
- Elektrik/Routing eingefroren: `npm run goldenmaster:capture` → `npm run test:goldenmaster`
- Regression: `npm run regression:capture` → `npm run test:regression`
- Performance: `npm run perf:edge-routing` (Gate) · `npm run perf:route-scaling`
- **Gate vor jedem Commit:** `npm run check` (lint + format + 2× typecheck + Coverage) grün.
  CI-Reihenfolge: [CI.md](docs/CI.md).

## 8. Arbeitsweise

- Aufgaben der Reihe nach abarbeiten; ein PR pro Aufgabe.
- Nach Merge das Häkchen `[x]` in dieser Datei setzen und mitcommitten.
- Neue Erkenntnisse als neue IDs unten anhängen, bestehende Texte nicht umschreiben.
- Diese Datei ≤ 1.500 Tokens halten; Erledigtes zeitnah ins Git-Log verlagern.

## 9. Harte Regeln

- Responsive: alles funktioniert auf 375 / 768 / 1440 px.
- Touch First-Class: was per Maus geht, geht auch per Finger (Drag-Handle, Long-Press,
  Tap-to-Connect).
- Inspector: Slide-over < 1280 px; Docking ≥ 1280 px (288 px bis 1535, 320 px ab 1536).
- Keine neuen Features ohne Freigabe (kein PWA, kein Export/Import, keine Energiebilanz,
  kein Multi-Plan).
- Ein Commit pro Aufgabe; jeder Bugfix mit Regressionstest.
- Trade-offs aus PR #314 bleiben, bis ein reproduzierbarer Fehler sie widerlegt.

## 10. Auftragsbuch (unverändert übernommen)

### Abgeschlossen

- M1–M8 komplett, M9-1-Security (Next 16.3.3 gepinnt), M9-3, M10-1/M10-2: PRs #346/#348/#365
  (27.–29.08.). Details: Git-Log, ADR 0005/0006.

### Restposten (aus M9/M10)

- [ ] R-1 Dependabot-Triage: #354 (dev-Gruppe) bei grünem CI mergen; Majors (#356 TS 7,
      #360 Tailwind 4, #357 lucide, #358 jsdom, #359 jest-dom, #361 knip) einzeln prüfen oder
      schließen — nie blind mergen.
- [ ] R-2 Jules-PRs #332 + #345 nach PR #348/#365 auf Überschneidungen prüfen, rebasen oder
      schließen.
- [ ] R-3 `main` zum Default-Branch machen, Feature-Branch einmergen; danach 254 verifiziert
      gemergte Branches löschen (`docs/merged-branch-candidates.txt`).
- [ ] R-4 Visuelles Gate (M10-3): Playwright-Screenshot-Baseline des Referenzplans
      (375 + 1280 px, hell+dunkel) mit Diff-Schwelle im CI — blockiert, bis PNG-Baselines
      existieren; UI-PRs mit Vorher/Nachher-Bildern.

### Mission 11: Profi-Niveau

- [ ] M11-1 DESIGN-SPRUNG (Top-Prio, Nutzer-Vorgabe): Planner visuell auf CAD-Niveau polieren
      — Node-Cards, Toolbar, Panels, Handles neu gestaltet (token-basiert, hell+dunkel).
      PFLICHT: Vorher/Nachher-Screenshots (375/768/1440 px) im PR — Merge erst nach optischer
      Freigabe durch den Nutzer.
- [ ] M11-2 AutoWire-Platzierung: Bauteile werden aktuell ungünstig gesetzt → Kabel laufen
      Umwege. Fix: AutoWire platziert Knoten in Flussrichtung (Quellen → Verteilung →
      Verbraucher), auf dem 16-px-Grid, mit konsistenten Abständen; optional Auto-Layout
      (dagre) direkt nach dem Verdrahten. Metrik als Test: Gesamtkabellänge im Referenzplan
      ≤ 1,3× Manhattan-Optimum, keine Kante mit > 2 Richtungswechseln ohne Grund.
- [ ] M11-3 Tastatur-First wie CAD: Canvas komplett ohne Maus bedienbar (Bauteil
      bewegen/verbinden/löschen per Tastatur) + Shortcut-Overlay per `?`. Abnahme: E2E baut
      Mini-Plan nur per Tastatur.
- [ ] M11-4 `prefers-reduced-motion` global respektieren (tokenbasiert, nicht pro Komponente).
- [ ] M11-5 Performance-Gate: Lighthouse Performance ≥ 90 im CI + Bundle-Budget (ADR);
      React Compiler evaluieren (ADR).
- [ ] M11-6 Fonts: Inter + IBM Plex Mono subsetten (latin), kritische Schnitte preloaden;
      LCP vorher/nachher im PR.
- [ ] M11-7 Security-Headers fürs Static Hosting: CSP, X-Content-Type-Options,
      Referrer-Policy, frame-ancestors; CSP-Strategie als ADR.
- [ ] M11-8 Touch-E2E echt: Pinch-Zoom, Long-Press, Tap-to-Connect, Drag-Handle als
      Playwright-Gesten (bisher nur Unit-Ebene).
- [ ] M11-9 Stress-Budget: 100 Bauteile / 300 Kanten — Pan/Drag/Auto-Wire ≤ 16 ms/Frame;
      Benchmark-ADR.
- [ ] M11-10 Fehler-Monitoring-ADR: ErrorBoundary → Reporting evaluieren
      (privacy-konform) oder begründet ablehnen.

## 11. Rechte-Übergabe

- Offene Aufgaben, die GitHub-Admin- oder `workflows:write`-Rechte benötigen, stehen in
  `agent.md`.
- Der kopierfertige Übergabe-Prompt liegt in `docs/ci/pages-deploy-handoff-prompt.md`.

## 12. Kontext

- Detaillierte Arbeitsdokumentation: [`docs/ai/`](docs/ai/).
- Historische Audits: `AUDIT.md`, `AUDIT-AUTOWIRE.md`, `AUDIT-EXTREM-2026-09.md`,
  `docs/` (ADRs, CI-Referenzen). Historie: Git-Log.
