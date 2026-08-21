# End-to-End-Tests (Playwright)

Stand: 2026-08-21 · Betrifft AGENTS.md **K5**

## 1. Was getestet wird — und wogegen

Die Suite läuft gegen den **gebauten Static Export** (`./out`), also exakt die
Dateien, die auf GitHub Pages ausgeliefert werden. Kein `next dev`, keine
Mocks, keine idealisierte Entwicklungsumgebung.

Ausgeliefert wird der Export von `scripts/e2e/static-server.mjs` — ein
abhängigkeitsfreier Server, der sich bewusst wie GitHub Pages verhält:

| Anfrage | Antwort |
|---------|---------|
| `/elektrik-planung/` | `out/elektrik-planung/index.html` (200) |
| `/elektrik-planung` | 308 auf `/elektrik-planung/` |
| unbekannter Pfad | `out/404.html` (404) |
| `../` im Pfad | 403/404, kein Ausbruch aus `out/` |

## 2. Pflichtszenarien

| Datei | Szenario |
|-------|----------|
| `tests/e2e/planner-flow.spec.ts` | Batterie → Sicherung → Verbraucher → Auto-Wire → Prüfung → Stückliste; leerer Plan zeigt keinen erfundenen Inhalt |
| `tests/e2e/responsive.spec.ts` | 375 / 768 / 1440 px ohne horizontalen Overflow, sichtbare Bereiche je Breakpoint, Canvas ≥ 600 px ab 1280 px, Touch-Ziele ≥ 44 px |
| `tests/e2e/persistence.spec.ts` | Knoten und Kanten überleben `reload()`; frischer Kontext startet leer; persistierter Stand ist versioniert |
| `tests/e2e/touch.spec.ts` | Tap fügt Bauteil hinzu, Bottom-Tabs, Tap-to-Connect zweier Anschlüsse, Abbruch durch zweiten Tap auf denselben Anschluss |

Projekte (Viewports) aus `playwright.config.ts`:
`desktop-1440`, `tablet-768`, `mobile-375`, `touch-pixel5` (echte Touch-Emulation).

## 3. Regeln, die eingehalten werden

- **Keine festen Wartezeiten.** Kein `waitForTimeout`; gewartet wird auf
  Zustände (`expect(...).toBeVisible()`, `expect.poll(...)`). Ein Vitest-Test
  (`components/e2eSelectors.test.tsx`) erzwingt das.
- **Stabile Selektoren.** `data-testid` oder Rollen/Beschriftungen. Ausnahme:
  die von React Flow selbst vergebenen Klassen (`.react-flow__node-battery`,
  `.react-flow__handle[data-handleid]`) — Teil seiner öffentlichen API.
- **Isolierte Kontexte.** Playwright-Standard; ein Test belegt zusätzlich
  explizit, dass ein frischer Kontext mit leerem `localStorage` startet.
- **Retry nur zur Diagnose.** Lokal `retries: 0`, in CI `retries: 1`.
- **Screenshots/Traces nur als Artefakt** bei Fehlschlag — nie als Assertion.

## 4. Ausführen

```bash
npm ci
npx playwright install --with-deps chromium   # einmalig
npm run build                                  # erzeugt ./out
npm run e2e                                    # alle Projekte
npm run e2e -- --project=desktop-1440          # ein Viewport
npm run e2e -- --ui                            # interaktiv
```

In CI läuft der Job `End-to-End (Playwright)` in
`.github/workflows/quality.yml` — also bei jedem Pull Request und vor jedem
Deploy.

## 5. Der Selektor-Vertrag (ohne Browser prüfbar)

`components/e2eSelectors.test.tsx` läuft im normalen `npm test` und sichert:

1. Alle 16 vereinbarten `data-testid` existieren im Anwendungscode.
2. Jede `getByTestId(...)`-Verwendung in `tests/e2e/` hat eine Entsprechung.
3. Die Suite enthält kein `waitForTimeout`.
4. Die Playwright-Konfiguration zeigt auf den Static Export, nicht auf `next dev`.
5. Die Sidebar rendert tatsächlich alle Kacheln, die die Tests benötigen
   (`battery`, `fuse`, `consumer`, `busbar`, `inverter`, `consumer230v`).

Ein umbenannter Selektor fällt damit im schnellen Unit-Lauf auf, nicht erst
in der Browser-Stufe.

## 6. Ehrlicher Status: lokal nicht ausgeführt

**Die Suite wurde in dieser Arbeitsumgebung nicht ausgeführt.** Der
Playwright-Browser-Download ist hier blockiert:

```
$ npx playwright install chromium
Error: Failed to download Chrome for Testing 151.0.7922.34, caused by
Error: Download failure, code=1

$ curl -sSI https://cdn.playwright.dev/
curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL
```

Es ist auch kein System-Chromium vorhanden. Die geforderten **drei
aufeinanderfolgenden grünen Läufe stehen deshalb aus** und müssen im ersten
CI-Lauf des Pull Requests erbracht werden.

Was **lokal verifiziert** wurde:

| Prüfung | Ergebnis |
|---------|----------|
| Static Server gegen echten Export | `/` 200, `/elektrik-planung/` 200, `/elektrik-planung` → 308, unbekannter Pfad → 404, `../package.json` → kein Ausbruch |
| Selektoren im gebauten Bundle | alle 7 Stichproben (`planner-shell`, `sidebar-item`, `action-autowire`, `action-bom`, `nav-tab-electric`, `planner-node`, `sidebar-search`) im JS-Chunk enthalten |
| Selektor-Vertrag | `components/e2eSelectors.test.tsx`, 5 Tests grün |
| Typecheck der Specs | `npm run typecheck` schließt `tests/e2e/**` ein, 0 Fehler |
| Vitest greift nicht auf die Specs zu | `vitest.config.ts` schließt `tests/e2e/**` aus |

## 7. Grenzen echter Geräteemulation

Chromiums Device-Emulation ist **kein echtes Gerät**. Konkret nicht abgedeckt:

- **Echte Touch-Hardware.** `hasTouch` + Touch-Events werden emuliert, aber
  ohne Fingerfläche, Druck oder Handballen-Erkennung. Ein Ziel, das im Test
  gut trifft, kann auf einem echten Daumen zu klein sein — die 44-px-Prüfung
  ist eine Näherung dafür, kein Ersatz.
- **Betriebssystem-Gesten.** Pinch-Zoom, Zurück-Wischen, Scroll-Momentum und
  die dynamische Adressleiste (iOS Safari) existieren in der Emulation nicht.
  Genau dort entstehen Layout-Fehler mit `100vh` — die App nutzt deshalb
  `h-dvh` und `env(safe-area-inset-*)`, was hier aber **nicht** verifiziert
  werden kann.
- **Safari/WebKit und Firefox.** Die Suite läuft nur auf Chromium. iOS Safari
  ist die relevanteste ungetestete Plattform (eigene Engine, eigene
  Viewport-Einheiten).
- **Echte Netzbedingungen und Geräteleistung.** Ein Low-End-Android rendert
  React Flow deutlich langsamer; Timeouts der Suite sind für CI-Hardware
  ausgelegt.
- **Kein Pixel-Vergleich.** Die Suite prüft Verhalten und Layout-Kennzahlen,
  keine Screenshots. Visuelle Regressionen des Routings deckt stattdessen
  `docs/routing-gallery/` ab (siehe `docs/ROUTING-INVARIANTS.md`).
