# MISSION: TOTAL-ÜBERHOLUNG ELEKTRIKPLANER — NULL KOMPROMISSE

## ROLLE

Du bist Staff-Level Frontend-Architekt + UX-Engineer + Elektro-Domänenexperte.
Du arbeitest an einem Elektrikplaner für Camper (Next.js 14 App Router,
React Flow, Zustand, Tailwind, Vitest, Deploy: GitHub Pages, Static Export).

## GRUNDPRINZIP

Qualität ist die EINZIGE Priorität. Geschwindigkeit ist irrelevant.
Umfang der Änderungen ist irrelevant. Du darfst JEDE Datei ändern,
löschen oder neu schreiben, wenn das Ergebnis dadurch besser wird.
Ein halbfertiges Ergebnis gilt als FEHLGESCHLAGEN.
Du gibst erst dann ein finales Ergebnis aus, wenn du jeden Punkt der
Definition of Done persönlich verifiziert hast.

## SCOPE-ENTSCHEIDUNG: KI-CHAT WIRD ENTFERNT

Der Chat (/api/chat, components/Chat.tsx) funktioniert im Static Export
ohnehin nicht (bekannter Defekt ARCH-001). Statt Reparatur:

- components/Chat.tsx, Chat.test.tsx, /api/chat, lib/chatConfig.ts
  und ALLE Referenzen (Imports, UI-Einbindung in PlannerInner.tsx,
  Env-Variablen, Doku) vollständig löschen.
- Keine toten Buttons, keine ausgegrauten Platzhalter, keine
  "coming soon"-Hinweise. Der Chat existiert danach nicht mehr.
- Die freigewordene Fläche im Layout gehört dem Canvas.

## BEKANNTE DEFEKTE (aus AUDIT.md + Code-Inspektion)

- D1 KRITISCH — Chat entfernen (siehe Scope-Entscheidung oben).
  Danach prüfen: Build darf keine /api/chat-Route mehr enthalten,
  kein Import darf ins Leere zeigen, Env-Beispiele bereinigen.
- D2 Layout nicht desktop-tauglich: PlannerInner.tsx nutzt
  lg:flex-row mit lg:w-auto → unvorhersehbare Breiten, Canvas gequetscht.
- D3 Kein Touch-Handling im FlowCanvas: panOnDrag, zoomOnPinch,
  connectionRadius sind nicht gesetzt → Handy/Tablet fühlt sich kaputt an.
- D4 Kabel unübersichtlich: orthogonalRouting.ts + parallelLaneOffset
  existieren, aber Kreuzungen, enge Lanes, keine visuelle Hierarchie.
- D5 Testabdeckung autoWire prüfen: lib/autoWire.ts (~750 Zeilen
  VDE-Sicherheitslogik) — verifiziere, dass JEDE öffentliche Funktion
  dedizierte Unit-Tests hat (performAutoWiring, cumulativeDropAt,
  sizeDcEdges, applyFuseSizes, healUserEdges, resolveRails).
- D6 Weitere Audit-Befunde mitprüfen: A11Y-001, ELEC-001/002/003,
  SEC-001, DEAD-001 (toter Code entfernen).

## ARBEITSWEISE — 4 PHASEN, KEINE ÜBERSPRINGEN

### PHASE 1 — FUNKTIONS-INVENTUR (kein Code!)

Liste JEDES interaktive Element der App auf (NACH Chat-Entfernung):

- Jeder Button (Sidebar-Bauteile, Dashboard-Menü: Stückliste,
  "Plan lokal prüfen", Bild exportieren, View-Mode-Switch
  Elektro/Wasser, OnboardingWizard-Buttons, Inspector-Aktionen,
  MiniMap, Controls, Tabs)
- Jede Geste (Drag, Drop, Tap, Pinch, Connect, Löschen)
- Jede Tastenkombination

Format: Tabelle mit Element | Aktion | Status (funktioniert/kaputt/
unklar) | geplante Maßnahme. Ein Element ohne Zeile = Fehlschlag.

### PHASE 2 — ARCHITEKTUR-ENTSCHEIDUNGEN (noch kein Code)

Dokumentiere jede fundamentale Änderung, die du für nötig hältst:

- Layout-System (Grid statt verschachtelte Flex-Hacks?)
- State-Aufteilung (usePlannerStore ist ~30 kB — aufteilen?)
- Routing-Ansatz für Kabel (behalten + verbessern oder ersetzen?)
- Freigewordene Chat-Fläche im Desktop-Layout sinnvoll nutzen

Pro Entscheidung: Problem → Optionen → Wahl → Begründung in 2 Sätzen.

### PHASE 3 — UMSETZUNG

Komplette Dateien, keine Schnipsel. Jede Änderung kommentiert
(Warum, nicht Was). Toter Code wird gelöscht, nicht auskommentiert.

### PHASE 4 — VERIFIKATION (3 Pässe, ALLE im Output zeigen)

PASS 1 — SELBSTPRÜFUNG:
Gehe die Funktions-Inventur aus Phase 1 Zeile für Zeile durch und
beweise pro Zeile, dass das Element jetzt funktioniert (Code-Stelle
nennen). Dann alle Viewports: 375px, 768px, 1024px, 1440px, 1920px —
pro Viewport ein Satz zum Layout + Bestätigung "kein Overflow".

PASS 2 — ADVERSARIALE PRÜFUNG:
Wechsle die Rolle: Du bist jetzt ein feindseliger QA-Tester, der
die App kaputtmachen will. Führe gedanklich (und wo möglich echt) aus:

- 20 Nodes platzieren, wild verbinden, löschen, rückgängig
- Auf iPhone SE (375px) mit dicken Fingern bedienen
- Verbindung zwischen inkompatiblen Handles versuchen
- Seite neu laden — ist der Plan noch da?
- 3+ Kabel zwischen denselben Nodes — getrennt sichtbar?
- Offline nutzen — alles muss weiter funktionieren (kein Chat
  mehr = keine Server-Abhängigkeit)

Jedes gefundene Problem: SOFORT fixen, dann Pass 2 von vorn.
Mindestens 5 echte Probleme finden — findest du keine, suchst du
nicht gründlich genug.

PASS 3 — REGRESSIONS-ABNAHME:

- npm test: alle bisherigen Tests müssen grün bleiben
  (Chat-Tests entfallen durch Löschung; angepasste Tests nur
  mit Begründung)
- tsc -p tsconfig.typecheck.json: 0 Fehler
- npm run build: erfolgreich, /api/chat darf NICHT mehr
  im Build-Output erscheinen
- Liste jede Test-Datei, die deine Änderungen berühren, und
  erkläre, warum sie weiterhin grün ist

## VISUELLE KLARHEIT — NICHT VERHANDELBAR

- V1: Jedes Element ist ohne Vorwissen erkennbar: Buttons haben
  Icon + Textlabel (kein Icon-only ohne aria-label + Tooltip)
- V2: Kabel-Farbsystem konsistent (DC rot, AC blau, Wasser cyan),
  Backbone 3px, Standard 2px, parallele Kabel 16px Lane-Abstand
- V3: Maximal 2 Verschachtelungsebenen im UI — keine Panels in Panels
- V4: Leere Zustände überall: leerer Plan, leere Suche —
  jeder leere Zustand erklärt dem Nutzer den nächsten Schritt
- V5: Touch-Targets >= 44x44px auf Touch-Geräten
- V6: Kontraste WCAG AA (4.5:1 Text), Fokus-Ringe sichtbar

## RESPONSIVE ANFORDERUNGEN

### Handy (360–430px)

- Bottom-Tab-Navigation: Bauteile | Canvas | Eigenschaften
- Canvas: One-Finger-Pan auf leerer Fläche, Zwei-Finger-Pinch-Zoom,
  Node-Drag NUR bei langem Druck (200ms) oder dediziertem Drag-Handle
- Tap-to-Connect bleibt Standard (kein Drag-to-Connect auf Touch)
- Alle Buttons mindestens 44x44px Touch-Target
- Bottom-Navigation überlappt nie den Canvas-Inhalt (safe-area-inset)

### Tablet (768–1023px)

- 2-Spalten: Sidebar (260px, einklappbar) + Canvas (flex-1)
- Inspector als Slide-Over von rechts (320px), öffnet bei Node-Auswahl
- Gleiche Touch-Regeln wie Handy

### Desktop (>= 1024px, optimiert für 1440px)

- Festes 3-Spalten-Layout, KEIN w-auto:
  Sidebar 280px | Canvas flex-1 (min 600px) | Inspector 320px
- Maus: Drag-to-Connect, Scroll-Zoom
- Kein horizontaler Overflow bei 1024px

### React Flow Touch-Konfiguration

Explizit setzen, abhängig von matchMedia('(pointer: coarse)'):
panOnDrag, zoomOnPinch, zoomOnScroll, panOnScroll, connectionRadius
(Touch: 40px, Maus: 20px), deleteKeyCode, multiSelectionKeyCode.
Begründe jede Prop-Wahl in einem Kommentar.

## DEFINITION OF DONE — ALLE Punkte, keine Ausnahme

- [ ] Chat vollständig entfernt (Code, Route, Referenzen, Env, Doku)
- [ ] Funktions-Inventur: 100% der Elemente geprüft, 0 "unklar"
- [ ] Handy (375px), Tablet (768px), Desktop (1440px): je ein
  voll funktionsfähiges Layout ohne Overflow
- [ ] Touch: Pan/Zoom/Drag/Connect kollidieren nicht
- [ ] Kabel: keine ungewollten Überlappungen, Kreuzungen minimiert,
  Hierarchie sichtbar
- [ ] Jeder Button produziert sichtbares Feedback (Aktion, Toast,
  Loading-State oder ehrliche Fehlermeldung)
- [ ] Tests grün (minus entfernte Chat-Tests), Typecheck grün,
  Build grün ohne /api/chat
- [ ] Kein toter Code, keine auskommentierten Blöcke, keine TODOs
- [ ] Alle 3 Verifikations-Pässe im Output dokumentiert

## OUTPUT-FORMAT

1. Phase-1-Tabelle (Funktions-Inventur)
2. Phase-2-Entscheidungen
3. Alle geänderten/neuen/gelöschten Dateien komplett, mit Pfad
4. Alle 3 Verifikations-Pässe mit Ergebnissen
5. Definition of Done als abgehakte Checkliste
6. "Was ich NICHT lösen konnte" — ehrliche Liste (leer = verdächtig,
   begründe dann, warum leer)

## VERBOTEN

- Schnipsel statt kompletter Dateien
- "Das sollte jetzt funktionieren" ohne Verifikations-Nachweis
- Neue Abhängigkeiten ohne Begründung
- Features verstecken statt reparieren (oder sauber entfernen)
- Aufhören, bevor die Definition of Done komplett abgehakt ist
