# Fotomotiv-Katalog 2026-11 - Eigenaufnahmen für 12V-Planer

_Stand 2026-11-02 · Ergänzung zu `DESIGN-KONZEPT-2026-11.md` §4 · Gegenstück: `BILDRECHTE.md`_

**50 Fotomotive** in 8 Gruppen, jedes mit Zielseite, Bildausschnitt,
Licht, Requisiten, Alt-Text, Bildunterschrift und Abnahmekriterien. Dazu OG-Layouts,
Drehplan, Checklisten und eine Statusliste. Die PDF ist die Druckfassung für den Dreh.

## So benutzt du den Katalog

1. Vor dem Dreh: Ausrüstung, Bildsprache und Recht lesen, Requisiten nach Blöcken sortieren.
2. Beim Dreh: eine Seite pro Motiv, Kästchen am Seitenende abhaken.
3. Nach dem Dreh: Sichtung, Rechte in `BILDRECHTE.md`, Export, Alt-Texte in die Seiten.
4. P0 zuerst. Ohne A-01, B-01, B-03, C-01, C-04, D-01, E-01, F-01, F-02 bleibt die
   Leitidee (Plan und Foto tragen dieselbe Nummer) unsichtbar.

## Bildsprache - zehn Gebote

1. Verfügbares Licht, kein Blitz, kein Studio, kein Sonnenuntergang.
2. Hände, Material, Werkzeug. Keine Gesichter, kein Blick in die Kamera.
3. Gebrauchsspuren bleiben: Staub, Kratzer, leicht schiefer Horizont.
4. 35 mm / 50 mm, f/4 bis f/8, leichte Körnung ist erlaubt.
5. Kein Text, kein Logo, kein lesbarer Markenname, kein Kennzeichen im Bild.
6. Kein Duotone, kein HDR, kein Cinematic-Grade, keine künstliche Tiefenunschärfe.
7. Keine KI-generierten Bilder in der Auslieferung - du fotografierst selbst.
8. Bilder sind Belege, keine Dekoration: jedes Motiv hat eine Zielseite und eine Aussage.
9. Zahlen, Formeln und Tabellen gehören in HTML, nie ins Foto.
10. Ein Bild pro Aussage. Lieber ein zweites Detail als ein überladenes Hauptmotiv.

## Technische Abnahme (gilt für jedes Motiv)

- Master: RAW, lange Kante >= 2400 px, sRGB, feste Farbtemperatur, ohne GPS in den EXIF.
- Auslieferung: `<name>-640.avif`, `<name>-1200.avif`, `<name>.jpg` als Fallback.
- HTML: feste `width`/`height`, `srcset`/`sizes`, Hero `fetchpriority="high"` und Preload,
  alle anderen `loading="lazy"` und `decoding="async"`.
- Hero <= 60 KB AVIF, Summe <= 250 KB AVIF je Seite, CLS = 0.
- Jedes Bild: beschreibender Alt-Text, `<figcaption>` mit einer Aussage und internem Verweis,
  `ImageObject` in JSON-LD, `images`-Eintrag in `app/sitemap.ts`, `og:image:alt`.
- CSP lässt nur `'self'` zu: keine Hotlinks, alle Dateien unter `public/bilder/`.

## Master-Shotliste

| ID   | Motiv                                             | Zielseite                               | Prio | Status |
| ---- | ------------------------------------------------- | --------------------------------------- | ---- | ------ |
| A-01 | Kabelverlegung im Innenausbau                     | / (LCP-Hero)                            | P0   | [ ]    |
| A-02 | Geöffnete Seitenwand mit sichtbarer Installation  | / (Beweisstrecke)                       | P0   | [ ]    |
| A-03 | Fertiger Elektrik-Schrank, uninszeniert           | /camper-elektrik/ (Pillar)              | P1   | [ ]    |
| A-04 | Werkbank mit ausgelegtem Material                 | /rechner/ (Hub)                         | P1   | [ ]    |
| A-05 | Gedruckter Schaltplan auf der Werkbank            | /ueber-elektroplaner/                   | P0   | [ ]    |
| B-01 | Crimpvorgang mit der Crimpzange                   | /camper-elektrik/kabelquerschnitt/      | P0   | [ ]    |
| B-02 | Fertige Pressung im Makro                         | /camper-elektrik/kabelquerschnitt/      | P1   | [ ]    |
| B-03 | Zwei Querschnitte im direkten Vergleich           | /camper-elektrik/kabelquerschnitt/      | P0   | [ ]    |
| B-04 | Aderendhülse und Zugentlastung                    | /camper-elektrik/kabelquerschnitt/      | P2   | [ ]    |
| B-05 | Kabelweg mit Biegerradius                         | /camper-elektrik/spannungsabfall/       | P1   | [ ]    |
| B-06 | Messung an der Leitung                            | /rechner/spannungsabfall-12v/           | P2   | [ ]    |
| B-07 | Abisolieren der Leitung                           | /camper-elektrik/kabelquerschnitt/      | P2   | [ ]    |
| B-08 | Kabelkanal im Möbel                               | /camper-elektrik/schaltplan/            | P2   | [ ]    |
| C-01 | Sicherungsträger frontal                          | /camper-elektrik/sicherungen/           | P0   | [ ]    |
| C-02 | Sicherung zwischen den Fingern                    | /camper-elektrik/sicherungen/           | P2   | [ ]    |
| C-03 | Sammelschiene mit Ringkabelschuhen                | /camper-elektrik/sicherungen/           | P1   | [ ]    |
| C-04 | Hauptsicherung nahe der Batterie                  | /camper-elektrik/sicherungen/           | P0   | [ ]    |
| C-05 | Geöffneter Verteiler mit daneben liegendem Deckel | /camper-elektrik/schaltplan/            | P2   | [ ]    |
| C-06 | Massepunkt am Fahrzeugblech                       | /camper-elektrik/schaltplan/            | P2   | [ ]    |
| C-07 | Blanke Kabelmarker                                | /camper-elektrik/sicherungen/           | P2   | [ ]    |
| D-01 | Batteriekasten im Holzschrank                     | /camper-elektrik/batterie/              | P0   | [ ]    |
| D-02 | LiFePO4-Anschlüsse von oben                       | /camper-elektrik/lifepo4/               | P1   | [ ]    |
| D-03 | AGM und LiFePO4 nebeneinander                     | /camper-elektrik/agm/                   | P1   | [ ]    |
| D-04 | Batterie-Hauptschalter                            | /camper-elektrik/batterie/              | P2   | [ ]    |
| D-05 | Shunt und Batteriemonitor                         | /camper-elektrik/stromverbrauch/        | P2   | [ ]    |
| D-06 | Ladebooster eingebaut                             | /camper-elektrik/ladebooster/           | P1   | [ ]    |
| D-07 | Ladevorgang am Fahrzeug                           | /camper-elektrik/laden/                 | P2   | [ ]    |
| E-01 | Solarpanel wird ausgerichtet                      | /rechner/solaranlage/                   | P0   | [ ]    |
| E-02 | Dachaufsicht mit Panels und Dachluke              | /tools/dach/                            | P1   | [ ]    |
| E-03 | MC4-Stecker und Solarkabel                        | /camper-elektrik/solar/                 | P2   | [ ]    |
| E-04 | MPPT-Laderegler eingebaut                         | /camper-elektrik/mppt/                  | P1   | [ ]    |
| E-05 | Dachdurchführung                                  | /camper-elektrik/solar/                 | P2   | [ ]    |
| E-06 | Teilverschattung auf dem Panel                    | /camper-elektrik/solar/                 | P2   | [ ]    |
| F-01 | Wechselrichter im Schrank                         | /camper-elektrik/wechselrichter/        | P0   | [ ]    |
| F-02 | FI/RCD in der Verteilung                          | /camper-elektrik/230v/                  | P0   | [ ]    |
| F-03 | Landstromeinspeisung außen                        | /camper-elektrik/230v/                  | P1   | [ ]    |
| F-04 | Steckdose im Innenraum                            | /camper-elektrik/230v/                  | P2   | [ ]    |
| F-05 | Getrennte Verlegewege 12 V / 230 V                | /camper-elektrik/230v/                  | P1   | [ ]    |
| F-06 | Prüfung am Anschluss                              | /ueber-elektroplaner/                   | P1   | [ ]    |
| G-01 | Dämmung vor der Verkleidung                       | /heizung-daemmung/                      | P1   | [ ]    |
| G-02 | Standheizung mit Luftschläuchen                   | /heizung-daemmung/diesel-standheizung/  | P1   | [ ]    |
| G-03 | Holzausbau: Zuschnitt                             | /guides/holzausbau/                     | P2   | [ ]    |
| G-04 | Leeres Fahrzeug, Gewerke erkennbar                | /guides/ausbau-fahrplan/                | P1   | [ ]    |
| G-05 | Fahrzeug von außen ohne Kennzeichen               | /wohnmobilzulassung/                    | P1   | [ ]    |
| G-06 | Dokumentation des Ausbaus                         | /camper-ausbau/                         | P2   | [ ]    |
| H-01 | Werkzeug-Flachaufsicht                            | /ueber-elektroplaner/ (Vertrauensseite) | P1   | [ ]    |
| H-02 | Zugprobe an einer Verbindung                      | /camper-elektrik/fehler/                | P2   | [ ]    |
| H-03 | Fehlerbild: gequetschte Leitung                   | /camper-elektrik/fehler/                | P2   | [ ]    |
| H-04 | Rechenweg auf Papier, abstrakt                    | /rechner/spannungsabfall-12v/           | P2   | [ ]    |
| H-05 | Stückliste als blankes Objekt                     | /elektrik-planung/                      | P1   | [ ]    |

## Motive

### Gruppe A - Einstieg und Überblick

Die fünf Bilder, die zuerst entstehen müssen: Sie tragen Startseite, Pillar und Vertrauensseite.

### A-01 - Kabelverlegung im Innenausbau (P0)

| Feld             | Vorgabe                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | / (LCP-Hero) - /camper-elektrik/                                                                                                                                |
| Zweck            | Einstieg: zeigt in einem Bild, worüber die ganze Seite rechnet                                                                                                  |
| Bildinhalt       | Zwei Hände führen eine rote und eine schwarze 12-V-Leitung entlang einer hellen Holzleiste. Im Hintergrund geöffnete Seitenwand, Werkzeug und unfertiges Möbel. |
| Ausschnitt       | 3:2 quer, 1200 x 805 px, Motiv rechts, links 20 % ruhiger Freiraum, nicht beschriftet                                                                           |
| Fokus            | rechts                                                                                                                                                          |
| Objektiv         | 35 mm oder 50 mm, f/5.6, ISO Auto, 1/60 s oder kürzer, Stativ/Anlehnung                                                                                         |
| Licht            | Verfügbares Licht durch offene Tür oder Fenster, kein Blitz, kein Reflektor                                                                                     |
| Requisiten       | Holzleiste, 2 Adern, Kabelbinder, Abisolierzange, Sägespäne                                                                                                     |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                                             |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                                              |
| Alt-Text         | Hände verlegen rot-schwarze 12-V-Leitungen entlang einer Holzleiste im Camper-Innenausbau.                                                                      |
| Bildunterschrift | 01 - 12-V-Leitungen werden geführt, bevor die Verkleidung geschlossen wird. Der Planer beschriftet genau diese Leitung mit Querschnitt, Länge und Absicherung.  |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit                       |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                                                    |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: A-01)

### A-02 - Geöffnete Seitenwand mit sichtbarer Installation (P0)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | / (Beweisstrecke) - /camper-elektrik/                                                                                                     |
| Zweck            | Kontext: wie die Anlage im Fahrzeug liegt, bevor alles verkleidet ist                                                                     |
| Bildinhalt       | Halb entkernter Innenraum, Dämmung und Holzständer sichtbar, erste Kabelwege und ein Verteiler montiert. Nichts ist aufgeräumt.           |
| Ausschnitt       | 3:2 quer, weiter Winkel, Horizont leicht geneigt, Tiefe durch offene Tür                                                                  |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm oder 50 mm, f/5.6, ISO Auto, 1/60 s oder kürzer, Stativ/Anlehnung                                                                   |
| Licht            | Verfügbares Licht durch offene Tür oder Fenster, kein Blitz, kein Reflektor                                                               |
| Requisiten       | Dämmmaterial, Holzständer, Kabel, Verteiler, Schrauben                                                                                    |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Geöffnete Seitenwand eines Campers mit sichtbarer Dämmung und ersten verlegten 12-V-Leitungen.                                            |
| Bildunterschrift | 02 - Vor der Verkleidung sind Leitungslänge und Bauraum noch veränderbar. Beide Werte gehen in die Rechnung ein.                          |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: A-02)

### A-03 - Fertiger Elektrik-Schrank, uninszeniert (P1)

| Feld             | Vorgabe                                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/ (Pillar)                                                                                                                            |
| Zweck            | Zielzustand zeigen, ohne Hochglanz-Produktfoto                                                                                                        |
| Bildinhalt       | Geöffneter Technikschrank mit Verteiler, Sicherungen und geordneten, aber nicht perfekten Kabelwegen. Deckkante und Gebrauchsspuren bleiben sichtbar. |
| Ausschnitt       | 3:2 quer, frontale Kamera, gerader Horizont, keine Zwangszentrierung                                                                                  |
| Fokus            | mitte                                                                                                                                                 |
| Objektiv         | 35 mm oder 50 mm, f/5.6, ISO Auto, 1/60 s oder kürzer, Stativ/Anlehnung                                                                               |
| Licht            | Verfügbares Licht durch offene Tür oder Fenster, kein Blitz, kein Reflektor                                                                           |
| Requisiten       | Technikschrank, Verteiler, Sicherungsträger, Kabelbinder                                                                                              |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                                   |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                                    |
| Alt-Text         | Geöffneter Elektrik-Schrank im Camper mit Sicherungsträger und geordneten Kabelwegen.                                                                 |
| Bildunterschrift | 03 - Eine fertige Verteilung. Welche Leitung welchen Querschnitt braucht, entscheidet die Rechnung, nicht das Aussehen.                               |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit             |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                                          |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: A-03)

### A-04 - Werkbank mit ausgelegtem Material (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /rechner/ (Hub) - /elektrik-planung/                                                                                                      |
| Zweck            | Überblick über die Werkzeuge und Rechner der Seite                                                                                        |
| Bildinhalt       | Aufsicht auf eine Werkbank: Kabelreste, Crimpzange, Messband, blankes Papier und ein Becher mit Gebrauchsspuren.                          |
| Ausschnitt       | 3:2 quer, senkrecht von oben, weiches Seitenlicht, keine Schattenplastik                                                                  |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm oder 50 mm, f/5.6, ISO Auto, 1/60 s oder kürzer, Stativ/Anlehnung                                                                   |
| Licht            | Verfügbares Licht durch offene Tür oder Fenster, kein Blitz, kein Reflektor                                                               |
| Requisiten       | Crimpzange, Abisolierer, Messband, Kabelreste, Papier, Becher                                                                             |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Werkbank mit Kabelresten, Crimpzange, Messband und blankem Papier von oben fotografiert.                                                  |
| Bildunterschrift | 04 - Rechner, Planer und Stückliste gehören zusammen. Hier beginnt die Vorbereitung, nicht im Möbel.                                      |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: A-04)

### A-05 - Gedruckter Schaltplan auf der Werkbank (P0)

| Feld             | Vorgabe                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /ueber-elektroplaner/ - /camper-elektrik/schaltplan/                                                                                              |
| Zweck            | Brücke zwischen Plan und Realität, Leitmotiv des Konzepts                                                                                         |
| Bildinhalt       | Ausgedruckter Plan mit abstrakten Linien und Kästchen (keine lesbare Schrift), daneben Kabelreste, Messband und Bleistift. Papier leicht gewellt. |
| Ausschnitt       | 3:2 quer, 45-Grad-Aufsicht, Schärfe auf der Planmitte                                                                                             |
| Fokus            | mitte                                                                                                                                             |
| Objektiv         | 35 mm oder 50 mm, f/5.6, ISO Auto, 1/60 s oder kürzer, Stativ/Anlehnung                                                                           |
| Licht            | Verfügbares Licht durch offene Tür oder Fenster, kein Blitz, kein Reflektor                                                                       |
| Requisiten       | Ausdruck ohne Text, Bleistift, Messband, Kabelreste                                                                                               |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                               |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                                |
| Alt-Text         | Ausgedruckter Schaltplan liegt neben Kabelresten und Maßband auf einer Werkbank.                                                                  |
| Bildunterschrift | 05 - Der Plan ist die Zusage, das Foto der Beleg. Beide tragen dieselben Nummern.                                                                 |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit         |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                                      |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: A-05)

### Gruppe B - Kabel, Querschnitt, Verbindung

Nahaufnahmen. Hier entscheidet Schärfe: Der Übergang vom Rechenwert zum Bauteil muss prüfbar sein.

### B-01 - Crimpvorgang mit der Crimpzange (P0)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/kabelquerschnitt/                                                                                                        |
| Zweck            | Zeigt den Handgriff, der aus einem berechneten Querschnitt eine Verbindung macht                                                          |
| Bildinhalt       | Zwei Hände pressen eine Crimpzange auf einen Kabelschuh am Ende einer roten Leitung. Werkzeug trägt Gebrauchsspuren.                      |
| Ausschnitt       | 3:2 quer, Schärfe auf der Pressstelle, Hintergrund leicht unscharf                                                                        |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm oder Makro, f/4 bis f/5.6, Stativ, Fernauslöser oder Selbstauslöser                                                                 |
| Licht            | Fensterlicht von links, weißer Karton als dezenter Aufheller, kein Blitz                                                                  |
| Requisiten       | Crimpzange, Kabelschuh, rote 12-V-Leitung, Holzunterlage                                                                                  |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Crimpzange presst einen Kabelschuh auf eine rote 12-V-Leitung an der Werkbank.                                                            |
| Bildunterschrift | 01 - Der berechnete Querschnitt ist erst mit der passenden Verbindung brauchbar.                                                          |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: B-01)

### B-02 - Fertige Pressung im Makro (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/kabelquerschnitt/ - /camper-elektrik/fehler/                                                                             |
| Zweck            | Qualitätsmerkmal einer sauberen Verbindung                                                                                                |
| Bildinhalt       | Kabelschuh nach der Pressung, Litze bündig, Isolierung unverletzt, Kupfer sichtbar. Sehr nah, aber ohne Überhöhung.                       |
| Ausschnitt       | 3:2 quer, Makro, Schärfentiefe so groß, dass der ganze Schuh lesbar bleibt                                                                |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm oder Makro, f/4 bis f/5.6, Stativ, Fernauslöser oder Selbstauslöser                                                                 |
| Licht            | Fensterlicht von links, weißer Karton als dezenter Aufheller, kein Blitz                                                                  |
| Requisiten       | Gecrimpter Kabelschuh, Kabel, matte Unterlage                                                                                             |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Nahaufnahme eines gecrimpten Kabelschuhs mit bündiger Litze an einer roten Leitung.                                                       |
| Bildunterschrift | 02 - Eine saubere Pressung: Litze bündig, Isolierung unverletzt. Prüfbar, nicht dekorativ.                                                |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: B-02)

### B-03 - Zwei Querschnitte im direkten Vergleich (P0)

| Feld             | Vorgabe                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/kabelquerschnitt/                                                                                                                          |
| Zweck            | Das wichtigste Fachbild der Seite: Querschnitt wird sichtbar                                                                                                |
| Bildinhalt       | Zwei abisolierte Kupferleitungen unterschiedlicher Stärke liegen parallel auf mattem Holz, Querschnittsflächen zur Kamera gedreht. Kein Maßstab mit Zahlen. |
| Ausschnitt       | 3:2 quer, senkrecht von oben, beide Enden auf gleicher Schärfeebene                                                                                         |
| Fokus            | mitte                                                                                                                                                       |
| Objektiv         | 50 mm oder Makro, f/4 bis f/5.6, Stativ, Fernauslöser oder Selbstauslöser                                                                                   |
| Licht            | Fensterlicht von links, weißer Karton als dezenter Aufheller, kein Blitz                                                                                    |
| Requisiten       | Zwei Kabelstärken, Abisolierer, Holzbrett, Lineal ohne lesbare Ziffern                                                                                      |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                                         |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                                          |
| Alt-Text         | Zwei abisolierte Kupferleitungen mit unterschiedlichem Querschnitt liegen nebeneinander auf Holz.                                                           |
| Bildunterschrift | 03 - Querschnitt ist eine Fläche, keine Farbe. Die Rechnung bestimmt, welche der beiden Leitungen passt.                                                    |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit                   |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                                                |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: B-03)

### B-04 - Aderendhülse und Zugentlastung (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/kabelquerschnitt/ - /camper-elektrik/sicherungen/                                                                        |
| Zweck            | Anschluss an Klemmen und Schutz vor Zug                                                                                                   |
| Bildinhalt       | Aderendhülsen, Kabelbinder und ein gebündelter Strang kurz vor dem Einführen in eine Klemme.                                              |
| Ausschnitt       | 3:2 quer, leicht schräge Aufsicht                                                                                                         |
| Fokus            | rechts                                                                                                                                    |
| Objektiv         | 50 mm oder Makro, f/4 bis f/5.6, Stativ, Fernauslöser oder Selbstauslöser                                                                 |
| Licht            | Fensterlicht von links, weißer Karton als dezenter Aufheller, kein Blitz                                                                  |
| Requisiten       | Aderendhülsen, Kabelbinder, Klemme, Kabelstrang                                                                                           |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Aderendhülsen und Kabelbinder an einem gebündelten Leitungsstrang vor einer Klemme.                                                       |
| Bildunterschrift | 04 - Zugentlastung gehört zur Auslegung dazu, auch wenn sie in keiner Formel steht.                                                       |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: B-04)

### B-05 - Kabelweg mit Biegerradius (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/spannungsabfall/ - /camper-elektrik/schaltplan/                                                                          |
| Zweck            | Leitungslänge und Verlegeweg als Einfluss auf den Spannungsabfall                                                                         |
| Bildinhalt       | Eine Leitung folgt einem Holzrahmen in weitem Bogen, keine scharfen Knicke, Befestigung alle paar Zentimeter.                             |
| Ausschnitt       | 3:2 quer, Verlauf von links unten nach rechts oben, viel Umgebung                                                                         |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm oder Makro, f/4 bis f/5.6, Stativ, Fernauslöser oder Selbstauslöser                                                                 |
| Licht            | Fensterlicht von links, weißer Karton als dezenter Aufheller, kein Blitz                                                                  |
| Requisiten       | Lange Leitung, Holzrahmen, Kabelbinder, Schellen                                                                                          |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | 12-V-Leitung folgt in einem weiten Bogen einem Holzrahmen im Camper-Innenausbau.                                                          |
| Bildunterschrift | 05 - Jeder zusätzliche Meter zählt. Die Länge im Plan ist die Länge im Fahrzeug.                                                          |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: B-05)

### B-06 - Messung an der Leitung (P2)

| Feld             | Vorgabe                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /rechner/spannungsabfall-12v/ - /ueber-elektroplaner/                                                                                             |
| Zweck            | Nachprüfbarkeit der Werte zeigen                                                                                                                  |
| Bildinhalt       | Messspitzen eines Multimeters an zwei Punkten einer Leitung. Das Display ist abgewandt oder unscharf, keine lesbaren Werte und keine Markennamen. |
| Ausschnitt       | 3:2 quer, Schärfe auf den Messspitzen                                                                                                             |
| Fokus            | mitte                                                                                                                                             |
| Objektiv         | 50 mm oder Makro, f/4 bis f/5.6, Stativ, Fernauslöser oder Selbstauslöser                                                                         |
| Licht            | Fensterlicht von links, weißer Karton als dezenter Aufheller, kein Blitz                                                                          |
| Requisiten       | Multimeter, Messleitungen, 12-V-Leitung, matte Unterlage                                                                                          |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                               |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                                |
| Alt-Text         | Messspitzen eines Multimeters liegen an zwei Punkten einer 12-V-Leitung an.                                                                       |
| Bildunterschrift | 06 - Gemessen wird am Aufbau, nicht am Screenshot. Annahmen und Grenzen stehen im Text.                                                           |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit         |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                                      |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: B-06)

### B-07 - Abisolieren der Leitung (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/kabelquerschnitt/                                                                                                        |
| Zweck            | Vorbereitung des Anschlusses, zweiter Handgriff neben dem Crimpen                                                                         |
| Bildinhalt       | Abisolierzange entfernt ein kurzes Stück Isolierung, Kupferlitze kommt zum Vorschein, Späne auf dem Brett.                                |
| Ausschnitt       | 3:2 quer, nah, Schärfe auf der Schnittkante                                                                                               |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm oder Makro, f/4 bis f/5.6, Stativ, Fernauslöser oder Selbstauslöser                                                                 |
| Licht            | Fensterlicht von links, weißer Karton als dezenter Aufheller, kein Blitz                                                                  |
| Requisiten       | Abisolierzange, Kabel, Holzbrett                                                                                                          |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Abisolierzange entfernt die Isolierung einer 12-V-Leitung, Kupferlitze wird sichtbar.                                                     |
| Bildunterschrift | 07 - Sauber abisoliert: keine verletzte Litze, kein zu langes blankes Stück.                                                              |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: B-07)

### B-08 - Kabelkanal im Möbel (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/schaltplan/ - /guides/holzausbau/                                                                                        |
| Zweck            | Verlegeweg hinter der Verkleidung, Schnittstelle zum Möbelbau                                                                             |
| Bildinhalt       | Geöffneter Kabelkanal oder Wellrohr in einem Holzschrank, Leitung gerade erst eingezogen, Deckel daneben.                                 |
| Ausschnitt       | 3:2 quer, halbnah, Blick in den Kanal                                                                                                     |
| Fokus            | rechts                                                                                                                                    |
| Objektiv         | 50 mm oder Makro, f/4 bis f/5.6, Stativ, Fernauslöser oder Selbstauslöser                                                                 |
| Licht            | Fensterlicht von links, weißer Karton als dezenter Aufheller, kein Blitz                                                                  |
| Requisiten       | Kabelkanal/Wellrohr, Holzschrank, Leitung, Deckel                                                                                         |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Geöffneter Kabelkanal in einem Camper-Holzschrank mit eingezogener Leitung.                                                               |
| Bildunterschrift | 08 - Der Plan endet nicht an der Klemme. Der Verlegeweg entscheidet über Länge und Zugänglichkeit.                                        |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: B-08)

### Gruppe C - Sicherungen, Verteilung, 12-V-Struktur

Keine Warnfarben-Posse. Sachliche Bauteilaufnahmen, Beschriftungen bleiben blank.

### C-01 - Sicherungsträger frontal (P0)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/sicherungen/                                                                                                             |
| Zweck            | Hauptbild für I_B <= I_n <= I_z                                                                                                           |
| Bildinhalt       | Reihe von Flachsicherungen im Halter, rote und schwarze Leitungen mit blauen und roten Crimpsteckern, blanke Label-Tags ohne Schrift.     |
| Ausschnitt       | 3:2 quer, frontal, Innenabstand rundherum                                                                                                 |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm, f/5.6, Stativ, gerade Kameraachse zum Bauteil                                                                                      |
| Licht            | Streiflicht von der Seite, damit Kanten und Schrauben lesbar bleiben                                                                      |
| Requisiten       | Sicherungshalter, Flachsicherungen, Leitungen, blanke Labels                                                                              |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Sicherungshalter mit mehreren rot und schwarz angeschlossenen 12-V-Leitungen.                                                             |
| Bildunterschrift | 01 - Der Nennstrom der Sicherung folgt der Belastbarkeit der Leitung, nicht umgekehrt.                                                    |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: C-01)

### C-02 - Sicherung zwischen den Fingern (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/sicherungen/                                                                                                             |
| Zweck            | Größe und Bauform greifbar machen                                                                                                         |
| Bildinhalt       | Eine einzelne Flachsicherung wird vor dem Halter gehalten, unscharfer Hintergrund, kein Markenname lesbar.                                |
| Ausschnitt       | 3:2 quer, nah, Schärfe auf der Sicherung                                                                                                  |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm, f/5.6, Stativ, gerade Kameraachse zum Bauteil                                                                                      |
| Licht            | Streiflicht von der Seite, damit Kanten und Schrauben lesbar bleiben                                                                      |
| Requisiten       | Flachsicherung, Sicherungshalter im Hintergrund                                                                                           |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Eine einzelne Flachsicherung wird vor einem Sicherungshalter zwischen den Fingern gehalten.                                               |
| Bildunterschrift | 02 - Klein, aber maßgeblich: Die Sicherung schützt die Leitung, nicht das Gerät.                                                          |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: C-02)

### C-03 - Sammelschiene mit Ringkabelschuhen (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/sicherungen/ - /camper-elektrik/schaltplan/                                                                              |
| Zweck            | Verteilung und Massepunkt sichtbar machen                                                                                                 |
| Bildinhalt       | Kupferschiene mit mehreren aufgeschraubten Ringkabelschuhen, Schraubenköpfe und Unterlegscheiben scharf.                                  |
| Ausschnitt       | 3:2 quer, leicht schräg von oben                                                                                                          |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm, f/5.6, Stativ, gerade Kameraachse zum Bauteil                                                                                      |
| Licht            | Streiflicht von der Seite, damit Kanten und Schrauben lesbar bleiben                                                                      |
| Requisiten       | Sammelschiene, Ringkabelschuhe, Schrauben, Leitungenden                                                                                   |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Kupferne Sammelschiene mit mehreren verschraubten Ringkabelschuhen im Camper.                                                             |
| Bildunterschrift | 03 - Ein zentraler Verteilpunkt statt vieler Einzelabzweige.                                                                              |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: C-03)

### C-04 - Hauptsicherung nahe der Batterie (P0)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/sicherungen/ - /camper-elektrik/batterie/                                                                                |
| Zweck            | Absicherung direkt an der Quelle                                                                                                          |
| Bildinhalt       | Hauptsicherung im Halter wenige Zentimeter neben dem Batteriepluspol, dicke Leitung, Holzumgebung.                                        |
| Ausschnitt       | 3:2 quer, halbnah, beide Bauteile im Bild                                                                                                 |
| Fokus            | links                                                                                                                                     |
| Objektiv         | 50 mm, f/5.6, Stativ, gerade Kameraachse zum Bauteil                                                                                      |
| Licht            | Streiflicht von der Seite, damit Kanten und Schrauben lesbar bleiben                                                                      |
| Requisiten       | Hauptsicherung, Halter, dicke Plusleitung, Batterie ohne sichtbares Logo                                                                  |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Hauptsicherung im Halter direkt neben dem Pluspol einer 12-V-Batterie.                                                                    |
| Bildunterschrift | 04 - Möglichst nah an der Quelle: Der Weg dorthin ist ungeschützt und deshalb kurz.                                                       |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: C-04)

### C-05 - Geöffneter Verteiler mit daneben liegendem Deckel (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/schaltplan/                                                                                                              |
| Zweck            | Innenleben der Verteilung                                                                                                                 |
| Bildinhalt       | Kunststoffverteiler ohne Deckel, Kabel von unten und oben, Deckel mit leichtem Kratzer liegt daneben.                                     |
| Ausschnitt       | 3:2 quer, 30-Grad-Aufsicht                                                                                                                |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm, f/5.6, Stativ, gerade Kameraachse zum Bauteil                                                                                      |
| Licht            | Streiflicht von der Seite, damit Kanten und Schrauben lesbar bleiben                                                                      |
| Requisiten       | Verteilerkasten, Deckel, Leitungen                                                                                                        |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Geöffneter Verteilerkasten eines Camper-Schaltplans mit ein- und ausgehenden Leitungen.                                                   |
| Bildunterschrift | 05 - Zugänglich bleibt, was später geprüft werden muss.                                                                                   |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: C-05)

### C-06 - Massepunkt am Fahrzeugblech (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/schaltplan/ - /camper-elektrik/fehler/                                                                                   |
| Zweck            | Rückleitung und Masseverbindung                                                                                                           |
| Bildinhalt       | Ringkabelschuh auf blankem, leicht mattem Blech verschraubt, Zahnscheibe sichtbar, kein Rost-Spektakel.                                   |
| Ausschnitt       | 3:2 quer, Makro, Streiflicht                                                                                                              |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm, f/5.6, Stativ, gerade Kameraachse zum Bauteil                                                                                      |
| Licht            | Streiflicht von der Seite, damit Kanten und Schrauben lesbar bleiben                                                                      |
| Requisiten       | Ringkabelschuh, Schraube, Zahnscheibe, Blech                                                                                              |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Ringkabelschuh eines Massekabels auf blankem Fahrzeugblech verschraubt.                                                                   |
| Bildunterschrift | 06 - Die Rückleitung ist Teil der Rechnung, kein Nebenschauplatz.                                                                         |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: C-06)

### C-07 - Blanke Kabelmarker (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/sicherungen/ - /camper-elektrik/schaltplan/                                                                              |
| Zweck            | Beschriftung als Konzept, ohne dass Text im Bild steht                                                                                    |
| Bildinhalt       | Mehrere unbeschriftete Kabelmarker an einem Strang, daneben ein Stift. Alle Flächen bleiben leer.                                         |
| Ausschnitt       | 3:2 quer, nah, Schärfe auf den Markern                                                                                                    |
| Fokus            | rechts                                                                                                                                    |
| Objektiv         | 50 mm, f/5.6, Stativ, gerade Kameraachse zum Bauteil                                                                                      |
| Licht            | Streiflicht von der Seite, damit Kanten und Schrauben lesbar bleiben                                                                      |
| Requisiten       | Blanke Kabelmarker, Stift, Kabelstrang                                                                                                    |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Mehrere unbeschriftete Kabelmarker an einem Bündel 12-V-Leitungen.                                                                        |
| Bildunterschrift | 07 - Beschriftung gehört in die Stückliste und auf den Marker, nicht ins Foto.                                                            |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: C-07)

### Gruppe D - Batterie, Kapazität und Laden

Batterien fast immer ohne lesbares Typenschild fotografieren - sonst wirbt das Bild für eine Marke.

### D-01 - Batteriekasten im Holzschrank (P0)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/batterie/ - /rechner/batteriekapazitaet/                                                                                 |
| Zweck            | Kapazität braucht Bauraum                                                                                                                 |
| Bildinhalt       | Graue 12-V-Batterie in einem einfachen Holzschrank, gehalten von einer Holzleiste, Plus- und Minusleitung zu Sammelschiene und Sicherung. |
| Ausschnitt       | 3:2 quer, leicht schräg, gesamte Einbausituation im Bild                                                                                  |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ausreichend Schärfentiefe für das ganze Bauteil                                                                     |
| Licht            | Tageslicht aus der Heck- oder Seitentür, dunkle Ecken mit weißem Karton aufhellen                                                         |
| Requisiten       | Batterie ohne sichtbares Logo, Holzschrank, Leiste, Leitungen, Sammelschiene                                                              |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | 12-V-Batterie in einem Holzschrank, verkabelt über Sammelschiene und Sicherungshalter.                                                    |
| Bildunterschrift | 01 - Ah sind auch ein Maß für Bauraum. Beides fließt in die Auslegung ein.                                                                |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: D-01)

### D-02 - LiFePO4-Anschlüsse von oben (P1)

| Feld             | Vorgabe                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/lifepo4/                                                                                                                         |
| Zweck            | Polklemmen, Kabel und Platzbedarf einer Lithium-Batterie                                                                                          |
| Bildinhalt       | Aufsicht auf die Oberseite einer Batterie mit zwei Polen und aufgesetzten Ringkabelschuhen. Typenschild abgedeckt oder außerhalb des Ausschnitts. |
| Ausschnitt       | 3:2 quer, senkrecht von oben, ruhiger Hintergrund                                                                                                 |
| Fokus            | mitte                                                                                                                                             |
| Objektiv         | 35 mm, f/5.6, Stativ, ausreichend Schärfentiefe für das ganze Bauteil                                                                             |
| Licht            | Tageslicht aus der Heck- oder Seitentür, dunkle Ecken mit weißem Karton aufhellen                                                                 |
| Requisiten       | Batterie, Ringkabelschuhe, Abdeckung für Typenschild                                                                                              |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                               |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                                |
| Alt-Text         | Aufsicht auf die beiden Pole einer 12-V-Batterie mit aufgesetzten Ringkabelschuhen.                                                               |
| Bildunterschrift | 02 - Anschlussquerschnitt und Polklemmen gehören zur Auslegung wie die Kapazität.                                                                 |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit         |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                                      |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: D-02)

### D-03 - AGM und LiFePO4 nebeneinander (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/agm/ - /camper-elektrik/lifepo4/                                                                                         |
| Zweck            | Vergleichsabsicht sachlich bedienen, ohne Produktempfehlung                                                                               |
| Bildinhalt       | Zwei unterschiedlich große Batteriegehäuse nebeneinander auf dem Boden, beide ohne lesbare Markennamen, gleiches Licht, gleicher Abstand. |
| Ausschnitt       | 3:2 quer, frontale Aufsicht, beide gleich groß im Bild                                                                                    |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ausreichend Schärfentiefe für das ganze Bauteil                                                                     |
| Licht            | Tageslicht aus der Heck- oder Seitentür, dunkle Ecken mit weißem Karton aufhellen                                                         |
| Requisiten       | Zwei Batterien, neutrale Unterlage, Abdeckungen                                                                                           |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Zwei unterschiedlich große 12-V-Batteriegehäuse stehen nebeneinander auf neutralem Untergrund.                                            |
| Bildunterschrift | 03 - Bauform und Gewicht unterscheiden sich. Welche Chemie passt, entscheidet der Bedarf, nicht das Foto.                                 |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: D-03)

### D-04 - Batterie-Hauptschalter (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/batterie/ - /camper-elektrik/schaltplan/                                                                                 |
| Zweck            | Trennbarkeit der Anlage                                                                                                                   |
| Bildinhalt       | Dreh- oder Kippschalter in Griffnähe, dicke Leitung dahinter, Schalterstellung eindeutig erkennbar.                                       |
| Ausschnitt       | 3:2 quer, halbnah, Bedienrichtung bleibt erkennbar                                                                                        |
| Fokus            | links                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ausreichend Schärfentiefe für das ganze Bauteil                                                                     |
| Licht            | Tageslicht aus der Heck- oder Seitentür, dunkle Ecken mit weißem Karton aufhellen                                                         |
| Requisiten       | Hauptschalter, dicke Leitung, Holzumgebung                                                                                                |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Batterie-Hauptschalter mit dicker Plusleitung in einem Camper-Schrank.                                                                    |
| Bildunterschrift | 04 - Trennbarkeit ist Teil des Plans, keine nachträgliche Zugabe.                                                                         |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: D-04)

### D-05 - Shunt und Batteriemonitor (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/stromverbrauch/                                                                                                          |
| Zweck            | Verbrauch messen statt schätzen                                                                                                           |
| Bildinhalt       | Shunt in der Minusleitung, dünne Messleitung zum Anzeigegerät. Display abgewandt oder ohne lesbare Werte.                                 |
| Ausschnitt       | 3:2 quer, Schärfe auf dem Shunt                                                                                                           |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ausreichend Schärfentiefe für das ganze Bauteil                                                                     |
| Licht            | Tageslicht aus der Heck- oder Seitentür, dunkle Ecken mit weißem Karton aufhellen                                                         |
| Requisiten       | Shunt, Minusleitung, Messleitung, Anzeigegerät                                                                                            |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Shunt in der Minusleitung einer 12-V-Anlage mit abgehender Messleitung.                                                                   |
| Bildunterschrift | 05 - Verbrauch wird gemessen. Die Verbrauchsliste im Planer ist eine Eingabe, keine Messung.                                              |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: D-05)

### D-06 - Ladebooster eingebaut (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/ladebooster/                                                                                                             |
| Zweck            | Laden während der Fahrt, Kabelwege sichtbar                                                                                               |
| Bildinhalt       | Kompaktes Ladegerät verschraubt, zwei dicke Leitungen zur Starter- und Versorgerbatterie, Kühlrippen im Streiflicht.                      |
| Ausschnitt       | 3:2 quer, leicht schräg, beide Abgänge im Bild                                                                                            |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ausreichend Schärfentiefe für das ganze Bauteil                                                                     |
| Licht            | Tageslicht aus der Heck- oder Seitentür, dunkle Ecken mit weißem Karton aufhellen                                                         |
| Requisiten       | Ladebooster ohne lesbares Logo, dicke Leitungen, Schrauben                                                                                |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Eingebauter Ladebooster mit zwei dicken Leitungen im Camper-Innenraum.                                                                    |
| Bildunterschrift | 06 - Zwei Batterien, ein Ladestrom, zwei Leitungswege. Beide werden einzeln ausgelegt.                                                    |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: D-06)

### D-07 - Ladevorgang am Fahrzeug (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/laden/                                                                                                                   |
| Zweck            | Landstrom/Laden als Alltagssituation                                                                                                      |
| Bildinhalt       | Ladekabel vom Fahrzeug zur Steckdose, ordentlich verlegt, kein Kabelgewirr, keine Person im Bild.                                         |
| Ausschnitt       | 3:2 quer, weiter Winkel, Tageslicht                                                                                                       |
| Fokus            | rechts                                                                                                                                    |
| Objektiv         | 35 mm, f/5.6, Stativ, ausreichend Schärfentiefe für das ganze Bauteil                                                                     |
| Licht            | Tageslicht aus der Heck- oder Seitentür, dunkle Ecken mit weißem Karton aufhellen                                                         |
| Requisiten       | Ladekabel, Steckdose, Fahrzeugausschnitt ohne Kennzeichen                                                                                 |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Ladekabel verbindet ein Wohnmobil mit einer Steckdose an der Hauswand.                                                                    |
| Bildunterschrift | 07 - Laden ist ein Betriebszustand, kein eigenes Kapitel.                                                                                 |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: D-07)

### Gruppe E - Solar und Dach

Dachmotive bei bedecktem Himmel: harte Sonne erzeugt Spiegelungen und ausgefressene Kanten.

### E-01 - Solarpanel wird ausgerichtet (P0)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /rechner/solaranlage/ - /tools/dach/                                                                                                      |
| Zweck            | Fläche und Montage statt Symbol                                                                                                           |
| Bildinhalt       | Zwei Hände richten ein Schwarzrahmen-Panel auf dem Dachträger aus, zweites Panel und ein aufgerolltes Kabel im Hintergrund.               |
| Ausschnitt       | 3:2 quer, leicht von unten, viel Himmel, Horizont nicht durch Gesichter schneiden                                                         |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/8, Polarisationsfilter nur gegen Spiegelung, nicht für dramatischen Himmel                                                       |
| Licht            | Bedeckter Himmel oder später Nachmittag, nie direkte Mittagssonne                                                                         |
| Requisiten       | Solarpanel, Dachträger, Aluschienen, Kabel                                                                                                |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Zwei Hände richten ein Solarpanel auf dem Dachträger eines Wohnmobils aus.                                                                |
| Bildunterschrift | 01 - Verfügbare Dachfläche begrenzt die Modulzahl, bevor die Ertragsrechnung beginnt.                                                     |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: E-01)

### E-02 - Dachaufsicht mit Panels und Dachluke (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /tools/dach/                                                                                                                              |
| Zweck            | Belegung und Abstände nachvollziehbar                                                                                                     |
| Bildinhalt       | Von oben auf das Fahrzeugdach: zwei Panels, eine Dachluke, freie Restflächen, keine Personen.                                             |
| Ausschnitt       | 3:2 quer, senkrecht von oben (Leiter oder benachbarte Etage), ruhiger Rahmen                                                              |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/8, Polarisationsfilter nur gegen Spiegelung, nicht für dramatischen Himmel                                                       |
| Licht            | Bedeckter Himmel oder später Nachmittag, nie direkte Mittagssonne                                                                         |
| Requisiten       | Fahrzeug, zwei Panels, Dachluke, sicherer Standpunkt                                                                                      |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Aufsicht auf ein Wohnmobildach mit zwei Solarpanelen und einer Dachluke.                                                                  |
| Bildunterschrift | 02 - Belegung ist Geometrie. Der Dach-Planer rechnet mit genau diesen Flächen.                                                            |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: E-02)

### E-03 - MC4-Stecker und Solarkabel (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/solar/ - /camper-elektrik/mppt/                                                                                          |
| Zweck            | Übergang vom Modul zum Laderegler                                                                                                         |
| Bildinhalt       | Zwei MC4-Stecker kurz vor dem Zusammenstecken, schwarzes Solarkabel, matte Unterlage.                                                     |
| Ausschnitt       | 3:2 quer, Makro, Schärfe auf den Steckergesichtern                                                                                        |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/8, Polarisationsfilter nur gegen Spiegelung, nicht für dramatischen Himmel                                                       |
| Licht            | Bedeckter Himmel oder später Nachmittag, nie direkte Mittagssonne                                                                         |
| Requisiten       | MC4-Stecker, Solarkabel, Unterlage                                                                                                        |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Zwei MC4-Stecker an schwarzen Solarkabeln kurz vor dem Verbinden.                                                                         |
| Bildunterschrift | 03 - Steckverbindungen sind Teil der Leitungslänge und des Übergangswiderstands.                                                          |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: E-03)

### E-04 - MPPT-Laderegler eingebaut (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/mppt/                                                                                                                    |
| Zweck            | Regler zwischen Modul und Batterie                                                                                                        |
| Bildinhalt       | Laderegler an einer Holzplatte verschraubt, Solarkabel von oben, Batteriekabel nach unten, Kühlrippen erkennbar.                          |
| Ausschnitt       | 3:2 quer, frontal, beide Kabelrichtungen im Bild                                                                                          |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/8, Polarisationsfilter nur gegen Spiegelung, nicht für dramatischen Himmel                                                       |
| Licht            | Bedeckter Himmel oder später Nachmittag, nie direkte Mittagssonne                                                                         |
| Requisiten       | MPPT-Regler ohne Logo, Solarkabel, Batteriekabel, Holzplatte                                                                              |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Eingebauter MPPT-Laderegler mit Solar- und Batterieleitungen an einer Holzplatte.                                                         |
| Bildunterschrift | 04 - Zwei Leitungswege, zwei Auslegungen. Der Regler verbindet sie, ersetzt sie nicht.                                                    |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: E-04)

### E-05 - Dachdurchführung (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/solar/                                                                                                                   |
| Zweck            | Abdichtung und Kabelweg nach innen                                                                                                        |
| Bildinhalt       | Kabeldurchführung auf dem Dach mit zwei austretenden Solarkabeln, Dichtmasse sauber, aber nicht frisch poliert.                           |
| Ausschnitt       | 3:2 quer, halbnah, Streiflicht auf der Dichtkante                                                                                         |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/8, Polarisationsfilter nur gegen Spiegelung, nicht für dramatischen Himmel                                                       |
| Licht            | Bedeckter Himmel oder später Nachmittag, nie direkte Mittagssonne                                                                         |
| Requisiten       | Dachdurchführung, Solarkabel, Dichtmasse                                                                                                  |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Dachdurchführung mit zwei austretenden Solarkabeln auf einem Wohnmobildach.                                                               |
| Bildunterschrift | 05 - Jede Durchführung ist ein Übergabepunkt zwischen Dachplan und Schaltplan.                                                            |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: E-05)

### E-06 - Teilverschattung auf dem Panel (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/solar/                                                                                                                   |
| Zweck            | Ertragsminderung sachlich zeigen                                                                                                          |
| Bildinhalt       | Schattenstreifen eines Astes oder einer Dachluke liegt über einem Teil der Modulfläche, bedeckter Himmel, keine dramatische Stimmung.     |
| Ausschnitt       | 3:2 quer, Modul füllt das Bild, Schatten klar abgrenzbar                                                                                  |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/8, Polarisationsfilter nur gegen Spiegelung, nicht für dramatischen Himmel                                                       |
| Licht            | Bedeckter Himmel oder später Nachmittag, nie direkte Mittagssonne                                                                         |
| Requisiten       | Solarpanel, Ast oder Dachluke als Schattengeber                                                                                           |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Schattenstreifen liegt über einem Teil der Fläche eines Solarpanels.                                                                      |
| Bildunterschrift | 06 - Teilverschattung trifft nicht das ganze Modul gleich. Die Auslegung nennt die Annahme dazu.                                          |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: E-06)

### Gruppe F - 230 V, Wechselrichter, Sicherheit

Keine Warnsymbolik, keine rot leuchtenden Pfeile. Sachlichkeit ist hier besonders wichtig.

### F-01 - Wechselrichter im Schrank (P0)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/wechselrichter/                                                                                                          |
| Zweck            | 12 V zu 230 V, Einbausituation                                                                                                            |
| Bildinhalt       | Wechselrichter auf Holzplatte, dicke 12-V-Leitungen links, 230-V-Leitung rechts, getrennt geführt.                                        |
| Ausschnitt       | 3:2 quer, leicht schräg, beide Leitungsarten erkennbar                                                                                    |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ruhige Kamera                                                                                                       |
| Licht            | Tageslicht plus dezente Aufhellung, keine harten Schlagschatten                                                                           |
| Requisiten       | Wechselrichter ohne Logo, 12-V- und 230-V-Leitungen, Holzplatte                                                                           |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Wechselrichter im Camper-Schrank mit getrennt geführten 12-V- und 230-V-Leitungen.                                                        |
| Bildunterschrift | 01 - Zwei Spannungsebenen, getrennte Verlegewege, eine Auslegung je Leitung.                                                              |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: F-01)

### F-02 - FI/RCD in der Verteilung (P0)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/230v/                                                                                                                    |
| Zweck            | Schutzeinrichtung sachlich zeigen                                                                                                         |
| Bildinhalt       | Fehlerstromschutzschalter in einer kleinen 230-V-Verteilung, Prüftaste erkennbar, keine lesbaren Herstellerangaben.                       |
| Ausschnitt       | 3:2 quer, frontal, Schärfe auf der Front                                                                                                  |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ruhige Kamera                                                                                                       |
| Licht            | Tageslicht plus dezente Aufhellung, keine harten Schlagschatten                                                                           |
| Requisiten       | FI/RCD, Kleinverteilung, 230-V-Leitungen                                                                                                  |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Fehlerstromschutzschalter in einer 230-V-Kleinverteilung eines Wohnmobils.                                                                |
| Bildunterschrift | 02 - 230-V-Anlagen sind abnahmepflichtig. Das steht im Text, nicht als Warnsymbol im Bild.                                                |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: F-02)

### F-03 - Landstromeinspeisung außen (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/230v/                                                                                                                    |
| Zweck            | Übergabepunkt von außen                                                                                                                   |
| Bildinhalt       | CEE-Einspeisung an der Fahrzeugaußenwand, Klappe geöffnet, kein Kennzeichen und keine Markenembleme im Ausschnitt.                        |
| Ausschnitt       | 3:2 quer, halbnah, Fahrzeugkante als ruhige Linie                                                                                         |
| Fokus            | links                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ruhige Kamera                                                                                                       |
| Licht            | Tageslicht plus dezente Aufhellung, keine harten Schlagschatten                                                                           |
| Requisiten       | CEE-Einspeisung, Klappe, Fahrzeugausschnitt                                                                                               |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Geöffnete CEE-Landstromeinspeisung an der Außenwand eines Wohnmobils.                                                                     |
| Bildunterschrift | 03 - Der Übergabepunkt gehört in den Plan, bevor über Innenverteilung gesprochen wird.                                                    |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: F-03)

### F-04 - Steckdose im Innenraum (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/230v/                                                                                                                    |
| Zweck            | Alltagsbezug ohne Lifestyle                                                                                                               |
| Bildinhalt       | Eine eingebaute 230-V-Steckdose in einer Holzverkleidung, leicht schräg, kein Stecker eingesteckt, keine Dekoration.                      |
| Ausschnitt       | 3:2 quer, nah, Holzmaserung bleibt erkennbar                                                                                              |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ruhige Kamera                                                                                                       |
| Licht            | Tageslicht plus dezente Aufhellung, keine harten Schlagschatten                                                                           |
| Requisiten       | Einbausteckdose, Holzverkleidung                                                                                                          |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | 230-V-Steckdose in einer Holzverkleidung im Camper-Innenraum.                                                                             |
| Bildunterschrift | 04 - Jede Steckdose ist ein Verbraucherpfad im Plan, kein Einzelfall.                                                                     |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: F-04)

### F-05 - Getrennte Verlegewege 12 V / 230 V (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/230v/ - /camper-elektrik/schaltplan/                                                                                     |
| Zweck            | Trennung räumlich nachvollziehbar                                                                                                         |
| Bildinhalt       | Zwei getrennte Kabelkanäle mit sichtbarem Abstand auf derselben Holzfläche, rote/schwarze Adern links, 230-V-Leitung rechts.              |
| Ausschnitt       | 3:2 quer, von oben, Abstand bleibt messbar                                                                                                |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ, ruhige Kamera                                                                                                       |
| Licht            | Tageslicht plus dezente Aufhellung, keine harten Schlagschatten                                                                           |
| Requisiten       | Zwei Kabelkanäle, 12-V- und 230-V-Leitung, Holzplatte                                                                                     |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Zwei getrennte Kabelkanäle mit 12-V- und 230-V-Leitungen auf einer Holzfläche.                                                            |
| Bildunterschrift | 05 - Getrennte Wege sind eine Planungsentscheidung, keine kosmetische.                                                                    |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: F-05)

### F-06 - Prüfung am Anschluss (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /ueber-elektroplaner/ - /camper-elektrik/230v/                                                                                            |
| Zweck            | Transparenz und Grenzen des Werkzeugs                                                                                                     |
| Bildinhalt       | Prüfgerät an einer 230-V-Verteilung, Display ohne lesbare Werte, Hände im Bild, keine Siegel oder Plaketten.                              |
| Ausschnitt       | 3:2 quer, halbnah, ruhiges Licht                                                                                                          |
| Fokus            | rechts                                                                                                                                    |
| Objektiv         | 35 mm, f/5.6, Stativ, ruhige Kamera                                                                                                       |
| Licht            | Tageslicht plus dezente Aufhellung, keine harten Schlagschatten                                                                           |
| Requisiten       | Prüfgerät, Kleinverteilung, Messleitungen                                                                                                 |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Prüfgerät wird an einer 230-V-Kleinverteilung im Wohnmobil angesetzt.                                                                     |
| Bildunterschrift | 06 - Das Werkzeug unterstützt die Vorbereitung. Prüfung und Abnahme bleiben separat.                                                      |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: F-06)

### Gruppe G - Heizung, Dämmung, Ausbau, Zulassung

Diese Motive bedienen die Guides und Werkzeugseiten, die laut SEO-Audit noch zu dünn sind.

### G-01 - Dämmung vor der Verkleidung (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /heizung-daemmung/ - /tools/heizung/                                                                                                      |
| Zweck            | Heizlast hängt an der Dämmung                                                                                                             |
| Bildinhalt       | Dämmmaterial zwischen Holzständern, stellenweise noch offen, keine Perfektion, kein Dekostoff.                                            |
| Ausschnitt       | 3:2 quer, weiter Winkel, Struktur des Materials erkennbar                                                                                 |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ bei Innenraum                                                                                                        |
| Licht            | Verfügbares Tageslicht, keine Baustrahler-Farbe                                                                                           |
| Requisiten       | Dämmmaterial, Holzständer, Werkzeug                                                                                                       |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Dämmmaterial zwischen Holzständern einer noch offenen Camper-Seitenwand.                                                                  |
| Bildunterschrift | 01 - Die Heizlastrechnung beginnt bei der Hülle, nicht beim Heizgerät.                                                                    |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: G-01)

### G-02 - Standheizung mit Luftschläuchen (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /heizung-daemmung/diesel-standheizung/ - /tools/heizung/                                                                                  |
| Zweck            | Einbausituation der Heizung                                                                                                               |
| Bildinhalt       | Kompakte Standheizung unter dem Möbel, Warmluftschläuche und Abgasführung angedeutet, kein lesbares Typenschild.                          |
| Ausschnitt       | 3:2 quer, halbnah, Schlauchverlauf bleibt erkennbar                                                                                       |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ bei Innenraum                                                                                                        |
| Licht            | Verfügbares Tageslicht, keine Baustrahler-Farbe                                                                                           |
| Requisiten       | Standheizung, Warmluftschläuche, Schellen                                                                                                 |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Eingebaute Standheizung unter einem Camper-Möbel mit angeschlossenen Warmluftschläuchen.                                                  |
| Bildunterschrift | 02 - Geräteleistung und Einbaulage gehören zusammen.                                                                                      |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: G-02)

### G-03 - Holzausbau: Zuschnitt (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /guides/holzausbau/                                                                                                                       |
| Zweck            | Möbelbau als eigener Gewerkeschritt                                                                                                       |
| Bildinhalt       | Frisch zugeschnittene Multiplexplatte auf Böcken, Schnittkante scharf, Sägespäne, Winkel und Bleistift.                                   |
| Ausschnitt       | 3:2 quer, leicht schräg, Kante führt durchs Bild                                                                                          |
| Fokus            | rechts                                                                                                                                    |
| Objektiv         | 35 mm, f/5.6, Stativ bei Innenraum                                                                                                        |
| Licht            | Verfügbares Tageslicht, keine Baustrahler-Farbe                                                                                           |
| Requisiten       | Multiplexplatte, Böcke, Winkel, Bleistift, Säge                                                                                           |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Frisch zugeschnittene Multiplexplatte auf Werkböcken mit Winkel und Sägespänen.                                                           |
| Bildunterschrift | 03 - Erst das Maß, dann der Zuschnitt. Der Ausbau-Fahrplan nennt die Reihenfolge.                                                         |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: G-03)

### G-04 - Leeres Fahrzeug, Gewerke erkennbar (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /guides/ausbau-fahrplan/                                                                                                                  |
| Zweck            | Reihenfolge der Gewerke räumlich zeigen                                                                                                   |
| Bildinhalt       | Entkernter Innenraum mit sichtbaren Ständern, ersten Kabelwegen und noch fehlender Verkleidung. Keine beschrifteten Klebebänder.          |
| Ausschnitt       | 3:2 quer, weiter Winkel, Tiefe bis zur Heckklappe                                                                                         |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ bei Innenraum                                                                                                        |
| Licht            | Verfügbares Tageslicht, keine Baustrahler-Farbe                                                                                           |
| Requisiten       | Entkerntes Fahrzeug, Holzständer, Kabelreste                                                                                              |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Entkernter Camper-Innenraum mit Holzständern und ersten verlegten Kabelwegen.                                                             |
| Bildunterschrift | 04 - Was zuerst kommt, sieht man am Zustand des Fahrzeugs, nicht an einer Checkliste im Bild.                                             |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: G-04)

### G-05 - Fahrzeug von außen ohne Kennzeichen (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /wohnmobilzulassung/ - /guides/camper-ausbauguide/                                                                                        |
| Zweck            | Titelbild für Ratgeber- und Zulassungsseiten                                                                                              |
| Bildinhalt       | Ganzes Fahrzeug auf ruhigem Untergrund, bewölkter Himmel, keine Menschen, kein Kennzeichen, keine Markenembleme im Bild.                  |
| Ausschnitt       | 3:2 quer, weiter Winkel, Fahrzeug leicht aus der Mitte                                                                                    |
| Fokus            | rechts                                                                                                                                    |
| Objektiv         | 35 mm, f/5.6, Stativ bei Innenraum                                                                                                        |
| Licht            | Verfügbares Tageslicht, keine Baustrahler-Farbe                                                                                           |
| Requisiten       | Fahrzeug, ruhiger Platz ohne fremde Autos und Schilder                                                                                    |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Weißes Wohnmobil auf einem ruhigen Platz unter bedecktem Himmel.                                                                          |
| Bildunterschrift | 05 - Zulassungsfragen betreffen das Fahrzeug, nicht einzelne Bauteile.                                                                    |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: G-05)

### G-06 - Dokumentation des Ausbaus (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-ausbau/ - /ueber-elektroplaner/                                                                                                   |
| Zweck            | Nachvollziehbarkeit als Gegenstand                                                                                                        |
| Bildinhalt       | Aufgeschlagener Ordner mit blanken Tabellen und einem Stift, daneben ein Kabelrest. Keine lesbare Schrift, keine Zahlen.                  |
| Ausschnitt       | 3:2 quer, 45-Grad-Aufsicht                                                                                                                |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 35 mm, f/5.6, Stativ bei Innenraum                                                                                                        |
| Licht            | Verfügbares Tageslicht, keine Baustrahler-Farbe                                                                                           |
| Requisiten       | Ordner mit leeren Formularen, Stift, Kabelrest                                                                                            |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Aufgeschlagener Ordner mit leeren Tabellen und einem Stift auf der Werkbank.                                                              |
| Bildunterschrift | 06 - Dokumentiert wird, was man später prüfen will. Zahlen stehen im Text, nicht im Foto.                                                 |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: G-06)

### Gruppe H - Werkzeug, Prüfung, Vertrauen

Die Bilder für Methodik, Fehlerbilder und Vertrauensseite. Bewusst unaufgeregt.

### H-01 - Werkzeug-Flachaufsicht (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /ueber-elektroplaner/ (Vertrauensseite)                                                                                                   |
| Zweck            | Zeigt, womit gearbeitet wird                                                                                                              |
| Bildinhalt       | Crimpzange, Abisolierer, Messband, Kabelreste, blanker Zettel und ein Becher liegen nebeneinander auf einer verkratzten Werkbank.         |
| Ausschnitt       | 3:2 quer, senkrecht von oben, alle Gegenstände scharf                                                                                     |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm, f/4 bis f/5.6, Stativ                                                                                                              |
| Licht            | Fensterlicht von links, kein Blitz, kein Farbfilter                                                                                       |
| Requisiten       | Werkzeug, Kabelreste, blankes Papier, Becher                                                                                              |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Crimpzange, Abisolierer, Maßband und Kabelreste liegen geordnet auf einer Werkbank.                                                       |
| Bildunterschrift | 01 - Werkzeug, Unterlagen, Nachweis: Die Methodikseite erklärt, wie gerechnet wird.                                                       |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: H-01)

### H-02 - Zugprobe an einer Verbindung (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/fehler/                                                                                                                  |
| Zweck            | Prüfen statt vermuten                                                                                                                     |
| Bildinhalt       | Zwei Hände ziehen leicht an einem gecrimpten Kabelschuh, ohne ihn zu verbiegen. Sachte, keine reißerische Geste.                          |
| Ausschnitt       | 3:2 quer, nah, Schärfe auf der Verbindungsstelle                                                                                          |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm, f/4 bis f/5.6, Stativ                                                                                                              |
| Licht            | Fensterlicht von links, kein Blitz, kein Farbfilter                                                                                       |
| Requisiten       | Gecrimpter Kabelschuh, kurzes Kabelstück                                                                                                  |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Zwei Hände prüfen eine gecrimpte Kabelverbindung mit leichtem Zug.                                                                        |
| Bildunterschrift | 02 - Eine Verbindung wird geprüft, nicht nach Aussehen bewertet.                                                                          |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: H-02)

### H-03 - Fehlerbild: gequetschte Leitung (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /camper-elektrik/fehler/                                                                                                                  |
| Zweck            | Sachliches Negativbeispiel, ohne Schadenromantik                                                                                          |
| Bildinhalt       | Eine zu eng gebogene oder gequetschte Leitung auf matter Unterlage, klar erkennbar, aber nicht spektakulär inszeniert.                    |
| Ausschnitt       | 3:2 quer, Makro, neutrales Licht                                                                                                          |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm, f/4 bis f/5.6, Stativ                                                                                                              |
| Licht            | Fensterlicht von links, kein Blitz, kein Farbfilter                                                                                       |
| Requisiten       | Beschädigtes Kabelstück, matte Unterlage                                                                                                  |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Nahaufnahme einer gequetschten 12-V-Leitung mit verformter Isolierung.                                                                    |
| Bildunterschrift | 03 - Ein Fehlerbild erklärt eine Grenze. Es ersetzt keine Prüfung und keine Normangabe.                                                   |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: H-03)

### H-04 - Rechenweg auf Papier, abstrakt (P2)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /rechner/spannungsabfall-12v/ - /rechner/batteriekapazitaet/                                                                              |
| Zweck            | Rechnung als Gegenstand, ohne Text im Bild                                                                                                |
| Bildinhalt       | Handgezeichnete Kästchen, Linien und Pfeile auf blankem Papier, absichtlich ohne lesbare Ziffern oder Buchstaben, Bleistift daneben.      |
| Ausschnitt       | 3:2 quer, 45-Grad-Aufsicht, weiches Licht                                                                                                 |
| Fokus            | mitte                                                                                                                                     |
| Objektiv         | 50 mm, f/4 bis f/5.6, Stativ                                                                                                              |
| Licht            | Fensterlicht von links, kein Blitz, kein Farbfilter                                                                                       |
| Requisiten       | Papier, Bleistift, Lineal                                                                                                                 |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Abstrakte Handskizze mit Kästchen und Linien auf einem Blatt Papier neben einem Bleistift.                                                |
| Bildunterschrift | 04 - Formeln stehen als Text auf der Seite. Das Bild zeigt nur, dass nachgerechnet wird.                                                  |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: H-04)

### H-05 - Stückliste als blankes Objekt (P1)

| Feld             | Vorgabe                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Zielseite        | /elektrik-planung/ - /planer/                                                                                                             |
| Zweck            | Ergebnis des Planers greifbar machen                                                                                                      |
| Bildinhalt       | Leere, linierte Liste auf der Werkbank, daneben ein paar sortierte Bauteile (Sicherung, Kabelschuh, Kabelbinder), keine lesbare Schrift.  |
| Ausschnitt       | 3:2 quer, leicht schräg von oben                                                                                                          |
| Fokus            | links                                                                                                                                     |
| Objektiv         | 50 mm, f/4 bis f/5.6, Stativ                                                                                                              |
| Licht            | Fensterlicht von links, kein Blitz, kein Farbfilter                                                                                       |
| Requisiten       | Blankes Formular, Sicherung, Kabelschuh, Kabelbinder                                                                                      |
| Personen         | Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera                                                       |
| Varianten        | A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte                                                        |
| Alt-Text         | Leere Materialliste liegt neben sortierten Bauteilen auf einer Werkbank.                                                                  |
| Bildunterschrift | 05 - Aus dem Plan entsteht eine Stückliste. Ihre Werte stehen in der Anwendung, nicht im Bild.                                            |
| Vermeiden        | Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit |
| Abnahme          | Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF                              |

- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: H-05)

## Zuordnung Seite zu Motiv

| Seite                                  | Motive                 |
| -------------------------------------- | ---------------------- |
| /                                      | A-01, A-02             |
| /camper-elektrik/                      | A-02, A-03, B-05       |
| /camper-elektrik/kabelquerschnitt/     | B-01, B-03, B-07       |
| /camper-elektrik/spannungsabfall/      | B-05, B-06             |
| /camper-elektrik/sicherungen/          | C-01, C-04, C-07       |
| /camper-elektrik/schaltplan/           | A-05, B-08, C-05, C-06 |
| /camper-elektrik/batterie/             | D-01, D-04             |
| /camper-elektrik/lifepo4/              | D-02, D-03             |
| /camper-elektrik/agm/                  | D-03                   |
| /camper-elektrik/ladebooster/          | D-06                   |
| /camper-elektrik/laden/                | D-07                   |
| /camper-elektrik/stromverbrauch/       | D-05                   |
| /camper-elektrik/solar/                | E-03, E-05, E-06       |
| /camper-elektrik/mppt/                 | E-04                   |
| /camper-elektrik/wechselrichter/       | F-01                   |
| /camper-elektrik/230v/                 | F-02, F-03, F-04, F-05 |
| /camper-elektrik/fehler/               | H-02, H-03             |
| /rechner/                              | A-04                   |
| /rechner/spannungsabfall-12v/          | B-06, H-04             |
| /rechner/batteriekapazitaet/           | D-01, H-04             |
| /rechner/solaranlage/                  | E-01                   |
| /tools/dach/                           | E-01, E-02             |
| /tools/heizung/                        | G-01, G-02             |
| /heizung-daemmung/                     | G-01                   |
| /heizung-daemmung/diesel-standheizung/ | G-02                   |
| /guides/ausbau-fahrplan/               | G-04                   |
| /guides/holzausbau/                    | G-03                   |
| /guides/camper-ausbauguide/            | G-05                   |
| /wohnmobilzulassung/                   | G-05                   |
| /camper-ausbau/                        | G-06                   |
| /elektrik-planung/ - /planer/          | H-05                   |
| /ueber-elektroplaner/                  | A-05, H-01, F-06       |
| /ueber-12v-planer/                     | A-05, H-01             |

## OG-Karten (1200 x 630) - keine neuen Motive nötig

Einzige Ausnahme von der Regel 'kein Text im Bild': Hier ist Text erlaubt und erwünscht.

| Layout | Ziel                            | Basismotiv | Aufteilung                                                    |
| ------ | ------------------------------- | ---------- | ------------------------------------------------------------- |
| OG-01  | Pillar /camper-elektrik/        | A-02       | Text links auf Papierfläche, Foto rechts 55 %                 |
| OG-02  | Cluster Kabelquerschnitt        | B-03       | Foto 60 % links, eine Zeile Text rechts                       |
| OG-03  | Rechner Batteriekapazitaet      | D-01       | Foto unten, oben eine Zeile, viel Ruhe                        |
| OG-04  | Rechner Solaranlage             | E-01       | Foto als Streifen, Text darüber                               |
| OG-05  | Cluster 230 V                   | F-02       | Foto rechts, links eine Zeile                                 |
| OG-06  | Vertrauen /ueber-elektroplaner/ | A-05       | Plan-Foto als ganzflächiger Hintergrund, Text in ruhiger Ecke |

## Was du NICHT fotografieren musst (HTML/SVG statt Bild)

| Element                       | Seite                              | Umsetzung                                      |
| ----------------------------- | ---------------------------------- | ---------------------------------------------- |
| Querschnittstabelle           | /camper-elektrik/kabelquerschnitt/ | HTML-Tabelle mit caption - Zahlen bleiben Text |
| Spannungsabfall-Diagramm      | /camper-elektrik/spannungsabfall/  | inline SVG, editierbar und indexierbar         |
| Schaltplanausschnitt          | /planer/ - /elektrik-planung/      | SVG direkt aus dem Produkt, kein Screenshot    |
| Batteriekurve / Entladetiefe  | /camper-elektrik/agm/              | SVG-Diagramm, Achsen als echter Text           |
| Vergleichstabelle LiFePO4/AGM | /camper-elektrik/lifepo4/          | HTML-Tabelle, kein Bild                        |
| Dachbelegungsschema           | /tools/dach/                       | SVG aus dem Dach-Planer                        |
| Heizlast-Formel               | /tools/heizung/                    | formatierter Text / MathML, kein Rasterbild    |
| Ausbau-Reihenfolge            | /guides/ausbau-fahrplan/           | nummerierte HTML-Liste                         |

## Drehplan

### Block 1 - Werkbank / Innenraum (ca. 2 h)

Motive: A-01, A-04, A-05, B-01 bis B-04, B-07, C-01 bis C-03, C-07, H-01, H-04, H-05

Lichtunabhängig, mit Stativ und ruhiger Unterlage. Zuerst alle Makros, solange die Werkbank noch leer ist.

### Block 2 - Einbau im Fahrzeug (ca. 2 h)

Motive: A-02, A-03, B-05, B-08, C-04 bis C-06, D-01 bis D-06, F-01 bis F-06, G-01, G-02, G-04, H-02, H-03

Tageslicht, Türen auf. Erst die weiten Bilder, dann die Details - so bleibt die Reihenfolge der Gewerke glaubwürdig.

### Block 3 - Dach / außen (ca. 1 h)

Motive: E-01 bis E-06, G-05, D-07

Bedeckter Himmel ist Pflicht. Leiter sichern, keine fremden Fahrzeuge, Kennzeichen und Markenembleme aus dem Ausschnitt.

### Block 4 - Reserve (ca. 1 h)

Motive: Varianten B/C, Nachschüsse, OG-Ausschnitte

Für jedes P0-Motiv zusätzlich einen Hochformat-Ausschnitt (4:5) und ein Detail (4:3) anfertigen.

## Checklisten

### Vorbereitung

- [ ] Kamera, zwei Objektive (35 mm + 50 mm/Makro), Stativ, Fernauslöser, Ersatzakku, Speicherkarten
- [ ] Weißer Karton als Aufheller, mattes Holzbrett als Unterlage, Microfasertuch, Klebeband (nicht im Bild)
- [ ] Abdeckband für Typenschilder, Logos und Displays; Ersatz für blanke Kabelmarker
- [ ] Ausdruck des Schaltplans ohne Text, leere Formulare, leerer Ordner
- [ ] Requisiten nach Block sortieren, Kabelreste in mehreren Stärken bereitlegen
- [ ] Motivliste ausdrucken; pro Motiv die Kästchen am Seitenende abhaken
- [ ] Wetter: bedeckter Himmel für Block 3 einplanen, Sonne = Block 1 und 2

### Vor Ort

- [ ] RAW + JPEG, sRGB, feste Farbtemperatur (nicht Auto-Weißabgleich pro Bild wechseln)
- [ ] Pro Motiv mindestens 5 Aufnahmen: eine Weite, zwei Varianten, ein Detail, eine Reserve
- [ ] Nach jedem Motiv kurz prüfen: Schärfe auf dem Hauptmotiv, kein Text/Logo/Kennzeichen im Bild
- [ ] Hände nur mit Einverständnis; Gesichter und Kennzeichen grundsätzlich nicht
- [ ] Keine nachträglichen Text-Overlays, keine Wasserzeichen, keine KI-Nachbearbeitung
- [ ] Kabel nicht extra neu verlegen, nur für die Aufnahme - der Zustand soll echt bleiben

### Übergabe

- [ ] Sichtung: pro Motiv eine A-Variante auswählen, B/C ablegen
- [ ] IPTC: Urheber, Rechteinhaber, Aufnahmedatum, Freigabe - jede Zeile in BILDRECHTE.md eintragen
- [ ] Export: 1200 px AVIF + 640 px AVIF + JPEG-Fallback, längere Kante >= 2400 px im Master
- [ ] Dateinamen nach Muster: <motiv-id>-<kurzname>-1200.avif (kleingeschrieben, kebab-case)
- [ ] Alt-Text und Bildunterschrift je Motiv in die Seite übernehmen, beide aus diesem Katalog
- [ ] Breite und Höhe im HTML setzen, Bildunterschrift als figcaption, ImageObject und Sitemap ergänzen
- [ ] Budgets prüfen: Hero <= 60 KB AVIF, Summe <= 250 KB AVIF je Seite

## Vorlage: Einverständniserklärung

```
Einverständniserklärung (Vorlage - vom Betreiber vor dem Dreh ausfüllen)

Ich, ____________________________, bin damit einverstanden, dass Aufnahmen von meinen Händen
bzw. von mir bei Arbeiten am Fahrzeug für die Website 12v-planer.de sowie für zugehörige
Anzeigen (SEA) und Social-Media-Ausschnitte verwendet werden.

Ort, Datum: ____________________    Unterschrift: ____________________

Hinweis: Gesichter und Kennzeichen werden nicht abgebildet. Ein Widerruf ist jederzeit
möglich; betroffene Bilder werden dann aus der Auslieferung entfernt.
```

## Statusliste zum Abhaken

| ID   | aufgenommen | Rechte | Alt/Caption | exportiert |
| ---- | ----------- | ------ | ----------- | ---------- |
| A-01 | [ ]         | [ ]    | [ ]         | [ ]        |
| A-02 | [ ]         | [ ]    | [ ]         | [ ]        |
| A-03 | [ ]         | [ ]    | [ ]         | [ ]        |
| A-04 | [ ]         | [ ]    | [ ]         | [ ]        |
| A-05 | [ ]         | [ ]    | [ ]         | [ ]        |
| B-01 | [ ]         | [ ]    | [ ]         | [ ]        |
| B-02 | [ ]         | [ ]    | [ ]         | [ ]        |
| B-03 | [ ]         | [ ]    | [ ]         | [ ]        |
| B-04 | [ ]         | [ ]    | [ ]         | [ ]        |
| B-05 | [ ]         | [ ]    | [ ]         | [ ]        |
| B-06 | [ ]         | [ ]    | [ ]         | [ ]        |
| B-07 | [ ]         | [ ]    | [ ]         | [ ]        |
| B-08 | [ ]         | [ ]    | [ ]         | [ ]        |
| C-01 | [ ]         | [ ]    | [ ]         | [ ]        |
| C-02 | [ ]         | [ ]    | [ ]         | [ ]        |
| C-03 | [ ]         | [ ]    | [ ]         | [ ]        |
| C-04 | [ ]         | [ ]    | [ ]         | [ ]        |
| C-05 | [ ]         | [ ]    | [ ]         | [ ]        |
| C-06 | [ ]         | [ ]    | [ ]         | [ ]        |
| C-07 | [ ]         | [ ]    | [ ]         | [ ]        |
| D-01 | [ ]         | [ ]    | [ ]         | [ ]        |
| D-02 | [ ]         | [ ]    | [ ]         | [ ]        |
| D-03 | [ ]         | [ ]    | [ ]         | [ ]        |
| D-04 | [ ]         | [ ]    | [ ]         | [ ]        |
| D-05 | [ ]         | [ ]    | [ ]         | [ ]        |
| D-06 | [ ]         | [ ]    | [ ]         | [ ]        |
| D-07 | [ ]         | [ ]    | [ ]         | [ ]        |
| E-01 | [ ]         | [ ]    | [ ]         | [ ]        |
| E-02 | [ ]         | [ ]    | [ ]         | [ ]        |
| E-03 | [ ]         | [ ]    | [ ]         | [ ]        |
| E-04 | [ ]         | [ ]    | [ ]         | [ ]        |
| E-05 | [ ]         | [ ]    | [ ]         | [ ]        |
| E-06 | [ ]         | [ ]    | [ ]         | [ ]        |
| F-01 | [ ]         | [ ]    | [ ]         | [ ]        |
| F-02 | [ ]         | [ ]    | [ ]         | [ ]        |
| F-03 | [ ]         | [ ]    | [ ]         | [ ]        |
| F-04 | [ ]         | [ ]    | [ ]         | [ ]        |
| F-05 | [ ]         | [ ]    | [ ]         | [ ]        |
| F-06 | [ ]         | [ ]    | [ ]         | [ ]        |
| G-01 | [ ]         | [ ]    | [ ]         | [ ]        |
| G-02 | [ ]         | [ ]    | [ ]         | [ ]        |
| G-03 | [ ]         | [ ]    | [ ]         | [ ]        |
| G-04 | [ ]         | [ ]    | [ ]         | [ ]        |
| G-05 | [ ]         | [ ]    | [ ]         | [ ]        |
| G-06 | [ ]         | [ ]    | [ ]         | [ ]        |
| H-01 | [ ]         | [ ]    | [ ]         | [ ]        |
| H-02 | [ ]         | [ ]    | [ ]         | [ ]        |
| H-03 | [ ]         | [ ]    | [ ]         | [ ]        |
| H-04 | [ ]         | [ ]    | [ ]         | [ ]        |
| H-05 | [ ]         | [ ]    | [ ]         | [ ]        |

## Offene Entscheidungen

- Wer fotografiert, wer ist Rechteinhaber, wer unterschreibt die Einverständniserklärung?
- Welches Fahrzeug wird abgebildet (Kennzeichen und Markenembleme aus dem Ausschnitt)?
- Wer füllt `lib/siteLegal.ts` und die Datenschutzerklärung aus (P0-Blocker für SEA)?

_Kein Ranking-Versprechen. Bilder verbessern die Nachprüfbarkeit, keine Position._
