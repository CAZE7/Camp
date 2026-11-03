# Befund: Impressum & Datenschutz — Platzhalter und Optionen

> **Nachtrag 2026-10-28 — Punkt 1 (Impressum) ist erledigt.**
> `SITE_LEGAL` in `lib/siteLegal.ts` ist vollständig eingetragen (Anbieter,
> Anschrift, E-Mail, Inhaltsverantwortung); `npm run ci:verify-legal-notice`
> meldet „vollständig". Die sichtbaren Normzitate stehen jetzt auf § 5 DDG und
> § 18 Abs. 2 MStV (vorher TMG/RStV) und sind durch
> `app/impressum/page.test.tsx` gepinnt.
> **Offen bleibt Punkt 2 (Datenschutz)**: Die Seite ist weiterhin eine
> Kurzfassung ohne benannte verantwortliche Stelle, ohne Hosting-Hinweis und
> ohne die Angaben nach Art. 13 DSGVO.
> Die Abschnitte unten beschreiben den Stand vom 2026-10-12 und bleiben als
> Nachweis stehen — sie sind nicht der aktuelle Zustand.

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

## Nachtrag 2026-10-28 — Datenschutzerklärung geschrieben (Option A für Punkt 2)

Der Befund oben betraf beide Rechtstexte; das Impressum ist am 2026-10-28
gefüllt worden. Die Datenschutzerklärung folgt am selben Tag und beschreibt,
was diese Anwendung tatsächlich tut. Entscheidung und Begründung: ADR 0039.

Kurz:

- **Verantwortlicher** aus `lib/siteLegal.ts` — dieselbe Quelle wie das
  Impressum, kein zweiter Name zum Pflegen. Ein Datenschutzbeauftragter ist
  nicht bestellt; die Voraussetzungen (Art. 37 DSGVO, § 38 BDSG) liegen bei
  diesem Angebot nicht vor.
- **Hosting:** GitHub Pages, einschließlich der technisch notwendigen
  Verbindungsdaten (IP-Adresse, Zeitpunkt, abgerufene Adresse, Referrer,
  Browserkennung), Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO, Verweis auf die
  Datenschutzerklärung von GitHub wegen der Drittlandfrage USA.
- **Speicherung:** die vier Schlüssel aus `lib/storageKeys.ts`, mit Zweck,
  § 25 Abs. 2 Nr. 2 TDDDG und Art. 6 Abs. 1 lit. b DSGVO als Grundlage, plus
  Löschweg für den Besucher.
- **Nicht-Verarbeitung als Aussage:** keine Cookies, keine Reichweitenmessung,
  keine Werbung, keine fremden Server, keine Chat-Schnittstelle (ADR 0021).
  Diese Sätze sind testbar und werden getestet: `app/datenschutz/page.test.tsx`
  durchsucht den Quelltext nach Analyse-Clients, Cookie-Zugriffen und
  Drittanbieter-Hosts. Kommt einer hinzu, wird der Test rot, bevor die Aussage
  falsch wird.
- **Rechte** Art. 15–21 und **Beschwerderecht** Art. 77 mit der zuständigen
  Behörde: Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit,
  Ludwig-Erhard-Str. 22, 20459 Hamburg (am 2026-10-28 geprüft über
  datenschutz-hamburg.de und die Adressliste des BfDI).

Was weiterhin gilt: Die Seite ist keine Rechtsberatung. Der Text beschreibt den
technischen Stand; die rechtliche Bewertung bleibt beim Betreiber — etwa ob die
Reichweite des Angebots einen Vertreter in der EU oder eine
Datenschutz-Folgenabschätzung verlangt.
