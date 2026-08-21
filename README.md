# Werft — Elektrikplaner für den Camper-Ausbau

Ein statischer Web-Planer für 12-V-Bordnetze im Wohnmobil. Bauteile per
Klick oder Ziehen aufs Blatt, Leitungen automatisch verlegen lassen —
und die Anwendung rechnet Querschnitte, Sicherungen und Spannungsfall nach
den einschlägigen VDE-Regeln nach. Ohne Konto, ohne Server, ohne Backend.

**Für wen:** Menschen, die ihren Camper selbst ausbauen und wissen wollen,
ob ihr Plan trägt — nicht für Elektrofachkräfte, die eine normgerechte
Fachplanung erstellen. Die Vorschläge sind bewusst konservativ und ersetzen
keine Abnahme durch eine Fachkraft.

> **Demo:** _(Platzhalter — hier gehört die GitHub-Pages-URL des Repos hin,
> sobald Pages aktiviert ist.)_
> **Screenshots:** _(Platzhalter — noch keine erstellt.)_
> Beides ist bewusst leer statt erfunden.

---

## In 30 Sekunden

```bash
npm ci          # exakte Abhängigkeiten aus dem Lockfile
npm run dev     # http://localhost:3000/elektrik-planung/
npm run check   # Typecheck + 1051 Tests
npm run build   # Static Export nach ./out
```

Der Planer liegt unter `/elektrik-planung/`. Alles wird lokal im Browser
gespeichert (`localStorage`, versioniert mit Migration).

---

## Funktionen (verifiziert)

| Funktion | Wo im Code | Beleg |
|----------|------------|-------|
| Bauteil-Katalog mit Suche und Kategorien | `components/Sidebar.tsx`, `components/registry/` | `Sidebar.test.tsx`, `componentRegistry.test.tsx` |
| Schaltplan mit Zoom, Pan, Auswahl, Minimap | `components/planner/FlowCanvas.tsx` | `FlowCanvas.test.tsx` |
| Automatische Verdrahtung (Backbone, Sicherungen, Querschnitte) | `lib/autoWire.ts` | `autoWire.test.ts`, `vde-properties.test.ts` |
| Querschnitt nach Strombelastbarkeit **und** Spannungsfall | `lib/electrical.ts`, `lib/vde-standards.ts` | `electrical.test.ts`, `vde-standards.test.ts` |
| Sicherungsauswahl, die nie über die Kabelgrenze geht | `lib/electrical.ts` (`selectFuseSize`) | Gesetz G1 in `vde-properties.test.ts` |
| Live-Prüfung mit Warn-Center (RCD, Überlast, Leerrohr-Füllgrad) | `components/planner/hooks/useLiveValidation.ts` | `useLiveValidation.test.ts` |
| Orthogonales Kabel-Routing mit Hindernisvermeidung | `components/edges/utils/orthogonalRouting.ts` | 25 Szenarien in `docs/routing-gallery/` |
| Stückliste mit Bauteilen und Leitungslängen | `components/planner/BOMModal.tsx` | E2E `planner-flow.spec.ts` |
| Bild-Export des Plans (PNG) | `components/planner/PlannerDashboard.tsx` | `PlannerDashboard.test.tsx` |
| Undo/Redo, Auto-Layout, Vorlagen | `store/usePlannerStore.ts` | `usePlannerStore.test.ts` |
| Wassermodus (Tanks, Pumpe, Entnahmestellen) | `components/nodes/WaterNode.tsx` | `WaterPipeEdge.test.tsx` |
| Dachplaner und Heizlast-Rechner | `app/tools/dach/`, `app/tools/heizung/` | `page.test.tsx`, `validation.test.ts` |
| Bedienung auf Handy, Tablet und Desktop | `components/PlannerInner.tsx` | `PlannerInner.test.tsx`, E2E `responsive.spec.ts` |

---

## Architektur

```
                    ┌──────────────────────────────────────────┐
                    │  components/registry/                    │
                    │  ComponentSpec: Label, Domäne, Handles,  │
                    │  Icon, Node-Komponente, Standardwerte    │
                    └───────────────┬──────────────────────────┘
                       liest         │        liest
              ┌──────────────────────┼───────────────────────────┐
              ▼                      ▼                           ▼
   ┌─────────────────┐   ┌────────────────────┐    ┌──────────────────────┐
   │  Sidebar        │   │  NODE_TYPES        │    │  Stückliste / Filter │
   │  Katalog+Suche  │   │  (React Flow)      │    │  Label, Domänenfarbe │
   └────────┬────────┘   └─────────┬──────────┘    └──────────────────────┘
            │ addNode                        ▲
            ▼                                │ nodes / edges
   ┌───────────────────────────────────────────────────────────────────┐
   │  store/usePlannerStore.ts        (Zustand + persist + Historie)   │
   │  nodes · edges · Auswahl · Undo/Redo · isValidConnection          │
   └───────┬──────────────────────────────────────────┬────────────────┘
           │ Zustand                                  │ autoWireSystem()
           ▼                                          ▼
   ┌────────────────────────────┐          ┌─────────────────────────────┐
   │  FlowCanvas (React Flow)   │          │  lib/autoWire.ts            │
   │  Nodes, CableEdge, Minimap │          │  Topologie: Batterie →      │
   │  orthogonalRouting.ts      │          │  Shunt → Schienen →         │
   └────────────┬───────────────┘          │  Sicherungskasten → Lasten  │
                │                          └──────────────┬──────────────┘
                │ zeigt Warnungen                         │ Ströme, Längen
                ▼                                         ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │  lib/vde-standards.ts  +  lib/electrical.ts   (VDE-Prüfung)       │
   │  Querschnitt · Sicherung · Spannungsfall · Leerrohr · RCD         │
   │  alle Größen typsicher aus lib/units.ts (Watts, Amps, Volts, mm²) │
   └───────────────────────────────────────────────────────────────────┘
```

Der Weg einer Änderung: **Sidebar → Store → Canvas → AutoWire → VDE-Prüfung →
zurück in den Store** (Querschnitte, Sicherungen, Warnungen).

---

## Tech-Stack

| Bereich | Wahl | Version |
|---------|------|---------|
| Framework | Next.js (App Router, `output: 'export'`) | 16 |
| UI | React 19, Tailwind CSS 3, Radix Primitives, lucide-react | — |
| Canvas | React Flow | 11 |
| State | Zustand mit `persist` | 5 |
| Tests | Vitest + Testing Library, fast-check (Property-Tests) | 4 / 4.9 |
| E2E | Playwright (Chromium, 4 Viewport-Projekte) | 1.62 |
| Sprache | TypeScript `strict` | 5.9 |
| Node | siehe `.nvmrc` (22) | — |

## Verzeichnisse

```
app/                    Seiten (App Router) — Planer, Guides, Tools, Recht
components/
  registry/             Bauteil-Registry: eine Quelle je Bauteil
  nodes/                Darstellung der Bauteile im Canvas
  edges/                Kabel- und Rohrleitungen inkl. Routing
  planner/              Canvas, Sidebar, Dashboard, Inspector, Hooks
  ui/                   generische Bausteine (Dialog, Button)
lib/
  units.ts              typsichere physikalische Einheiten
  electrical.ts         thermische VDE-Basis (Normreihe, Ampacity, Sicherungen)
  vde-standards.ts      Spannungsfall, Leerrohr, Wirkungsgrade, Validierung
  autoWire.ts           automatische Verdrahtung
store/                  Zustand-Store mit Historie und Persistenz
tests/e2e/              Playwright-Specs gegen den gebauten Export
scripts/                CI-Belege, Routing-Galerie, E2E-Server, Benchmarks
docs/                   Architektur-Entscheidungen und Nachweise
```

---

## Qualitätsstand

Alle Angaben stammen aus Läufen auf dem aktuellen Stand
(Commit-Reihe K1–K7, 2026-08-21, Node 22.22.3).

| Prüfung | Befehl | Ergebnis |
|---------|--------|----------|
| Typecheck (Produktionscode) | `npm run typecheck` | **0 Fehler** |
| Typecheck (inkl. Tests) | `npm run typecheck:tests` | **0 Fehler** — Einheiten gelten auch in Tests |
| Unit-/Komponententests | `npm test` | **1051 Tests, 81 Dateien, grün** |
| Property-Tests (VDE) | `npx vitest run lib/vde-properties.test.ts` | 30 Tests, ~17.000 generierte Fälle |
| Routing-Invarianten | `npx vitest run components/edges/utils` | 25 Szenarien × 7 Invarianten |
| Build | `npm run build` | erfolgreich, `./out` 4,2 MB, 11 HTML-Seiten |
| Lockfile-Gate | `npm run ci:verify-lockfile-gate` | greift (npm ci scheitert bei Drift) |
| Lighthouse Accessibility | Report vom 2026-08-20, Lighthouse 13.4.1 | **100 / 100** (Mobile und Desktop) |
| End-to-End | `npm run e2e` | **steht aus** — siehe unten |

**Offener Punkt (ehrlich benannt):** Die Playwright-Suite ist vollständig
geschrieben und in CI eingebunden, wurde aber noch **nicht ausgeführt**: der
Browser-Download war in der Entwicklungsumgebung blockiert. Die drei
geforderten grünen Läufe müssen im ersten CI-Lauf erbracht werden.
Details und die stattdessen lokal erbrachten Belege: `docs/E2E-TESTS.md`.

Der Lighthouse-Wert stammt aus Mission 1 (2026-08-20) und wurde seitdem nicht
neu gemessen; die Rohdaten liegen in `lighthouse-report/`.

---

## Entwicklung

```bash
npm ci                      # niemals npm install im CI-Kontext
npm run dev                 # Dev-Server auf 0.0.0.0:3000
npm run typecheck           # tsc --noEmit (Produktionscode)
npm run typecheck:tests     # tsc --noEmit inklusive aller Testdateien
npm test                    # Vitest einmalig
npm run test:watch          # Vitest im Watch-Modus
npm run check               # Typecheck + Tests
npm run build               # Static Export nach ./out
npm run e2e                 # Playwright (benötigt ./out und Chromium)
npm run routing:gallery     # Routing-Galerie neu erzeugen
npm run ci:verify-lockfile-gate
```

**CI:** Jeder Pull Request durchläuft `.github/workflows/ci.yml` →
`quality.yml` (npm ci · Typecheck · Tests · Build · E2E). Der Deploy nach
GitHub Pages läuft ausschließlich nach grünem Gate. Einrichtung der
Branch Protection: `docs/CI.md`.

---

## Architektur-Entscheidungen (ADRs)

| ADR | Thema | Kurzfassung |
|-----|-------|-------------|
| [0001](docs/adr/0001-static-export-ohne-backend.md) | Static Export ohne Backend | Keine Server, Daten bleiben im Browser — Preis: kein Geräteabgleich |
| [0002](docs/adr/0002-react-flow-als-canvas.md) | React Flow als Canvas | Knoten sind React — Preis: Kanten kennen fremde Handles nicht |
| [0003](docs/adr/0003-orthogonales-routing-statt-wegfindung.md) | Routing ohne Wegfindung | Deterministisch und schnell — Preis: nicht optimal |
| [0004](docs/adr/0004-vde-modell-konservativ-und-zentral.md) | VDE-Modell | Eine Quelle, konservative Werte, typsichere Einheiten |

## Weitere Nachweise

- `docs/CI.md` — CI-Gate, Lockfile-Beleg, Branch Protection
- `docs/PROPERTY-TESTS.md` — die sechs VDE-Gesetze und ein echter Fund
- `docs/ROUTING-INVARIANTS.md` — R1–R7, zwei behobene Routing-Fehler
- `docs/COMPONENT-REGISTRY.md` — Analyse der Bauteildefinitionen
- `docs/E2E-TESTS.md` — Playwright-Setup und Grenzen der Geräteemulation
- `docs/INVENTORY.md`, `docs/RESTMISSION-REPORT.md` — Bestandsaufnahme aus Mission 1
- `AGENTS.md` — Arbeitsauftrag und Definition of Done

## Daten im Browser

Planstand und Einstellungen liegen im `localStorage` (`werft-planner-v1`).
Beide Stores sind versioniert und haben defensive Migrationsfunktionen, damit
ältere Stände nach Schema-Änderungen keine Laufzeitfehler erzeugen. Es werden
keine Daten an einen Server gesendet.

## Lizenz

ISC (siehe `package.json`).
