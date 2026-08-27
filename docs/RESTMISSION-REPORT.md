# REST-MISSION R1–R7 — Abschlussbericht

**Branch:** `arena/01a02021-camp`
**Datum:** 2026-08-20
**Baseline:** PR #314 (664 Tests grün, tsc sauber, Build sauber)

Dieses Dokument fasst Phase 2 (Architektur-Entscheidungen) und Phase 4
(alle drei Verifikations-Pässe) zusammen, wie in `AGENTS.md` gefordert.

---

## 1. Phase-2-Architektur-Entscheidungen

| # | Problem | Optionen | Wahl | Begründung (2 Sätze) |
|---|---|---|---|---|
| E1 | R1: Letzte Chat-Reste im Source (`copyBomForChat`, Kommentare in `vde-standards.ts`, `globals.css`) | (a) harte Löschung, (b) nur umbenennen, (c) als deprecated markieren | (b) | Der BOM-Kopier-Button ist weiterhin funktional erwünscht (JSON in Zwischenablage), nur der Name referenziert einen nicht existenten Chat. Umbenennen nennt den Zweck korrekt, ohne ein funktionierendes Feature zu entfernen. |
| E2 | R3: Private Auto-Wire-Hilfsfunktionen (`cumulativeDropAt`, `sizeDcEdges`, `applyFuseSizes`, `healUserEdges`, `resolveRails`) haben keine Unit-Tests | (a) Export + `@internal`-Tests, (b) nur über `performAutoWiring` integrieren, (c) ungetestet lassen | (a) | Jede dieser Funktionen enthält VDE-Sicherheitslogik; ein Regressionstest auf Integrationsebene würde einen Defekt nicht auf die funktionale Einheit eingrenzen. Der `@internal`-Export ist explizit dokumentiert und erweitert die öffentliche API nicht (`performAutoWiring` bleibt der einzige normale Einstieg). |
| E3 | R4 DEAD-001: Das AUDIT.md nennt `components/Sidebar.tsx` und `components/Inspector.tsx` als tot | (a) löschen, (b) behalten | (b) | Nach dem Stand von PR #314 importiert `PlannerSidebar` `Sidebar` und `PlannerInspector` den Default-Export aus `../Inspector`. Beide Dateien sind also produktiv verwendet — das AUDIT.md ist an dieser Stelle historisch. |
| E4 | R4 A11Y-001: Skip-Link-Ziel `#main` auf `/elektrik-planung` | (a) id an `<main>` ergänzen, (b) `PlannerInner` ein neues `<main>` geben | (a) | `app/elektrik-planung/page.tsx` rendert bereits das einzige `<main>` der Route; die id zu ergänzen ist die minimale, im AUDIT geforderte Änderung. |
| E5 | R4 ELEC-001: `selectFuseSize`-Fallback | (a) `maxFuse` statt nächstgrößere Norm-Sicherung, (b) Error werfen, (c) Wert `null` | (a) — in `electrical.ts` bereits umgesetzt; `applyFuseSizes` prüft `isFuseFeasible` und treibt den Querschnitt hoch | Eine Exception wäre im Auto-Wire-Lauf kaum beherrschbar, `null` würde jeden Aufrufer zwingen, den Fall zu behandeln. `maxFuse` zurückzugeben UND in `applyFuseSizes` den Quersritt hochzutreiben ist die fachlich konservative Lösung: niemals eine Sicherung über dem Kabel-Maximalwert. |
| E6 | R4 ELEC-002: `hasRcd`-Stempel | (a) überhaupt nicht mehr setzen, (b) immer `true`, (c) an einen vom Nutzer gepflegten `rating`-Wert koppeln | (a) — bereits umgesetzt | `autoWire.ts` setzt `hasRcd` nicht mehr; `useLiveValidation` Rule A2 + Dashboard erzeugen eine kritische Warnung. Das verhindert ein stilles „FI vorhanden“ ohne die Editor-UI für ein RCD-Feld überarbeiten zu müssen. |
| E7 | R4 ELEC-003: AC-Kanten-Sicherungen | (a) Pauschale 16 A wie bisher, (b) `fuseSize` auf AC-Kanten ableiten, (c) eigener `shorePower.rating`-Wert | (a) (bewusst verzögert) | AC-Kanten werden bereits gequerschnittlich dimensioniert (`sizeAcEdges`); eine modellierte AC-Sicherung würde eine neue Nutzer-Interaktion (Bemessungsstrom am Landstromanschluss) und Kanten-UI erfordern. Der Rückstellweg ist dokumentiert; bei 230 V ist die pauschale 16-A-Versorgung im Camper üblich und die RCD-Pflicht ist über RCD-Warnung abgedeckt. |
| E8 | R4 SEC-001: `allowedDevOrigins: ['*.e2b.app']` in `next.config.ts` | (a) ganz entfernen, (b) nur dev setzen, (c) über Env | (b) — bereits umgesetzt | `next.config.ts` clippt die Option jetzt auf `NODE_ENV !== 'production'`. In Produktion (Static Export) ist sie ohnehin wirkungslos, die Dev-Wildcard bleibt für die Sandbox-Vorschau funktional. |
| E9 | R5: Leere Zustände | (a) zentrales `EmptyState`-Primitive verwenden, (b) jede Seite selbst rendern | (a) — bereits umgesetzt | `components/ui/EmptyState.tsx` wird in `FlowCanvas` (leere Elektrik/leeres Wasser) verwendet; BOMModal hat eine eigene Variante mit Listenkontext; Such-Leerraum in `Sidebar.tsx` hat Reset-Button. So bleibt jeder leere Zustang kontextspezifisch. |
| E10 | R6: Lighthouse im Sandbox | (a) auf echten Browser warten, (b) `@sparticuz/chromium` + `npx lighthouse` gegen lokalen Static-Export | (b) | Das binary `chromium.br` aus dem npm-Paket lässt sich per Brotli entpacken und mit den mitgelieferten `al2023.tar.br`-nss-Libraries gegen `http://127.0.0.1` betreiben. Ergebnis: 100/100 auf Mobile (375 px) UND Desktop (1366 px); Reproduktionsanleitung siehe `lighthouse-report/README.md`. |
| E11 | R7: Exakte Segment-Schnittprüfung | (a) jetzt implementieren, (b) verschieben | (b) | Die Mittelpunkt-Näherung ist in PR #314 ausdrücklich als Trade-off dokumentiert und liefert in der Praxis keine sichtbare Unruhe; die Grenze von 120 Kanten schützt vor O(E²). Eine Änderung würde ein eigenes Projekt mit spezialisierten Polygon-Intersection-Tests erfordern und in diesem Scope keine Nutzer-verbesserung freisetzen. |
| E12 | A11y: `aria-label` auf bedeutungslosem `<div>` (Lighthouse `aria-prohibited-attr`) | (a) entfernen, (b) `role="img"` ergänzen, (c) in semantisches Element umwandeln | (b) | Der Onboarding-Fortschrittsbalken ist eine rein visuelle Anzeige; mit `role="img"` und `aria-label="Schritt N von 3"` wird die Information Screenreadern zugänglich, ohne Markup-Struktur zu ändern. |

## 2. Phase-3-Änderungen (Dateien)

### Neu
- `docs/INVENTORY.md` — R2-Inventur (9 Gruppen, alle interaktiven Elemente).
- `docs/RESTMISSION-REPORT.md` — diese Datei.
- `lighthouse-report/elektrik-planung-mobile.report.html` / `.json` — R6-Beleg Mobile (375×667).
- `lighthouse-report/elektrik-planung-desktop.report.html` / `.json` — R6-Beleg Desktop (1366×768).
- `lighthouse-report/README.md` — Reproduktionsanleitung.

### Geändert
- `components/planner/BOMModal.tsx` — R1: `copyBomForChat` → `copyBomToClipboard`; Kommentar beschreibt den tatsächlichen Zweck.
- `lib/vde-standards.ts` — R1: Stale-Kommentar `app/api/chat/route.ts` entfernt.
- `app/globals.css` — R1: Kommentar „(Chat, DachPanel)“ → „(DachPanel etc.)“.
- `lib/autoWire.ts` — R3: `cumulativeDropAt`, `sizeDcEdges`, `applyFuseSizes`, `healUserEdges`, `resolveRails` mit `@internal`-JSDoc exportiert, damit Unit-Tests sie direkt adressieren können. Keine Logik-Änderung.
- `lib/autoWire.test.ts` — R3: von 9 auf 30 Tests erweitert; pro exportierter/nennenswerter Funktion ein `describe`-Block.
- `components/planner/OnboardingWizard.tsx` — R6/A11y: Fortschrittsanzeige bekommt `role="img"`, damit `aria-label` auf dem `<div>` erlaubt ist (Lighthouse `aria-prohibited-attr`).

### Gelöscht
- Keine. Alle gemeldeten „toten“ Dateien sind nach aktuellem Stand in Verwendung (siehe E3).
- Chat-Komponenten (`components/Chat.tsx`, `app/api/chat/`, `app/ki-assistent/`, `lib/chatConfig*`) waren bereits in PR #314 entfernt; R1 hat nur noch Namens-/Kommentar-Reste beseitigt.

## 3. Phase-4-Verifikation

### PASS 1 — Selbstprüfung gegen `docs/INVENTORY.md`

Jede Zeile in der Inventur wurde gegen den aktuellen Stand geprüft:

- **Sidebar** (`components/Sidebar.tsx` + `PlannerSidebar.tsx`): Suchfeld, Löschen-Knopf, Kategorie-Köpfe, Komponente-Kachel, Geräte-Vorlagen, Einklapp-Pfeil, leer-Suche — jeweils im Code verifiziert, Touch-Targets via `min-h-11`/`min-h-24`. ✅
- **Dashboard** (`PlannerDashboard.tsx`): Tabs, Auto-Wire, Undo/Redo, Übersicht, Aufräumen, Mehr-Menü, alle Menüpunkte, Saisonschalter, WarningCenter, Shortcut-Hints, Save-Indikator, Toast, Reset-Dialog — `aria-*` konsistent. ✅
- **Canvas / Ansichten** (`FlowCanvas.tsx`, `PlannerInner.tsx`): Mobile Tabs `aria-current`, Domänen-Filter `aria-pressed`, MiniMap, Controls, Handles (`role="button"`, Enter/Space in `useAccessibleHandles`), Drag-Griff, Long-Press, Kanten (Touch-Zone 36 px, Tap-Label), Kontextmenü, leere Canvas via `EmptyState`, Onboarding, Metrics-Karte, Solar-Banner. ✅
- **Inspector**: Einklapp-Pfeil, Schließen im Slide-over, Empty-Selection, Bezeichnungs-Feld, Typspezifische Felder, RCD-Anzeige (Auto-Wire setzt nicht mehr `hasRcd=true`), Lösch-Button. ✅
- **Dialoge**: `AccessibleDialog` mit Fokus-Falle/Escape, BOMModal (inkl. Leer-Zustand & Kopier-Button), Reset/Onboarding. ✅
- **Gesten/Tastatur** (`PlannerInner.onKeyDown` + Hooks): Strg+Z/Y/Shift+Z, Strg+S, Entf/Backspace (mit Bestätigung), Escape, Touch-Tap-Connect, 200 ms Long-Press, Ein-Finger-Pan, Pinch-Zoom, Maus-Rechtsklick, Doppelklick-Bearbeitung, Drag-from-Sidebar (Ghost). ✅
- **Sonstige Seiten**: Skip-Link `#main` auf `app/elektrik-planung/page.tsx` (A11Y-001), `SiteHeader`, Footer, Dach, Heizung, Guides. ✅
- **Chat (R1)**: keine Route, keine Komponente, kein `useChat`, keine `.env`-Referenz; Build-Output listet KEIN `/api/chat`. ✅

**Viewport-Verifikation (PR #314-Stand respektiert):**
- 375 px (iPhone SE): Bottom-Tab-Nav, eine Spalte sichtbar, MiniMap versteckt, Kabel-Labels minimiert.
- 768 px (iPad hoch): Sidebar + Canvas, Inspector als Slide-over (320 px) mit Backdrop.
- 1024 px (iPad quer): Sidebar 260 + Canvas 744, Inspector weiterhin Slide-over (600-px-Regel).
- 1440 px (Desktop): Sidebar 280 + Canvas flex + Inspector 288 angedockt (Canvas-Anteil 60,6 %).
- 1920 px (Desktop): Inspector 320 px ab 1536 px.

### PASS 2 — Adversariale QA

Folgende Szenarien wurden gegen den laufenden Static-Export und den
Quellcode geprüft:

1. **20 Knoten wild platzieren, verbinden, löschen, rückgängig.**
   History ist in `usePlannerStore` über `undo`/`redo` abgebildet;
   `deleteSelected` filtert verwaisende Kanten und schreibt einen
   Checkpoint (store/usePlannerStore.ts:300-320). Die Auto-Wire-Läufe
   sind idempotent (Test in `autoWire.test.ts`).
2. **iPhone SE 375 px mit dicken Fingern.** Alle Buttons ≥44 px
   (`min-h-11`), Handles 44×44, Drag-Griff 44×44, Mobile-Tabs
   `min-h-14`. Lighthouse Mobile 100 bestätigt die Trefferflächen.
3. **Inkompatible Handles verbinden.** `isValidConnection` im Store
   prüft Domäne (DC/AC), Polarität und vorhandene Kanten; ein Fehlversuch
   löst in `FlowCanvas` `onConnectEnd` mit Feedback „Diese Verbindung
   ist nicht möglich…“ aus.
4. **Reload — Plan noch da?** Beide Stores (`werft-planner-v1`,
   `werft-app-preferences-v1`) persistieren nach `localStorage` über
   Zustand-Persist-Middleware; nach Reload wird der Plan ohne
   Server-Anfrage rekonstruiert.
5. **3+ Kabel zwischen denselben Knoten — getrennt sichtbar?**
   `parallelLaneOffset` in `pathUtils.ts:104` sortiert Geschwisterkanten
   nach Typ (Plus→Minus→230V→Rest) und spreizt sie um 16 px je Lane.
   Labels spreizt `edgeLabelNudge` um 22 px.
6. **Offline — alles funktioniert ohne Server?** Static Export
   (`output: 'export'`), keine `fetch`-Aufrufe im Planner, alle
   Berechnungen clientseitig. R1: Chat-Route entfernt → es gibt
   keinen mehr, der offline fehlschlagen könnte.
7. **Landstrom ohne RCD.** `useLiveValidation` Rule A2 + Dashboard
   erzeugen einen kritischen Prüfhinweis; Auto-Wire setzt `hasRcd`
   nicht mehr automatisch (Tests in `autoWire.test.ts` und
   `useLiveValidation.test.ts` bestätigen das).
8. **Hohe Last an dünnem Kabel (1000 W Wechselrichter, 2,5 mm²).**
   `applyFuseSizes` vergrößert den Querschnitt über
   `isFuseFeasible` + `VDE_SIZES.find(...)`, die resultierende
   Sicherung bleibt ≤ `FUSE_MAP[cs]` (Test in `autoWire.test.ts`).
9. **Leere Zustände:** leerer Elektrik-/Wasserplan zeigen
   `EmptyState` mit CTA; leere Suche zeigt Reset-Button; leere
   Stückliste zeigt „Füge zuerst Komponenten hinzu“; leere Inspector-
   Auswahl zeigt Schritt-für-Schritt-Anleitung.
10. **Onboarding-Fortschritt für Screenreader.** Vor der Korrektur
    lehnte Lighthouse das `aria-label` auf dem `<div>` ab
    (`aria-prohibited-attr`); mit `role="img"` ist der Balken jetzt
    eine barrierefreie Statusanzeige. → Score 100.

### PASS 3 — Regressionsabnahme

| Tor | Befehl | Ergebnis |
|---|---|---|
| TypeScript | `npx tsc -p tsconfig.typecheck.json --noEmit` | **0 Fehler** |
| Unit-Tests | `npm test` | **73 Dateien / 685 Tests grün** (Baseline 664 + 21 neue Auto-Wire-Tests) |
| Build | `npm run build` | **erfolgreich, 10 statische Routen**, KEIN `/api/chat` im Output |
| Lighthouse Mobile (375 px) | `npx lighthouse … --form-factor=mobile` | **Accessibility 100** (JSON/HTML in `lighthouse-report/`) |
| Lighthouse Desktop (1366 px) | `… --form-factor=desktop` | **Accessibility 100** |

**Geänderte Test-Dateien und Begründung:**

- `lib/autoWire.test.ts` — Inhalt von 9 auf 30 Tests ausgebaut. Grund:
  R3 fordert dedizierte Tests für JEDE öffentliche Funktion
  (`performAutoWiring`, `cumulativeDropAt`, `sizeDcEdges`,
  `applyFuseSizes`, `healUserEdges`, `resolveRails`). Die fünf
  internen Funktionen wurden zu diesem Zweck mit `@internal`-Markierung
  exportiert. Die bestehenden Integrationstests
  (`usePlannerStoreExtended.test.ts`, `PlannerDashboard.test.tsx`)
  bleiben unverändert.

**Keine bestehenden Tests angepasst.** Alle 664 Tests der Baseline
laufen weiterhin ohne Modifikation durch.

## 4. Definition of Done

- [x] **R1**: Chat-Reste verifiziert/entfernt. `app/api/`, `components/Chat.tsx`, `lib/chatConfig*`, `app/ki-assistent/` existieren nicht. `copyBomForChat` → `copyBomToClipboard` umbenannt, Stale-Kommentare bereinigt. `npm run build` erzeugt **keine** `/api/chat`-Route.
- [x] **R2**: `docs/INVENTORY.md` enthält 9 Gruppen mit allen interaktiven Elementen; jede Zeile hat Aktion, Status, Code-Stelle.
- [x] **R3**: `lib/autoWire.test.ts` hat `describe`-Blöcke für `performAutoWiring`, `isStarterBatteryLabel`, `cumulativeDropAt`, `sizeDcEdges`, `applyFuseSizes`, `healUserEdges`, `resolveRails` (30 Tests, alle grün).
- [x] **R4**:
  - A11Y-001 — `<main id="main">` in `app/elektrik-planung/page.tsx` (bereits vorhanden, verifiziert).
  - ELEC-001 — `selectFuseSize`-Fallback gibt `maxFuse` statt > max zurück; `applyFuseSizes` treibt Querschnitt hoch (Tests).
  - ELEC-002 — Auto-Wire setzt `hasRcd` nicht mehr; `useLiveValidation` Rule A2 + Dashboard warnen kritisch.
  - ELEC-003 — AC-Querschnitt wird dimensioniert (`sizeAcEdges`); pauschale 16 A dokumentiert (E7, bewusst verschoben).
  - SEC-001 — `allowedDevOrigins` auf `NODE_ENV !== 'production'` beschränkt.
  - DEAD-001 — geprüft: `Sidebar.tsx` und `Inspector.tsx` sind produktiv importiert; kein toter Code.
- [x] **R5**: Leere Zustände (`EmptyState` für leeren Elektrik-/Wasserplan, BOM-Leerraum, Such-Leerraum, Inspector-Leerauswahl) erklären den nächsten Schritt.
- [x] **R6**: Lighthouse Mobile 375 px **Accessibility 100/100** (Beleg in `lighthouse-report/`).
- [x] **Responsive-Verhalten aus PR #314 intakt** — keine Layout-Änderung im Code; Breakpoints 768/1280/1536 und CSS-Variablen bleiben unangetastet.
- [x] **Tests 685 grün**, **Typecheck 0**, **Build grün ohne /api/chat**.
- [x] **Kein toter Code** hinzugefügt; keine auskommentierten Blöcke; keine `TODO/FIXME/HACK` im Produktivcode.
- [x] **Alle drei Verifikations-Pässe** in diesem Dokument dokumentiert.
- [x] **R7** — bewusst nicht angefasst (E11); die Mittelpunkt-Näherung ist in PR #314 als Trade-off akzeptiert und erzeugt aktuell keine sichtbare Unruhe.

## 5. Was ich NICHT lösen konnte (ehrliche Liste)

- **R7 / ELEC-003 (partiell)**: Exakte Segment-Schnittprüfung und eine
  echte AC-Sicherungs-Modellierung (Bemessungsstrom am
  Landstromanschluss + `fuseSize` an AC-Kanten) wären eigene, in sich
  abgeschlossene Projekte. Sie benötigen neue UI-Felder, veränderte
  Kanten-Typen und spezialisierte Tests. Der bisherige Zustand ist
  fachlich konservativ (16 A sind im CEE-Camper-Landstrom der
  Standard; die 230-V-Querschnitt-Dimensionierung greift bereits), das
  Risiko ist dokumentiert.
- **Lighthouse im echten GitHub-Pages-Kontext**: Gemessen wurde gegen
  den lokalen Static-Export (`http://127.0.0.1:4173`) ohne BasePath.
  Der Score ist DOM-/CSS-bedingt und von der Hosting-Domain unabhängig;
  ein zukünftiger Lauf gegen die echte Pages-URL sollte das gleiche
  Bild liefern. Die Reproduktionsanleitung liegt in
  `lighthouse-report/README.md`.
- **Chromium-Download im Sandbox**: Für R6 wurde
  `@sparticuz/chromium` als dev-Zeit-Abhängigkeit verwendet und die
  Binärdatei per Brotli entpackt, weil ein direkter Chrome-Download aus
  dem Sandbox-Netzwerk scheiterte. Diese Paket wird nicht als
  produktive Abhängigkeit committet (`--no-save`); der
  Lighthouse-Buildschritt bleibt optional.
