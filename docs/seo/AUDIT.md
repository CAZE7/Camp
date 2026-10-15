# Camp — SEO-Messgrundlage

_Seiteninventar, Verweise und Bündel des gebauten Exports. Automatisch erzeugt von scripts/seo/report.ts._

Stand: 2026-10-15 · Commit: `d31044e` (2026-10-15) · Grundlage: gebauter Static Export unter `out/`, ohne JavaScript gemessen.

## Wie gemessen wird

Gemessen wird der gebaute Export, nicht die Absicht im Quelltext: Die Skripte lesen out/**/index.html, entfernen Skripte und Stile und zählen den sichtbaren Text. Damit entspricht die Wortzahl dem, was ein Crawler ohne JavaScript sieht. Verweise werden ohne Fragmente und Fremdadressen ausgewertet; die Tiefe ist der kürzeste Weg ab der Startseite über interne Verweise. Die Bündelgröße ist die Summe der im HTML verwiesenen Skriptdateien (unkomprimiert), die schweren Abhängigkeiten werden über Kennungen in diesen Dateien erkannt.

- Werkzeug: `npx tsx scripts/seo/measureExport.ts` (Tabelle) und dieser Bericht (Datei und PDF).
- Prüfregeln: `npm run seo:audit` — Teil des Builds; Exit-Code 1 nur bei echten Fehlern.
- Wiederholbar: gleicher Commit und gleicher Bau ergeben dieselben Zahlen.

## Seitenmessung

```
| Seite | Art | Wörter | H1/H2 | ein/aus | Tiefe | JS (KB) | schwer |
|---|---|---:|---|---:|---:|---:|---|
| `/camper-elektrik/230v/` | cluster | 1054 | 1/10 | 3/14 | 2 | 596 | — |
| `/camper-elektrik/agm/` | cluster | 952 | 1/10 | 4/17 | 2 | 596 | — |
| `/camper-elektrik/batterie/` | cluster | 1116 | 1/11 | 11/17 | 2 | 596 | — |
| `/camper-elektrik/` | pillar | 1887 | 1/13 | 29/25 | 1 | 596 | — |
| `/camper-elektrik/kabelquerschnitt/` | cluster | 1438 | 1/11 | 11/15 | 2 | 596 | — |
| `/camper-elektrik/ladebooster/` | cluster | 2371 | 1/11 | 2/16 | 2 | 596 | — |
| `/camper-elektrik/lifepo4/` | cluster | 1103 | 1/11 | 5/16 | 2 | 596 | — |
| `/camper-elektrik/mppt/` | cluster | 995 | 1/9 | 5/15 | 2 | 596 | — |
| `/camper-elektrik/schaltplan/` | cluster | 944 | 1/10 | 6/14 | 2 | 596 | — |
| `/camper-elektrik/sicherungen/` | cluster | 1445 | 1/11 | 15/15 | 2 | 596 | — |
| `/camper-elektrik/solar/` | cluster | 1128 | 1/10 | 6/14 | 2 | 596 | — |
| `/camper-elektrik/spannungsabfall/` | cluster | 1208 | 1/11 | 6/15 | 2 | 596 | — |
| `/camper-elektrik/wechselrichter/` | cluster | 1036 | 1/10 | 2/16 | 2 | 596 | — |
| `/datenschutz/` | rechtliches | 98 | 1/2 | 28/9 | 1 | 593 | — |
| `/design-system/` | ansicht | 567 | 1/6 | 0/0 | — | 625 | — |
| `/elektrik-planung/` | werkzeug | 1586 | 1/6 | 19/16 | 2 | 644 | — |
| `/guides/ausbau-fahrplan/` | ratgeber | 896 | 1/10 | 29/10 | 1 | 593 | — |
| `/guides/camper-ausbauguide/` | ratgeber | 1070 | 1/9 | 2/12 | 1 | 600 | — |
| `/guides/holzausbau/` | ratgeber | 410 | 1/6 | 2/10 | 1 | 593 | — |
| `/impressum/` | rechtliches | 121 | 1/4 | 28/9 | 1 | 593 | — |
| `/` | start | 242 | 1/3 | 30/14 | 0 | 595 | — |
| `/ki-assistent/` | ansicht | 58 | 1/1 | 0/7 | — | 611 | — |
| `/planer/` | werkzeug | 1120 | 1/6 | 30/11 | 1 | 609 | — |
| `/rechner/batteriekapazitaet/` | rechner | 1028 | 1/10 | 11/16 | 1 | 596 | — |
| `/rechner/` | rechner | 692 | 1/9 | 29/16 | 1 | 596 | — |
| `/rechner/solaranlage/` | rechner | 928 | 1/10 | 9/14 | 1 | 596 | — |
| `/rechner/spannungsabfall-12v/` | rechner | 1049 | 1/10 | 7/15 | 1 | 596 | — |
| `/tools/dach/` | werkzeug | 207 | 1/0 | 30/9 | 1 | 967 | react-flow |
| `/tools/heizung/` | werkzeug | 436 | 1/0 | 30/9 | 1 | 797 | — |
| `/ueber-elektroplaner/` | vertrauen | 1062 | 1/10 | 29/11 | 1 | 596 | — |
| `/ueber-werft/` | ansicht | 31 | 1/0 | 0/1 | — | 602 | — |
```

## Kennzahlen

| Kennzahl                         | Wert      |
| -------------------------------- | --------- |
| Indexierbare Seiten              | 28        |
| Pillar-Seiten                    | 1         |
| Rechner-Landingpages             | 4         |
| Suchintentionen abgedeckt        | 34 von 39 |
| Waisenseiten                     | 0         |
| Dünne Seiten                     | 0         |
| Doppelte Metadaten               | 0         |
| Interne Verlinkung               | 100 %     |
| Inhalt ohne JavaScript           | 28 von 28 |
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

- Dünnste Seite: /tools/dach/ (207 Wörter), / (242 Wörter), /guides/holzausbau/ (410 Wörter).
- Seiten ohne H2: /tools/dach/, /tools/heizung/.
- Größte Bündel: /tools/dach/ (967 KB), /tools/heizung/ (797 KB), /elektrik-planung/ (644 KB).
- Sockel aller Seiten sind rund 593 KB Skript (React, Next-Laufzeit, Grundgerüst) — unkomprimiert gemessen; komprimiert liegt der Wert deutlich niedriger.
