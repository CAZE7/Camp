# Befund: Impressum & Datenschutz — Platzhalter und Optionen

Stand: 2026-10-12 · Erhoben durch Code-Sicht (`lib/siteLegal.ts`, `app/impressum/page.tsx`,
`app/datenschutz/page.tsx`, `.github/workflows/deploy.yml`). **Es wurden keine
personenbezogenen Daten eingetragen** — das kann und darf nur der Betreiber
(`lib/siteLegal.ts` dokumentiert den Grund: erfundene Angaben wären schlimmer als
der Platzhalter). Diese Datei ist eine Bestandsaufnahme, **keine Rechtsberatung**.

## 1. Fehlende Pflichtangaben (Impressum)

Alle fünf Felder in `lib/siteLegal.ts` stehen auf der Platzhalter-Marke
`BITTE-EINTRAGEN`; `/impressum/` zeigt deshalb die Aufforderungstexte an den
Betreiber:

| #   | Feld                 | Rechtsgrundlage (Normstand 2026, laut Modul) | Inhalt                                          |
| --- | -------------------- | -------------------------------------------- | ----------------------------------------------- |
| 1   | `providerName`       | § 5 DDG Nr. 1                                | Anbietername inkl. Rechtsformzusatz             |
| 2   | `street`             | § 5 DDG Nr. 1                                | Straße und Hausnummer (ladungsfähige Anschrift) |
| 3   | `postalCodeAndCity`  | § 5 DDG Nr. 1                                | PLZ und Ort (ladungsfähige Anschrift)           |
| 4   | `email`              | § 5 DDG Nr. 2                                | E-Mail für schnelle Kontaktaufnahme             |
| 5   | `contentResponsible` | § 18 Abs. 2 MStV                             | inhaltlich verantwortliche Person mit Anschrift |

Zusätzlich offen (bewusst, dokumentiert in `lib/siteLegal.ts`): Die **sichtbaren
Normzitate** auf `/impressum/` lauten noch „§ 5 TMG“ und „§ 55 Abs. 2 RStV“ —
sie sind Teil der eingefrorenen Pixel-Baseline und sind laut Modul-Kommentar
zusammen mit den echten Angaben und mit UI-Freigabe zu aktualisieren.

### Datenschutzseite (`/datenschutz/`)

- Der Untertitel ist ein Platzhalter: „Kurzfassung – bitte den finalen Text mit
  einer Rechtsberatung abgleichen.“
- Inhaltlich behandelt die Seite bisher nur die lokale Speicherung
  (`localStorage`). Für eine vollständige Datenschutzerklärung fehlen
  mindestens: benannte verantwortliche Stelle, Hinweis auf die
  Hosting-Verarbeitung durch GitHub (GitHub Pages, Server-Logs, ggf. Drittland),
  Betroffenenrechte inkl. Beschwerderecht bei einer Aufsichtsbehörde und die
  Kontaktadresse (bisher nur als Verweis aufs Impressum).
- Der Verweis „an die im Impressum genannte Adresse“ zeigt solange auf einen
  Platzhalter.

## 2. Maschineller Schutz, der bereits eingebaut ist

- `npm run ci:verify-legal-notice` läuft im Deploy-Workflow **vor dem Build** und
  meldet die offenen Felder in Log, Annotation und Step-Summary.
- Die Stufe ist `LEGAL_NOTICE_GATE: warn` (Betreiber-Entscheidung vom
  2026-09-26, im Workflow-Kommentar begründet). **An dieser Stufe wurde nichts
  geändert** — `block` erst, wenn die Angaben stehen.

## 3. Optionen und ihre Folgen

### Option A — Angaben ergänzen (nur durch den Betreiber)

**Vorgehen:** die fünf Felder in `lib/siteLegal.ts` ausfüllen (eine Stelle),
ggf. Normzitate auf der Seite auf DDG/MStV stellen, Datenschutzerklärung um
Verantwortliche Stelle / GitHub-Hosting / Betroffenenrechte ergänzen.

**Folgen:**

- `/impressum/` zeigt die echten Angaben; der Deploy-Wächter läuft grün und
  `LEGAL_NOTICE_GATE` kann danach auf `block` gestellt werden (dann kann ein
  künftiger Deploy das Impressum nicht mehr still zurückdrehen).
- Die Pixel-Baseline `route-impressum-*.png` weicht ab und muss **bewusst und
  begründet** neu aufgenommen werden (`--update-snapshots`, UI-Freigabe laut
  Kommentar in `app/impressum/page.tsx`) — der Kommentar an der Stelle sagt das
  voraus.
- Aufwand: Minuten; Voraussetzung: der Betreiber liefert die Angaben.

### Option B — Seite als Demo-Projekt kennzeichnen

**Vorgehen:** sichtbarer Hinweis auf `/impressum/` und `/` (z. B.
„Demonstrationsprojekt im Rahmen einer Bewerbung; kein kommerzielles Angebot;
Angaben nachreichen“), formuliert vom Betreiber. Technisch bleibt
`SITE_LEGAL` unvollständig.

**Folgen:**

- Die Kennzeichnung ändert **nichts** an der Messbarkeit: Der Wächter meldet
  weiter die offenen Felder (`warn`). Ob und wie weit eine
  Anbieterkennzeichnungspflicht für ein nicht-kommerzielles Demo-Projekt
  entfällt, ist eine Rechtsfrage und **hier nicht entscheidbar** — die Seite
  ist über GitHub Pages öffentlich erreichbar, und ein Platzhalter-Impressum
  bleibt das dokumentierte Risiko („abmahnfähig“, Begründung in
  `lib/siteLegal.ts`).
- Günstigste Wirkung nur bei **kombinierter** Nutzung: Demo-Hinweis sichtbar
  **plus** Option A, sobald der Betreiber die Angaben hat. Die Kennzeichnung
  allein entfernt weder die Deploy-Warnung noch das Risiko.

### Empfehlung (technisch, nicht rechtlich)

Option A — die Infrastruktur dafür steht komplett (ein Ort zum Ausfüllen, ein
Wächter, eine dokumentierte Stufe). Option B höchstens als Übergang mit
sichtbarem Demo-Hinweis. Für eine Bewerbungsmappe wirkt ein belegbar
abgesicherter Zustand (Wächter + gefüllte Angaben) stärker als ein
dauerhafter Platzhalter.
