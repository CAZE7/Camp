# Elektrikplaner — Agentenleitfaden

Statischer Next.js-Planer (TypeScript, Tailwind, @xyflow/react, Zustand) für
Camper-Elektrik (12 V / 230 V / Solar). Diese Datei enthält nur: Task-Routing,
Verbote, Gates. Alle Details stehen in [`docs/ai/`](docs/ai/).

## 1. Vor Code-Änderungen lesen

1. [`docs/ai/ARCHITECTURE-RULES.md`](docs/ai/ARCHITECTURE-RULES.md) (Regeln A–N,
   jede mit erzwingendem Test)
2. Das Kontextdokument des Themas (§2) +
   [`docs/ai/CHANGE-WORKFLOW.md`](docs/ai/CHANGE-WORKFLOW.md)
3. Bei Symptomen in [`docs/ai/KNOWN-PROBLEMS.md`](docs/ai/KNOWN-PROBLEMS.md)
   **nach ID suchen** (v. a. ROUTE-001, ELE-003) — nicht komplett lesen.
   Routing-Altbestand: [`docs/ai/LEGACY.md`](docs/ai/LEGACY.md)

Orientierung: [`docs/ai/CODE-MAP.md`](docs/ai/CODE-MAP.md),
[`docs/ai/SYMBOL-INDEX.md`](docs/ai/SYMBOL-INDEX.md), Modul-READMEs in `lib/`,
`lib/routing/`, `lib/autoWire/`, `components/edges/utils/`.

## 2. Thema → Dokument

- Routing (Pfad, Stub, Lane, Kollision, Crossing, ELK, A\*, SVG-Geometrie) → [`ROUTING-CONTEXT.md`](docs/ai/ROUTING-CONTEXT.md)
- Elektro (Strom, Querschnitt, Sicherung, Spannungsfall, Batterie, Solar, AC, RCD) → [`ELECTRICAL-CONTEXT.md`](docs/ai/ELECTRICAL-CONTEXT.md)
- AutoWire (`performAutoWiring`, Rails, Heilung, Sizing) → [`AUTOWIRE-CONTEXT.md`](docs/ai/AUTOWIRE-CONTEXT.md)
- Datenmodell (`PlannerNode/Edge`, Ports, `ComponentKind`, Persistenz) → [`DOMAIN-CONTEXT.md`](docs/ai/DOMAIN-CONTEXT.md)
- Validierung (`isConnectionAllowed`, `collectEdgeErrors`, Rule-IDs) → [`VALIDATION-CONTEXT.md`](docs/ai/VALIDATION-CONTEXT.md)
- Tests (Vitest, fast-check, Playwright, Coverage-/Perf-Gates) → [`TESTING-CONTEXT.md`](docs/ai/TESTING-CONTEXT.md)
- Golden Plans / Golden Master → [`GOLDEN-PLANS.md`](docs/ai/GOLDEN-PLANS.md) · Beispiele → [`docs/ai/examples/`](docs/ai/examples/)
- Design → [`DESIGN-KONZEPT-2026-10.md`](docs/DESIGN-KONZEPT-2026-10.md) (Wächter: `lib/designTokens.test.ts`)

Nichts davon → UI/Store/Tooling: nachfragen statt raten.

## 3. Routing ändern

- Betroffen: `routeAll.ts` (produktiv) — `orthogonalRouting.ts` ist Legacy.
- Betroffene Invariante I1–I10 benennen. Neue Größen nur in
  `lib/routing/tokens.ts` (nie inline). Kollisionen nur über
  `lib/routing/rules/collision.ts`. Deterministisch: kein `Math.random`,
  keine ungeordnete Iteration.
- Gates (alle grün): `npm run routing:audit` (I1–I7 = 0, Fallback = 0) ·
  `npm run perf:edge-routing` (Render-Pfad Median ≤ 16 ms; Live-Pfad
  Ratchet ≤ 300 ms — `LIVE_PATH_RATCHET_MS` nur begründet per ADR ändern) ·
  `npm run test:regression` (byte-exakte SVGs; Abweichung ⇒ begründen +
  Recapture im PR).
- Routing schreibt nie `crossSection`, `fuseSize`, `edgeDomain`, `length`.

## 4. Elektro ändern

- **Eine** Stromquelle: `calculateEdgeCurrent` (DC) bzw. `acCurrentA` (AC) —
  nie einen zweiten Strompfad bauen. `I_B ≤ I_n ≤ I_z` per Konstruktion
  (ein `DERATE_FACTOR` für Sizing + Sicherung).
- Längen nur über `PX_PER_METER`. Domänen nur über `getEdgeDomain` /
  `getHandleDomain`. Anzeige folgt der Rechnung, nie umgekehrt.
- Gates: `npx vitest run lib/` (inkl. `vde-properties` G1–G7,
  `vde-consistency`) · Golden Plans neu rechnen
  (`npm run goldenmaster:capture` → `npm run test:goldenmaster`), jede
  Abweichung begründen.
- Warnung nie „wegoptimieren“ — Datenlage klären. Keine VDE-/Normaussage
  erfinden; unbewiesen ⇒ `UNVERIFIED` (Kommentar) / `UNKNOWN` (Doku).

## 5. Niemals tun

- VDE-Regeln, Grenzwerte oder Normabschnitte erfinden.
- Elektrische Semantik ändern, um ein visuelles Problem zu lösen.
- Abstands-Zahlen im Routing hardcoden (→ `lib/routing/tokens.ts`).
- Unbekannte elektrische Daten als „gültig“ behandeln; Sicherheitsurteile raten.
- Validierung umgehen oder „nur für den Test“ deaktivieren.
- Still auf einen Default zurückfallen (Regel M).
- Fehlgeschlagene Tests löschen/`skip`en, um CI grün zu bekommen.
- `edge.data.geometry` lesen/schreiben (Architekturtest verbietet es).
- Golden-Fixtures „reparieren“ ohne dokumentierten Grund (→ ELE-003).
- Den Legacy-Router (`orthogonalRouting.ts`) tunen, als würde er gerendert.

## 6. DO NOT TOUCH (nur mit Tests + expliziter Review)

- **Sicherheitskritisch:** `lib/electrical.ts` (Sicherungsgrenzen), `lib/vde-standards.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`
- **Routing-Garantien:** `lib/routing/invariants.ts` (I1–I7), `lib/routing/rules/collision.ts`
- **`lib/routing/tokens.ts`** — ändert alle Referenz-SVGs.
- **Eingefrorene Wahrheit:** `scripts/goldenmaster/snapshots/*`, `knownPlans/*`, `scripts/regression/__snapshots__/*`
- **Echte Nutzerdaten:** `store/slices/persistence.ts`, `lib/nodeSchema.ts`

## 7. Befehle

- `npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint`
- E2E: einmalig `npm run e2e:install`, dann `npm run e2e`
- **Gate vor jedem Commit: `npm run check` grün** (lint + format + 2×
  typecheck + Coverage). CI-Reihenfolge: [`docs/CI.md`](docs/CI.md).

## 8. Harte Regeln

- Responsive 375 / 768 / 1440 px. Touch = Maus (Drag-Handle, Long-Press,
  Tap-to-Connect). Inspector: Slide-over < 1280 px, Docking ≥ 1280 px
  (288 px, ab 1536 px 320 px).
- Keine neuen Features ohne Freigabe (kein PWA, kein Export/Import, keine
  Energiebilanz, kein Multi-Plan).
- Ein PR/Commit pro Aufgabe; jeder Bugfix mit Regressionstest. Nach Merge
  Aufgabe hier abhaken bzw. streichen — Erledigtes gehört ins Git-Log, nicht
  in diese Datei. Diese Datei ≤ ~2.000 Tokens halten.

## 9. Offene Arbeit

- [ ] **R-1** Dependabot-Triage (laufend): Majors einzeln prüfen, nie blind mergen.
- [ ] **R-3 (Rest)** Gemergte Branches löschen (`docs/merged-branch-candidates.txt`);
      `main` ist bereits Default-Branch.
- [ ] **M11-3 (Rest)** Canvas komplett per Tastatur bedienbar — `?`-Overlay
      existiert; Abnahme offen: E2E baut Mini-Plan nur per Tastatur.
- [ ] **M11-5** Lighthouse Performance ≥ 90 im CI + Bundle-Budget (ADR);
      React Compiler evaluieren (ADR).
- [ ] **M11-6** Fonts (Inter, IBM Plex Mono) subsetten (latin), kritische
      Schnitte preloaden; LCP vorher/nachher im PR.
- [ ] **M11-9** Stress-Budget: 100 Bauteile / 300 Kanten — Pan/Drag/Auto-Wire
      ≤ 16 ms/Frame (Benchmark-ADR).
- [ ] **M11-10** Fehler-Monitoring-ADR: ErrorBoundary → Reporting
      privacy-konform evaluieren oder begründet ablehnen.

Aufgaben, die GitHub-Admin-/`workflows:write`-Rechte brauchen (A-3, S- und
P-Track): [`agent.md`](agent.md).

## 10. Kontext

- ADRs: Index im [`README.md`](README.md#architektur-entscheidungen-adrs),
  Volltexte in `docs/adr/`. **ADR 0026 wurde nie vergeben** (keine Datei,
  kein Verweis); ADR 0021 ist vorgeschlagen/offen.
- Historie: Git-Log. Altdaten/Audits in `docs/` sind Archiv, keine Vorgabe.
