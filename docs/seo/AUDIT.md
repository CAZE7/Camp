# Camp — SEO-Messgrundlage

_Seiteninventar, Verweise und Bündel des gebauten Exports. Automatisch erzeugt von scripts/seo/report.ts._

Stand: 2026-10-31 · Commit: `61e0e20` (2026-10-31) · Grundlage: gebauter Static Export unter `out/`, ohne JavaScript gemessen.

## Wie gemessen wird

Gemessen wird der gebaute Export, nicht die Absicht im Quelltext: Die Skripte lesen out/**/index.html, entfernen Skripte und Stile und zählen den sichtbaren Text. Damit entspricht die Wortzahl dem, was ein Crawler ohne JavaScript sieht. Verweise werden ohne Fragmente und Fremdadressen ausgewertet; die Tiefe ist der kürzeste Weg ab der Startseite über interne Verweise. Die Bündelgröße ist die Summe der im HTML verwiesenen Skriptdateien (unkomprimiert), die schweren Abhängigkeiten werden über Kennungen in diesen Dateien erkannt.

- Werkzeug: `npx tsx scripts/seo/measureExport.ts` (Tabelle) und dieser Bericht (Datei und PDF).
- Prüfregeln: `npm run seo:audit` — Teil des Builds; Exit-Code 1 nur bei echten Fehlern.
- Wiederholbar: gleicher Commit und gleicher Bau ergeben dieselben Zahlen.

## Seitenmessung

```
| Seite | Art | Wörter | H1/H2 | ein/aus | Tiefe | JS (KB) | schwer |
|---|---|---:|---|---:|---:|---:|---|
| `/camper-ausbau/` | ratgeber | 1198 | 1/17 | 38/20 | 1 | 601 | — |
| `/camper-elektrik/230v/` | cluster | 1143 | 1/10 | 4/20 | 2 | 601 | — |
| `/camper-elektrik/agm/` | cluster | 1008 | 1/10 | 4/21 | 2 | 601 | — |
| `/camper-elektrik/batterie/` | cluster | 1174 | 1/11 | 14/22 | 2 | 601 | — |
| `/camper-elektrik/fehler/` | ratgeber | 1313 | 1/20 | 2/22 | 2 | 601 | — |
| `/camper-elektrik/` | pillar | 2063 | 1/13 | 38/32 | 1 | 601 | — |
| `/camper-elektrik/kabelquerschnitt/` | cluster | 1960 | 1/12 | 17/19 | 2 | 601 | — |
| `/camper-elektrik/ladebooster/` | cluster | 3408 | 1/11 | 6/22 | 2 | 601 | — |
| `/camper-elektrik/laden/` | pillar | 1016 | 1/13 | 4/22 | 2 | 601 | — |
| `/camper-elektrik/lifepo4/` | cluster | 1193 | 1/11 | 7/22 | 2 | 601 | — |
| `/camper-elektrik/mppt/` | cluster | 1051 | 1/9 | 5/20 | 2 | 601 | — |
| `/camper-elektrik/schaltplan/` | cluster | 995 | 1/10 | 7/21 | 2 | 601 | — |
| `/camper-elektrik/sicherungen/` | cluster | 1548 | 1/11 | 21/21 | 2 | 601 | — |
| `/camper-elektrik/solar/` | cluster | 1453 | 1/12 | 7/19 | 2 | 601 | — |
| `/camper-elektrik/spannungsabfall/` | cluster | 1281 | 1/11 | 8/20 | 2 | 601 | — |
| `/camper-elektrik/stromverbrauch/` | cluster | 1286 | 1/10 | 3/19 | 2 | 601 | — |
| `/camper-elektrik/wechselrichter/` | cluster | 1209 | 1/10 | 2/21 | 2 | 601 | — |
| `/datenschutz/` | rechtliches | 526 | 1/9 | 39/16 | 1 | 595 | — |
| `/design-system/` | ansicht | 567 | 1/6 | 0/0 | — | 629 | — |
| `/elektrik-planung/` | werkzeug | 1621 | 1/6 | 39/22 | 1 | 628 | — |
| `/guides/ausbau-fahrplan/` | ratgeber | 960 | 1/10 | 8/18 | 1 | 595 | — |
| `/guides/camper-ausbauguide/` | ratgeber | 1246 | 1/9 | 3/20 | 1 | 603 | — |
| `/guides/holzausbau/` | ratgeber | 567 | 1/6 | 3/18 | 1 | 598 | — |
| `/guides/` | pillar | 505 | 1/4 | 38/19 | 1 | 598 | — |
| `/heizung-daemmung/diesel-standheizung/` | cluster | 1441 | 1/11 | 1/22 | 2 | 601 | — |
| `/heizung-daemmung/` | pillar | 1082 | 1/11 | 38/20 | 1 | 601 | — |
| `/impressum/` | rechtliches | 168 | 1/4 | 39/16 | 1 | 595 | — |
| `/` | start | 466 | 1/4 | 39/20 | 0 | 598 | — |
| `/ki-assistent/` | ansicht | 134 | 1/1 | 0/17 | — | 601 | — |
| `/planer/` | werkzeug | 1150 | 1/6 | 39/14 | 1 | 614 | — |
| `/rechner/batteriekapazitaet/` | rechner | 1063 | 1/10 | 39/20 | 1 | 601 | — |
| `/rechner/` | rechner | 769 | 1/9 | 38/20 | 1 | 601 | — |
| `/rechner/ladestrom/` | rechner | 1078 | 1/9 | 5/21 | 1 | 601 | — |
| `/rechner/solaranlage/` | rechner | 997 | 1/10 | 39/18 | 1 | 601 | — |
| `/rechner/spannungsabfall-12v/` | rechner | 1088 | 1/10 | 39/19 | 1 | 601 | — |
| `/tools/dach/` | werkzeug | 243 | 1/0 | 39/16 | 1 | 950 | react-flow |
| `/tools/heizung/` | werkzeug | 468 | 1/0 | 39/16 | 1 | 782 | — |
| `/ueber-elektroplaner/` | vertrauen | 1193 | 1/11 | 39/17 | 1 | 601 | — |
| `/ueber-werft/` | ansicht | 31 | 1/0 | 0/1 | — | 603 | — |
| `/wohnmobilzulassung/` | pillar | 1002 | 1/12 | 38/19 | 1 | 601 | — |
```

## Kennzahlen

| Kennzahl                         | Wert      |
| -------------------------------- | --------- |
| Indexierbare Seiten              | 37        |
| Pillar-Seiten                    | 5         |
| Rechner-Landingpages             | 5         |
| Suchintentionen abgedeckt        | 34 von 39 |
| Waisenseiten                     | 0         |
| Dünne Seiten                     | 0         |
| Doppelte Metadaten               | 0         |
| Interne Verlinkung               | 100 %     |
| Inhalt ohne JavaScript           | 37 von 37 |
| Strukturierte Daten              | bestanden |
| Sitemap und Robots               | bestanden |
| Planner-Bundle auf Inhaltsseiten | bestanden |

## Suchintentionen

| Intention (Annahme)                             | Lage      | Zielseite                          | Nächster Schritt      |
| ----------------------------------------------- | --------- | ---------------------------------- | --------------------- |
| camper elektrik planen                          | abgedeckt | /camper-elektrik/                  | keine                 |
| schaltplan camper 12v                           | abgedeckt | /camper-elektrik/schaltplan/       | keine                 |
| camper schaltplan zeichnen programm             | abgedeckt | /planer/                           | keine                 |
| wohnmobil elektrik planer online                | abgedeckt | /elektrik-planung/                 | keine                 |
| 12v kabelquerschnitt berechnen                  | abgedeckt | /camper-elektrik/kabelquerschnitt/ | keine                 |
| welchen kabelquerschnitt camper                 | abgedeckt | /camper-elektrik/kabelquerschnitt/ | keine                 |
| spannungsabfall 12v berechnen                   | abgedeckt | /camper-elektrik/spannungsabfall/  | keine                 |
| camper sicherung richtig dimensionieren         | abgedeckt | /camper-elektrik/sicherungen/      | keine                 |
| welche sicherung bei welchem kabelquerschnitt   | abgedeckt | /camper-elektrik/sicherungen/      | keine                 |
| camper batterie dimensionieren                  | abgedeckt | /camper-elektrik/batterie/         | keine                 |
| batteriekapazität camper berechnen ah           | abgedeckt | /rechner/batteriekapazitaet/       | keine                 |
| lifepo4 camper dimensionieren                   | abgedeckt | /camper-elektrik/lifepo4/          | keine                 |
| agm oder lifepo4 camper                         | abgedeckt | /camper-elektrik/agm/              | keine                 |
| agm batterie camper entladetiefe                | abgedeckt | /camper-elektrik/agm/              | keine                 |
| peukert effekt camper batterie                  | abgedeckt | /camper-elektrik/batterie/         | keine                 |
| camper solar wie viel watt                      | abgedeckt | /rechner/solaranlage/              | keine                 |
| solar camper winter auslegung                   | abgedeckt | /camper-elektrik/solar/            | keine                 |
| mppt laderegler camper auslegen                 | abgedeckt | /camper-elektrik/mppt/             | keine                 |
| mppt oder pwm laderegler unterschied            | abgedeckt | /camper-elektrik/mppt/             | keine                 |
| wechselrichter camper auslegen kabel            | abgedeckt | /camper-elektrik/wechselrichter/   | keine                 |
| wie viel strom zieht ein wechselrichter 12v     | abgedeckt | /camper-elektrik/wechselrichter/   | keine                 |
| 230v camper fi schutzschalter                   | abgedeckt | /camper-elektrik/230v/             | keine                 |
| landstrom anschluss camper cee                  | abgedeckt | /camper-elektrik/230v/             | keine                 |
| heizlast wohnmobil berechnen                    | abgedeckt | /tools/heizung/                    | keine                 |
| welche standheizung für welches fahrzeug        | teilweise | /tools/heizung/                    | seite-erweitern       |
| wie viele solarpanels passen aufs dach          | teilweise | /tools/dach/                       | beispiel-ergaenzen    |
| camper ausbau reihenfolge gewerke               | abgedeckt | /guides/ausbau-fahrplan/           | keine                 |
| camper ausbau guide elektrik                    | teilweise | /guides/camper-ausbauguide/        | verlinkung-verbessern |
| wie genau rechnet der camper planer             | abgedeckt | /ueber-elektroplaner/              | keine                 |
| elektrik vw t6 ausbau                           | luecke    | — (neu)                            | neue-seite            |
| ladebooster camper lichtmaschine dimensionieren | abgedeckt | /camper-elektrik/ladebooster/      | keine                 |
| trennrelais oder ladebooster                    | abgedeckt | /camper-elektrik/ladebooster/      | keine                 |
| ladebooster 30a oder 50a                        | abgedeckt | /camper-elektrik/ladebooster/      | keine                 |
| welches kabel für ladebooster                   | abgedeckt | /camper-elektrik/ladebooster/      | keine                 |
| sinus wechselrichter unterschied reiner sinus   | teilweise | /camper-elektrik/wechselrichter/   | beispiel-ergaenzen    |
| rechner camper ausbau                           | abgedeckt | /rechner/                          | keine                 |
| spannungsabfall rechner 12v                     | abgedeckt | /rechner/spannungsabfall-12v/      | keine                 |
| camper ausbau planung online                    | abgedeckt | /                                  | keine                 |
| holzausbau camper unterbau                      | abgedeckt | /guides/holzausbau/                | keine                 |

## Befunde

- Dünnste Seite: /tools/dach/ (243 Wörter), / (466 Wörter), /tools/heizung/ (468 Wörter).
- Seiten ohne H2: /tools/dach/, /tools/heizung/.
- Größte Bündel: /tools/dach/ (950 KB), /tools/heizung/ (782 KB), /elektrik-planung/ (628 KB).
- Sockel aller Seiten sind rund 593 KB Skript (React, Next-Laufzeit, Grundgerüst) — unkomprimiert gemessen; komprimiert liegt der Wert deutlich niedriger.
