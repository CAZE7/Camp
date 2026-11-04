# System-Architektur — Camp (Elektrikplaner)

**Stand:** 2026-11-04  
**Status:** Verbindlich (Erstfassung, Phase 1 — Architektur & Regelwerk)  
**Geltungsbereich:** Gesamtes Camp-Repository (`app/`, `components/`, `lib/`, `store/`, `scripts/`, `tests/`, `benchmarks/`).  
**Verfasser:** Softwarearchitektur / Quality Engineering / Safety Engineering (gemeinsam)  
**Verwandte Dokumente:** `docs/ai/ARCHITECTURE-RULES.md`, `docs/electrical-architecture.md`, `docs/electrical-graph.md`, `docs/CODE-MAP.md`, `docs/GOVERNANCE.md`, `docs/CI.md`, alle ADRs unter `docs/adr/`.

---

## 1. Zweck und Geltung

Dieses Dokument definiert die langfristig tragfähige Zielarchitektur von Camp. Es ist das verbindliche Bezugsdokument für alle Entwickler und KI-Agenten. Es ersetzt keine bestehenden, funktionierenden Strukturen, sondern fasst sie zusammen, macht Abhängigkeiten explizit und definiert, welche Änderungen erlaubt, welche verboten und welche durch Architekturtests erzwungen werden.

**Wesentlicher Grundsatz (aus Phase 13 der Aufgabenstellung):** In dieser ersten Phase gibt es keine Implementierung, keine Änderung an elektrischen Formeln, keine Änderung an bestehenden Berechnungsdaten, keine unnötigen Refactorings. Dieses Dokument beschreibt den **Ist-Zustand, soweit er die Anforderungen erfüllt**, und definiert das **Soll** für alle künftigen Änderungen.

---

## 2. Gesamtbild: Die zehn Schichten

Camp beantwortet vier verschiedene Fragen, und fast jeder Fehler der Vergangenheit entstand dort, wo eine Antwort in die Zuständigkeit einer anderen hineingriff. Deshalb ist die Abhängigkeitsrichtung einseitig und streng geschichtet:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 10  VERIFICATION INFRASTRUCTURE   scripts/, tests/, benchmarks/, CI    │
│     Erzwingt Architektur, Sicherheit, Qualität — niemals Planänderung   │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ liest / prüft
┌───────────────▼─────────────────────────────────────────────────────────┐
│ 9   REPORTING & EXPORT         BOM, PDF, Warn-Zentrale, Expert Panel   │
│     Anzeige nur, keine Berechnung                                       │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ liest
┌───────────────▼─────────────────────────────────────────────────────────┐
│ 8   PERSISTENCE & PROJECT MGMT  store/slices/persistence, storage.ts   │
│     localStorage, Migration, Version, Serialization                    │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ liest / schreibt
┌───────────────▼─────────────────────────────────────────────────────────┐
│ 7   VALIDATION & WARNING ENGINE lib/verify, lib/connectionRules,       │
│     lib/electricalGraph, collectEdgeErrors, useLiveValidation          │
│     Erkenntnisse: Befunde — niemals Änderungen am Plan                 │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ liest
┌───────────────▼─────────────────────────────────────────────────────────┐
│ 6   GRAPH & ROUTING ENGINE       lib/routing, lib/electricalGraph,     │
│     components/edges/utils/routeAll, pathfinding                        │
│     Topologie, Spannungsebenen, Batteriebänke, Wegpunkte, I1–I10       │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ liest
┌───────────────▼─────────────────────────────────────────────────────────┐
│ 5   ELECTRICAL CALCULATION ENGINE lib/electrical.ts, lib/vde-standards │
│     lib/units.ts, lib/shortCircuit.ts, lib/acProtection.ts, lib/solar   │
│     lib/peukert.ts, lib/cableConditions.ts                              │
│     Eine Quelle je physikalischer Größe                                 │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ liest
┌───────────────▼─────────────────────────────────────────────────────────┐
│ 4   COMPONENT DATA & CATALOG    components/registry, lib/nodeSchema,   │
│     lib/domain/graph.ts, lib/domain/cableEdgeData.ts                   │
│     Bauteildaten, Hersteller, Datenblatt, Datenversion, Quellen        │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ liest
┌───────────────▼─────────────────────────────────────────────────────────┐
│ 3   DOMAIN MODEL                lib/domain/*, lib/electricalGraph/*,   │
│     lib/autoWire/ (reine Domänenfunktionen, ohne React)                │
│     Knoten, Kanten, Absichten (intent), Pläne, Geometriefrei           │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ liest
┌───────────────▼─────────────────────────────────────────────────────────┐
│ 2   APPLICATION SERVICES        store/usePlannerStore + slices         │
│     Zustand, Undo/Redo, AutoWire-Aktion, Layout-Aktion, Persistenz     │
└───────────────┬────────────────────────────────────────────-------------┘
                │ liest / ruft auf
┌───────────────▼─────────────────────────────────────────────────────────┐
│ 1   USER INTERFACE              app/, components/                      │
│     Next App Router, React-Flow-Adapter, Inspector, Dashboard, BOM     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Richtung der Abhängigkeiten:** Jede Schicht darf nur auf darunterliegende oder gleichgeordnete Schichten zugreifen. Nie umgekehrt. Insbesondere:
- `lib/` (Schichten 3–5) importiert **nichts** aus `components/`, `store/`, `app/` oder `benchmarks/` (Rule A, erzwungen durch `scripts/architecture/libBoundary.test.ts`).
- UI (Schicht 1) implementiert **keine** elektrischen Berechnungen selbst (Rule D).
- Routing (Schicht 6) schreibt **keine** elektrische Semantik (`crossSection`, `fuseSize`, `edgeDomain`, `length`) — nur Geometrie (Rule C, Rule G).
- Verifikation (Schicht 7 und 10) meldet Befunde, ändert niemals den Plan.

---

## 3. Zuständigkeiten der Schichten

| Schicht | Verantwortung | Darf NICHT | Typische Dateien |
|---|---|---|---|
| 1 UI | Darstellung, Interaktion, Navigation, Responsive/Touch | Elektrische Berechnungen, eigene Strompfade | `app/`, `components/` |
| 2 Application Services | Zustandsmanagement, Aktionen (AutoWire, Layout, Undo), Persistenz-Koordination | Reine Domänenlogik duplizieren | `store/usePlannerStore.ts`, `store/slices/*` |
| 3 Domain Model | Knoten, Kanten, Absichten, Topologie, Plansemantik, geometriefrei | React, React-Flow, DOM, Maße | `lib/domain/`, `lib/electricalGraph/`, `lib/autoWire/` |
| 4 Component Data & Catalog | Bauteildaten, Hersteller, Modell, Datenblatt, Quelle, Datenversion, Gültigkeit, Annahmen, Verifizierungsstatus | Ungeprüfte Herstellerangaben als Fakten darstellen | `components/registry/`, `lib/nodeSchema.ts`, `lib/domain/cableEdgeData.ts` |
| 5 Electrical Calculation Engine | Strom, Querschnitt, Sicherung, Spannungsfall, Kurzschluss, AC-Schutz, Solar, Peukert, Verlegebedingungen | Zweite Stromquelle, Normzitate ohne Quelle | `lib/electrical.ts`, `lib/vde-standards.ts`, `lib/units.ts`, `lib/shortCircuit.ts`, `lib/acProtection.ts`, `lib/solar.ts`, `lib/cableConditions.ts` |
| 6 Graph & Routing Engine | Topologie, Spannungsebenen, Batteriebänke, Absichten, Routing-Wegpunkte, Invariante I1–I10, deterministisch | Elektrodaten ändern, Zufall, unsortierte Iteration | `lib/routing/`, `lib/electricalGraph/`, `components/edges/utils/routeAll.ts`, `pathfinding.ts` |
| 7 Validation & Warning Engine | Anschluss-, Elektrik-, Plan-, Routing-Validierung; strukturierte Befunde mit ruleId/severity/unit | Pläne still korrigieren, Datenlücken als „ok“ tarnen | `lib/connectionRules.ts`, `lib/verify/`, `collectEdgeErrors`, `useLiveValidation` |
| 8 Persistence & Project Management | Speicherung, Migration, Versionierung, Serialization, Debounce | Daten ohne Schema-Anwendung heilen | `store/slices/persistence.ts`, `store/storage.ts`, `lib/nodeSchema.ts`, `lib/edgeSchema.ts` |
| 9 Reporting & Export | BOM, PDF, Stückliste, Warn-Zentrale, Expert Panel, reine Anzeige | Berechnung, Planänderung | `components/planner/BOMModal.tsx`, `ExpertPanel.tsx`, `WarningCenter.tsx` |
| 10 Verification Infrastructure | Architekturtests, Golden Master, Regression, Invarianten, Property-Based, CI-Gates, Perf-Gates | Produktivlogik | `scripts/`, `tests/`, `benchmarks/`, `.github/workflows/` |

---

## 4. Single Source of Truth (SSOT)

Jede fachliche Entscheidung hat **exakt eine** authoritative Quelle. Abweichende Duplikate sind ein Architekturverstoß.

| Entscheidung | Single Source of Truth | Durchsetzung |
|---|---|---|
| Physikalische Einheiten & Umrechnung | `lib/units.ts` (`PX_PER_METER = 100`, branded types) | Rule B, `lib/units.test.ts` |
| VDE-Normtabellen (Ampacity, Querschnitte, Sicherungen) | `lib/electrical.ts`, `lib/vde-standards.ts` | `lib/electrical.test.ts`, `lib/vde-*.test.ts` |
| Stromberechnung (DC) | `calculateEdgeCurrent` in `lib/vde-standards.ts` | Rule: keine zweite Stromquelle |
| Stromberechnung (AC) | `acCurrentA` in `lib/autoWire/sizing.ts` | AUDIT ELE-009 (zweiter Pfad entfernt) |
| Kabelgeometrie | Globaler Routing-Pass `routeAllCables` / `useCableRoute` | Rule G, `scripts/routing/architecture.test.ts` |
| Kollisions- & Abstandsmodell | `lib/routing/rules/collision.ts` | Rule H |
| Routing-Tokens (Abstände) | `lib/routing/tokens.ts` | Rule E, `lib/routing/tokens.test.ts` |
| Verbindungsregeln | `lib/connectionRules.ts` (`isConnectionAllowed`) | Rule: Connection Validation blockiert beim Connect |
| Bauteildaten & Registry | `components/registry/componentRegistry.ts` + `NodeDataRegistry` | `componentRegistry.test.tsx` |
| Laufzeit-Schema für `node.data` | `lib/nodeSchema.ts` | `lib/nodeSchema.test.ts`, `DOM-004` |
| Laufzeit-Schema für `edge.data` | `lib/edgeSchema.ts` | `lib/edgeSchema.test.ts` |
| Persistenz & Migration | `store/slices/persistence.ts` (`PLANNER_STORAGE_VERSION = 1`) | `persistence.test.ts` |
| Determinismus | Sortierung über Edge-ID, keine `Math.random` | Rule K, `goldenMaster.test.ts`, `regression.test.ts` |
| Absicht / Verbindlichkeit einer Kante | `lib/electricalGraph/intent.ts` | `intent.test.ts`, E1–E2 |
| Batteriebänke & Spannungsebenen | `lib/electricalGraph/batteryBank.ts`, `powerSystem.ts` | `batteryBank.test.ts`, `powerSystem.test.ts` |
| Komponentengrenzen | `lib/electricalGraph/constraints.ts` | `constraints.test.ts` |
| Design-Budget / Strombudget | `lib/electricalGraph/currentBudget.ts`, `lib/autoWire/designBudget.ts` | `currentBudget.test.ts`, `designBudget` |
| Architekturregeln (erzwungen) | `docs/ai/ARCHITECTURE-RULES.md` + `scripts/architecture/` | `libBoundary.test.ts`, `routing/architecture.test.ts` |
| Design-Tokens (Farben, Abstände UI) | `app/dark-engineering.css` | `designTokens.test.ts` (216 Tests) |

---

## 5. Erlaubte und verbotene Abhängigkeiten

Die folgende Matrix ist verbindlich. Ein `✓` bedeutet erlaubt, `✗` verboten, `→` nur über Adapter/delegiert.

| Von \ Nach | UI (app/components) | Application (store) | Domain (lib/domain, electricalGraph, autoWire) | Electrical Engine (lib/electrical*, units) | Component Data (registry, schemas) | Graph & Routing (lib/routing, edges/utils) | Validation (lib/verify, connectionRules) | Persistence (persistence, storage) | Verification (scripts, tests) |
|---|---|---|---|---|---|---|---|---|---|
| UI | ✓ | ✓ (ruft auf) | ✓ (liest) | ✓ (delegiert, Rule D) | ✓ (liest) | ✓ (liest Routen) | ✓ (zeigt Befunde) | — | — |
| Application | — | ✓ | ✓ (ruft auf) | ✓ (über Domain) | ✓ (liest) | ✓ (startet Routing) | ✓ (löst Validierung aus) | ✓ (schreibt) | — |
| Domain | ✗ | ✗ | ✓ | ✓ (liest) | ✓ (liest) | ✗ (Routing liest Domain, nicht umgekehrt) | ✗ | — | — |
| Electrical Engine | ✗ | ✗ | ✗ | ✓ | ✓ (liest) | ✗ | ✗ | — | — |
| Component Data | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | — | — |
| Graph & Routing | ✗ | ✗ | ✗ | ✗ | ✓ (Kantendaten lesen) | ✓ | ✗ (liest nur) | — | — |
| Validation | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ (Invariante) | ✓ | — | — |
| Persistence | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | — |
| Verification | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

**Absolute Verbote (harte Architekturtests):**
- `lib/**` darf nicht aus `components/`, `store/`, `app/` oder `benchmarks/` importieren (Rule A).
- Produktivcode darf nicht `edge.data.geometry` lesen oder schreiben (Rule G, `scripts/routing/architecture.test.ts`).
- `lib/routing/tokens.ts` ist die einzige Stelle, die Routing-Abstandskonstanten definiert (Rule E).
- Kein `Math.random`, keine unsortierte Objekt-Iteration im Routing (Rule K).
- Keine elektrische Berechnung im UI (Rule D).
- Keine stillen Fallbacks bei sicherheitskritischen Werten (Rule M).
- Keine `any`, kein `@ts-ignore`, kein `as unknown as` als Dauerzustand (O-1).

---

## 6. Datenverträge und Schnittstellen

| Vertrag | Beschreibung | Quelle |
|---|---|---|
| `PlannerNode` / `PlannerEdge` | Domänen-Knoten/-Kante, geometriefrei, strukturell kompatibel zu React-Flow-Typen | `lib/domain/graph.ts` |
| `CableEdgeData` | `geometry` ist **entfernt/tot** (Rule G); `crossSection`, `fuseSize`, `edgeDomain`, `length`, `dropWarning`, `fuseWarning` | `lib/domain/cableEdgeData.ts` |
| `HandleSpec` / `HandleBox` | Deklaration vs. Messung der Anschlüsse | `components/registry/...`, `nodeGeometry.ts` |
| `ElectricalDomain` | `'DC_12V' \| 'AC_230V' \| 'Solar'` — eine Quelle `getEdgeDomain` / `getHandleDomain` | `lib/electrical.ts` |
| `PathResult` | `waypoints` sind die Wahrheit; SVG wird daraus erzeugt, nie umgekehrt | `pathfinding.ts` |
| `ValidationWarning` | `ruleId`, `severity`, `measuredValue`, `expectedValue`, `unit`, `source`, `consequence`, `nextStep` | `VALIDATION-CONTEXT.md` |
| `PathRequest` / `RouteEdgeRef` | Router-Eingabevertrag (strikt: fehlender Bauteil/Anschluss ⇒ nicht routbar, eigener Befund) | `routeInput.ts`, `routeAll.ts` |
| Persistenz-Format | JSON in `localStorage['elektroplaner-planner-v1']`, Version 1, `partialize` + `migratePlannerPersisted` | `persistence.ts` |
| Inhalts-Hash | `electricalGraphHash` (FNV-1a), geometriefrei, ändert sich bei Umverdrahten nicht bei Verschieben | `lib/electricalGraph/graph.ts` |

---

## 7. Deterministisches Verhalten

- Gleiche Eingabe ⇒ byte-identisches Ergebnis (Rule K, ADR 0010).
- Tie-Breaker ist immer die Edge-ID (`String.localeCompare`), niemals `Math.random()`, niemals Objekt-Identität.
- Keine `Date.now()` im Routing/Domain.
- Sortierung immer über stabile IDs.
- Nachweis: `goldenMaster.test.ts` (Doppellauf), `regression.test.ts` (Szenarien 13–15 Drag/Undo/Pass-Wechsel), `npm run routing:audit` (Spalte `determ`).

---

## 8. Fehler- und Statusmodelle

| Domäne | Zustände | Bedeutung | Quelle |
|---|---|---|---|
| Validierung (Engine) | `CRITICAL_SAFETY`, `CODE_VIOLATION`, `EFFICIENCY_WARNING` × `VIOLATION` / `UNVERIFIABLE` / `coverageOnly` | Normsprache intern | `lib/verify/events.ts` |
| Validierung (Nutzer) | `critical` / `warning` / `info` × `violated` / `incomplete` / `not_applicable` | Projektion für Anzeige | `lib/validationSeverity.ts` |
| Routing-Invar., I1–I3 | `VALID` / `INVALID` | Hartes Gate | `finalValidation.ts` |
| Routing-I4–I7 | Zähler / Metrik | Ratchet, kein Block | `invariants.ts`, `routing:audit` |
| AC-Modell | `COMPLIANT` (12 V) / `INCOMPLETE` (230 V mit `NET-003`) | Modellgrenze ausgewiesen | `lib/verify/acScope.ts` |
| Elektro-Daten | `undefined` + Warnung statt erfundener Grenzwerte (Regel M) | Unbekannt ist ein eigener Zustand | `units.ts`, `currentBudget.ts` |
| Persistenz | Bekannte Felder mit falschem Typ werden **entfernt**, unbekannte bleiben (Forward-Kompatibilität) | `nodeSchema.ts`, `edgeSchema.ts` | `N-REGEL` |

**Wichtig:** Eine Datenlücke („ungeprüft“) ist kein Defekt und erscheint niemals als `critical`. Sie erhält eine klare Handlungsaufforderung (`nextStep`).

---

## 9. Versionierungsstrategie

| Objekt | Version | Verhalten |
|---|---|---|
| Plan-Datei (localStorage) | `PLANNER_STORAGE_VERSION = 1` | Migration `0 → 1` ohne Feldumbenennung; RETTEN statt VERWERFEN |
| Komponentendaten | Datenversion je Bauteil (Hersteller, Modell, Datenblatt, Quelle) | Siehe DOKUMENT 8 (Datenqualität) |
| Referenzpläne (Golden Master) | `knownPlans/*.json` eingefroren | Änderung nur mit PR-Begründung + Ledger-Eintrag + Recapture |
| Routing-Tokens | eingefrorener Stand, Drift-Guard | `tokens.test.ts` |
| Architektur & Regeln | dieses Dokument + `ARCHITECTURE-CHANGES.md` (Ledger) | Jede Verhaltensänderung einen Ledger-Eintrag |
| Storage-Key | `elektroplaner-planner-v1` (früher `werft-planner-v1`, wird übernommen) | Ein Dokument, ein Versionsschritt |

**Rückwärtskompatibilität:** Bestehende Projekte (v1) müssen lesbar bleiben. Migrationen wenden Feldschemas an, entfernen falsch getippte bekannte Felder, behalten unbekannte. Kein stiller Default.

---

## 10. Erweiterbarkeit

Zukünftige Erweiterungen dürfen die bestehenden Schichten nicht aufbrechen:

- **Neue Bauteile:** Registry-Eintrag + `NodeDataRegistry`-Eintrag + `lib/nodeSchema.ts`-Feldspiegel. Sonst nichts (DOMAIN-CONTEXT §6.4).
- **Neue Fahrzeugtypen / Spannungsebenen:** `lib/electricalGraph/powerSystem.ts` (Klassenfenster 12/24/48 V, `unknown` statt Rückfall).
- **Neue Berechnungsmodelle:** Neue Module in `lib/` (Electrical Engine), niemals im UI; durch Unit- + Property-Tests + Golden Master abgesichert.
- **Neue Normen/technische Daten:** Änderung nur in `lib/electrical.ts` / `lib/vde-standards.ts` mit Quellenangabe im Test; Golden Master neu erfassen.
- **Mehrere parallele KI-Agenten:** Architekturtests (`libBoundary`, `routing/architecture`) sowie Rule-Obligationen erzwingen die Grenzen; jeder Agent liest `ARCHITECTURE-RULES.md` vor Änderungen (AGENTS.md §1).
- **Domänen-Trennung elektrisch/wasser, AC/DC:** Regel existiert (`buildDomainSeparationRules`), ist teils nicht ans Produktivrouter angebunden (KNOWN-PROBLEMS ROUTE-003) — gezielte Erweiterung, keine Neubewertung.

---

## 11. Architekturtests zur Durchsetzung

Die Regeln werden durch ausführbare Tests erzwungen (eine Regel ohne Test ist eine Konvention und wird als solche markiert):

| Regel | Test / Befehl | Erzwingt |
|---|---|---|
| A | `npx vitest run scripts/architecture/libBoundary.test.ts` | `lib/` importiert keine App-Schicht |
| E, G, H, I, J | `npx vitest run scripts/routing/architecture.test.ts` | Eine Quelle je Zuständigkeit, `Infinity` Kollision, keine `geometry`-Lesung, gebündeltes elkjs |
| E (Werte/Drift) | `npx vitest run lib/routing/tokens.test.ts` | Token-Drift |
| K | `npm run test:goldenmaster`, `npm run test:regression`, `npm run routing:audit` | Determinismus |
| L | `npx vitest run lib/routing/rules/collision.test.ts`, `lib/routing/invariants.test.ts` | Crossing vs. Overlap |
| F | `npm run routing:audit` (Spalten I1–I3, fallback) | Sicherheit vor Schönheit |
| P | `npx vitest run components/edges/utils/routableNodes.test.ts …` | Darstellungs-Knoten erreichen Router nicht |
| Q | `npx vitest run store/slices/changeNoise.test.ts …` | Kein Zustand ohne Wirkung |
| R | `npx vitest run store/slices/persistence.test.ts app/handleGeometry.test.ts` | Messwerte sind kein Planinhalt |
| G1–G7 | `lib/vde-properties.test.ts` (fast-check) | Eigentumsgesetze der Elektrik |
| Architektur-Selbstprüfung | `npm run check` (lint + format + typecheck ×2 + Coverage) | Gate vor jedem Commit |

**Gate vor jedem Commit:** `npm run check` muss grün sein (AGENTS.md §7).

---

## 12. Abgrenzung zu bestehenden Dokumenten

Dieses Dokument dupliziert nicht die bestehenden, funktionierenden Spezifikationen. Es bezieht sich auf sie:

- `docs/ai/ARCHITECTURE-RULES.md` — Regeln A–N (verbindlich, mit erzwingenden Tests).
- `docs/electrical-architecture.md` — Schichtenmodell der fünf Zusagen (Determinismus, Nutzerabsicht gewinnt, Topologie ≠ Geometrie, keine stillen Annahmen, Konvergenz).
- `docs/electrical-graph.md` — Die elektrische Wahrheit (`lib/electricalGraph/`).
- `docs/CODE-MAP.md` — Vollständige Modulkarte (Ist-Zustand).
- `docs/ai/KNOWN-PROBLEMS.md` — Nachweisbare, offene Probleme (keine Wunschliste).
- `docs/ARCHITECTURE-V2.md` — FROZEN Spezifikation (Zielbild, nicht Ist-Code).
- Alle ADRs unter `docs/adr/` (0001–0038, 0026 nie vergeben).

Bei Widerspruch zwischen Code und ADR steht der Befund in `KNOWN-PROBLEMS.md`.
