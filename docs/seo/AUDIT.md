# Camp — SEO-Messgrundlage

_Seiteninventar, Verweise und Bündel des gebauten Exports. Automatisch erzeugt von scripts/seo/report.ts._

Stand: 2026-10-03 · Commit: `59060c8` (2026-10-03) · Grundlage: gebauter Static Export unter `out/`, ohne JavaScript gemessen.

## Wie gemessen wird

Gemessen wird der gebaute Export, nicht die Absicht im Quelltext: Die Skripte lesen out/**/index.html, entfernen Skripte und Stile und zählen den sichtbaren Text. Damit entspricht die Wortzahl dem, was ein Crawler ohne JavaScript sieht. Verweise werden ohne Fragmente und Fremdadressen ausgewertet; die Tiefe ist der kürzeste Weg ab der Startseite über interne Verweise. Die Bündelgröße ist die Summe der im HTML verwiesenen Skriptdateien (unkomprimiert), die schweren Abhängigkeiten werden über Kennungen in diesen Dateien erkannt.
- Werkzeug: `npx tsx scripts/seo/measureExport.ts` (Tabelle) und dieser Bericht (Datei und PDF).
- Prüfregeln: `npm run seo:audit` — Teil des Builds; Exit-Code 1 nur bei echten Fehlern.
- Wiederholbar: gleicher Commit und gleicher Bau ergeben dieselben Zahlen.

## Seitenmessung

```
| Seite | Art | Wörter | H1/H2 | ein/aus | Tiefe | JS (KB) | schwer |
|---|---|---:|---|---:|---:|---:|---|
| `/camper-elektrik/230v/` | cluster | 1051 | 1/10 | 3/20 | 2 | 662 | — |
| `/camper-elektrik/agm/` | cluster | 949 | 1/10 | 4/23 | 2 | 662 | — |
| `/camper-elektrik/batterie/` | cluster | 1109 | 1/11 | 9/23 | 2 | 662 | — |
| `/camper-elektrik/` | pillar | 1782 | 1/12 | 28/30 | 1 | 662 | — |
| `/camper-elektrik/kabelquerschnitt/` | cluster | 1422 | 1/11 | 8/21 | 2 | 662 | — |
| `/camper-elektrik/lifepo4/` | cluster | 1100 | 1/11 | 4/22 | 2 | 662 | — |
| `/camper-elektrik/mppt/` | cluster | 992 | 1/9 | 5/21 | 2 | 662 | — |
| `/camper-elektrik/schaltplan/` | cluster | 921 | 1/10 | 4/20 | 2 | 662 | — |
| `/camper-elektrik/sicherungen/` | cluster | 1428 | 1/11 | 12/21 | 2 | 662 | — |
| `/camper-elektrik/solar/` | cluster | 1121 | 1/10 | 6/20 | 2 | 662 | — |
| `/camper-elektrik/spannungsabfall/` | cluster | 1201 | 1/11 | 5/21 | 2 | 662 | — |
| `/camper-elektrik/wechselrichter/` | cluster | 1033 | 1/10 | 2/22 | 2 | 662 | — |
| `/datenschutz/` | rechtliches | 98 | 1/2 | 27/16 | 1 | 593 | — |
| `/design-system/` | ansicht | 576 | 1/6 | 0/8 | — | 621 | — |
| `/elektrik-planung/` | werkzeug | 1497 | 1/5 | 28/17 | 1 | 645 | — |
| `/guides/ausbau-fahrplan/` | ratgeber | 896 | 1/10 | 28/17 | 1 | 593 | — |
| `/guides/camper-ausbauguide/` | ratgeber | 1079 | 1/9 | 2/19 | 1 | 597 | — |
| `/guides/holzausbau/` | ratgeber | 408 | 1/6 | 2/17 | 1 | 593 | — |
| `/impressum/` | rechtliches | 121 | 1/4 | 27/16 | 1 | 593 | — |
| `/` | start | 186 | 1/2 | 29/18 | 0 | 595 | — |
| `/ki-assistent/` | ansicht | 58 | 1/1 | 0/14 | — | 1150 | — |
| `/rechner/batteriekapazitaet/` | rechner | 1021 | 1/10 | 9/22 | 2 | 662 | — |
| `/rechner/` | rechner | 629 | 1/8 | 28/22 | 1 | 662 | — |
| `/rechner/solaranlage/` | rechner | 921 | 1/10 | 7/20 | 2 | 662 | — |
| `/rechner/spannungsabfall-12v/` | rechner | 1042 | 1/10 | 4/21 | 2 | 662 | — |
| `/tools/dach/` | werkzeug | 207 | 1/0 | 28/17 | 1 | 965 | react-flow |
| `/tools/heizung/` | werkzeug | 436 | 1/0 | 28/16 | 1 | 797 | — |
| `/ueber-werft/` | vertrauen | 1058 | 1/10 | 27/17 | 1 | 662 | — |
```

## Kennzahlen

| Kennzahl | Wert |
| --- | --- |
| Indexierbare Seiten | 26 |
| Pillar-Seiten | 1 |
| Rechner-Landingpages | 4 |
| Suchintentionen abgedeckt | 29 von 35 |
| Waisenseiten | 0 |
| Dünne Seiten | 1 |
| Doppelte Metadaten | 0 |
| Interne Verlinkung | 100 % |
| Inhalt ohne JavaScript | 26 von 26 |
| Strukturierte Daten | bestanden |
| Sitemap und Robots | bestanden |
| Planner-Bundle auf Inhaltsseiten | bestanden |

## Suchintentionen

| Intention (Annahme) | Lage | Zielseite | Nächster Schritt |
| --- | --- | --- | --- |
| camper elektrik planen | abgedeckt | /camper-elektrik/ | keine |
| schaltplan camper 12v | abgedeckt | /camper-elektrik/schaltplan/ | keine |
| wohnmobil elektrik planer online | abgedeckt | /elektrik-planung/ | keine |
| 12v kabelquerschnitt berechnen | abgedeckt | /camper-elektrik/kabelquerschnitt/ | keine |
| welchen kabelquerschnitt camper | abgedeckt | /camper-elektrik/kabelquerschnitt/ | keine |
| spannungsabfall 12v berechnen | abgedeckt | /camper-elektrik/spannungsabfall/ | keine |
| camper sicherung richtig dimensionieren | abgedeckt | /camper-elektrik/sicherungen/ | keine |
| welche sicherung bei welchem kabelquerschnitt | abgedeckt | /camper-elektrik/sicherungen/ | keine |
| camper batterie dimensionieren | abgedeckt | /camper-elektrik/batterie/ | keine |
| batteriekapazität camper berechnen ah | abgedeckt | /rechner/batteriekapazitaet/ | keine |
| lifepo4 camper dimensionieren | abgedeckt | /camper-elektrik/lifepo4/ | keine |
| agm oder lifepo4 camper | abgedeckt | /camper-elektrik/agm/ | keine |
| agm batterie camper entladetiefe | abgedeckt | /camper-elektrik/agm/ | keine |
| peukert effekt camper batterie | abgedeckt | /camper-elektrik/batterie/ | keine |
| camper solar wie viel watt | abgedeckt | /rechner/solaranlage/ | keine |
| solar camper winter auslegung | abgedeckt | /camper-elektrik/solar/ | keine |
| mppt laderegler camper auslegen | abgedeckt | /camper-elektrik/mppt/ | keine |
| mppt oder pwm laderegler unterschied | abgedeckt | /camper-elektrik/mppt/ | keine |
| wechselrichter camper auslegen kabel | abgedeckt | /camper-elektrik/wechselrichter/ | keine |
| wie viel strom zieht ein wechselrichter 12v | abgedeckt | /camper-elektrik/wechselrichter/ | keine |
| 230v camper fi schutzschalter | abgedeckt | /camper-elektrik/230v/ | keine |
| landstrom anschluss camper cee | abgedeckt | /camper-elektrik/230v/ | keine |
| heizlast wohnmobil berechnen | abgedeckt | /tools/heizung/ | keine |
| welche standheizung für welches fahrzeug | teilweise | /tools/heizung/ | seite-erweitern |
| wie viele solarpanels passen aufs dach | teilweise | /tools/dach/ | beispiel-ergaenzen |
| camper ausbau reihenfolge gewerke | abgedeckt | /guides/ausbau-fahrplan/ | keine |
| camper ausbau guide elektrik | teilweise | /guides/camper-ausbauguide/ | verlinkung-verbessern |
| wie genau rechnet der camper planer | abgedeckt | /ueber-werft/ | keine |
| elektrik vw t6 ausbau | luecke | — (neu) | neue-seite |
| ladebooster camper lichtmaschine dimensionieren | luecke | — (neu) | neue-seite |
| sinus wechselrichter unterschied reiner sinus | teilweise | /camper-elektrik/wechselrichter/ | beispiel-ergaenzen |
| rechner camper ausbau | abgedeckt | /rechner/ | keine |
| spannungsabfall rechner 12v | abgedeckt | /rechner/spannungsabfall-12v/ | keine |
| camper ausbau planung online | abgedeckt | / | keine |
| holzausbau camper unterbau | abgedeckt | /guides/holzausbau/ | keine |

## Befunde
- Dünnste Seite: / (186 Wörter), /tools/dach/ (207 Wörter), /guides/holzausbau/ (408 Wörter).
- Seiten ohne H2: /tools/dach/, /tools/heizung/.
- Größte Bündel: /tools/dach/ (965 KB), /tools/heizung/ (797 KB), /camper-elektrik/230v/ (662 KB).
- Sockel aller Seiten sind rund 593 KB Skript (React, Next-Laufzeit, Grundgerüst) — unkomprimiert gemessen; komprimiert liegt der Wert deutlich niedriger.
