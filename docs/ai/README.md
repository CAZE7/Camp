# CAMP AI Handbook

Start here.

CAMP („Werft“) ist ein **statischer** Next.js-Elektroplaner für Camper-12-V-/230-V-/Solar-Anlagen.
Dieses Verzeichnis ist die autoritative Einstiegsdokumentation für Coding-Agents. Sie beschreibt
**ausschließlich Dinge, die im Code nachweisbar sind**. Steht irgendwo `UNKNOWN` oder
`NEEDS VERIFICATION`, ist die Frage offen und darf nicht durch Vermutung ersetzt werden.

Gültigkeit: Branch `arena/01a087f9-camp`, Stand 2026-09-10.

---

## 1. Der Weg in 60 Sekunden

```
AGENTS.md (Root, Pflichtlektüre + Task-Routing)
   └── docs/ai/README.md   ← du bist hier
          ├── CODE-MAP.md            Wo liegt was? (Modulkarte mit Depends On / Called By)
          ├── ARCHITECTURE-RULES.md  Was darf wohin? (erzwingbare Regeln + Test-Gates)
          ├── DOMAIN-CONTEXT.md      Datenmodell: Node, Edge, Port, ComponentKind (= PlannerNodeType), Domain
          ├── ELECTRICAL-CONTEXT.md  Strom, Spannung, Querschnitt, Sicherung, Solar, AC
          ├── AUTOWIRE-CONTEXT.md    Was AutoWire entscheidet — und was nicht
          ├── ROUTING-CONTEXT.md     Routing-Pipeline, Regeln, Token, Invarianten
          ├── VALIDATION-CONTEXT.md  Alle Prüfregeln mit Rule-ID und Severity
          ├── TESTING-CONTEXT.md     Welcher Testtyp ist für welche Änderung Pflicht
          ├── KNOWN-PROBLEMS.md      Echte, offene Probleme (keine Wunschliste)
          ├── CHANGE-WORKFLOW.md     Änderungsablauf + Routing-/Electrical-Spezialfall
          ├── SYMBOL-INDEX.md        Symbol → Datei → Zweck → Tests
          ├── LEGACY.md              Was Altbestand ist und warum es noch da ist
          ├── GOLDEN-PLANS.md        Die sechs Referenzpläne (Golden Master)
          └── examples/              Sieben reale Beispielpläne mit Erwartungswert
```

**Autoritätsregel:** Jede Information existiert genau **einmal**. Andere Dokumente verlinken
dorthin und wiederholen sie nicht. Widerspricht `docs/ai/*` einem anderen Dokument im Repo,
gilt der **Code**, danach `docs/ai/*`.

---

## 2. Task-Routing (Entscheidungslogik)

| Task enthält …                                                  | Zuerst lesen                                     |
| --------------------------------------------------------------- | ------------------------------------------------ |
| `routing / path / collision / crossing / lane / hop / ELK / A*` | [ROUTING-CONTEXT.md](./ROUTING-CONTEXT.md)       |
| `fuse / cable / voltage / current / battery / solar`            | [ELECTRICAL-CONTEXT.md](./ELECTRICAL-CONTEXT.md) |
| `autowire / automatic wiring`                                   | [AUTOWIRE-CONTEXT.md](./AUTOWIRE-CONTEXT.md)     |
| `component / port / connection / node.type`                     | [DOMAIN-CONTEXT.md](./DOMAIN-CONTEXT.md)         |
| `warning / validation / error / rule`                           | [VALIDATION-CONTEXT.md](./VALIDATION-CONTEXT.md) |
| `test / regression / golden / e2e`                              | [TESTING-CONTEXT.md](./TESTING-CONTEXT.md)       |
| `refactor / move / new file / dependency`                       | [ARCHITECTURE-RULES.md](./ARCHITECTURE-RULES.md) |

Zusätzlich **immer**, wenn die Änderung Verhalten betrifft:
[CHANGE-WORKFLOW.md](./CHANGE-WORKFLOW.md) (Routing und Electrical haben eigene Abläufe).

---

## 3. Das System in fünf Sätzen

1. **UI** (`components/`, `app/`) rendert React Flow und liest State aus einem Zustand-Store (`store/`).
2. **Domäne** (`lib/`) rechnet elektrisch und routet — ohne React, ohne React-Flow-Runtime (ADR 0008).
3. **AutoWire** (`lib/autoWire*`) erzeugt aus einer Bauteilliste eine normnahe Topologie inklusive
   Querschnitten und Sicherungen.
4. **Routing** (`components/edges/utils/routeAll.ts` + `lib/routing/`) erzeugt aus Knotengeometrie
   orthogonale Kabelwege — global, deterministisch, hindernisbewusst.
5. **Validierung** (`components/planner/hooks/useLiveValidation.ts` +
   `collectEdgeErrors` in `components/edges/CableEdge.tsx`) meldet Regelverstöße strukturiert
   (`ruleId`, `measuredValue`, `expectedValue`, `source`).

Der Datenfluss einer Planänderung:
**Sidebar → Store → Canvas → AutoWire → Sizing → Routing → Validierung → zurück in den Store.**

---

## 4. Harte Gates (ändern heißt: alle müssen grün bleiben)

```bash
npm run check              # lint + format + typecheck (2 Profile) + Tests
npm test                   # Vitest, 2026 Tests / 145 Dateien
npm run typecheck:tests    # tsc inklusive Testdateien (Units wirken dort)
npm run routing:audit      # Routing-Invarianten I1–I7 über die sechs Referenzpläne
npm run test:goldenmaster  # Golden-Master-Diff
npm run test:regression    # 15 Routing-Szenarien (Layout + Metrik + SVG)
npm run e2e                # Playwright: statischer Server auf ./out (scripts/e2e/static-server.mjs)
```

---

## 5. Was hier NICHT steht

- Keine VDE-/Normbehauptung ohne Quelle im Code. Wo eine Zahl eine **Modellannahme** ist,
  steht das in `lib/` im Quellkommentar — und genau so ist sie hier übernommen.
- Keine Produkt-Roadmap. Offene Aufgaben stehen in `AGENTS.md` (Projektboard).
- Keine API-Doku für externe Verbraucher — es gibt kein Backend (ADR 0001).
