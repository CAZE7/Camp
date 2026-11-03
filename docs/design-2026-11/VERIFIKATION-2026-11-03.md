# Browser-Verifikation — 2026-11-03

Der Betreiber hat verlangt, die nötigen Werkzeuge selbst zu besorgen und alles
im Browser zu prüfen. Dieses Dokument hält fest, **was tatsächlich gemessen**
wurde, mit welchem Browser und wo die Grenzen liegen. Es ist kein Freispruch.

## 1. Werkzeuge

| Werkzeug                      | Herkunft                                               | Grund                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium 153 (headless shell) | `@sparticuz/chromium@153.0.0` aus `registry.npmjs.org` | `cdn.playwright.dev`, `storage.googleapis.com` und `playwright install` sind in dieser Umgebung blockiert; das Paket liefert Binary + NSS-Libs + Fonts im npm-Tarball |
| Playwright 1.63               | bereits im Repo                                        | `playwright.config.ts` hat dafür den Haken `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`                                                                                      |
| Lighthouse 13.6               | `registry.npmjs.org`                                   | Performance/A11y/Best-Practices/SEO                                                                                                                                   |
| axe                           | `@axe-core/playwright` im Repo                         | Barrierefreiheits-Gate                                                                                                                                                |
| gzip-Statikserver             | selbst geschrieben, `/tmp`                             | Der Standard-`http.server` liefert unkomprimiert; GitHub Pages liefert gzip. Ohne diese Korrektur sind Lab-Werte systematisch zu schlecht                             |

Extrahiert wurden `chromium.br`, `al2023.tar.br` (libnspr4/libnss3/…), Fonts
und SwiftShader nach `/tmp`; gesetzt wurden `LD_LIBRARY_PATH=/tmp/al2023/lib`
und `FONTCONFIG_PATH=/tmp/fonts`. `ldd /tmp/chromium` meldet danach **keine**
fehlende Bibliothek. Der Browser läuft mit den Standard-Playwright-Argumenten.

## 2. Gates

| Gate                                                                       | Ergebnis                                                                                                                                              |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                            | **exit 0** — Lint, Prettier, 2× Typecheck, 298 Testdateien                                                                                            |
| `npm run build`                                                            | **exit 0** — 47 statische Routen, 42 geprüfte Seiten, „Export-Prüfung grün"                                                                           |
| `npm run seo:audit`                                                        | **exit 0** — Kopfdaten, strukturierte Beschreibung, Verweise, Sitemap                                                                                 |
| `npx playwright test --workers=2` (alle 4 Projekte)                        | **420 bestanden, 259 übersprungen, 17 fehlgeschlagen** — alle 17 sind `toHaveScreenshot`-Baselines, kein einziger Funktions-, A11y- oder No-JS-Fehler |
| `a11y.spec.ts`                                                             | **grün** – u. a. „Ladebooster-Vergleich", „Ladebooster-Vergleich im dunklen Schema", Planer-Canvas                                                    |
| `seo-nojs.spec.ts`                                                         | **grün** – Inhalt ohne JavaScript, inkl. Ladebooster-Vergleich                                                                                        |
| `responsive.spec.ts`, `mobile-geometry.spec.ts`, `layout-geometry.spec.ts` | **grün**                                                                                                                                              |
| `planner-canvas-a11y.spec.ts`                                              | **grün** – inkl. `prefers-reduced-motion`                                                                                                             |
| `ladebooster-vergleich.spec.ts`                                            | **grün** – Filter, Rechner-Ausgaben `79 A · 0,24 C` / `90-A-Klasse` / `130 A · 72 %` bleiben bitidentisch                                             |

### Die 17 Baseline-Fehler, sortiert nach Ursache

| Anzahl | Test                                                   | Ursache                                                                                                                        | Bewertung                                                                                       |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 8      | `visual.spec.ts` · `impressum` light/dark × 4 Projekte | Erwartet 1440 × 1192 px, erhalten 1440 × 1220 px. Das echte Impressum hat drei Zeilen Anschrift statt zwei Aufforderungszeilen | **Erwartete, gewollte Änderung.** Baselines müssen in CI neu gezogen werden                     |
| 9      | `visual-de-pixel.spec.ts` · `design-system` light/dark | Erwartetes Bild ist **400 px breit**, der Test rendert **375 px**; zusätzlich andere Font-Metriken (5609 → 5536 px Höhe)       | **Vorbestehend und umgebungsbedingt.** `/design-system/` wurde in dieser Arbeit nicht angefasst |

**Wichtig:** Die Baselines wurden **nicht** überschrieben. Dieser Chromium-Build
ist nicht der offiziell in CI verwendete Playwright-Chromium; mit ihm erzeugte
Pixel wären in CI falsch. Der richtige Weg ist
`npx playwright test tests/e2e/visual.spec.ts --update-snapshots` auf Linux mit
dem offiziellen Browser, plus optische Freigabe (M11-1).

## 3. Lighthouse

Zwei Messreihen, weil der unkomprimierte lokale Server die Zahlen verzerrt.
Lighthouse-Simulation: Mobil, 150 ms RTT, 1,6 MBit/s, 4× CPU-Drosselung.

| Seite                                | unkomprimiert (Python-Server)                                         | **mit gzip (wie GitHub Pages)**                                           |
| ------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/`                                  | Perf 85 · A11y 100 · SEO 100 · LCP 2,4 s · CLS 0,194                  | **Perf 90 · A11y 100 · BP 100 · SEO 100 · LCP 1,2 s · CLS 0,194**         |
| `/impressum/`                        | Perf 97 · LCP 2,1 s · CLS 0,001                                       | **Perf 100 · LCP 1,1 s · CLS 0,001**                                      |
| `/camper-elektrik/kabelquerschnitt/` | Perf 92 · LCP 2,7 s · CLS 0                                           | **Perf 100 · LCP 1,4 s · CLS 0**                                          |
| `/camper-elektrik/ladebooster/`      | Perf 82 · A11y 100 · BP 100 · SEO 100 · LCP 3,6 s · CLS 0 · TBT 40 ms | **Perf 99 · A11y 100 · BP 100 · SEO 100 · LCP 1,5 s · CLS 0 · TBT 70 ms** |

Transfergrößen mit gzip: Startseite 15 KB, Vergleich 65 KB, Impressum 7 KB.
Ohne gzip liegt das HTML der Vergleichsseite bei 319 KB.

**Befund zur Startseite:** Die simulierte CLS von 0,194 ist ein
**vorbestehender Font-Swap in der Kopfzeile** (Navigationselemente verschieben
sich beim Laden der selbst gehosteten Schriften um wenige Pixel). Die direkte,
ungedrosselte `PerformanceObserver`-Messung auf `/` ergab **CLS 0**. Das
betrifft nicht die Vergleichsseite und wurde in dieser Arbeit nicht verursacht;
es bleibt als eigene Aufgabe offen. Ebenso global: 73 KiB ungenutztes CSS von
199 KiB und ~151 KiB ungenutztes JavaScript — technische Schuld des Gesamt-
Bundles, kein Fehler der Vergleichsseite.

## 4. Eigene Browser-Messungen

Sechs Kombinationen (375 / 768 / 1440 × hell / dunkel), echte Interaktionen,
`PerformanceObserver` für LCP/CLS/INP, Gegenprobe ohne JavaScript.

| Prüfung                               | Ergebnis                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| HTTP-Status                           | 200 in allen sechs Läufen                                                                           |
| Horizontaler Overflow                 | **keiner** (scrollWidth == innerWidth bei 375 / 768 / 1440)                                         |
| Geräte                                | 9 Karten, 9 Tabellenzeilen, 13 `<details>` in allen Läufen                                          |
| Überschriften                         | genau 1 H1, 12 H2                                                                                   |
| Doppelte IDs / tote Anker             | keine                                                                                               |
| Konsolen-/Seitenfehler                | **keine** in allen sechs Läufen                                                                     |
| Dark Mode                             | `body` hell `rgb(236,238,240)`, dunkel `rgb(19,21,24)`                                              |
| Filter `60–70 A`                      | **4 sichtbare Zeilen und 4 sichtbare Karten**, Zähler „4 von 9 Geräten", `aria-pressed=true`        |
| Sortierung „Nach Preis"               | erste Zeile Orion-Tr Smart (168 €), `aria-pressed=true`                                             |
| Sprung „Konzepte"                     | `<details>` öffnet, `aria-current` gesetzt                                                          |
| Hover Tabellenzeile                   | `rgba(0,0,0,0)` → `rgb(231,234,237)`                                                                |
| Press-Feedback                        | Summary **und** Filterknopf: `scale 0,96`, `150 ms`, `transition-property` enthält `scale`          |
| `prefers-reduced-motion: reduce`      | `transition-duration 1e-05s`, `scale: none`, `scroll-behavior: auto`                                |
| Ohne JavaScript                       | H2, Kurzentscheidung, Geräteüberblick, 9 Karten, Vertiefungstexte und der Rechner-Hinweis vorhanden |
| LCP / CLS / INP (lokal, ungedrosselt) | **148 ms / 0,0065 / 32 ms** bei 15 Interaktionen                                                    |
| CLS über die sechs Läufe              | 0 (375), 0,0151 (768), 0,0065 (1440) – derselbe Header-Font-Swap wie auf `/`                        |

**Während der Prüfung behoben:** Die Filter-/Sortierknöpfe hatten kein
Press-Feedback. Eine eigene, Reduced-Motion-geschützte Regel in
`app/ladebooster-vergleich.css` setzt jetzt `scale: var(--press-scale)` bei
`:active`, ohne die Farb-Transition zu überschreiben. Danach neu gebaut und im
Browser nachgemessen (`no-preference` → 0,96 / `reduce` → `none`).

## 5. P4-Nachtrag (gleicher Tag)

| Prüfung                                                                          | Ergebnis                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visuelle Baselines                                                               | Die 22 auf `main` freigegebenen Baselines übernommen (bewusst **nicht** mit dem Lambda-Chromium neu erzeugt)                                                                                   |
| `npx playwright test tests/e2e/visual.spec.ts tests/e2e/visual-de-pixel.spec.ts` | **76 bestanden, 0 fehlgeschlagen** über alle vier Projekte (vorher 17 rot)                                                                                                                     |
| `npm run perf:lighthouse` (M11-5)                                                | **exit 0** – Vergleich 99/100/100/100 · LCP 1511 ms · CLS 0; Start 91/100/100 · LCP 1212 ms · CLS 0,194 (innerhalb des dokumentierten Limits); Impressum 99/100/100 · LCP 1059 ms · CLS 0,0005 |
| Bild-Sitemap / `ImageObject`                                                     | `lib/seo/bildSitemap.ts` als eine Liste; `app/sitemap.ts` und `jsonLdFor()` lesen sie. Leer, solange keine eigenen Fotos mit Rechten vorliegen — keine erfundenen Bild-Adressen                |
| CI-Anbindung                                                                     | `npm run perf:lighthouse` läuft im nicht-blockierenden Visual-Job von `quality.yml`; 1:1-Spiegel in `docs/ci/workflows/` synchron, `workflows.test.ts` grün                                    |

Die Budgetlogik ist ohne Browser unit-getestet (`scripts/ci/lighthouseGate.test.ts`),
die Bildregeln in `lib/seo/bildSitemap.test.ts` und `app/sitemap.test.ts`.

## 5. Belege im Ordner

| Datei                                 | Inhalt                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `vergleich-375-{light,dark}.jpg`      | Ausschnitt der Scan-Schicht, 375 px                                                         |
| `vergleich-768-{light,dark}.jpg`      | Ausschnitt, 768 px                                                                          |
| `vergleich-1440-{light,dark}.jpg`     | Ausschnitt, 1440 px                                                                         |
| `impressum-ist-{light,dark}-1440.jpg` | **Ist-Zustand** des Impressums mit den echten Angaben. Ausdrücklich **keine** neue Baseline |

## 6. Grenzen dieser Prüfung

- Der Browser ist ein **Lambda-/Headless-Shell-Chromium 153**, nicht der in CI
  gebündelte Playwright-Chromium. Pixelbaselines dürfen damit nicht erzeugt
  werden; Farb-, Hover- und DOM-Verhalten sind davon nicht betroffen.
- Lighthouse-Werte sind **Lab-Werte unter simulierter Drosselung** auf einem
  lokalen Server. Keine CrUX-/Felddaten, kein echtes Mobilgerät, kein
  CDN-Verhalten. INP wurde lokal aus 15 Interaktionen gemessen (32 ms), nicht
  aus echten Nutzerdaten.
- Nicht geprüft: echte Touch-Hardware, Screenreader, Tastaturbedienung über
  die automatisierten Tests hinaus, Forced Colors, Anzeigenfreigaben und
  Conversion-Messung. Die **Rechtstexte sind in diesem Baum vollständig**
  (Impressum befüllt, Datenschutzerklärung ohne Platzhalter, keine Cookies →
  kein CMP nötig); offen sind ausschließlich Ads-Konto, Search Console und
  Conversion-Events als Setup/Messung, nicht als Rechtsblocker.
- **Kein Ranking- und kein CPA-Versprechen.**
