# INVENTORY — Interaktive Elemente des Elektrikplaners

**Datum:** 2026-08-20
**Branch:** `arena/01a02021-camp`
**Zweck:** Phase-1-Inventur gemäß AGENTS.md R2. Jede interaktive Stelle der
App erhält genau eine Zeile. Status ist der Zustand nach PR #314 plus der
Arbeiten aus dieser Mission. „Maßnahme“ dokumentiert, was in R1–R7 daran
verändert oder verifiziert wurde.

Legende Status:
- ✅ vorhanden & barrierefrei (Touch ≥44 px, Fokus sichtbar, Tastatur bedienbar)
- ✏️ überarbeitet in dieser Mission
- 🆕 neu in dieser Mission
- ➖ entfällt / bewusst entfernt (R1)

---

## 1. Sidebar-Bauteile (`components/Sidebar.tsx` + `PlannerSidebar.tsx`)

| Element | Aktion | Status | Maßnahme / Code-Stelle |
|---|---|---|---|
| Suchfeld „Suchen…“ | filtert Komponenten & Vorlagen live | ✅ | `Sidebar.tsx` `<input id="component-search">`, `min-h-11`, Label sr-only. |
| Suchfeld Löschen (X) | leert Suchterm | ✅ | `Sidebar.tsx` `h-11 w-11`, `aria-label="Filter zurücksetzen"`. |
| Kategorie-Kopf (z. B. „Strom speichern (4)“) | klappt Kategorie auf/zu | ✅ | `CategorySection` Button `min-h-11`, `aria-expanded`. |
| Komponente-Kachel (Batterie, MPPT, …) | Klick = Hinzufügen; Desktop = Drag auf Canvas | ✅ | `ComponentTile`, `min-h-24`, `aria-label` mit Beschreibung, `onPointerDown`-Ghost-Drag. |
| Geräte-Vorlagen (Kühlschrank, Kaffeemaschine, …) | wie Komponente, mit Watt voreingestellt | ✅ | `deviceAssistant[]`, gleiche Kachelkomponente. |
| Sidebar-Einklapp-Pfeil (Desktop/Tablet) | klappt die linke Spalte ein/aus | ✅ | `PlannerSidebar.tsx`, `aria-expanded`, 44×44 px. |
| Leere-Suche | „Keine Treffer“ + Reset-Button | ✅ R5 | `Sidebar.tsx` — kein leerer Bildschirm, nächster Schritt „Filter zurücksetzen“. |

## 2. Dashboard / Toolbar (`components/planner/PlannerDashboard.tsx`)

| Element | Aktion | Status | Maßnahme / Code-Stelle |
|---|---|---|---|
| Tabs „Elektrisch / Wasser“ (Desktop ≥1024) | wechselt `viewMode` | ✅ | `NavigationSection`, `role="tablist"`, `aria-selected`, `min-h-11`. |
| Button „Automatisch verbinden“ | `performAutoWiring` (Querschnitte, Sicherungen, Topologie) | ✅ R3 | `ActionsSection.runAutoWire` — durch neue Unit-Tests in `lib/autoWire.test.ts` abgesichert. |
| Rückgängig / Wiederholen | `undo` / `redo` aus Store-History | ✅ | Icon-Buttons `h-11 w-11`, `aria-label`, bei Disabled ausgegraut. |
| Übersicht | `fitView` über `planner-fit-view`-Event | ✅ | `min-h-11`, Icon + Text ab `lg`. |
| Aufräumen (Auto-Layout) | dagre-Layout | ✅ | `min-h-11`, Icon + Text ab `sm`. |
| Menü „Mehr“ | öffnet Dropdown `role="menu"` | ✅ | `aria-haspopup="menu"`, `aria-expanded`, schließt bei Escape / Outside-Click. |
| Menüpunkt „Stückliste“ | `exportBOM()` + öffnet `BOMModal` | ✏️ R1 | interner Kopier-Button von `copyBomForChat` in `copyBomToClipboard` umbenannt (kein toter Chat-Verweis). |
| Menüpunkt „Plan lokal prüfen“ | `checkSchematic()`, öffnet WarningCenter | ✅ | `runCheck`, Feedback im Toast. |
| Menüpunkt „Bild exportieren“ | `html-to-image` PNG-Download | ✅ | `onExportImage`, leerer Plan wird mit ehrlicher Meldung quittiert (R5). |
| Sommer/Winter-Umschalter | Season beeinflusst Solar/Heizung | ✅ | Zwei volle Buttons `min-h-11 flex-1`. |
| Menüpunkt „Einführung erneut öffnen“ | setzt `hasOnboarded=false` | ✅ | `setHasOnboarded(false)`. |
| Menüpunkt „Neuen leeren Plan starten“ | öffnet Bestätigungsdialog | ✅ | Destruktiver Menüpunkt, `AccessibleDialog` mit „Plan leeren“/„Abbrechen“. |
| WarningCenter-Button | öffnet Prüfhinweise | ✅ R4 ELEC-002 | Zeigt Anzahl; RCD-Warnung wird in `useLiveValidation.ts` Rule A2 UND im Dashboard ergänzt. |
| Tastaturkürzel-Hinweise | sichtbar ab `xl` | ✅ | `KeyboardShortcutHints`: Strg+Z, Entf, Strg+S. |
| Auto-Save-Indikator | „Automatisch gespeichert“ ab 1536 px | ✅ | Grüner Haken + Text. |
| Saison-Badge | „☀ Sommer / ❄ Winter“ ab 640 px | ✅ | Reine Info, `title`. |
| Feedback-Toast | Erfolg/Fehler/Info nach Aktion | ✅ | `role="status"`/`role="alert"`, `aria-live`. |
| Reset-Dialog | Bestätigung „Plan leeren“ | ✅ | `AccessibleDialog` mit Fokus-Falle. |

## 3. Ansichts-Modus & Canvas

| Element | Aktion | Status | Maßnahme / Code-Stelle |
|---|---|---|---|
| Mobile Bottom-Tabs (Bauteile / Elektrik / Wasser / Details / Heizung) | wechseln `activeTab` + `viewMode` | ✅ | `PlannerInner.tsx`, 5 Tabs `min-h-14`, `aria-current="page"`. |
| Domänen-Filter (DC Plus / DC Minus / AC) | schaltet Domänen im Canvas ein/aus | ✅ | `FlowCanvas.tsx` Panel top-right, `aria-pressed`, mindestens eine Domäne bleibt aktiv. |
| „Trassen“-Toggle | hebt Backbone-Kanten hervor | ✅ | `trunkMode`, `aria-pressed`. |
| React-Flow-Controls | Zoom + Fit (+ ggf. Lock) | ✅ | `<Controls>` reagieren auf Touch/Maus. |
| MiniMap | springt zu Ansicht | ✅ | ab 640 px sichtbar (bewusste mobile Ausblendung aus PR #314 beibehalten). |
| Background-Muster | dekorativ | ➖ | keine Interaktion. |
| Canvas (Pane) | Pan/Zoom, Tap-Connect, Drop | ✅ | alle Interaktions-Props aus `flowInteraction.ts`; Touch via Long-Press + Drag-Griff. |
| Anschluss-Handle | Start/Ziel einer Kante | ✅ | 44×44 px, `role="button"`, dynamisches `aria-label`, Enter/Space löst Verbindung aus (`useAccessibleHandles`). |
| Knoten (jede Node-Komponente) | Auswahl, Doppelklick-Bearbeitung, Drag | ✅ | `BaseNode` + typspezifische Inspector-Werte; Touch-Drag nur am `.node-drag-handle`. |
| Drag-Griff (Touch) | sichtbarer Anfasser an jeder Node | ✅ | `NodeDragHandle`, 44×44 px, nur bei `pointer: coarse` sichtbar (PR #314). |
| Long-Press (Touch) | entsperrt Node für Ganzkörper-Drag | ✅ | `useLongPressNodeDrag`, 200 ms, Vibration, Hinweis-Toast. |
| Kante (CableEdge / WaterPipeEdge) | Auswahl, Hover-Fokus, Tap-Label | ✅ | Trefferzone 36 px Touch, Label als Tooltip 5 s (PR #314). |
| Kontextmenü (Desktop-Rechtsklick) | Aktionen auf Node/Edge/Pane | ✅ | `CanvasContextMenu`, `role="menu"`, schließt bei Escape. |
| Leerer Canvas (Elektrik) | „Fang mit deiner Batterie an“ + CTA | ✅ R5 | `EmptyState` mit Button „Batterie hinzufügen“. |
| Leerer Canvas (Wasser) | „Starte mit dem Frischwassertank“ + CTA | ✅ R5 | `EmptyState` mit Button „Frischwassertank hinzufügen“. |
| Onboarding-Wizard | 3-Schritte-Dialog beim ersten Start | ✅ | `OnboardingWizard`, `AccessibleDialog`, empfohlene Vorlage optisch hervorgehoben. |
| Floating-Metrics-Karte | zeigt Batterie/Spannung/Kapazität | ✅ | `FloatingMetricsCard`, nicht interaktiv. |
| Dach-Solar-Banner | Hinweis „Dachplaner-Daten erkannt: … W“ | ✅ | Wird bei `calculatedSolarWatts > 0` eingeblendet. |

## 4. Inspector (`components/Inspector.tsx` + `planner/PlannerInspector.tsx`)

| Element | Aktion | Status | Maßnahme / Code-Stelle |
|---|---|---|---|
| Inspector-Einklapp-Pfeil | öffnet/schließt die 3. Spalte / Slide-over | ✅ | `PlannerInspector.tsx`, `aria-expanded`, 44×44 px. |
| Inspector-Schließen (Tablet) | schließt Slide-over | ✅ | `PlannerInner.tsx`, 44×44 px, nur im Overlay-Modus sichtbar. |
| Empty-State (keine Auswahl) | „Tippe eine Komponente an…“ + 3-Schritte-Anleitung | ✅ R5 | `Inspector.EmptySelection`. |
| Node-Bezeichnungs-Eingabe | ändert `data.label` onBlur | ✅ | `NodeInspector`, `min-h-11`, eindeutige `id`. |
| Typspezifische Felder (Batterie-Kapazität, Verbraucher-Watt, MPPT-Amps, …) | `onUpdateNodeData` | ✅ | `NodeInspectors.tsx`, numerische Felder mit `ValidatingNumberInput`, werfen bei Falscheingabe `planner-input-error`. |
| Sicherungs-/Querschnitt-/Längen-Felder an Kanten | `EdgeInspector` / `WaterPipeInspector` | ✅ | steuern `fuseSize`/`crossSection`/`length`. |
| RCD-Anzeige Landstrom | „RCD (30mA): Ja/Nein“ (read-only im Node) | ✏️ R4 ELEC-002 | Auto-Wire setzt `hasRcd` NICHT mehr pauschal; live-Validation mahnt fehlenden FI an. |
| Lösch-Button (Node/Edge) | `window.confirm` → `deleteSelected` | ✅ | Destruktiver Varianten-Button, voll breit, rückgängigbar. |
| Experten-Tipps (ab Profi-Modus) | `ExpertPanel` Detailtiefe | ✅ | `ExpertPanel` unten im Canvas. |

## 5. Modale Dialoge (`components/ui/AccessibleDialog.tsx`)

| Element | Aktion | Status | Maßnahme / Code-Stelle |
|---|---|---|---|
| BOM-Modal (`BOMModal.tsx`) | zeigt Stückliste, Kabellängen, Rohre | ✅ | Stückliste leer → Hinweis „Füge zuerst Komponenten hinzu“ (R5). |
| BOM „Stückliste kopieren“ | JSON in Zwischenablage | ✏️ R1 | Umbenennung von `copyBomForChat` → `copyBomToClipboard`; Chat existiert nicht mehr. |
| Reset-/Lösch-Dialoge | Bestätigung | ✅ | `AccessibleDialog` mit Fokus-Falle, Escape, Klick auf Backdrop. |
| Onboarding-Dialog | Auswahl Stromquelle/Geräte/Vorlage | ✅ | siehe Abschnitt 3. |
| Jeder Dialog | Schließen bei Escape, Fokus-Rückgabe | ✅ | `AccessibleDialog` implementiert das zentral. |

## 6. Gesten & Tastatur

| Geste / Taste | Wirkung | Status | Code-Stelle |
|---|---|---|---|
| Strg/Cmd + Z | Rückgängig | ✅ | `PlannerInner.onKeyDown` |
| Strg/Cmd + Shift + Z / Strg+Y | Wiederholen | ✅ | ebenda |
| Strg/Cmd + S | zeigt „Automatisch gespeichert“ | ✅ | verhindert Browser-Speichern-Dialog |
| Entf / Backspace | löscht Auswahl nach Bestätigung | ✅ | `window.confirm`, nur wenn nicht in Eingabefeld |
| Escape | schließt Inspector / Dropdown / Dialog | ✅ | Dialoge haben Vorrang |
| Tab / Shift+Tab | Fokus zirkuliert im Dialog | ✅ | `AccessibleDialog` Fokus-Falle |
| Touch: Tap auf Handle → Tap auf Handle | Sequenzielles Verbinden | ✅ | `useSequentialTapConnect`, Feedback-Toast |
| Touch: 200 ms Long-Press auf Node | entsperrt Ganzkörper-Drag | ✅ | `useLongPressNodeDrag`, Vibration |
| Touch: Drag-Griff | Node verschieben | ✅ | `NodeDragHandle` |
| Touch: Ein-Finger-Wisch auf Canvas | pan | ✅ | `panOnDrag` nur für Nicht-Handle-Touches via `flowInteraction.ts` |
| Maus: Rechtsklick | Kontextmenü | ✅ | `CanvasContextMenu` |
| Maus: Doppelklick auf Node-Wert | Feld bearbeiten | ✅ | in den Node-Komponenten |
| Maus: Drag von Sidebar-Kachel | Ghost-Drag + Drop | ✅ | `handlePointerDown` + `usePlannerDragDrop` |
| Pinch-to-zoom Touch | zoomen | ✅ | `zoomOnPinch` in `flowInteraction.ts` |

## 7. Sonstige Seiten (zum vollständigen Audit)

| Element | Aktion | Status | Maßnahme |
|---|---|---|---|
| Globale Skip-Link → `#main` | Springt zum Hauptinhalt | ✅ R4 A11Y-001 | `app/elektrik-planung/page.tsx` hat `id="main"`; alle Seiten bereits entsprechend. |
| Site-Header-Navigation | Links zu Start / Guides / Tools | ✅ | `components/brand/SiteHeader.tsx`, `aria-current="page"`. |
| Site-Footer | Impressum / Datenschutz | ✅ | Statische Links. |
| Dachplaner (`/tools/dach`) | Solarmodule & Fenster platzieren | ✅ | Nutzt `useDachNodes`, Touch-Bedienung. |
| Heizungsrechner (`/tools/heizung`) | Dämmung & Heizlast | ✅ | Section-Nav horizontal scrollbar auf 375 px. |
| Guides | Artikel mit Animation | ✅ | `prefers-reduced-motion` respektiert. |

## 8. Chat (R1) — entfernt

| Element | Status | Maßnahme |
|---|---|---|
| `components/Chat.tsx` | ➖ entfernt | existiert nicht im Repo. |
| `app/api/chat/route.ts` | ➖ entfernt | kein `app/api`-Verzeichnis mehr; `npm run build` erzeugt KEINE `/api/chat`-Route. |
| `lib/chatConfig.ts` (+ Test) | ➖ entfernt | nicht vorhanden. |
| `app/ki-assistent/` | ➖ entfernt | Verzeichnis existiert nicht. |
| `useChat`, `@ai-sdk/react` | ➖ entfernt | keine Referenz mehr in `package.json` oder Source. |
| Umgebungsvariablen (`OPENAI_API_KEY`, `DATABASE_URL`) | ➖ entfernt | `.env.example` dokumentiert: „No environment variables are required for the static export. All data is stored in the browser (localStorage).“ |
| Stale Referenzen | ✏️ R1 | Kommentar in `lib/vde-standards.ts` und `app/globals.css` bereinigt; `BOMModal.copyBomForChat` in `copyBomToClipboard` umbenannt. Historische `.Jules/palette.md` bleibt als Lern-Archiv (wird nicht gebaut). |

## 9. Bewusste Trade-offs aus PR #314 (nicht zurückgebaut)

- Inspector dockt erst ab 1280 px an, Slide-over 768–1279 px (Canvas-Mindestbreite 600 px).
- MiniMap unter 640 px ausgeblendet.
- Long-Press entsperrt nur, zieht nicht im selben Fingerkontakt.
- Strichstärke kodiert die Kabel-Rolle, Querschnitt steht im Label.
- Kreuzungszählung ist Mittelpunkt-Näherung, ab 120 Kanten übersprungen (R7 nur bei sichtbarer Unruhe — aktuell nicht anwendbar).
