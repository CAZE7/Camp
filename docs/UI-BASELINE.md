# UI-BASELINE — Werft-Relaunch-Freeze

Stand: 2026-09-06 · Baseline-Quelle: `3148348` (`stack/s-1 + routing-v2/wp-7`).

Dieses Dokument ist der feste UI-Freeze-Punkt für den wiederhergestellten Werft-Stand.
Es schützt das Erscheinungsbild vor künftigen Architektur-Refactors: V2 darf auf die UI
aufsetzen, aber die UI nicht wieder auf einen alten/monatsalten Zustand zurückwerfen.

## 1. Reihenfolge für Refactors

Für diese Wiederherstellung gilt ausdrücklich **UI zuerst, Architektur danach**:

```text
                 UI
                  │
          ┌───────┴────────┐
          ↓                ↓
     Planner UI       Design System
          │
          ↓
      Domain Model
          ↓
      AutoWire
          ↓
      Routing V2
```

Konsequenzen:

1. `app/globals.css`, Fonts, Theme-Klasse, Header/Footer und Planner-Chrome sind die
   sichtbare Referenz.
2. Domain Model, AutoWire und Routing V2 dürfen darunter verbessert werden, müssen aber
   die Screenshots und Token-Guards dieser Baseline grün halten.
3. React Flow bleibt UI-Adapter. Fachlogik darf nicht in Node-/Edge-Rendering zurückwandern.
4. Neue Architekturarbeit braucht entweder unveränderte Golden Screenshots oder bewusst
   freigegebene neue Screenshots mit Vorher/Nachher-Vergleich.

## 2. Eingefrorene UI-Flächen

| Fläche      | Referenzpfade                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------- |
| Homepage    | `app/page.tsx`, `components/brand/SiteHeader.tsx`, `components/brand/SiteFooter.tsx`            |
| App-Shell   | `app/layout.tsx`, `components/theme/SystemThemeSync.tsx`                                        |
| CSS/Tokens  | `app/globals.css`, `tailwind.config.ts`, `lib/designTokens.test.ts`                             |
| Fonts       | Inter, Outfit, IBM Plex Mono via `app/layout.tsx`                                               |
| Sidebar     | `components/Sidebar.tsx`, `components/sidebar/*`                                                |
| Planner UI  | `components/Planner.tsx`, `components/PlannerInner.tsx`, `components/planner/*`                 |
| Canvas      | `components/planner/FlowCanvas.tsx`, `components/nodes/*`, `components/edges/*`                 |
| Inspector   | `components/planner/PlannerInspector.tsx`, `components/Inspector.tsx`, `components/inspector/*` |
| Warnings    | `components/planner/ui/WarningCenter.tsx`, `components/planner/hooks/useLiveValidation.ts`      |
| Mobile/Dark | `PlannerInner` Breakpoints, `SystemThemeSync`, `.dark`-Tokenblock in `globals.css`              |

## 3. Golden Screenshot Gate

Die verbindlichen Pixel-Baselines liegen hier:

- Test: `tests/e2e/visual.spec.ts`
- Snapshots: `tests/e2e/visual.spec.ts-snapshots/*.png`

Abgedeckte Matrix:

| Bereich                        | Baselines                                              |
| ------------------------------ | ------------------------------------------------------ |
| Homepage                       | `route-start-{light,dark}-*.png`                       |
| Planner inklusive Shell/Canvas | `route-planung-{light,dark}-*.png`                     |
| Mobile                         | `*-mobile-375-linux.png`, `*-touch-pixel5-linux.png`   |
| Tablet                         | `*-tablet-768-linux.png`                               |
| Desktop                        | `*-desktop-1440-linux.png`                             |
| Dark Mode                      | alle `*-dark-*.png`                                    |
| Weitere öffentliche Seiten     | `route-dach-*`, `route-heizung-*`, `route-impressum-*` |

Die Planner-Route ist die Baseline für Sidebar, Canvas, Inspector-Chrome und die
Warnzentrale im normalen Erstbesuchszustand. Wenn diese Teilflächen gezielt umgebaut
werden, müssen zusätzlich dedizierte Locator-Screenshots für die betroffene Teilfläche
angelegt oder aktualisiert werden.

## 4. Baseline aktualisieren

Nur nach ausdrücklicher UI-Freigabe:

```bash
npm ci
npm run build
npx playwright test tests/e2e/visual.spec.ts --update-snapshots
npm run check
```

Regeln für Snapshot-Updates:

- Keine Snapshot-Aktualisierung als Nebenprodukt eines Domain-/Routing-Refactors.
- Jede Änderung an `app/globals.css`, `tailwind.config.ts`, Header/Footer, Sidebar,
  Canvas, Inspector oder WarningCenter braucht eine kurze Begründung im PR.
- Vorher/Nachher-Bilder gehören in den PR-Kommentar, wenn Pixel-Baselines geändert werden.
- Ohne Browser in der lokalen Umgebung ist der Playwright-Lauf im CI nachzuholen; die
  vorhandenen PNGs bleiben trotzdem die Review-Referenz.

## 5. Lokale Nicht-Pixel-Gates

Auch ohne Playwright-Browser schützen diese schnellen Checks die Baseline:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run typecheck:tests
npm test
```

Wichtige Guards:

- `lib/designTokens.test.ts` prüft helle/dunkle Tokens, Kontraste, Fonts und Touch-Größen.
- `components/e2eSelectors.test.tsx` hält die Playwright-Selektoren stabil.
- `tests/e2e/responsive.spec.ts` dokumentiert die Breakpoints 375 / 768 / 1440 px.
- `tests/e2e/planner-flow.spec.ts` schützt den Planer-Grundablauf inklusive AutoWire,
  Prüfung und Stückliste.
