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

## STATUS nach PR #314 (gemergt 2026-08-20) — NICHT erneut implementieren

Bereits ERLEDIGT und verbindlich:

- D2 RESPONSIVE LAYOUT: md:flex-row statt lg:flex-row, w-auto entfernt,
  Spaltenbreiten als CSS-Variablen (--planner-sidebar-w,
  --planner-inspector-w). Verbindliche Auflösung der früheren
  Anforderungs-Konflikte:
  - Inspector dockt erst ab 1280px an (bei 1024px: 1024-280-320=424px
    Canvas < 600px Minimum → dort Slide-over)
  - Inspector-Breite: 288px zwischen 1280–1535px, 320px ab 1536px
  - Canvas-Anteil bei 1440px: 60,6% (erfüllt >=60%)
- D3 TOUCH-KONFIGURATION: components/planner/utils/flowInteraction.ts
  ist die EINZIGE Quelle für React-Flow-Interaktions-Props. Auswahl via
  matchMedia('(pointer: coarse)'), NICHT über Fensterbreite.
  Node-Drag via dragHandle '.node-drag-handle' (44px, nur bei
  pointer:coarse sichtbar, display:contents-Hülle), 200ms Long-Press
  entsperrt zusätzlich (Vibration + Hinweis). connectionRadius:
  40px Touch / 20px Maus.
- D4 KABEL (großteils): Lane-Offset 16px, Lane-Sortierung nach Typ
  (Plus → Minus → 230V → Rest), Backbone 3px / Standard 2px /
  Trassen-Abgang 1,5px, Hover/Auswahl +1px. Kreuzungszählung mit
  Ausweichrouten (±32/±64px) ab >3 Kreuzungen. Kabel-Labels unter
  640px ausgeblendet, Tap zeigt 5s-Tooltip. Trefferzone Touch 36px.
- V5/V6 weitgehend: Touch-Targets >=44px, aria-label/aria-expanded/
  aria-current, Kontextmenü mit role=menu + Escape + Fokus.
- MiniMap unter 640px ausgeblendet (bewusste Entscheidung, beibehalten).
- viewportFit:'cover' im Root-Layout (safe-area-inset funktioniert).
- Rechtsklick-Kontextmenü Desktop, sichtbare Shortcuts (Strg+Z/Entf/
  Strg+S) in der Toolbar, Strg+S zeigt Autosave-Status.

Akzeptierte Trade-offs aus PR #314 (NICHT "zurückbauen"):
- Long-Press entsperrt nur, zieht nicht im selben Fingerkontakt
  (d3-drag-Limitation; Griff ist der primäre Weg)
- Strichstärke kodiert die Rolle (Backbone/normal), NICHT mehr den
  Querschnitt — Querschnitt steht im Label
- Slide-over ohne Animation (hidden statt translate), sonst
  horizontales Scrollen am Tablet
- Kreuzungszählung ist Näherung (Mittelpunkt-Mittelpunkt, O(E²)),
  wird ab 120 Kanten übersprungen

Neue Test-Baseline: 664 Tests grün (vorher 613), tsc --noEmit sauber,
next build sauber. Neue Suiten: flowInteraction.test.ts (15),
PlannerInner.test.tsx (8), useLongPressNodeDrag.test.tsx (6),
NodeDragHandle.test.tsx (4), cableStyle.test.ts (4).

## REST-MISSION — das ist noch zu tun

- R1 CHAT-ENTFERNUNG VERIFIZIEREN (kritisch): components/Chat.tsx wurde
  laut PR #314 upstream entfernt. ZU PRÜFEN und ggf. zu löschen:
  app/api/chat (Route), lib/chatConfig.ts + chatConfig.test.ts,
  Env-Referenzen in .env.example, Doku-Erwähnungen, verwaiste Imports.
  next build darf KEINE /api/chat-Route mehr ausgeben. Ein toter
  Button oder eine tote Route ist INAKZEPTABEL.
- R2 PHASE-1-INVENTUR als Artefakt nachliefern: docs/INVENTORY.md —
  Tabelle JEDES interaktiven Elements (Element | Aktion | Status |
  Maßnahme): Sidebar-Bauteile, Dashboard-Menü (Stückliste, Plan lokal
  prüfen, Bild exportieren), View-Mode-Switch, OnboardingWizard,
  Inspector-Aktionen, MiniMap, Controls, Tabs, Kontextmenü, Gesten,
  Tastenkombinationen. Ein Element ohne Zeile = Fehlschlag.
- R3 D5 AUTO-WIRE-TESTABDECKUNG: lib/autoWire.ts (~750 Zeilen
  VDE-Sicherheitslogik) — verifiziere, dass JEDE öffentliche Funktion
  dedizierte Unit-Tests hat (performAutoWiring, cumulativeDropAt,
  sizeDcEdges, applyFuseSizes, healUserEdges, resolveRails).
- R4 D6 AUDIT-RESTE aus AUDIT.md: A11Y-001, ELEC-001/002/003,
  SEC-001, DEAD-001 (toter Code entfernen).
- R5 V4 LEERE ZUSTÄNDE: leerer Plan, leere Suche, leere Stückliste —
  jeder leere Zustand erklärt dem Nutzer den nächsten Schritt.
- R6 LIGHTHOUSE-MESSUNG: Accessibility-Score >=95 auf Mobile MESSEN
  (in der bisherigen Agent-Umgebung nicht möglich) und Beleg
  (Report oder Screenshot) im PR ablegen.
- R7 D4-REST (optional, nur falls sichtbar unruhig): exakte
  Segment-Schnittprüfung statt Mittelpunkt-Näherung.

## ARBEITSWEISE — 4 PHASEN, KEINE ÜBERSPRINGEN

### PHASE 1 — INVENTUR (R2) + VERIFIKATION (R1), kein Code

Erst docs/INVENTORY.md und die Chat-Reste-Bestandsaufnahme.

### PHASE 2 — ARCHITEKTUR-ENTSCHEIDUNGEN (noch kein Code)

Dokumentiere jede fundamentale Änderung: Problem → Optionen → Wahl →
Begründung in 2 Sätzen. State-Aufteilung usePlannerStore (~30 kB)
nur anfassen, wenn ein konkreter Defekt es erfordert.

### PHASE 3 — UMSETZUNG

Komplette Dateien, keine Schnipsel. Jede Änderung kommentiert
(Warum, nicht Was). Toter Code wird gelöscht, nicht auskommentiert.

### PHASE 4 — VERIFIKATION (3 Pässe, ALLE im Output zeigen)

PASS 1 — SELBSTPRÜFUNG: Inventur-Tabelle Zeile für Zeile durchgehen,
pro Zeile Code-Stelle nennen. Viewports 375/768/1024/1440/1920
bestätigen (Ist-Zustand aus PR #314 als Ausgangslage respektieren).

PASS 2 — ADVERSARIALE PRÜFUNG: feindseliger QA-Tester:
- 20 Nodes platzieren, wild verbinden, löschen, rückgängig
- iPhone SE (375px) mit dicken Fingern
- inkompatible Handles verbinden versuchen
- Reload — Plan noch da?
- 3+ Kabel zwischen denselben Nodes — getrennt sichtbar?
- Offline — alles funktioniert ohne Server?
Jedes Problem: SOFORT fixen, Pass 2 von vorn. Mindestens 5 echte
Probleme finden — keine gefunden = nicht gründlich gesucht.

PASS 3 — REGRESSIONS-ABNAHME:
- npm test: alle 664+ Tests grün (angepasste Tests nur mit Begründung)
- tsc -p tsconfig.typecheck.json: 0 Fehler
- npm run build: erfolgreich, KEINE /api/chat-Route im Output
- Jede berührte Test-Datei auflisten + begründen, warum grün

## VISUELLE KLARHEIT — NICHT VERHANDELBAR

- V1: Buttons mit Icon + Textlabel (kein Icon-only ohne aria-label
  + Tooltip)
- V2: Kabel-Farben konsistent (DC rot, AC blau, Wasser cyan),
  Rollen-Strichstärken aus PR #314 beibehalten, 16px Lanes
- V3: Maximal 2 Verschachtelungsebenen im UI
- V4: Leere Zustände erklären den nächsten Schritt (siehe R5)
- V5: Touch-Targets >= 44x44px
- V6: Kontraste WCAG AA (4.5:1), Fokus-Ringe sichtbar

## DEFINITION OF DONE — ALLE Punkte, keine Ausnahme

- [ ] R1: Chat-Reste verifiziert/entfernt, Build ohne /api/chat
- [ ] R2: docs/INVENTORY.md vollständig, 0 "unklar"
- [ ] R3: autoWire-Funktionen mit dedizierten Tests
- [ ] R4: Audit-Reste A11Y-001, ELEC-001/002/003, SEC-001, DEAD-001
- [ ] R5: Leere Zustände mit nächstem-Schritt-Hinweis
- [ ] R6: Lighthouse Accessibility >=95 gemessen + Beleg
- [ ] Responsive-Verhalten aus PR #314 unverändert intakt
- [ ] Tests grün (>=664 minus entfernte Chat-Tests), Typecheck 0,
  Build grün
- [ ] Kein toter Code, keine auskommentierten Blöcke, keine TODOs
- [ ] Alle 3 Verifikations-Pässe im Output dokumentiert

## OUTPUT-FORMAT

1. docs/INVENTORY.md (R2) + Chat-Bestandsaufnahme (R1)
2. Phase-2-Entscheidungen
3. Alle geänderten/neuen/gelöschten Dateien komplett, mit Pfad
4. Alle 3 Verifikations-Pässe mit Ergebnissen
5. Definition of Done als abgehakte Checkliste
6. "Was ich NICHT lösen konnte" — ehrliche Liste (leer = verdächtig,
   begründe dann, warum leer)

## VERBOTEN

- Bereits gelöste Punkte aus dem STATUS-Abschnitt erneut implementieren
  oder deren Trade-offs ohne Anlass zurückbauen
- Schnipsel statt kompletter Dateien
- "Das sollte jetzt funktionieren" ohne Verifikations-Nachweis
- Neue Abhängigkeiten ohne Begründung
- Features verstecken statt reparieren (oder sauber entfernen)
- Aufhören, bevor die Definition of Done komplett abgehakt ist
