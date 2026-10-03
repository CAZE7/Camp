# CAMP SEO GROWTH REPORT

_Organische Sichtbarkeit für Camper-Elektrik und der Weg in den Planer · Stand 2026-10-03 · Commit 59060c8_

Stand: 2026-10-03 · Commit: `59060c8` (2026-10-03) · Grundlage: gebauter Static Export unter `out/`, ohne JavaScript gemessen.

## Ergebnis

Vor dieser Arbeit hatte die Auslieferung 9 indexierbare Seiten: Startseite, Planer, zwei Werkzeuge, drei Guides und die Pflichtseiten. Es gab keine Seite für „Kabelquerschnitt 12 V", keine für „Spannungsabfall", keine für „LiFePO4 im Camper" — die Fragen, mit denen die Zielgruppe sucht, hatten kein Ziel. Diese Arbeit baut die Inhalts- und Rechnerebene auf, verbindet sie mit dem vorhandenen Planer und sichert die Zusagen maschinell ab. Sie erfindet keine zweite technische Infrastruktur: Kopfdaten, Sitemap, Robotik und die Exportprüfung bleiben die bestehenden Systeme, sie lesen jetzt nur aus einer gemeinsamen Datenquelle (lib/seo/).

## Kennzahlen

| Kennzahl | Wert | Anmerkung |
| --- | --- | --- |
| Indexierbare Seiten | 26 | 30 Dateien im Export, davon 4 ohne Indexaufnahme (zwei Ansichten, zwei Fehlerseiten). |
| Pillar-Seiten | 1 | Eine Übersichtsseite trägt das Thema Camper-Elektrik — sie verlinkt alle Unterthemen. |
| Rechner-Landingpages | 4 | Vier Rechnerseiten mit eigenem Text, Formel, Quellen und Grenzen; dazu die beiden Werkzeuge Dach und Heizlast. |
| Suchintentionen abgedeckt | 29 von 35 | 4 teilweise abgedeckt, 2 offen. Keine offene P0-Intention (0). |
| Waisenseiten | 0 | Seiten ohne einen einzigen internen Verweis. Jede indexierbare Seite ist über mindestens einen Verweis erreichbar. |
| Dünne Seiten | 1 | Unter 300 Wörtern ohne JavaScript gemessen. /tools/dach/ (207) |
| Doppelte Metadaten | 0 | Titel und Beschreibungen sind über alle Seiten eindeutig (Prüfregeln `titel-doppelt` und `beschreibung-doppelt`). |
| Interne Verlinkung | 100 % | Jede indexierbare Seite hat mindestens einen eingehenden Verweis; im Mittel 14.0. Größte Tiefe ab Startseite: 2 Klicks. |
| Inhalt ohne JavaScript | 26 von 26 | Jede indexierbare Seite liefert im Roh-HTML genau eine H1 und ihren Text — geprüft ohne Skriptausführung. |
| Strukturierte Daten | bestanden | JSON-LD jeder Seite ist gültig, nennt schema.org und beschreibt nur, was sichtbar ist (Prüfregeln `strukturierte-daten-*`). |
| Sitemap und Robots | bestanden | Sitemap führt genau die indexierbaren Seiten (26 Einträge) unter dem Basis-Pfad; robots.txt verweist darauf. |
| Planner-Bundle auf Inhaltsseiten | bestanden | Keine Inhaltsseite lädt elkjs, dagre, react-flow oder GSAP im Erstaufbau (Prüfregel `bundle-schwer`). Werkzeuge dürfen ihre eigene Bibliothek laden. |

## Was entstanden ist

Die Inhalte liegen als Daten in `lib/seo/content/` und werden von gemeinsamen Gerüsten gerendert. Ein Themenbaum (`lib/seo/topics.ts`) bestimmt Verlinkung, Brotkrumen und Reihenfolge; die Suchintentionen stehen in `lib/seo/opportunities.ts`; das Inventar (`lib/seo/inventory.ts`) speist Sitemap und Prüfung aus einer Quelle.

| Seite | Art | Bediente Anfrage | Absicht |
| --- | --- | --- | --- |
| /camper-elektrik/ | pillar | camper elektrik planen | Eine Elektrik im Camper wird nicht gezeichnet, sondern gerechnet: E… |
| /camper-elektrik/kabelquerschnitt/ | cluster | 12v kabelquerschnitt berechnen | Bei 12 V entscheidet nicht die Strombelastbarkeit über den Querschn… |
| /camper-elektrik/spannungsabfall/ | cluster | spannungsabfall 12v berechnen | Eine Leitung ist kein idealer Leiter: Über Hin- und Rückleitung fäl… |
| /camper-elektrik/sicherungen/ | cluster | camper sicherung richtig dimensionieren | Eine Sicherung schützt nicht das Gerät, sondern die Leitung — und s… |
| /camper-elektrik/batterie/ | cluster | camper batterie dimensionieren | Nicht die Nennkapazität auf dem Etikett entscheidet über die Autark… |
| /camper-elektrik/lifepo4/ | cluster | lifepo4 camper dimensionieren | Lithium-Eisenphosphat liefert fast die doppelte nutzbare Kapazität … |
| /camper-elektrik/agm/ | cluster | agm oder lifepo4 camper | AGM und Gel sind robust, günstig und in fast jedem Fahrzeug zu find… |
| /camper-elektrik/solar/ | cluster | solar camper winter auslegung | Die Frage „wie viel Watt passen aufs Dach?" ist die falsche Reihenf… |
| /camper-elektrik/mppt/ | cluster | mppt laderegler camper auslegen | Der Laderegler ist die Schnittstelle zwischen Modul und Batterie. W… |
| /camper-elektrik/wechselrichter/ | cluster | wechselrichter camper auslegen kabel | Ein Wechselrichter zieht bei 12 V Ströme, die jede andere Last im F… |
| /camper-elektrik/230v/ | cluster | 230v camper fi schutzschalter | Die 230-V-Seite ist der Teil der Camper-Elektrik, der nicht in Eige… |
| /camper-elektrik/schaltplan/ | cluster | schaltplan camper 12v | Ein Schaltplan ist kein Dokument für die Schublade: Er ist die Arbe… |
| /rechner/ | rechner | rechner camper ausbau | Sechs Rechenwerkzeuge für die häufigsten Fragen beim Ausbau — vom K… |
| /rechner/spannungsabfall-12v/ | rechner | spannungsabfall rechner 12v | Dieser Rechner bewertet eine Leitung, die es schon gibt oder geben … |
| /rechner/batteriekapazitaet/ | rechner | batteriekapazität camper berechnen ah | Dieser Rechner beantwortet die Frage, wie groß die Aufbaubatterie s… |
| /rechner/solaranlage/ | rechner | camper solar wie viel watt | Dieser Rechner beantwortet zwei Fragen in einer: Wie viel Modulleis… |
| /ueber-werft/ | vertrauen | wie genau rechnet der camper planer | Werft ist ein Planungs- und Rechenwerkzeug für den Camper-Ausbau: E… |

## Prüfungen und ihre Aussage

| Prüfung | Ergebnis | Wo sie läuft |
| --- | --- | --- |
| Strukturierte Daten (JSON-LD) | bestanden | scripts/seo/auditExport.ts im Build, Regel `strukturierte-daten-*` |
| Sitemap und Robots | bestanden | App-Routen + Exportprüfung (`sitemap-*`, `robots-*`) |
| Inhalt ohne JavaScript | bestanden | Messung am Roh-HTML (measureExport) |
| Planner-Bundle auf Inhaltsseiten | bestanden | Regel `bundle-schwer` (Neu) |
| Interne Verlinkung und Waisen | bestanden | Regeln `verwaiste-seite`, `verweis-ohne-ziel` |
| Kopfdaten (Titel, Beschreibung, Canonical) | bestanden | Regeln `titel*`, `beschreibung*`, `canonical*` |
| SEO-CI (Gesamtlauf) | PASS | npm run build → seo:audit, Exit-Code 0 |

## Offene Punkte nach Priorität
- P0 — erledigt: Suchintentionen inventarisiert, Pillar und Cluster gebaut, die stärksten Rechner als Landingpages aufgesetzt, interne Verlinkung geschlossen, Waisen und Dubletten maschinell ausgeschlossen.
- P1 — Werkzeugseiten erklären: /tools/dach/ (207 Wörter, keine H2) und /tools/heizung/ (436 Wörter, keine H2) brauchen einen erklärenden Textteil; /guides/camper-ausbauguide/ braucht eine Kurzfassung oben (1027 Wörter Gesamttext).
- P1 — Echte Bilder: Die Inhaltsseiten arbeiten mit Tabellen und Rechenbeispielen, aber ohne eigene Fotos oder Diagramme; zwei <img> in der ganzen Auslieferung sind zu wenig für ein visuell geprägtes Thema (Ausbau, Dach, Verkabelung).
- P1 — Search Console anschließen: Die Anfrageliste ist bislang eine begründete Annahme (Quelle `annahme`). Erst echte Daten erlauben, Reihenfolge und Titel zu schärfen — Workflow in docs/seo/SEARCH-CONSOLE.md.
- P2 — Ladebooster/DC-DC und Sinus-Wechselrichter-Vergleich: zwei Intentionen mit klarer Nachfrage, aber ohne Seite.
- P2 — Internationalisierung: Die Architektur ist bereit (Inhalte als Daten, Texte getrennt von Darstellung), aber es gibt keinen englischen Zweig — bewusst nicht begonnen, solange die deutsche Ebene nicht in den Suchdaten steht.
- P3 — Fahrzeugspezifische Seiten (etwa VW T6): nur mit echtem, belegbarem Inhalt je Fahrzeug; Massenerzeugung ist ausgeschlossen.

## Top 20 Content-Chancen

Reihenfolge nach Priorität, Lage und Wirkung. „Lage" ist der Abdeckungsgrad der Anfrage, „Wirkung" die erwartete Bedeutung für das Thema — keine Suchvolumenzahl: Die Anfragen sind Modellannahmen (Quelle `annahme`), bis Search-Console-Daten vorliegen.

| # | Anfrage | Intention | Ziel | Lage | Nächster Schritt |
| --- | --- | --- | --- | --- | --- |
| 1 | camper ausbau guide elektrik | ratgeber | /guides/camper-ausbauguide/ | teilweise | verlinkung-verbessern |
| 2 | wie viele solarpanels passen aufs dach | planung | /tools/dach/ | teilweise | beispiel-ergaenzen |
| 3 | ladebooster camper lichtmaschine dimensionieren | ratgeber | neu | luecke | neue-seite |
| 4 | welche standheizung für welches fahrzeug | ratgeber | /tools/heizung/ | teilweise | seite-erweitern |
| 5 | sinus wechselrichter unterschied reiner sinus | vergleich | /camper-elektrik/wechselrichter/ | teilweise | beispiel-ergaenzen |
| 6 | elektrik vw t6 ausbau | planung | neu | luecke | neue-seite |
| 7 | camper elektrik planen | planung | /camper-elektrik/ | abgedeckt | beobachten / Titel schärfen |
| 8 | schaltplan camper 12v | planung | /camper-elektrik/schaltplan/ | abgedeckt | beobachten / Titel schärfen |
| 9 | wohnmobil elektrik planer online | planung | /elektrik-planung/ | abgedeckt | beobachten / Titel schärfen |
| 10 | 12v kabelquerschnitt berechnen | rechner | /camper-elektrik/kabelquerschnitt/ | abgedeckt | beobachten / Titel schärfen |
| 11 | welchen kabelquerschnitt camper | ratgeber | /camper-elektrik/kabelquerschnitt/ | abgedeckt | beobachten / Titel schärfen |
| 12 | spannungsabfall 12v berechnen | rechner | /camper-elektrik/spannungsabfall/ | abgedeckt | beobachten / Titel schärfen |
| 13 | camper sicherung richtig dimensionieren | ratgeber | /camper-elektrik/sicherungen/ | abgedeckt | beobachten / Titel schärfen |
| 14 | welche sicherung bei welchem kabelquerschnitt | rechner | /camper-elektrik/sicherungen/ | abgedeckt | beobachten / Titel schärfen |
| 15 | camper batterie dimensionieren | planung | /camper-elektrik/batterie/ | abgedeckt | beobachten / Titel schärfen |
| 16 | batteriekapazität camper berechnen ah | rechner | /rechner/batteriekapazitaet/ | abgedeckt | beobachten / Titel schärfen |
| 17 | lifepo4 camper dimensionieren | ratgeber | /camper-elektrik/lifepo4/ | abgedeckt | beobachten / Titel schärfen |
| 18 | agm oder lifepo4 camper | vergleich | /camper-elektrik/agm/ | abgedeckt | beobachten / Titel schärfen |
| 19 | agm batterie camper entladetiefe | ratgeber | /camper-elektrik/agm/ | abgedeckt | beobachten / Titel schärfen |
| 20 | peukert effekt camper batterie | ratgeber | /camper-elektrik/batterie/ | abgedeckt | beobachten / Titel schärfen |

## Nächste Schritte
- Search Console verbinden und die Anfragen der letzten 28 Tage exportieren; die Liste in lib/seo/opportunities.ts auf `source: 'search-console'` umstellen.
- P1: Werkzeugseiten um einen erklärenden Textteil ergänzen (je 300–500 Wörter, zwei H2, FAQ nur bei echten Fragen).
- P1: Bilder und Diagramme mit beschreibenden Alternativtexten ergänzen — Querschnittstabelle als Grafik, Beispielverkabelung, Dachbelegung.
- P2: Ladebooster/DC-DC als Cluster unter /camper-elektrik/ anlegen (Rechnung aus dem vorhandenen Modell: Strom, Spannungsfall, Sicherung, Leitungslänge).
- Nach jeder Änderung: npm run build (führt die Exportprüfung aus), npx tsx scripts/seo/report.ts für die aktualisierten Zahlen.

## Grenzen dieses Berichts
- Alle Anfragen sind Annahmen aus Fachsprache und Support-Fragen, keine Messwerte. Erst `source: 'search-console'` belegt eine Anfrage.
- „Indexierbar" heißt: Die Seite steht auf index und in der Sitemap. Ob sie tatsächlich in den Index aufgenommen und gerankt wird, entscheidet die Suchmaschine — das ist nicht messbar ohne Search Console.
- Die fachlichen Aussagen stützen sich auf die Modelle der Anwendung (VDE-Nennwerte, Kupferkennwerte, Peukert) und die genannten Normbezüge. Es gibt keine Prüfung durch Dritte; Annahmen und Grenzen stehen auf jeder Seite.
- Die Bundle-Größen sind unkomprimiert gemessen. Für Übertragungsbudgets zählt die komprimierte Größe — die Rangfolge der Seiten bleibt davon unberührt.

## Nachvollziehen

```
npm ci
npm run build            # baut den Export und prüft ihn (seo:audit)
npx tsx scripts/seo/measureExport.ts   # Zahlen dieses Berichts
npx tsx scripts/seo/report.ts          # erzeugt AUDIT, ANALYSE-UND-VISION und diesen Bericht neu
```
