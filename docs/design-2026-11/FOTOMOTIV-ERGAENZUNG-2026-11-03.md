# Ergänzung zum Fotomotiv-Katalog — 28 Seiten aus der Nischenforschung

**Quelle:** Anhang `Nischenforschung_und_Content-Ausbau_2026-11-03_12-15.md`,
verdichtet in [`ANHAENGE-INTEGRATION-2026-11-03.md`](ANHAENGE-INTEGRATION-2026-11-03.md).
**Status:** bedingt — die 28 Seiten existieren in diesem Checkout (`af7f646`)
**nicht**. Die Motive werden erst fällig, wenn die zugehörigen Inhaltsseiten
hier tatsächlich gebaut sind. Sie ergänzen, nicht ersetzen, die 50 Motive in
[`FOTOMOTIV-KATALOG.pdf`](FOTOMOTIV-KATALOG.pdf).

## Umfang

| Art                                          | Anzahl | Bildklasse (Konzept §4.1)  | Foto nötig?             |
| -------------------------------------------- | -----: | -------------------------- | ----------------------- |
| Hero-Motive für 28 Seiten                    |     28 | A — echtes Foto            | **ja**, eigene Aufnahme |
| Technische Diagramme je Seite                |     28 | B/C — inline SVG bzw. HTML | nein, gezeichnet        |
| OG-Ableitungen aus den Hero-Motiven          |     28 | A — Ableitung, 1200 × 630  | kein neues Foto         |
| Bereits vorhandene SVG-Diagramme laut Anhang |      7 | B                          | nein                    |

Damit steigt der Bedarf an **eigenen Fotografien** von 50 auf **78**, sofern die
Content-Cluster übernommen werden. Die 28 Diagramme kosten keinen Fototermin —
sie sind Text/SVG und bleiben ohne JavaScript lesbar.

## Regeln, die unverändert gelten

- Eigene Aufnahmen, keine KI-Platzhalter, kein Stock, kein Hotlinking
  ([`BILDRECHTE.md`](BILDRECHTE.md), Regeln 1 und 5).
- Je Foto: AVIF `-640`/`-1200`, JPEG-Fallback, `width`/`height`,
  beschreibender `kebab-case`-Dateiname, deutscher Alt-Text, `<figcaption>` mit
  einer Aussage und internem Verweis — hergestellt über
  `components/brand/ContentImage.tsx` (P1).
- Keine lesbaren Markennamen, Typenschilder oder Logos im Bild; Geräte werden in
  der Bildunterschrift sachlich benannt.
- OG-Karten sind die einzigen Bilder mit Text; je Suchintention separat.
- Rechte, Fotograf:in, Datum und Freigabe gehören in die Tabelle in
  `BILDRECHTE.md` — eine Zeile je Motiv.

---

## 1. Wasser (7 Seiten)

| Nr.  | Seite                     | Hero-Motiv (Klasse A)              | Diagramm (Klasse B/C, kein Foto)        |
| ---- | ------------------------- | ---------------------------------- | --------------------------------------- |
| W-01 | Hub `/camper-wasser/`     | Technikschrank mit Tank und Pumpe  | Vier-Systeme-Schema                     |
| W-02 | Wassertank reinigen       | offener Tank mit Bürste            | Reinigungsreihenfolge mit Chlor-Warnung |
| W-03 | Wasseranlage planen       | Planungstisch mit Skizze und Pumpe | Hydraulikschema                         |
| W-04 | Wasserpumpe fördert nicht | Multimeter an Pumpenklemmen        | Symptom-Diagnosebaum                    |
| W-05 | Abwassertank geruch       | Grauwassertank / Entsorgung        | Siphon-, Gefälle- und Entlüftungsfehler |
| W-06 | Warmwasserboiler          | Boiler im Technikschrank           | Energiebedarf 5 / 10 / 20 Liter         |
| W-07 | Winterfest                | Ablasshahn im Herbst               | Entleerungspunkt-Karte                  |

## 2. Gas (7 Seiten)

| Nr.  | Seite                  | Hero-Motiv (Klasse A)             | Diagramm (Klasse B/C, kein Foto)                |
| ---- | ---------------------- | --------------------------------- | ----------------------------------------------- |
| G-01 | Hub `/camper-gas/`     | Gaskasten mit gesicherter Flasche | Systemwahl Gas / Diesel / gasfrei               |
| G-02 | Gasprüfung             | Prüfgerät am Gaskasten            | zwei Zeitachsen (24 Monate / 10 Jahre)          |
| G-03 | Gaskasten              | Gaskasten mit Belüftung           | Schnitt mit Dichtheit und Flaschenhalterung     |
| G-04 | Gasregler / Schlauch   | Datumscode am Regler              | 10-Jahres-Zeitleiste                            |
| G-05 | Gaswarner              | tief montierter Warner            | Gasdichte und Montagehöhen                      |
| G-06 | Gas oder Dieselheizung | beide Heizgeräte                  | Entscheidungsmatrix                             |
| G-07 | Gasfrei kochen         | Induktionsfeld / Wechselrichter   | Energiefluss Batterie → Wechselrichter → Platte |

## 3. Dach & Dämmung (7 Seiten)

| Nr.  | Seite                    | Hero-Motiv (Klasse A)            | Diagramm (Klasse B/C, kein Foto)     |
| ---- | ------------------------ | -------------------------------- | ------------------------------------ |
| D-01 | Hub `/camper-dach/`      | Dach mit Luke, Solar und Dämmung | Schichtenmodell und Feuchtepfade     |
| D-02 | Dachluke einbauen        | trocken positionierte Luke       | Montagefolge                         |
| D-03 | Dachluke abdichten       | Wasserspur am Innenrahmen        | Diagnosebaum                         |
| D-04 | Alubutyl                 | teilverklebte Blechfläche        | Resonanz / Luftschall / Wärme        |
| D-05 | Kältebrücken             | freigelegte Rippen und Holme     | Bauteilkarte                         |
| D-06 | Dampfsperre              | zwei Dämmaufbauten               | Feuchtepfade und Entscheidungsfelder |
| D-07 | Kondenswasser / Schimmel | Hygrometer, beschlagene Scheibe  | Diagnoseprotokoll                    |

## 4. Zulassung (7 Seiten)

| Nr.  | Seite              | Hero-Motiv (Klasse A)           | Diagramm (Klasse B/C, kein Foto)                            |
| ---- | ------------------ | ------------------------------- | ----------------------------------------------------------- |
| Z-01 | Hub Zulassung      | Prüfermappe mit Papieren        | Ablaufkette mit Zuständigkeiten                             |
| Z-02 | § 21 oder § 19     | Ordner § 19 / § 21              | Entscheidungsbaum inkl. „Abs. 3 ist keine Änderungsabnahme" |
| Z-03 | Gewicht / Achslast | Camper auf Waage                | Gewichtsbudget und Achslastverteilung                       |
| Z-04 | Sitzplätze / Gurte | Sitzbank mit Gurtverankerung    | § 35a vs. Sitzzahl                                          |
| Z-05 | Aufstelldach       | aufgestelltes Dach              | Nachweise und Abnahmeart                                    |
| Z-06 | Versicherung       | Ordner mit Rechnungen und Fotos | Umbauphase → Zulassung → Versicherung                       |
| Z-07 | Prüfermappe        | sortierte Mappe                 | Dokumentencheckliste                                        |

---

## Offen vor dem Dreh

- **Seiten existieren hier nicht.** Vor einem Fototermin entscheiden, ob die
  vier Cluster in diesem Branch gebaut werden. Ohne Zielseite gibt es keinen
  sinnvollen Dateinamen, keinen Alt-Text und keinen internen Verweis.
- **Rechtliche Sorgfalt.** Die Zulassungs- und Gas-Motive berühren § 19/§ 21
  StVZO und G 607. Bildunterschriften müssen die Aussage der jeweiligen Seite
  stützen, nicht eine neue Rechtsbehauptung aufstellen (Anhang A hat hier
  mehrere falsche Aussagen korrigiert).
- **Keine „Foto folgt"-Platzhalter** auf den Seiten, solange die Aufnahmen
  fehlen — das war einer der Befunde in Anhang B und kostet Vertrauen.
- **Vollständige Briefings** (Licht, Optik, Ausschnitt, Alt-Text, Caption,
  Checkboxen) liegen im Hauptkatalog für 50 Motive vor. Für diese 28 Ergänzungen
  gibt es bisher nur die Kurzform oben; vor dem Dreh sind sie auf dasselbe
  Format zu bringen und in `BILDRECHTE.md` einzutragen.
