# Search-Console-Workflow

Wie echte Suchdaten in die Content-Roadmap kommen — und warum sie bislang fehlen.

## Ausgangslage

`lib/seo/opportunities.ts` enthält 35 Anfragen. Jede trägt ein Feld `source`.
Derzeit steht dort überall `annahme`: Die Formulierungen stammen aus Fachsprache,
Support-Fragen und der Logik des Themas, nicht aus Messwerten. Das ist bewusst so
— ein erfundener Suchvolumenwert wäre schlimmer als kein Wert, weil er
Entscheidungen vortäuscht.

Diese Datei beschreibt, wie aus `annahme` belastbare Daten werden.

## Voraussetzungen

- Die Seite ist unter der in `lib/site.ts` hinterlegten Adresse erreichbar
  (`SITE_ORIGIN` + `SITE_BASE_PATH`) und die Sitemap ist eingereicht.
- Zugriff auf die Search Console für genau diese Adresse (Eigentümer- oder
  Vollzugriff). Die Daten bleiben in der Organisation; sie werden nicht an
  Dritte übertragen.

## Ablauf je Auswertung (monatlich, 30 Minuten)

1. **Daten ziehen.** In der Search Console: _Leistung → Suchanfragen_, Zeitraum
   „Letzte 28 Tage“, Export als CSV. Zusätzlich _Seiten_ exportieren.
2. **Vergleichen.** Jede Anfrage mit mindestens zehn Impressionen wird gegen
   `lib/seo/opportunities.ts` gehalten:
   - Anfrage existiert und deckt sich mit der Zielseite → `source` auf
     `'search-console'` setzen.
   - Anfrage existiert, aber die Zielseite ist eine andere → `page` korrigieren.
     Das ist der häufigste Fall: Nutzer formulieren „Kabelrechner Camper“ und
     landen auf der Sicherungsseite.
   - Anfrage fehlt in der Liste → neuen Eintrag anlegen, `coverage` nach
     Augenschein setzen (`abgedeckt`, `teilweise`, `luecke`).
3. **Lage nachziehen.** `coverage` und `gap` an die Wirklichkeit anpassen:
   Eine Anfrage, die eine Seite hat und dort beantwortet wird, ist
   `abgedeckt`; eine Anfrage, die nur gestreift wird, ist `teilweise`.
4. **Prüfen.** `npm test` (die Inventar- und Abdeckungstests laufen mit) und
   `npx tsx scripts/seo/report.ts` (Zahlen im Bericht aktualisieren).
5. **Entscheiden.** Was als Nächstes gebaut wird, folgt aus der Rangfolge in
   `openGaps()` — nicht aus Bauchgefühl.

## Regeln für Einträge

- **Kein Volumen ohne Quelle.** `searchVolume` gibt es nicht. Wer eine Zahl
  nennen will, nennt die Impressionen aus der Search Console und das Datum.
- **Eine Anfrage ist eine Nutzerfrage.** Keine Keyword-Stapel, keine
  Synonymlisten. Zwei Formulierungen derselben Absicht sind ein Eintrag.
- **Keine Seite ohne Anfrage.** Eine neue Seite entsteht nur für eine
  begründete Anfrage — oder für eine Pflichtseite. Die Liste ist die Bremse
  gegen beliebige Textmengen.
- **Keine Anfrage ohne Seite.** Jeder Eintrag mit `coverage: 'abgedeckt'` muss
  auf eine ausgelieferte Seite zeigen; das prüft das Inventar (Test).

## Was zu messen ist, wenn die Daten fließen

| Kennzahl                               | Zeitraum | Herkunft                                    | Ziel                                     |
| -------------------------------------- | -------- | ------------------------------------------- | ---------------------------------------- |
| Impressionen je Anfrage                | 28 Tage  | Search Console                              | steigende Tendenz je Thema               |
| Klicks je Anfrage                      | 28 Tage  | Search Console                              | Klicks folgen den Impressionen           |
| Durchschnittliche Position             | 28 Tage  | Search Console                              | Top-20 für die zehn wichtigsten Anfragen |
| Indexierte Seiten                      | laufend  | _Abdeckung_ → Seiten                        | alle 26 indexierbaren Seiten             |
| Aufrufe des Planers aus Suche          | 28 Tage  | Search Console (Seite `/elektrik-planung/`) | steigend gegenüber dem Basiswert         |
| „Eingeschlossen, aber nicht indexiert“ | laufend  | _Abdeckung_                                 | null für Seiten mit eigenem Inhalt       |

Der Basiswert für den Planer wird beim ersten Abruf schriftlich festgehalten
(Datum, Wert) — ohne Basiswert ist „mehr“ keine Aussage.

## Warnzeichen und ihre Ursache

- **„Gefunden, zurzeit nicht indexiert“** bei einer Inhaltsseite: meist dünner
  Inhalt oder Dublette. Beides melden die Prüfungen des Baus
  (`seite-duenn`, `titel-doppelt`, `beschreibung-doppelt`).
- **Impressions ohne Klicks** über vier Wochen: Titel und Beschreibung
  schärfen. Die Titel stehen zentral in `lib/seo/content/`, nicht in den
  Seitendateien.
- **Klicks auf der falschen Seite**: interne Verlinkung prüfen. Der
  Themenbaum (`lib/seo/topics.ts`) bestimmt sie; ein Eintrag zeigt auf die
  Seite, die die Absicht bedient.
- **Plötzlich hohe Ladezeit auf einer Inhaltsseite**: `bundle-schwer` im Build
  prüfen — schwere Planer-Bibliotheken gehören nicht in statische Inhalte.

## Und wenn es keine Search Console gibt

Dann bleibt die Liste eine Annahme — und der Bericht sagt das. Was auch ohne
Suchdaten belastbar ist: die Messung des eigenen Exports
(`npx tsx scripts/seo/measureExport.ts`). Sie sagt nichts über Sichtbarkeit,
aber alles über die Zusagen der Seite: erreichbar, indexierbar, vollständig,
verlinkt, schlank.
