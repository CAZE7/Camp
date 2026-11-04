#!/usr/bin/env python3
"""
Erzeugt den Fotomotiv-Katalog für das Designkonzept 2026-11.

Ausgaben (beide aus derselben Datenquelle):
  docs/design-2026-11/FOTOMOTIV-KATALOG.md   — editierbare, diffbare Quelle
  docs/design-2026-11/FOTOMOTIV-KATALOG.pdf  — große, druckbare PDF für den Dreh

Einmalige Abhängigkeit, nur zur Erzeugung, nicht Teil der Anwendung:
  pip install reportlab
  python3 scripts/design/fotomotive.py

Hinweis: Nach einer Änderung an der Markdown-Ausgabe `npx prettier --write`
auf die .md-Datei laufen lassen (Repo-Format). Die PDF ist das Auslieferformat.
"""

from __future__ import annotations

import os
from xml.sax.saxutils import escape as xml_escape

from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "docs", "design-2026-11")
MD_PATH = os.path.join(OUT_DIR, "FOTOMOTIV-KATALOG.md")
PDF_PATH = os.path.join(OUT_DIR, "FOTOMOTIV-KATALOG.pdf")

INK = colors.HexColor("#1c1b18")
INK2 = colors.HexColor("#57534a")
INK3 = colors.HexColor("#8a857b")
OXIDE = colors.HexColor("#a34a24")
RULE = colors.HexColor("#d8d4cd")
PANEL = colors.HexColor("#f6f5f2")
BOX = colors.HexColor("#fbfaf8")

CONTENT_W = A4[0] - 90

# ---------------------------------------------------------------------------
# Gemeinsame Vorgaben je Motivgruppe. Einzelne Motive überschreiben sie.
# ---------------------------------------------------------------------------

COMMON = {
    "optik": "35 mm oder 50 mm, f/5.6, ISO Auto, 1/60 s oder kürzer, Stativ/Anlehnung",
    "licht": "Verfügbares Licht durch offene Tür oder Fenster, kein Blitz, kein Reflektor",
    "person": "Nur Hände und Unterarme, Arbeitskleidung, keine Gesichter, kein Blick in die Kamera",
    "vermeiden": "Kein Text, Logo oder lesbarer Markenname im Bild; keine perfekte Symmetrie, kein HDR, kein Sonnenuntergang, keine gestellte Zufriedenheit",
    "abnahme": "Schärfe auf dem Hauptmotiv, keine Verwacklung, lange Kante >= 2400 px, RAW + sRGB-JPEG, kein GPS in den EXIF",
    "varianten": "A: 3:2 quer (Standard) - B: Detail 4:3 - C: 4:5 hoch für mobile/Social-Ausschnitte",
}

GROUPS = [
    {
        "key": "A",
        "title": "Einstieg und Überblick",
        "note": "Die fünf Bilder, die zuerst entstehen müssen: Sie tragen Startseite, Pillar und Vertrauensseite.",
        "defaults": {},
        "motifs": [
            {
                "id": "A-01",
                "titel": "Kabelverlegung im Innenausbau",
                "ziel": "/ (LCP-Hero) - /camper-elektrik/",
                "zweck": "Einstieg: zeigt in einem Bild, worüber die ganze Seite rechnet",
                "inhalt": "Zwei Hände führen eine rote und eine schwarze 12-V-Leitung entlang einer hellen Holzleiste. Im Hintergrund geöffnete Seitenwand, Werkzeug und unfertiges Möbel.",
                "ausschnitt": "3:2 quer, 1200 x 805 px, Motiv rechts, links 20 % ruhiger Freiraum, nicht beschriftet",
                "fokus": "rechts",
                "requisiten": "Holzleiste, 2 Adern, Kabelbinder, Abisolierzange, Sägespäne",
                "alt": "Hände verlegen rot-schwarze 12-V-Leitungen entlang einer Holzleiste im Camper-Innenausbau.",
                "caption": "01 - 12-V-Leitungen werden geführt, bevor die Verkleidung geschlossen wird. Der Planer beschriftet genau diese Leitung mit Querschnitt, Länge und Absicherung.",
                "prio": "P0",
            },
            {
                "id": "A-02",
                "titel": "Geöffnete Seitenwand mit sichtbarer Installation",
                "ziel": "/ (Beweisstrecke) - /camper-elektrik/",
                "zweck": "Kontext: wie die Anlage im Fahrzeug liegt, bevor alles verkleidet ist",
                "inhalt": "Halb entkernter Innenraum, Dämmung und Holzständer sichtbar, erste Kabelwege und ein Verteiler montiert. Nichts ist aufgeräumt.",
                "ausschnitt": "3:2 quer, weiter Winkel, Horizont leicht geneigt, Tiefe durch offene Tür",
                "fokus": "mitte",
                "requisiten": "Dämmmaterial, Holzständer, Kabel, Verteiler, Schrauben",
                "alt": "Geöffnete Seitenwand eines Campers mit sichtbarer Dämmung und ersten verlegten 12-V-Leitungen.",
                "caption": "02 - Vor der Verkleidung sind Leitungslänge und Bauraum noch veränderbar. Beide Werte gehen in die Rechnung ein.",
                "prio": "P0",
            },
            {
                "id": "A-03",
                "titel": "Fertiger Elektrik-Schrank, uninszeniert",
                "ziel": "/camper-elektrik/ (Pillar)",
                "zweck": "Zielzustand zeigen, ohne Hochglanz-Produktfoto",
                "inhalt": "Geöffneter Technikschrank mit Verteiler, Sicherungen und geordneten, aber nicht perfekten Kabelwegen. Deckkante und Gebrauchsspuren bleiben sichtbar.",
                "ausschnitt": "3:2 quer, frontale Kamera, gerader Horizont, keine Zwangszentrierung",
                "fokus": "mitte",
                "requisiten": "Technikschrank, Verteiler, Sicherungsträger, Kabelbinder",
                "alt": "Geöffneter Elektrik-Schrank im Camper mit Sicherungsträger und geordneten Kabelwegen.",
                "caption": "03 - Eine fertige Verteilung. Welche Leitung welchen Querschnitt braucht, entscheidet die Rechnung, nicht das Aussehen.",
                "prio": "P1",
            },
            {
                "id": "A-04",
                "titel": "Werkbank mit ausgelegtem Material",
                "ziel": "/rechner/ (Hub) - /elektrik-planung/",
                "zweck": "Überblick über die Werkzeuge und Rechner der Seite",
                "inhalt": "Aufsicht auf eine Werkbank: Kabelreste, Crimpzange, Messband, blankes Papier und ein Becher mit Gebrauchsspuren.",
                "ausschnitt": "3:2 quer, senkrecht von oben, weiches Seitenlicht, keine Schattenplastik",
                "fokus": "mitte",
                "requisiten": "Crimpzange, Abisolierer, Messband, Kabelreste, Papier, Becher",
                "alt": "Werkbank mit Kabelresten, Crimpzange, Messband und blankem Papier von oben fotografiert.",
                "caption": "04 - Rechner, Planer und Stückliste gehören zusammen. Hier beginnt die Vorbereitung, nicht im Möbel.",
                "prio": "P1",
            },
            {
                "id": "A-05",
                "titel": "Gedruckter Schaltplan auf der Werkbank",
                "ziel": "/ueber-elektroplaner/ - /camper-elektrik/schaltplan/",
                "zweck": "Brücke zwischen Plan und Realität, Leitmotiv des Konzepts",
                "inhalt": "Ausgedruckter Plan mit abstrakten Linien und Kästchen (keine lesbare Schrift), daneben Kabelreste, Messband und Bleistift. Papier leicht gewellt.",
                "ausschnitt": "3:2 quer, 45-Grad-Aufsicht, Schärfe auf der Planmitte",
                "fokus": "mitte",
                "requisiten": "Ausdruck ohne Text, Bleistift, Messband, Kabelreste",
                "alt": "Ausgedruckter Schaltplan liegt neben Kabelresten und Maßband auf einer Werkbank.",
                "caption": "05 - Der Plan ist die Zusage, das Foto der Beleg. Beide tragen dieselben Nummern.",
                "prio": "P0",
            },
        ],
    },
    {
        "key": "B",
        "title": "Kabel, Querschnitt, Verbindung",
        "note": "Nahaufnahmen. Hier entscheidet Schärfe: Der Übergang vom Rechenwert zum Bauteil muss prüfbar sein.",
        "defaults": {
            "optik": "50 mm oder Makro, f/4 bis f/5.6, Stativ, Fernauslöser oder Selbstauslöser",
            "licht": "Fensterlicht von links, weißer Karton als dezenter Aufheller, kein Blitz",
        },
        "motifs": [
            {
                "id": "B-01",
                "titel": "Crimpvorgang mit der Crimpzange",
                "ziel": "/camper-elektrik/kabelquerschnitt/",
                "zweck": "Zeigt den Handgriff, der aus einem berechneten Querschnitt eine Verbindung macht",
                "inhalt": "Zwei Hände pressen eine Crimpzange auf einen Kabelschuh am Ende einer roten Leitung. Werkzeug trägt Gebrauchsspuren.",
                "ausschnitt": "3:2 quer, Schärfe auf der Pressstelle, Hintergrund leicht unscharf",
                "fokus": "mitte",
                "requisiten": "Crimpzange, Kabelschuh, rote 12-V-Leitung, Holzunterlage",
                "alt": "Crimpzange presst einen Kabelschuh auf eine rote 12-V-Leitung an der Werkbank.",
                "caption": "01 - Der berechnete Querschnitt ist erst mit der passenden Verbindung brauchbar.",
                "prio": "P0",
            },
            {
                "id": "B-02",
                "titel": "Fertige Pressung im Makro",
                "ziel": "/camper-elektrik/kabelquerschnitt/ - /camper-elektrik/fehler/",
                "zweck": "Qualitätsmerkmal einer sauberen Verbindung",
                "inhalt": "Kabelschuh nach der Pressung, Litze bündig, Isolierung unverletzt, Kupfer sichtbar. Sehr nah, aber ohne Überhöhung.",
                "ausschnitt": "3:2 quer, Makro, Schärfentiefe so groß, dass der ganze Schuh lesbar bleibt",
                "fokus": "mitte",
                "requisiten": "Gecrimpter Kabelschuh, Kabel, matte Unterlage",
                "alt": "Nahaufnahme eines gecrimpten Kabelschuhs mit bündiger Litze an einer roten Leitung.",
                "caption": "02 - Eine saubere Pressung: Litze bündig, Isolierung unverletzt. Prüfbar, nicht dekorativ.",
                "prio": "P1",
            },
            {
                "id": "B-03",
                "titel": "Zwei Querschnitte im direkten Vergleich",
                "ziel": "/camper-elektrik/kabelquerschnitt/",
                "zweck": "Das wichtigste Fachbild der Seite: Querschnitt wird sichtbar",
                "inhalt": "Zwei abisolierte Kupferleitungen unterschiedlicher Stärke liegen parallel auf mattem Holz, Querschnittsflächen zur Kamera gedreht. Kein Maßstab mit Zahlen.",
                "ausschnitt": "3:2 quer, senkrecht von oben, beide Enden auf gleicher Schärfeebene",
                "fokus": "mitte",
                "requisiten": "Zwei Kabelstärken, Abisolierer, Holzbrett, Lineal ohne lesbare Ziffern",
                "alt": "Zwei abisolierte Kupferleitungen mit unterschiedlichem Querschnitt liegen nebeneinander auf Holz.",
                "caption": "03 - Querschnitt ist eine Fläche, keine Farbe. Die Rechnung bestimmt, welche der beiden Leitungen passt.",
                "prio": "P0",
            },
            {
                "id": "B-04",
                "titel": "Aderendhülse und Zugentlastung",
                "ziel": "/camper-elektrik/kabelquerschnitt/ - /camper-elektrik/sicherungen/",
                "zweck": "Anschluss an Klemmen und Schutz vor Zug",
                "inhalt": "Aderendhülsen, Kabelbinder und ein gebündelter Strang kurz vor dem Einführen in eine Klemme.",
                "ausschnitt": "3:2 quer, leicht schräge Aufsicht",
                "fokus": "rechts",
                "requisiten": "Aderendhülsen, Kabelbinder, Klemme, Kabelstrang",
                "alt": "Aderendhülsen und Kabelbinder an einem gebündelten Leitungsstrang vor einer Klemme.",
                "caption": "04 - Zugentlastung gehört zur Auslegung dazu, auch wenn sie in keiner Formel steht.",
                "prio": "P2",
            },
            {
                "id": "B-05",
                "titel": "Kabelweg mit Biegerradius",
                "ziel": "/camper-elektrik/spannungsabfall/ - /camper-elektrik/schaltplan/",
                "zweck": "Leitungslänge und Verlegeweg als Einfluss auf den Spannungsabfall",
                "inhalt": "Eine Leitung folgt einem Holzrahmen in weitem Bogen, keine scharfen Knicke, Befestigung alle paar Zentimeter.",
                "ausschnitt": "3:2 quer, Verlauf von links unten nach rechts oben, viel Umgebung",
                "fokus": "mitte",
                "requisiten": "Lange Leitung, Holzrahmen, Kabelbinder, Schellen",
                "alt": "12-V-Leitung folgt in einem weiten Bogen einem Holzrahmen im Camper-Innenausbau.",
                "caption": "05 - Jeder zusätzliche Meter zählt. Die Länge im Plan ist die Länge im Fahrzeug.",
                "prio": "P1",
            },
            {
                "id": "B-06",
                "titel": "Messung an der Leitung",
                "ziel": "/rechner/spannungsabfall-12v/ - /ueber-elektroplaner/",
                "zweck": "Nachprüfbarkeit der Werte zeigen",
                "inhalt": "Messspitzen eines Multimeters an zwei Punkten einer Leitung. Das Display ist abgewandt oder unscharf, keine lesbaren Werte und keine Markennamen.",
                "ausschnitt": "3:2 quer, Schärfe auf den Messspitzen",
                "fokus": "mitte",
                "requisiten": "Multimeter, Messleitungen, 12-V-Leitung, matte Unterlage",
                "alt": "Messspitzen eines Multimeters liegen an zwei Punkten einer 12-V-Leitung an.",
                "caption": "06 - Gemessen wird am Aufbau, nicht am Screenshot. Annahmen und Grenzen stehen im Text.",
                "prio": "P2",
            },
            {
                "id": "B-07",
                "titel": "Abisolieren der Leitung",
                "ziel": "/camper-elektrik/kabelquerschnitt/",
                "zweck": "Vorbereitung des Anschlusses, zweiter Handgriff neben dem Crimpen",
                "inhalt": "Abisolierzange entfernt ein kurzes Stück Isolierung, Kupferlitze kommt zum Vorschein, Späne auf dem Brett.",
                "ausschnitt": "3:2 quer, nah, Schärfe auf der Schnittkante",
                "fokus": "mitte",
                "requisiten": "Abisolierzange, Kabel, Holzbrett",
                "alt": "Abisolierzange entfernt die Isolierung einer 12-V-Leitung, Kupferlitze wird sichtbar.",
                "caption": "07 - Sauber abisoliert: keine verletzte Litze, kein zu langes blankes Stück.",
                "prio": "P2",
            },
            {
                "id": "B-08",
                "titel": "Kabelkanal im Möbel",
                "ziel": "/camper-elektrik/schaltplan/ - /guides/holzausbau/",
                "zweck": "Verlegeweg hinter der Verkleidung, Schnittstelle zum Möbelbau",
                "inhalt": "Geöffneter Kabelkanal oder Wellrohr in einem Holzschrank, Leitung gerade erst eingezogen, Deckel daneben.",
                "ausschnitt": "3:2 quer, halbnah, Blick in den Kanal",
                "fokus": "rechts",
                "requisiten": "Kabelkanal/Wellrohr, Holzschrank, Leitung, Deckel",
                "alt": "Geöffneter Kabelkanal in einem Camper-Holzschrank mit eingezogener Leitung.",
                "caption": "08 - Der Plan endet nicht an der Klemme. Der Verlegeweg entscheidet über Länge und Zugänglichkeit.",
                "prio": "P2",
            },
        ],
    },
    {
        "key": "C",
        "title": "Sicherungen, Verteilung, 12-V-Struktur",
        "note": "Keine Warnfarben-Posse. Sachliche Bauteilaufnahmen, Beschriftungen bleiben blank.",
        "defaults": {
            "optik": "50 mm, f/5.6, Stativ, gerade Kameraachse zum Bauteil",
            "licht": "Streiflicht von der Seite, damit Kanten und Schrauben lesbar bleiben",
        },
        "motifs": [
            {
                "id": "C-01",
                "titel": "Sicherungsträger frontal",
                "ziel": "/camper-elektrik/sicherungen/",
                "zweck": "Hauptbild für I_B <= I_n <= I_z",
                "inhalt": "Reihe von Flachsicherungen im Halter, rote und schwarze Leitungen mit blauen und roten Crimpsteckern, blanke Label-Tags ohne Schrift.",
                "ausschnitt": "3:2 quer, frontal, Innenabstand rundherum",
                "fokus": "mitte",
                "requisiten": "Sicherungshalter, Flachsicherungen, Leitungen, blanke Labels",
                "alt": "Sicherungshalter mit mehreren rot und schwarz angeschlossenen 12-V-Leitungen.",
                "caption": "01 - Der Nennstrom der Sicherung folgt der Belastbarkeit der Leitung, nicht umgekehrt.",
                "prio": "P0",
            },
            {
                "id": "C-02",
                "titel": "Sicherung zwischen den Fingern",
                "ziel": "/camper-elektrik/sicherungen/",
                "zweck": "Größe und Bauform greifbar machen",
                "inhalt": "Eine einzelne Flachsicherung wird vor dem Halter gehalten, unscharfer Hintergrund, kein Markenname lesbar.",
                "ausschnitt": "3:2 quer, nah, Schärfe auf der Sicherung",
                "fokus": "mitte",
                "requisiten": "Flachsicherung, Sicherungshalter im Hintergrund",
                "alt": "Eine einzelne Flachsicherung wird vor einem Sicherungshalter zwischen den Fingern gehalten.",
                "caption": "02 - Klein, aber maßgeblich: Die Sicherung schützt die Leitung, nicht das Gerät.",
                "prio": "P2",
            },
            {
                "id": "C-03",
                "titel": "Sammelschiene mit Ringkabelschuhen",
                "ziel": "/camper-elektrik/sicherungen/ - /camper-elektrik/schaltplan/",
                "zweck": "Verteilung und Massepunkt sichtbar machen",
                "inhalt": "Kupferschiene mit mehreren aufgeschraubten Ringkabelschuhen, Schraubenköpfe und Unterlegscheiben scharf.",
                "ausschnitt": "3:2 quer, leicht schräg von oben",
                "fokus": "mitte",
                "requisiten": "Sammelschiene, Ringkabelschuhe, Schrauben, Leitungenden",
                "alt": "Kupferne Sammelschiene mit mehreren verschraubten Ringkabelschuhen im Camper.",
                "caption": "03 - Ein zentraler Verteilpunkt statt vieler Einzelabzweige.",
                "prio": "P1",
            },
            {
                "id": "C-04",
                "titel": "Hauptsicherung nahe der Batterie",
                "ziel": "/camper-elektrik/sicherungen/ - /camper-elektrik/batterie/",
                "zweck": "Absicherung direkt an der Quelle",
                "inhalt": "Hauptsicherung im Halter wenige Zentimeter neben dem Batteriepluspol, dicke Leitung, Holzumgebung.",
                "ausschnitt": "3:2 quer, halbnah, beide Bauteile im Bild",
                "fokus": "links",
                "requisiten": "Hauptsicherung, Halter, dicke Plusleitung, Batterie ohne sichtbares Logo",
                "alt": "Hauptsicherung im Halter direkt neben dem Pluspol einer 12-V-Batterie.",
                "caption": "04 - Möglichst nah an der Quelle: Der Weg dorthin ist ungeschützt und deshalb kurz.",
                "prio": "P0",
            },
            {
                "id": "C-05",
                "titel": "Geöffneter Verteiler mit daneben liegendem Deckel",
                "ziel": "/camper-elektrik/schaltplan/",
                "zweck": "Innenleben der Verteilung",
                "inhalt": "Kunststoffverteiler ohne Deckel, Kabel von unten und oben, Deckel mit leichtem Kratzer liegt daneben.",
                "ausschnitt": "3:2 quer, 30-Grad-Aufsicht",
                "fokus": "mitte",
                "requisiten": "Verteilerkasten, Deckel, Leitungen",
                "alt": "Geöffneter Verteilerkasten eines Camper-Schaltplans mit ein- und ausgehenden Leitungen.",
                "caption": "05 - Zugänglich bleibt, was später geprüft werden muss.",
                "prio": "P2",
            },
            {
                "id": "C-06",
                "titel": "Massepunkt am Fahrzeugblech",
                "ziel": "/camper-elektrik/schaltplan/ - /camper-elektrik/fehler/",
                "zweck": "Rückleitung und Masseverbindung",
                "inhalt": "Ringkabelschuh auf blankem, leicht mattem Blech verschraubt, Zahnscheibe sichtbar, kein Rost-Spektakel.",
                "ausschnitt": "3:2 quer, Makro, Streiflicht",
                "fokus": "mitte",
                "requisiten": "Ringkabelschuh, Schraube, Zahnscheibe, Blech",
                "alt": "Ringkabelschuh eines Massekabels auf blankem Fahrzeugblech verschraubt.",
                "caption": "06 - Die Rückleitung ist Teil der Rechnung, kein Nebenschauplatz.",
                "prio": "P2",
            },
            {
                "id": "C-07",
                "titel": "Blanke Kabelmarker",
                "ziel": "/camper-elektrik/sicherungen/ - /camper-elektrik/schaltplan/",
                "zweck": "Beschriftung als Konzept, ohne dass Text im Bild steht",
                "inhalt": "Mehrere unbeschriftete Kabelmarker an einem Strang, daneben ein Stift. Alle Flächen bleiben leer.",
                "ausschnitt": "3:2 quer, nah, Schärfe auf den Markern",
                "fokus": "rechts",
                "requisiten": "Blanke Kabelmarker, Stift, Kabelstrang",
                "alt": "Mehrere unbeschriftete Kabelmarker an einem Bündel 12-V-Leitungen.",
                "caption": "07 - Beschriftung gehört in die Stückliste und auf den Marker, nicht ins Foto.",
                "prio": "P2",
            },
        ],
    },
    {
        "key": "D",
        "title": "Batterie, Kapazität und Laden",
        "note": "Batterien fast immer ohne lesbares Typenschild fotografieren - sonst wirbt das Bild für eine Marke.",
        "defaults": {
            "optik": "35 mm, f/5.6, Stativ, ausreichend Schärfentiefe für das ganze Bauteil",
            "licht": "Tageslicht aus der Heck- oder Seitentür, dunkle Ecken mit weißem Karton aufhellen",
        },
        "motifs": [
            {
                "id": "D-01",
                "titel": "Batteriekasten im Holzschrank",
                "ziel": "/camper-elektrik/batterie/ - /rechner/batteriekapazitaet/",
                "zweck": "Kapazität braucht Bauraum",
                "inhalt": "Graue 12-V-Batterie in einem einfachen Holzschrank, gehalten von einer Holzleiste, Plus- und Minusleitung zu Sammelschiene und Sicherung.",
                "ausschnitt": "3:2 quer, leicht schräg, gesamte Einbausituation im Bild",
                "fokus": "mitte",
                "requisiten": "Batterie ohne sichtbares Logo, Holzschrank, Leiste, Leitungen, Sammelschiene",
                "alt": "12-V-Batterie in einem Holzschrank, verkabelt über Sammelschiene und Sicherungshalter.",
                "caption": "01 - Ah sind auch ein Maß für Bauraum. Beides fließt in die Auslegung ein.",
                "prio": "P0",
            },
            {
                "id": "D-02",
                "titel": "LiFePO4-Anschlüsse von oben",
                "ziel": "/camper-elektrik/lifepo4/",
                "zweck": "Polklemmen, Kabel und Platzbedarf einer Lithium-Batterie",
                "inhalt": "Aufsicht auf die Oberseite einer Batterie mit zwei Polen und aufgesetzten Ringkabelschuhen. Typenschild abgedeckt oder außerhalb des Ausschnitts.",
                "ausschnitt": "3:2 quer, senkrecht von oben, ruhiger Hintergrund",
                "fokus": "mitte",
                "requisiten": "Batterie, Ringkabelschuhe, Abdeckung für Typenschild",
                "alt": "Aufsicht auf die beiden Pole einer 12-V-Batterie mit aufgesetzten Ringkabelschuhen.",
                "caption": "02 - Anschlussquerschnitt und Polklemmen gehören zur Auslegung wie die Kapazität.",
                "prio": "P1",
            },
            {
                "id": "D-03",
                "titel": "AGM und LiFePO4 nebeneinander",
                "ziel": "/camper-elektrik/agm/ - /camper-elektrik/lifepo4/",
                "zweck": "Vergleichsabsicht sachlich bedienen, ohne Produktempfehlung",
                "inhalt": "Zwei unterschiedlich große Batteriegehäuse nebeneinander auf dem Boden, beide ohne lesbare Markennamen, gleiches Licht, gleicher Abstand.",
                "ausschnitt": "3:2 quer, frontale Aufsicht, beide gleich groß im Bild",
                "fokus": "mitte",
                "requisiten": "Zwei Batterien, neutrale Unterlage, Abdeckungen",
                "alt": "Zwei unterschiedlich große 12-V-Batteriegehäuse stehen nebeneinander auf neutralem Untergrund.",
                "caption": "03 - Bauform und Gewicht unterscheiden sich. Welche Chemie passt, entscheidet der Bedarf, nicht das Foto.",
                "prio": "P1",
            },
            {
                "id": "D-04",
                "titel": "Batterie-Hauptschalter",
                "ziel": "/camper-elektrik/batterie/ - /camper-elektrik/schaltplan/",
                "zweck": "Trennbarkeit der Anlage",
                "inhalt": "Dreh- oder Kippschalter in Griffnähe, dicke Leitung dahinter, Schalterstellung eindeutig erkennbar.",
                "ausschnitt": "3:2 quer, halbnah, Bedienrichtung bleibt erkennbar",
                "fokus": "links",
                "requisiten": "Hauptschalter, dicke Leitung, Holzumgebung",
                "alt": "Batterie-Hauptschalter mit dicker Plusleitung in einem Camper-Schrank.",
                "caption": "04 - Trennbarkeit ist Teil des Plans, keine nachträgliche Zugabe.",
                "prio": "P2",
            },
            {
                "id": "D-05",
                "titel": "Shunt und Batteriemonitor",
                "ziel": "/camper-elektrik/stromverbrauch/",
                "zweck": "Verbrauch messen statt schätzen",
                "inhalt": "Shunt in der Minusleitung, dünne Messleitung zum Anzeigegerät. Display abgewandt oder ohne lesbare Werte.",
                "ausschnitt": "3:2 quer, Schärfe auf dem Shunt",
                "fokus": "mitte",
                "requisiten": "Shunt, Minusleitung, Messleitung, Anzeigegerät",
                "alt": "Shunt in der Minusleitung einer 12-V-Anlage mit abgehender Messleitung.",
                "caption": "05 - Verbrauch wird gemessen. Die Verbrauchsliste im Planer ist eine Eingabe, keine Messung.",
                "prio": "P2",
            },
            {
                "id": "D-06",
                "titel": "Ladebooster eingebaut",
                "ziel": "/camper-elektrik/ladebooster/",
                "zweck": "Laden während der Fahrt, Kabelwege sichtbar",
                "inhalt": "Kompaktes Ladegerät verschraubt, zwei dicke Leitungen zur Starter- und Versorgerbatterie, Kühlrippen im Streiflicht.",
                "ausschnitt": "3:2 quer, leicht schräg, beide Abgänge im Bild",
                "fokus": "mitte",
                "requisiten": "Ladebooster ohne lesbares Logo, dicke Leitungen, Schrauben",
                "alt": "Eingebauter Ladebooster mit zwei dicken Leitungen im Camper-Innenraum.",
                "caption": "06 - Zwei Batterien, ein Ladestrom, zwei Leitungswege. Beide werden einzeln ausgelegt.",
                "prio": "P1",
            },
            {
                "id": "D-07",
                "titel": "Ladevorgang am Fahrzeug",
                "ziel": "/camper-elektrik/laden/",
                "zweck": "Landstrom/Laden als Alltagssituation",
                "inhalt": "Ladekabel vom Fahrzeug zur Steckdose, ordentlich verlegt, kein Kabelgewirr, keine Person im Bild.",
                "ausschnitt": "3:2 quer, weiter Winkel, Tageslicht",
                "fokus": "rechts",
                "requisiten": "Ladekabel, Steckdose, Fahrzeugausschnitt ohne Kennzeichen",
                "alt": "Ladekabel verbindet ein Wohnmobil mit einer Steckdose an der Hauswand.",
                "caption": "07 - Laden ist ein Betriebszustand, kein eigenes Kapitel.",
                "prio": "P2",
            },
        ],
    },
    {
        "key": "E",
        "title": "Solar und Dach",
        "note": "Dachmotive bei bedecktem Himmel: harte Sonne erzeugt Spiegelungen und ausgefressene Kanten.",
        "defaults": {
            "optik": "35 mm, f/8, Polarisationsfilter nur gegen Spiegelung, nicht für dramatischen Himmel",
            "licht": "Bedeckter Himmel oder später Nachmittag, nie direkte Mittagssonne",
        },
        "motifs": [
            {
                "id": "E-01",
                "titel": "Solarpanel wird ausgerichtet",
                "ziel": "/rechner/solaranlage/ - /tools/dach/",
                "zweck": "Fläche und Montage statt Symbol",
                "inhalt": "Zwei Hände richten ein Schwarzrahmen-Panel auf dem Dachträger aus, zweites Panel und ein aufgerolltes Kabel im Hintergrund.",
                "ausschnitt": "3:2 quer, leicht von unten, viel Himmel, Horizont nicht durch Gesichter schneiden",
                "fokus": "mitte",
                "requisiten": "Solarpanel, Dachträger, Aluschienen, Kabel",
                "alt": "Zwei Hände richten ein Solarpanel auf dem Dachträger eines Wohnmobils aus.",
                "caption": "01 - Verfügbare Dachfläche begrenzt die Modulzahl, bevor die Ertragsrechnung beginnt.",
                "prio": "P0",
            },
            {
                "id": "E-02",
                "titel": "Dachaufsicht mit Panels und Dachluke",
                "ziel": "/tools/dach/",
                "zweck": "Belegung und Abstände nachvollziehbar",
                "inhalt": "Von oben auf das Fahrzeugdach: zwei Panels, eine Dachluke, freie Restflächen, keine Personen.",
                "ausschnitt": "3:2 quer, senkrecht von oben (Leiter oder benachbarte Etage), ruhiger Rahmen",
                "fokus": "mitte",
                "requisiten": "Fahrzeug, zwei Panels, Dachluke, sicherer Standpunkt",
                "alt": "Aufsicht auf ein Wohnmobildach mit zwei Solarpanelen und einer Dachluke.",
                "caption": "02 - Belegung ist Geometrie. Der Dach-Planer rechnet mit genau diesen Flächen.",
                "prio": "P1",
            },
            {
                "id": "E-03",
                "titel": "MC4-Stecker und Solarkabel",
                "ziel": "/camper-elektrik/solar/ - /camper-elektrik/mppt/",
                "zweck": "Übergang vom Modul zum Laderegler",
                "inhalt": "Zwei MC4-Stecker kurz vor dem Zusammenstecken, schwarzes Solarkabel, matte Unterlage.",
                "ausschnitt": "3:2 quer, Makro, Schärfe auf den Steckergesichtern",
                "fokus": "mitte",
                "requisiten": "MC4-Stecker, Solarkabel, Unterlage",
                "alt": "Zwei MC4-Stecker an schwarzen Solarkabeln kurz vor dem Verbinden.",
                "caption": "03 - Steckverbindungen sind Teil der Leitungslänge und des Übergangswiderstands.",
                "prio": "P2",
            },
            {
                "id": "E-04",
                "titel": "MPPT-Laderegler eingebaut",
                "ziel": "/camper-elektrik/mppt/",
                "zweck": "Regler zwischen Modul und Batterie",
                "inhalt": "Laderegler an einer Holzplatte verschraubt, Solarkabel von oben, Batteriekabel nach unten, Kühlrippen erkennbar.",
                "ausschnitt": "3:2 quer, frontal, beide Kabelrichtungen im Bild",
                "fokus": "mitte",
                "requisiten": "MPPT-Regler ohne Logo, Solarkabel, Batteriekabel, Holzplatte",
                "alt": "Eingebauter MPPT-Laderegler mit Solar- und Batterieleitungen an einer Holzplatte.",
                "caption": "04 - Zwei Leitungswege, zwei Auslegungen. Der Regler verbindet sie, ersetzt sie nicht.",
                "prio": "P1",
            },
            {
                "id": "E-05",
                "titel": "Dachdurchführung",
                "ziel": "/camper-elektrik/solar/",
                "zweck": "Abdichtung und Kabelweg nach innen",
                "inhalt": "Kabeldurchführung auf dem Dach mit zwei austretenden Solarkabeln, Dichtmasse sauber, aber nicht frisch poliert.",
                "ausschnitt": "3:2 quer, halbnah, Streiflicht auf der Dichtkante",
                "fokus": "mitte",
                "requisiten": "Dachdurchführung, Solarkabel, Dichtmasse",
                "alt": "Dachdurchführung mit zwei austretenden Solarkabeln auf einem Wohnmobildach.",
                "caption": "05 - Jede Durchführung ist ein Übergabepunkt zwischen Dachplan und Schaltplan.",
                "prio": "P2",
            },
            {
                "id": "E-06",
                "titel": "Teilverschattung auf dem Panel",
                "ziel": "/camper-elektrik/solar/",
                "zweck": "Ertragsminderung sachlich zeigen",
                "inhalt": "Schattenstreifen eines Astes oder einer Dachluke liegt über einem Teil der Modulfläche, bedeckter Himmel, keine dramatische Stimmung.",
                "ausschnitt": "3:2 quer, Modul füllt das Bild, Schatten klar abgrenzbar",
                "fokus": "mitte",
                "requisiten": "Solarpanel, Ast oder Dachluke als Schattengeber",
                "alt": "Schattenstreifen liegt über einem Teil der Fläche eines Solarpanels.",
                "caption": "06 - Teilverschattung trifft nicht das ganze Modul gleich. Die Auslegung nennt die Annahme dazu.",
                "prio": "P2",
            },
        ],
    },
    {
        "key": "F",
        "title": "230 V, Wechselrichter, Sicherheit",
        "note": "Keine Warnsymbolik, keine rot leuchtenden Pfeile. Sachlichkeit ist hier besonders wichtig.",
        "defaults": {
            "optik": "35 mm, f/5.6, Stativ, ruhige Kamera",
            "licht": "Tageslicht plus dezente Aufhellung, keine harten Schlagschatten",
        },
        "motifs": [
            {
                "id": "F-01",
                "titel": "Wechselrichter im Schrank",
                "ziel": "/camper-elektrik/wechselrichter/",
                "zweck": "12 V zu 230 V, Einbausituation",
                "inhalt": "Wechselrichter auf Holzplatte, dicke 12-V-Leitungen links, 230-V-Leitung rechts, getrennt geführt.",
                "ausschnitt": "3:2 quer, leicht schräg, beide Leitungsarten erkennbar",
                "fokus": "mitte",
                "requisiten": "Wechselrichter ohne Logo, 12-V- und 230-V-Leitungen, Holzplatte",
                "alt": "Wechselrichter im Camper-Schrank mit getrennt geführten 12-V- und 230-V-Leitungen.",
                "caption": "01 - Zwei Spannungsebenen, getrennte Verlegewege, eine Auslegung je Leitung.",
                "prio": "P0",
            },
            {
                "id": "F-02",
                "titel": "FI/RCD in der Verteilung",
                "ziel": "/camper-elektrik/230v/",
                "zweck": "Schutzeinrichtung sachlich zeigen",
                "inhalt": "Fehlerstromschutzschalter in einer kleinen 230-V-Verteilung, Prüftaste erkennbar, keine lesbaren Herstellerangaben.",
                "ausschnitt": "3:2 quer, frontal, Schärfe auf der Front",
                "fokus": "mitte",
                "requisiten": "FI/RCD, Kleinverteilung, 230-V-Leitungen",
                "alt": "Fehlerstromschutzschalter in einer 230-V-Kleinverteilung eines Wohnmobils.",
                "caption": "02 - 230-V-Anlagen sind abnahmepflichtig. Das steht im Text, nicht als Warnsymbol im Bild.",
                "prio": "P0",
            },
            {
                "id": "F-03",
                "titel": "Landstromeinspeisung außen",
                "ziel": "/camper-elektrik/230v/",
                "zweck": "Übergabepunkt von außen",
                "inhalt": "CEE-Einspeisung an der Fahrzeugaußenwand, Klappe geöffnet, kein Kennzeichen und keine Markenembleme im Ausschnitt.",
                "ausschnitt": "3:2 quer, halbnah, Fahrzeugkante als ruhige Linie",
                "fokus": "links",
                "requisiten": "CEE-Einspeisung, Klappe, Fahrzeugausschnitt",
                "alt": "Geöffnete CEE-Landstromeinspeisung an der Außenwand eines Wohnmobils.",
                "caption": "03 - Der Übergabepunkt gehört in den Plan, bevor über Innenverteilung gesprochen wird.",
                "prio": "P1",
            },
            {
                "id": "F-04",
                "titel": "Steckdose im Innenraum",
                "ziel": "/camper-elektrik/230v/",
                "zweck": "Alltagsbezug ohne Lifestyle",
                "inhalt": "Eine eingebaute 230-V-Steckdose in einer Holzverkleidung, leicht schräg, kein Stecker eingesteckt, keine Dekoration.",
                "ausschnitt": "3:2 quer, nah, Holzmaserung bleibt erkennbar",
                "fokus": "mitte",
                "requisiten": "Einbausteckdose, Holzverkleidung",
                "alt": "230-V-Steckdose in einer Holzverkleidung im Camper-Innenraum.",
                "caption": "04 - Jede Steckdose ist ein Verbraucherpfad im Plan, kein Einzelfall.",
                "prio": "P2",
            },
            {
                "id": "F-05",
                "titel": "Getrennte Verlegewege 12 V / 230 V",
                "ziel": "/camper-elektrik/230v/ - /camper-elektrik/schaltplan/",
                "zweck": "Trennung räumlich nachvollziehbar",
                "inhalt": "Zwei getrennte Kabelkanäle mit sichtbarem Abstand auf derselben Holzfläche, rote/schwarze Adern links, 230-V-Leitung rechts.",
                "ausschnitt": "3:2 quer, von oben, Abstand bleibt messbar",
                "fokus": "mitte",
                "requisiten": "Zwei Kabelkanäle, 12-V- und 230-V-Leitung, Holzplatte",
                "alt": "Zwei getrennte Kabelkanäle mit 12-V- und 230-V-Leitungen auf einer Holzfläche.",
                "caption": "05 - Getrennte Wege sind eine Planungsentscheidung, keine kosmetische.",
                "prio": "P1",
            },
            {
                "id": "F-06",
                "titel": "Prüfung am Anschluss",
                "ziel": "/ueber-elektroplaner/ - /camper-elektrik/230v/",
                "zweck": "Transparenz und Grenzen des Werkzeugs",
                "inhalt": "Prüfgerät an einer 230-V-Verteilung, Display ohne lesbare Werte, Hände im Bild, keine Siegel oder Plaketten.",
                "ausschnitt": "3:2 quer, halbnah, ruhiges Licht",
                "fokus": "rechts",
                "requisiten": "Prüfgerät, Kleinverteilung, Messleitungen",
                "alt": "Prüfgerät wird an einer 230-V-Kleinverteilung im Wohnmobil angesetzt.",
                "caption": "06 - Das Werkzeug unterstützt die Vorbereitung. Prüfung und Abnahme bleiben separat.",
                "prio": "P1",
            },
        ],
    },
    {
        "key": "G",
        "title": "Heizung, Dämmung, Ausbau, Zulassung",
        "note": "Diese Motive bedienen die Guides und Werkzeugseiten, die laut SEO-Audit noch zu dünn sind.",
        "defaults": {
            "optik": "35 mm, f/5.6, Stativ bei Innenraum",
            "licht": "Verfügbares Tageslicht, keine Baustrahler-Farbe",
        },
        "motifs": [
            {
                "id": "G-01",
                "titel": "Dämmung vor der Verkleidung",
                "ziel": "/heizung-daemmung/ - /tools/heizung/",
                "zweck": "Heizlast hängt an der Dämmung",
                "inhalt": "Dämmmaterial zwischen Holzständern, stellenweise noch offen, keine Perfektion, kein Dekostoff.",
                "ausschnitt": "3:2 quer, weiter Winkel, Struktur des Materials erkennbar",
                "fokus": "mitte",
                "requisiten": "Dämmmaterial, Holzständer, Werkzeug",
                "alt": "Dämmmaterial zwischen Holzständern einer noch offenen Camper-Seitenwand.",
                "caption": "01 - Die Heizlastrechnung beginnt bei der Hülle, nicht beim Heizgerät.",
                "prio": "P1",
            },
            {
                "id": "G-02",
                "titel": "Standheizung mit Luftschläuchen",
                "ziel": "/heizung-daemmung/diesel-standheizung/ - /tools/heizung/",
                "zweck": "Einbausituation der Heizung",
                "inhalt": "Kompakte Standheizung unter dem Möbel, Warmluftschläuche und Abgasführung angedeutet, kein lesbares Typenschild.",
                "ausschnitt": "3:2 quer, halbnah, Schlauchverlauf bleibt erkennbar",
                "fokus": "mitte",
                "requisiten": "Standheizung, Warmluftschläuche, Schellen",
                "alt": "Eingebaute Standheizung unter einem Camper-Möbel mit angeschlossenen Warmluftschläuchen.",
                "caption": "02 - Geräteleistung und Einbaulage gehören zusammen.",
                "prio": "P1",
            },
            {
                "id": "G-03",
                "titel": "Holzausbau: Zuschnitt",
                "ziel": "/guides/holzausbau/",
                "zweck": "Möbelbau als eigener Gewerkeschritt",
                "inhalt": "Frisch zugeschnittene Multiplexplatte auf Böcken, Schnittkante scharf, Sägespäne, Winkel und Bleistift.",
                "ausschnitt": "3:2 quer, leicht schräg, Kante führt durchs Bild",
                "fokus": "rechts",
                "requisiten": "Multiplexplatte, Böcke, Winkel, Bleistift, Säge",
                "alt": "Frisch zugeschnittene Multiplexplatte auf Werkböcken mit Winkel und Sägespänen.",
                "caption": "03 - Erst das Maß, dann der Zuschnitt. Der Ausbau-Fahrplan nennt die Reihenfolge.",
                "prio": "P2",
            },
            {
                "id": "G-04",
                "titel": "Leeres Fahrzeug, Gewerke erkennbar",
                "ziel": "/guides/ausbau-fahrplan/",
                "zweck": "Reihenfolge der Gewerke räumlich zeigen",
                "inhalt": "Entkernter Innenraum mit sichtbaren Ständern, ersten Kabelwegen und noch fehlender Verkleidung. Keine beschrifteten Klebebänder.",
                "ausschnitt": "3:2 quer, weiter Winkel, Tiefe bis zur Heckklappe",
                "fokus": "mitte",
                "requisiten": "Entkerntes Fahrzeug, Holzständer, Kabelreste",
                "alt": "Entkernter Camper-Innenraum mit Holzständern und ersten verlegten Kabelwegen.",
                "caption": "04 - Was zuerst kommt, sieht man am Zustand des Fahrzeugs, nicht an einer Checkliste im Bild.",
                "prio": "P1",
            },
            {
                "id": "G-05",
                "titel": "Fahrzeug von außen ohne Kennzeichen",
                "ziel": "/wohnmobilzulassung/ - /guides/camper-ausbauguide/",
                "zweck": "Titelbild für Ratgeber- und Zulassungsseiten",
                "inhalt": "Ganzes Fahrzeug auf ruhigem Untergrund, bewölkter Himmel, keine Menschen, kein Kennzeichen, keine Markenembleme im Bild.",
                "ausschnitt": "3:2 quer, weiter Winkel, Fahrzeug leicht aus der Mitte",
                "fokus": "rechts",
                "requisiten": "Fahrzeug, ruhiger Platz ohne fremde Autos und Schilder",
                "alt": "Weißes Wohnmobil auf einem ruhigen Platz unter bedecktem Himmel.",
                "caption": "05 - Zulassungsfragen betreffen das Fahrzeug, nicht einzelne Bauteile.",
                "prio": "P1",
            },
            {
                "id": "G-06",
                "titel": "Dokumentation des Ausbaus",
                "ziel": "/camper-ausbau/ - /ueber-elektroplaner/",
                "zweck": "Nachvollziehbarkeit als Gegenstand",
                "inhalt": "Aufgeschlagener Ordner mit blanken Tabellen und einem Stift, daneben ein Kabelrest. Keine lesbare Schrift, keine Zahlen.",
                "ausschnitt": "3:2 quer, 45-Grad-Aufsicht",
                "fokus": "mitte",
                "requisiten": "Ordner mit leeren Formularen, Stift, Kabelrest",
                "alt": "Aufgeschlagener Ordner mit leeren Tabellen und einem Stift auf der Werkbank.",
                "caption": "06 - Dokumentiert wird, was man später prüfen will. Zahlen stehen im Text, nicht im Foto.",
                "prio": "P2",
            },
        ],
    },
    {
        "key": "H",
        "title": "Werkzeug, Prüfung, Vertrauen",
        "note": "Die Bilder für Methodik, Fehlerbilder und Vertrauensseite. Bewusst unaufgeregt.",
        "defaults": {
            "optik": "50 mm, f/4 bis f/5.6, Stativ",
            "licht": "Fensterlicht von links, kein Blitz, kein Farbfilter",
        },
        "motifs": [
            {
                "id": "H-01",
                "titel": "Werkzeug-Flachaufsicht",
                "ziel": "/ueber-elektroplaner/ (Vertrauensseite)",
                "zweck": "Zeigt, womit gearbeitet wird",
                "inhalt": "Crimpzange, Abisolierer, Messband, Kabelreste, blanker Zettel und ein Becher liegen nebeneinander auf einer verkratzten Werkbank.",
                "ausschnitt": "3:2 quer, senkrecht von oben, alle Gegenstände scharf",
                "fokus": "mitte",
                "requisiten": "Werkzeug, Kabelreste, blankes Papier, Becher",
                "alt": "Crimpzange, Abisolierer, Maßband und Kabelreste liegen geordnet auf einer Werkbank.",
                "caption": "01 - Werkzeug, Unterlagen, Nachweis: Die Methodikseite erklärt, wie gerechnet wird.",
                "prio": "P1",
            },
            {
                "id": "H-02",
                "titel": "Zugprobe an einer Verbindung",
                "ziel": "/camper-elektrik/fehler/",
                "zweck": "Prüfen statt vermuten",
                "inhalt": "Zwei Hände ziehen leicht an einem gecrimpten Kabelschuh, ohne ihn zu verbiegen. Sachte, keine reißerische Geste.",
                "ausschnitt": "3:2 quer, nah, Schärfe auf der Verbindungsstelle",
                "fokus": "mitte",
                "requisiten": "Gecrimpter Kabelschuh, kurzes Kabelstück",
                "alt": "Zwei Hände prüfen eine gecrimpte Kabelverbindung mit leichtem Zug.",
                "caption": "02 - Eine Verbindung wird geprüft, nicht nach Aussehen bewertet.",
                "prio": "P2",
            },
            {
                "id": "H-03",
                "titel": "Fehlerbild: gequetschte Leitung",
                "ziel": "/camper-elektrik/fehler/",
                "zweck": "Sachliches Negativbeispiel, ohne Schadenromantik",
                "inhalt": "Eine zu eng gebogene oder gequetschte Leitung auf matter Unterlage, klar erkennbar, aber nicht spektakulär inszeniert.",
                "ausschnitt": "3:2 quer, Makro, neutrales Licht",
                "fokus": "mitte",
                "requisiten": "Beschädigtes Kabelstück, matte Unterlage",
                "alt": "Nahaufnahme einer gequetschten 12-V-Leitung mit verformter Isolierung.",
                "caption": "03 - Ein Fehlerbild erklärt eine Grenze. Es ersetzt keine Prüfung und keine Normangabe.",
                "prio": "P2",
            },
            {
                "id": "H-04",
                "titel": "Rechenweg auf Papier, abstrakt",
                "ziel": "/rechner/spannungsabfall-12v/ - /rechner/batteriekapazitaet/",
                "zweck": "Rechnung als Gegenstand, ohne Text im Bild",
                "inhalt": "Handgezeichnete Kästchen, Linien und Pfeile auf blankem Papier, absichtlich ohne lesbare Ziffern oder Buchstaben, Bleistift daneben.",
                "ausschnitt": "3:2 quer, 45-Grad-Aufsicht, weiches Licht",
                "fokus": "mitte",
                "requisiten": "Papier, Bleistift, Lineal",
                "alt": "Abstrakte Handskizze mit Kästchen und Linien auf einem Blatt Papier neben einem Bleistift.",
                "caption": "04 - Formeln stehen als Text auf der Seite. Das Bild zeigt nur, dass nachgerechnet wird.",
                "prio": "P2",
            },
            {
                "id": "H-05",
                "titel": "Stückliste als blankes Objekt",
                "ziel": "/elektrik-planung/ - /planer/",
                "zweck": "Ergebnis des Planers greifbar machen",
                "inhalt": "Leere, linierte Liste auf der Werkbank, daneben ein paar sortierte Bauteile (Sicherung, Kabelschuh, Kabelbinder), keine lesbare Schrift.",
                "ausschnitt": "3:2 quer, leicht schräg von oben",
                "fokus": "links",
                "requisiten": "Blankes Formular, Sicherung, Kabelschuh, Kabelbinder",
                "alt": "Leere Materialliste liegt neben sortierten Bauteilen auf einer Werkbank.",
                "caption": "05 - Aus dem Plan entsteht eine Stückliste. Ihre Werte stehen in der Anwendung, nicht im Bild.",
                "prio": "P1",
            },
        ],
    },
]

ALL_MOTIFS = [dict(COMMON, **dict(g.get("defaults", {}), **m)) for g in GROUPS for m in g["motifs"]]

# ---------------------------------------------------------------------------
# Zusätzliche Kapitel
# ---------------------------------------------------------------------------

NO_PHOTO = [
    ("Querschnittstabelle", "/camper-elektrik/kabelquerschnitt/", "HTML-Tabelle mit caption - Zahlen bleiben Text"),
    ("Spannungsabfall-Diagramm", "/camper-elektrik/spannungsabfall/", "inline SVG, editierbar und indexierbar"),
    ("Schaltplanausschnitt", "/planer/ - /elektrik-planung/", "SVG direkt aus dem Produkt, kein Screenshot"),
    ("Batteriekurve / Entladetiefe", "/camper-elektrik/agm/", "SVG-Diagramm, Achsen als echter Text"),
    ("Vergleichstabelle LiFePO4/AGM", "/camper-elektrik/lifepo4/", "HTML-Tabelle, kein Bild"),
    ("Dachbelegungsschema", "/tools/dach/", "SVG aus dem Dach-Planer"),
    ("Heizlast-Formel", "/tools/heizung/", "formatierter Text / MathML, kein Rasterbild"),
    ("Ausbau-Reihenfolge", "/guides/ausbau-fahrplan/", "nummerierte HTML-Liste"),
]

OG_LAYOUTS = [
    ("OG-01", "Pillar /camper-elektrik/", "A-02", "Text links auf Papierfläche, Foto rechts 55 %"),
    ("OG-02", "Cluster Kabelquerschnitt", "B-03", "Foto 60 % links, eine Zeile Text rechts"),
    ("OG-03", "Rechner Batteriekapazitaet", "D-01", "Foto unten, oben eine Zeile, viel Ruhe"),
    ("OG-04", "Rechner Solaranlage", "E-01", "Foto als Streifen, Text darüber"),
    ("OG-05", "Cluster 230 V", "F-02", "Foto rechts, links eine Zeile"),
    ("OG-06", "Vertrauen /ueber-elektroplaner/", "A-05", "Plan-Foto als ganzflächiger Hintergrund, Text in ruhiger Ecke"),
]

PAGE_MAP = [
    ("/", "A-01, A-02"),
    ("/camper-elektrik/", "A-02, A-03, B-05"),
    ("/camper-elektrik/kabelquerschnitt/", "B-01, B-03, B-07"),
    ("/camper-elektrik/spannungsabfall/", "B-05, B-06"),
    ("/camper-elektrik/sicherungen/", "C-01, C-04, C-07"),
    ("/camper-elektrik/schaltplan/", "A-05, B-08, C-05, C-06"),
    ("/camper-elektrik/batterie/", "D-01, D-04"),
    ("/camper-elektrik/lifepo4/", "D-02, D-03"),
    ("/camper-elektrik/agm/", "D-03"),
    ("/camper-elektrik/ladebooster/", "D-06"),
    ("/camper-elektrik/laden/", "D-07"),
    ("/camper-elektrik/stromverbrauch/", "D-05"),
    ("/camper-elektrik/solar/", "E-03, E-05, E-06"),
    ("/camper-elektrik/mppt/", "E-04"),
    ("/camper-elektrik/wechselrichter/", "F-01"),
    ("/camper-elektrik/230v/", "F-02, F-03, F-04, F-05"),
    ("/camper-elektrik/fehler/", "H-02, H-03"),
    ("/rechner/", "A-04"),
    ("/rechner/spannungsabfall-12v/", "B-06, H-04"),
    ("/rechner/batteriekapazitaet/", "D-01, H-04"),
    ("/rechner/solaranlage/", "E-01"),
    ("/tools/dach/", "E-01, E-02"),
    ("/tools/heizung/", "G-01, G-02"),
    ("/heizung-daemmung/", "G-01"),
    ("/heizung-daemmung/diesel-standheizung/", "G-02"),
    ("/guides/ausbau-fahrplan/", "G-04"),
    ("/guides/holzausbau/", "G-03"),
    ("/guides/camper-ausbauguide/", "G-05"),
    ("/wohnmobilzulassung/", "G-05"),
    ("/camper-ausbau/", "G-06"),
    ("/elektrik-planung/ - /planer/", "H-05"),
    ("/ueber-elektroplaner/", "A-05, H-01, F-06"),
    ("/ueber-12v-planer/", "A-05, H-01"),
]

SHOOT_PLAN = [
    (
        "Block 1 - Werkbank / Innenraum (ca. 2 h)",
        "A-01, A-04, A-05, B-01 bis B-04, B-07, C-01 bis C-03, C-07, H-01, H-04, H-05",
        "Lichtunabhängig, mit Stativ und ruhiger Unterlage. Zuerst alle Makros, solange die Werkbank noch leer ist.",
    ),
    (
        "Block 2 - Einbau im Fahrzeug (ca. 2 h)",
        "A-02, A-03, B-05, B-08, C-04 bis C-06, D-01 bis D-06, F-01 bis F-06, G-01, G-02, G-04, H-02, H-03",
        "Tageslicht, Türen auf. Erst die weiten Bilder, dann die Details - so bleibt die Reihenfolge der Gewerke glaubwürdig.",
    ),
    (
        "Block 3 - Dach / außen (ca. 1 h)",
        "E-01 bis E-06, G-05, D-07",
        "Bedeckter Himmel ist Pflicht. Leiter sichern, keine fremden Fahrzeuge, Kennzeichen und Markenembleme aus dem Ausschnitt.",
    ),
    (
        "Block 4 - Reserve (ca. 1 h)",
        "Varianten B/C, Nachschüsse, OG-Ausschnitte",
        "Für jedes P0-Motiv zusätzlich einen Hochformat-Ausschnitt (4:5) und ein Detail (4:3) anfertigen.",
    ),
]

CHECKLIST_PREP = [
    "Kamera, zwei Objektive (35 mm + 50 mm/Makro), Stativ, Fernauslöser, Ersatzakku, Speicherkarten",
    "Weißer Karton als Aufheller, mattes Holzbrett als Unterlage, Microfasertuch, Klebeband (nicht im Bild)",
    "Abdeckband für Typenschilder, Logos und Displays; Ersatz für blanke Kabelmarker",
    "Ausdruck des Schaltplans ohne Text, leere Formulare, leerer Ordner",
    "Requisiten nach Block sortieren, Kabelreste in mehreren Stärken bereitlegen",
    "Motivliste ausdrucken; pro Motiv die Kästchen am Seitenende abhaken",
    "Wetter: bedeckter Himmel für Block 3 einplanen, Sonne = Block 1 und 2",
]

CHECKLIST_SHOOT = [
    "RAW + JPEG, sRGB, feste Farbtemperatur (nicht Auto-Weißabgleich pro Bild wechseln)",
    "Pro Motiv mindestens 5 Aufnahmen: eine Weite, zwei Varianten, ein Detail, eine Reserve",
    "Nach jedem Motiv kurz prüfen: Schärfe auf dem Hauptmotiv, kein Text/Logo/Kennzeichen im Bild",
    "Hände nur mit Einverständnis; Gesichter und Kennzeichen grundsätzlich nicht",
    "Keine nachträglichen Text-Overlays, keine Wasserzeichen, keine KI-Nachbearbeitung",
    "Kabel nicht extra neu verlegen, nur für die Aufnahme - der Zustand soll echt bleiben",
]

CHECKLIST_DELIVERY = [
    "Sichtung: pro Motiv eine A-Variante auswählen, B/C ablegen",
    "IPTC: Urheber, Rechteinhaber, Aufnahmedatum, Freigabe - jede Zeile in BILDRECHTE.md eintragen",
    "Export: 1200 px AVIF + 640 px AVIF + JPEG-Fallback, längere Kante >= 2400 px im Master",
    "Dateinamen nach Muster: <motiv-id>-<kurzname>-1200.avif (kleingeschrieben, kebab-case)",
    "Alt-Text und Bildunterschrift je Motiv in die Seite übernehmen, beide aus diesem Katalog",
    "Breite und Höhe im HTML setzen, Bildunterschrift als figcaption, ImageObject und Sitemap ergänzen",
    "Budgets prüfen: Hero <= 60 KB AVIF, Summe <= 250 KB AVIF je Seite",
]

RELEASE_FORM = [
    "Einverständniserklärung (Vorlage - vom Betreiber vor dem Dreh ausfüllen)",
    "",
    "Ich, ____________________________, bin damit einverstanden, dass Aufnahmen von meinen Händen",
    "bzw. von mir bei Arbeiten am Fahrzeug für die Website 12v-planer.de sowie für zugehörige",
    "Anzeigen (SEA) und Social-Media-Ausschnitte verwendet werden.",
    "",
    "Ort, Datum: ____________________    Unterschrift: ____________________",
    "",
    "Hinweis: Gesichter und Kennzeichen werden nicht abgebildet. Ein Widerruf ist jederzeit",
    "möglich; betroffene Bilder werden dann aus der Auslieferung entfernt.",
]

# ---------------------------------------------------------------------------
# Markdown-Ausgabe
# ---------------------------------------------------------------------------


def md_card(m: dict) -> str:
    rows = [
        ("Zielseite", m["ziel"]),
        ("Zweck", m["zweck"]),
        ("Bildinhalt", m["inhalt"]),
        ("Ausschnitt", m["ausschnitt"]),
        ("Fokus", m["fokus"]),
        ("Objektiv", m["optik"]),
        ("Licht", m["licht"]),
        ("Requisiten", m["requisiten"]),
        ("Personen", m["person"]),
        ("Varianten", m["varianten"]),
        ("Alt-Text", m["alt"]),
        ("Bildunterschrift", m["caption"]),
        ("Vermeiden", m["vermeiden"]),
        ("Abnahme", m["abnahme"]),
    ]
    lines = [f"### {m['id']} - {m['titel']} ({m['prio']})", "", "| Feld | Vorgabe |", "| --- | --- |"]
    lines += [f"| {k} | {v} |" for k, v in rows]
    lines += ["", f"- [ ] aufgenommen - [ ] Rechte geklärt - [ ] Alt/Caption - [ ] exportiert (Status: {m['id']})", ""]
    return "\n".join(lines)


def build_markdown() -> str:
    out: list[str] = [
        "# Fotomotiv-Katalog 2026-11 - Eigenaufnahmen für 12V-Planer",
        "",
        "_Stand 2026-11-02 · Ergänzung zu `DESIGN-KONZEPT-2026-11.md` §4 · Gegenstück: `BILDRECHTE.md`_",
        "",
        f"**{len(ALL_MOTIFS)} Fotomotive** in {len(GROUPS)} Gruppen, jedes mit Zielseite, Bildausschnitt,",
        "Licht, Requisiten, Alt-Text, Bildunterschrift und Abnahmekriterien. Dazu OG-Layouts,",
        "Drehplan, Checklisten und eine Statusliste. Die PDF ist die Druckfassung für den Dreh.",
        "",
        "## So benutzt du den Katalog",
        "",
        "1. Vor dem Dreh: Ausrüstung, Bildsprache und Recht lesen, Requisiten nach Blöcken sortieren.",
        "2. Beim Dreh: eine Seite pro Motiv, Kästchen am Seitenende abhaken.",
        "3. Nach dem Dreh: Sichtung, Rechte in `BILDRECHTE.md`, Export, Alt-Texte in die Seiten.",
        "4. P0 zuerst. Ohne A-01, B-01, B-03, C-01, C-04, D-01, E-01, F-01, F-02 bleibt die",
        "   Leitidee (Plan und Foto tragen dieselbe Nummer) unsichtbar.",
        "",
        "## Bildsprache - zehn Gebote",
        "",
        "1. Verfügbares Licht, kein Blitz, kein Studio, kein Sonnenuntergang.",
        "2. Hände, Material, Werkzeug. Keine Gesichter, kein Blick in die Kamera.",
        "3. Gebrauchsspuren bleiben: Staub, Kratzer, leicht schiefer Horizont.",
        "4. 35 mm / 50 mm, f/4 bis f/8, leichte Körnung ist erlaubt.",
        "5. Kein Text, kein Logo, kein lesbarer Markenname, kein Kennzeichen im Bild.",
        "6. Kein Duotone, kein HDR, kein Cinematic-Grade, keine künstliche Tiefenunschärfe.",
        "7. Keine KI-generierten Bilder in der Auslieferung - du fotografierst selbst.",
        "8. Bilder sind Belege, keine Dekoration: jedes Motiv hat eine Zielseite und eine Aussage.",
        "9. Zahlen, Formeln und Tabellen gehören in HTML, nie ins Foto.",
        "10. Ein Bild pro Aussage. Lieber ein zweites Detail als ein überladenes Hauptmotiv.",
        "",
        "## Technische Abnahme (gilt für jedes Motiv)",
        "",
        "- Master: RAW, lange Kante >= 2400 px, sRGB, feste Farbtemperatur, ohne GPS in den EXIF.",
        "- Auslieferung: `<name>-640.avif`, `<name>-1200.avif`, `<name>.jpg` als Fallback.",
        "- HTML: feste `width`/`height`, `srcset`/`sizes`, Hero `fetchpriority=\"high\"` und Preload,",
        "  alle anderen `loading=\"lazy\"` und `decoding=\"async\"`.",
        "- Hero <= 60 KB AVIF, Summe <= 250 KB AVIF je Seite, CLS = 0.",
        "- Jedes Bild: beschreibender Alt-Text, `<figcaption>` mit einer Aussage und internem Verweis,",
        "  `ImageObject` in JSON-LD, `images`-Eintrag in `app/sitemap.ts`, `og:image:alt`.",
        "- CSP lässt nur `'self'` zu: keine Hotlinks, alle Dateien unter `public/bilder/`.",
        "",
        "## Master-Shotliste",
        "",
        "| ID | Motiv | Zielseite | Prio | Status |",
        "| --- | --- | --- | --- | --- |",
    ]
    for m in ALL_MOTIFS:
        out.append(f"| {m['id']} | {m['titel']} | {m['ziel'].split(' - ')[0]} | {m['prio']} | [ ] |")
    out += ["", "## Motive", ""]
    for g in GROUPS:
        out += [f"### Gruppe {g['key']} - {g['title']}", "", g["note"], ""]
        for m in g["motifs"]:
            full = dict(COMMON, **dict(g.get("defaults", {}), **m))
            out.append(md_card(full))
    out += [
        "## Zuordnung Seite zu Motiv",
        "",
        "| Seite | Motive |",
        "| --- | --- |",
    ]
    out += [f"| {p} | {ids} |" for p, ids in PAGE_MAP]
    out += [
        "",
        "## OG-Karten (1200 x 630) - keine neuen Motive nötig",
        "",
        "Einzige Ausnahme von der Regel 'kein Text im Bild': Hier ist Text erlaubt und erwünscht.",
        "",
        "| Layout | Ziel | Basismotiv | Aufteilung |",
        "| --- | --- | --- | --- |",
    ]
    out += [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in OG_LAYOUTS]
    out += [
        "",
        "## Was du NICHT fotografieren musst (HTML/SVG statt Bild)",
        "",
        "| Element | Seite | Umsetzung |",
        "| --- | --- | --- |",
    ]
    out += [f"| {a} | {b} | {c} |" for a, b, c in NO_PHOTO]
    out += ["", "## Drehplan", ""]
    for title, ids, note in SHOOT_PLAN:
        out += [f"### {title}", "", f"Motive: {ids}", "", note, ""]
    out += ["## Checklisten", "", "### Vorbereitung", ""]
    out += [f"- [ ] {x}" for x in CHECKLIST_PREP]
    out += ["", "### Vor Ort", ""]
    out += [f"- [ ] {x}" for x in CHECKLIST_SHOOT]
    out += ["", "### Übergabe", ""]
    out += [f"- [ ] {x}" for x in CHECKLIST_DELIVERY]
    out += ["", "## Vorlage: Einverständniserklärung", "", "```"]
    out += RELEASE_FORM
    out += ["```", "", "## Statusliste zum Abhaken", "", "| ID | aufgenommen | Rechte | Alt/Caption | exportiert |", "| --- | --- | --- | --- | --- |"]
    for m in ALL_MOTIFS:
        out.append(f"| {m['id']} | [ ] | [ ] | [ ] | [ ] |")
    out += [
        "",
        "## Offene Entscheidungen",
        "",
        "- Wer fotografiert, wer ist Rechteinhaber, wer unterschreibt die Einverständniserklärung?",
        "- Welches Fahrzeug wird abgebildet (Kennzeichen und Markenembleme aus dem Ausschnitt)?",
        "- Wer füllt `lib/siteLegal.ts` und die Datenschutzerklärung aus (P0-Blocker für SEA)?",
        "",
        "_Kein Ranking-Versprechen. Bilder verbessern die Nachprüfbarkeit, keine Position._",
        "",
    ]
    return "\n".join(out)


# ---------------------------------------------------------------------------
# PDF-Ausgabe
# ---------------------------------------------------------------------------

S_TITLE = ParagraphStyle("T", fontName="Helvetica-Bold", fontSize=22, leading=27, textColor=INK, spaceAfter=10)
S_SUB = ParagraphStyle("S", fontName="Helvetica", fontSize=11, leading=16, textColor=INK2, spaceAfter=8)
S_H1 = ParagraphStyle("H1", fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=OXIDE, spaceBefore=14, spaceAfter=8)
S_H2 = ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=INK, spaceBefore=10, spaceAfter=5)
S_BODY = ParagraphStyle("B", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK, alignment=TA_LEFT, spaceAfter=6)
S_SMALL = ParagraphStyle("SM", fontName="Helvetica", fontSize=8.2, leading=11, textColor=INK2)
S_LABEL = ParagraphStyle("L", fontName="Helvetica-Bold", fontSize=8.2, leading=11, textColor=INK3)
S_CELL = ParagraphStyle("C", fontName="Helvetica", fontSize=8.2, leading=10.8, textColor=INK)
S_MONO = ParagraphStyle("M", fontName="Courier", fontSize=8, leading=11, textColor=INK)
S_COVER = ParagraphStyle("CV", fontName="Helvetica-Bold", fontSize=26, leading=32, textColor=INK)
S_COVERSUB = ParagraphStyle("CVS", fontName="Helvetica", fontSize=13, leading=19, textColor=INK2)
S_ID = ParagraphStyle("ID", fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=OXIDE)


def P(text: str, style=S_BODY) -> Paragraph:
    return Paragraph(xml_escape(str(text)), style)


def rule(color=RULE, width=0.7):
    t = Table([[""]], colWidths=[CONTENT_W], rowHeights=[max(1.5, width)])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), color),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return t


def kv_table(rows, label_w=88):
    data = [[P(k, S_LABEL), P(v, S_CELL)] for k, v in rows]
    t = Table(data, colWidths=[label_w, CONTENT_W - label_w])
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -2), 0.35, RULE),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return t


def grid_table(head, rows, widths):
    data = [[P(h, S_LABEL) for h in head]] + [[P(c, S_CELL) for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PANEL),
                ("LINEBELOW", (0, 0), (-1, 0), 0.8, OXIDE),
                ("LINEBELOW", (0, 1), (-1, -1), 0.35, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return t


def sketch(fokus: str) -> Drawing:
    """Kleine Kadrierskizze: 3:2-Rahmen, markierter Fokusbereich, Freiraum."""
    d = Drawing(CONTENT_W, 96)
    fw, fh = 158, 105  # annähernd 3:2
    fx, fy = 12, 4
    d.add(Rect(fx, fy, fw, fh, fillColor=BOX, strokeColor=INK2, strokeWidth=0.8))
    inner_w, inner_h = 52, 40
    pos = {
        "links": (fx + 8, fy + (fh - inner_h) / 2),
        "mitte": (fx + (fw - inner_w) / 2, fy + (fh - inner_h) / 2),
        "rechts": (fx + fw - inner_w - 8, fy + (fh - inner_h) / 2),
        "oben": (fx + (fw - inner_w) / 2, fy + fh - inner_h - 8),
        "unten": (fx + (fw - inner_w) / 2, fy + 8),
    }.get(fokus, (fx + (fw - inner_w) / 2, fy + (fh - inner_h) / 2))
    d.add(
        Rect(
            pos[0],
            pos[1],
            inner_w,
            inner_h,
            fillColor=None,
            strokeColor=OXIDE,
            strokeWidth=1.2,
            strokeDashArray=[3, 2],
        )
    )
    d.add(Line(fx + 4, fy + fh / 2, fx + fw - 4, fy + fh / 2, strokeColor=RULE, strokeWidth=0.4, strokeDashArray=[2, 3]))
    d.add(Line(fx + fw / 2, fy + 4, fx + fw / 2, fy + fh - 4, strokeColor=RULE, strokeWidth=0.4, strokeDashArray=[2, 3]))
    d.add(String(fx + fw + 14, 76, "3:2  -  Rahmen", fontName="Helvetica-Bold", fontSize=8.5, fillColor=INK))
    d.add(String(fx + fw + 14, 62, f"Fokus: {fokus}", fontName="Helvetica", fontSize=8, fillColor=OXIDE))
    opposite = {"links": "rechts", "rechts": "links", "oben": "unten", "unten": "oben"}.get(fokus, "Rand")
    d.add(String(fx + fw + 14, 48, f"Freiraum: {opposite}", fontName="Helvetica", fontSize=8, fillColor=INK2))
    d.add(String(fx + fw + 14, 34, "Gestrichelt = Schärfezone", fontName="Helvetica", fontSize=7.5, fillColor=INK3))
    d.add(String(fx + fw + 14, 20, "Nicht beschriften.", fontName="Helvetica", fontSize=7.5, fillColor=INK3))
    return d


def motif_page(m: dict, group_title: str) -> list:
    out = [
        P(f"{m['id']}  -  {m['titel']}", S_ID),
        P(f"Gruppe: {group_title}    |    Priorität: {m['prio']}    |    Status: [ ] aufgenommen", S_SMALL),
        rule(OXIDE, 1.1),
        Spacer(1, 6),
    ]
    head = grid_table(
        ["Zielseite", "Zweck im Text", "Priorität"],
        [[m["ziel"], m["zweck"], m["prio"]]],
        [CONTENT_W * 0.42, CONTENT_W * 0.45, CONTENT_W * 0.13],
    )
    out += [head, Spacer(1, 8), P("Kadrierung", S_H2), sketch(m["fokus"]), Spacer(1, 4)]
    out += [
        kv_table(
            [
                ("Bildinhalt", m["inhalt"]),
                ("Ausschnitt", m["ausschnitt"]),
                ("Objektiv", m["optik"]),
                ("Licht", m["licht"]),
                ("Requisiten", m["requisiten"]),
                ("Personen", m["person"]),
                ("Varianten", m["varianten"]),
                ("Vermeiden", m["vermeiden"]),
                ("Abnahme", m["abnahme"]),
            ]
        ),
        Spacer(1, 8),
        P("Texte für die Seite (1:1 übernehmen)", S_H2),
        kv_table([("Alt-Text", m["alt"]), ("Bildunterschrift", m["caption"])], label_w=88),
        Spacer(1, 8),
        P("Notizen / Abhaken", S_H2),
        grid_table(
            ["Aufgenommen", "Rechte geklärt", "Alt + Caption", "Exportiert", "In Seite"],
            [["[ ]", "[ ]", "[ ]", "[ ]", "[ ]"]],
            [CONTENT_W / 5] * 5,
        ),
        Spacer(1, 6),
    ]
    notes = Table([[P(" ", S_SMALL)] for _ in range(3)], colWidths=[CONTENT_W], rowHeights=[15] * 3)
    notes.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.35, RULE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    out += [notes]
    return out


def build_pdf() -> int:
    doc = BaseDocTemplate(
        PDF_PATH,
        pagesize=A4,
        leftMargin=45,
        rightMargin=45,
        topMargin=52,
        bottomMargin=44,
        title="Fotomotiv-Katalog 2026-11 - 12V-Planer",
        author="12V-Planer - Camp",
        subject="Motivliste für eigene Werkstatt-Fotografie",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    state = {"pages": 0}

    def on_page(canvas, doc_):
        state["pages"] = max(state["pages"], canvas.getPageNumber())
        canvas.saveState()
        if canvas.getPageNumber() > 1:
            canvas.setFont("Helvetica", 7.5)
            canvas.setFillColor(INK3)
            canvas.drawString(45, A4[1] - 34, "12V-Planer  -  Fotomotiv-Katalog 2026-11  -  Eigenaufnahmen")
            canvas.drawRightString(A4[0] - 45, A4[1] - 34, f"Seite {canvas.getPageNumber()}")
            canvas.setStrokeColor(RULE)
            canvas.setLineWidth(0.5)
            canvas.line(45, A4[1] - 40, A4[0] - 45, A4[1] - 40)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(INK3)
        canvas.drawString(45, 28, "Konzept 2026-11 - Gegenstück: DESIGN-KONZEPT-2026-11.md / BILDRECHTE.md")
        canvas.drawRightString(A4[0] - 45, 28, "Keine KI-Bilder in der Auslieferung")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])

    story: list = []

    # --- Umschlag ---
    story += [
        Spacer(1, 60),
        P("Fotomotiv-Katalog", S_COVER),
        P("12V-Planer - Designkonzept 2026-11 'Werkstattprotokoll'", S_COVERSUB),
        Spacer(1, 14),
        rule(OXIDE, 1.4),
        Spacer(1, 18),
        P(f"{len(ALL_MOTIFS)} Fotomotive in {len(GROUPS)} Gruppen - vollständige Motivliste für eigene Aufnahmen", S_BODY),
        P("Jedes Motiv: Zielseite, Zweck im Text, Bildinhalt, Kadrierung, Optik, Licht, Requisiten, Alt-Text, Bildunterschrift, Abnahme und Abhaken-Felder.", S_BODY),
        Spacer(1, 16),
        grid_table(
            ["Was", "Umfang"],
            [
                ["Fotomotive", f"{len(ALL_MOTIFS)} (davon {sum(1 for m in ALL_MOTIFS if m['prio'] == 'P0')} P0)"],
                ["Zielseiten", f"{len(PAGE_MAP)} Routen zugeordnet"],
                ["OG-Karten", f"{len(OG_LAYOUTS)} Layouts aus vorhandenen Motiven"],
                ["Keine Fotos nötig", f"{len(NO_PHOTO)} Elemente als HTML/SVG"],
                ["Drehblöcke", f"{len(SHOOT_PLAN)} Blöcke, ca. 6 Stunden plus Reserve"],
                ["Ausgabeformat", "A4, eine Seite je Motiv, druckbar"],
            ],
            [CONTENT_W * 0.35, CONTENT_W * 0.65],
        ),
        Spacer(1, 20),
        P("Stand: 2026-11-02  |  Version 1.0  |  Erstellt für den Fototermin", S_SMALL),
        P("Wichtig: Die sechs Bilder im Konzept-Prototyp sind KI-Platzhalter. Dieser Katalog ersetzt sie durch eigene Fotografie. Rechte und Freigaben gehören in BILDRECHTE.md.", S_SMALL),
        Spacer(1, 10),
        P("Kein Ranking-Versprechen. Bilder verbessern die Nachprüfbarkeit, keine Position.", S_SMALL),
        PageBreak(),
    ]

    # --- Einleitung / Inhalt ---
    story += [
        P("So benutzt du diesen Katalog", S_H1),
        P("1. Vor dem Dreh: Ausrüstung, Bildsprache und Recht lesen; Requisiten nach Blöcken sortieren.", S_BODY),
        P("2. Beim Dreh: eine Seite pro Motiv. Oben steht, wohin das Bild gehört, unten sind Kästchen zum Abhaken und Platz für Notizen.", S_BODY),
        P("3. Nach dem Dreh: Sichtung, Rechte in BILDRECHTE.md, Export als AVIF/JPEG, Alt-Texte und Bildunterschriften in die Seiten übernehmen.", S_BODY),
        P("4. P0 zuerst. Ohne A-01, B-01, B-03, C-01, C-04, D-01, E-01, F-01 und F-02 bleibt die Leitidee unsichtbar: Plan und Foto tragen dieselbe Nummer.", S_BODY),
        Spacer(1, 6),
        P("Inhalt", S_H1),
    ]
    toc = []
    for g in GROUPS:
        ids = [m["id"] for m in g["motifs"]]
        toc.append([g["key"], g["title"], str(len(ids)), f"{ids[0]} - {ids[-1]}"])
    toc += [
        ["-", "Master-Shotliste", "alle", "A-01 - H-05"],
        ["-", "Zuordnung Seite zu Motiv", str(len(PAGE_MAP)), "Routen"],
        ["-", "OG-Karten / keine Fotos nötig", str(len(OG_LAYOUTS) + len(NO_PHOTO)), "Anhang"],
        ["-", "Drehplan und Checklisten", "4", "Blöcke"],
        ["-", "Einverständnis + Statusliste", str(len(ALL_MOTIFS)), "Abhaken"],
    ]
    story += [grid_table(["Gruppe", "Thema", "Anzahl", "Bereich"], toc, [60, CONTENT_W - 250, 70, 120]), Spacer(1, 8)]
    story += [P("Hinweis zur Seitenzahl: Jedes Motiv bekommt genau eine Seite. Die PDF ist absichtlich umfangreich - sie ist Arbeitsmaterial, kein Handout.", S_SMALL), PageBreak()]

    # --- Ausrüstung / Bildsprache / Recht / Technik ---
    story += [
        P("Ausrüstung und Kameraeinstellungen", S_H1),
        kv_table(
            [
                ("Kamera", "Eine Kamera mit RAW, manuellem Modus und festem Weißabgleich. Smartphone nur als Reserve."),
                ("Objektive", "35 mm für Raum und Dach, 50 mm oder Makro für Bauteile und Verbindungen."),
                ("Blende", "f/5.6 bis f/8 bei Raumaufnahmen, f/4 bis f/5.6 bei Details - Schärfentiefe vor Bokeh."),
                ("Zeit / ISO", "1/60 s oder kürzer, ISO Auto mit Obergrenze, Stativ und Selbstauslöser gegen Verwacklung."),
                ("Licht", "Verfügbares Tageslicht. Weißer Karton als Aufheller. Kein Blitz, kein Baustrahler, keine LED-Panel-Farbe."),
                ("Unterlage", "Mattes, verkratztes Holzbrett. Kein Glossy, kein Stoff, keine Spiegelung."),
                ("Hilfsmittel", "Stativ, Fernauslöser, Wasserwaage, Microfasertuch, Abdeckband für Logos und Displays, Ersatzakku."),
            ]
        ),
        P("Bildsprache - zehn Gebote", S_H1),
    ]
    gebote = [
        "Verfügbares Licht, kein Blitz, kein Studio, kein Sonnenuntergang.",
        "Hände, Material, Werkzeug. Keine Gesichter, kein Blick in die Kamera.",
        "Gebrauchsspuren bleiben: Staub, Kratzer, leicht schiefer Horizont.",
        "35 mm / 50 mm, f/4 bis f/8, leichte Körnung ist erlaubt.",
        "Kein Text, kein Logo, kein lesbarer Markenname, kein Kennzeichen im Bild.",
        "Kein Duotone, kein HDR, kein Cinematic-Grade, keine künstliche Tiefenunschärfe.",
        "Keine KI-generierten Bilder in der Auslieferung - du fotografierst selbst.",
        "Bilder sind Belege, keine Dekoration: jedes Motiv hat eine Zielseite und eine Aussage.",
        "Zahlen, Formeln und Tabellen gehören in HTML, nie ins Foto.",
        "Ein Bild pro Aussage. Lieber ein zweites Detail als ein überladenes Hauptmotiv.",
    ]
    story += [P(f"{i:02d}.  {t}", S_BODY) for i, t in enumerate(gebote, 1)]
    story += [PageBreak(), P("Recht und Freigaben - vor dem ersten Bild klären", S_H1)]
    story += [
        kv_table(
            [
                ("Urheber", "Wer fotografiert, ist Urheber. Name und Datum je Motiv in BILDRECHTE.md eintragen."),
                ("Nutzungsrecht", "Schriftlich für Web, Anzeigen (SEA) und Bearbeitung (Zuschnitt, AVIF) festhalten."),
                ("Personen", "Sichtbare Hände brauchen eine Einverständniserklärung (Vorlage am Ende). Gesichter: nein."),
                ("Fahrzeug", "Kein Kennzeichen, keine Markenembleme, keine fremden Fahrzeuge oder Schilder im Ausschnitt."),
                ("Bauteile", "Typenschilder und Displays abdecken oder aus dem Bild drehen. Kein Hersteller wird beworben."),
                ("Hotlinking", "CSP erlaubt nur 'self'. Alle Dateien liegen lokal unter public/bilder/."),
                ("SEA", "Vor dem ersten Euro: Impressum, Datenschutz und CMP vervollständigen (lib/siteLegal.ts)."),
            ]
        ),
        P("Technische Abnahme - gilt für jedes einzelne Motiv", S_H1),
        kv_table(
            [
                ("Master", "RAW, lange Kante >= 2400 px, sRGB, feste Farbtemperatur, kein GPS in den EXIF."),
                ("Export", "<name>-640.avif, <name>-1200.avif, <name>.jpg als Fallback. Bilder sind Build-Artefakte: images.unoptimized = true."),
                ("HTML", "feste width/height, srcset/sizes, Hero mit fetchpriority='high' und Preload, alle anderen loading='lazy' und decoding='async'."),
                ("Budget", "Hero <= 60 KB AVIF, Summe <= 250 KB AVIF je Seite, CLS = 0."),
                ("Text", "Alt-Text, figcaption mit einer Aussage und internem Verweis, ImageObject, images in der Sitemap, og:image:alt."),
                ("Dateiname", "beschreibend, kleingeschrieben, kebab-case, z. B. b-03-querschnitt-vergleich-1200.avif."),
            ]
        ),
        PageBreak(),
    ]

    # --- Master-Shotliste ---
    story += [P("Master-Shotliste", S_H1), P("Alle Motive auf einen Blick. 'Status' wird beim Dreh abgehakt; die ausführliche Karte folgt auf den nächsten Seiten.", S_BODY), Spacer(1, 6)]
    master_rows = [[m["id"], m["titel"], m["ziel"].split(" - ")[0], m["prio"], "[ ]"] for m in ALL_MOTIFS]
    story += [grid_table(["ID", "Motiv", "Zielseite (erste)", "Prio", "OK"], master_rows, [48, CONTENT_W - 300, 155, 42, 35]), PageBreak()]

    # --- Motivseiten: eine Seite je Motiv ---
    for g in GROUPS:
        story += [P(f"Gruppe {g['key']} - {g['title']}", S_H1), P(g["note"], S_BODY), PageBreak()]
        for m in g["motifs"]:
            full = dict(COMMON, **dict(g.get("defaults", {}), **m))
            story += motif_page(full, g["title"])
            story += [PageBreak()]

    # --- Zuordnung, OG, keine Fotos ---
    story += [P("Zuordnung: welche Seite bekommt welches Motiv", S_H1), P("Die Route ist die Wahrheit - kein Motiv ohne Zielseite. Wo eine Seite kein Foto braucht, steht sie nicht in dieser Liste.", S_BODY), Spacer(1, 6)]
    story += [grid_table(["Seite", "Motive"], [[p, ids] for p, ids in PAGE_MAP], [CONTENT_W * 0.42, CONTENT_W * 0.58]), PageBreak()]

    story += [
        P("OG-Karten (1200 x 630)", S_H1),
        P("Einzige Ausnahme von der Regel 'kein Text im Bild': Auf Vorschaukarten ist eine Zeile Text erlaubt und erwünscht. Es entstehen keine neuen Fotomotive - jedes Layout nutzt ein vorhandenes Bild.", S_BODY),
        grid_table(["Layout", "Ziel", "Basismotiv", "Aufteilung"], [[a, b, c, d] for a, b, c, d in OG_LAYOUTS], [60, 160, 65, CONTENT_W - 285]),
        Spacer(1, 12),
        P("Was du NICHT fotografieren musst", S_H1),
        P("Tabellen, Diagramme und Pläne sind HTML oder SVG. Als Rasterbild wären sie weder indexierbar noch barrierefrei noch übersetzbar.", S_BODY),
        grid_table(["Element", "Seite", "Umsetzung"], [[a, b, c] for a, b, c in NO_PHOTO], [150, 150, CONTENT_W - 300]),
        PageBreak(),
    ]

    # --- Drehplan ---
    story += [P("Drehplan", S_H1), P("Reihenfolge nach Licht und Aufbau, nicht nach Motivnummer. Blöcke 1 und 2 sind wetterunabhängig, Block 3 braucht bedeckten Himmel.", S_BODY), Spacer(1, 6)]
    for title, ids, note in SHOOT_PLAN:
        story += [P(title, S_H2), kv_table([("Motive", ids), ("Vorgehen", note)]), Spacer(1, 6)]
    story += [PageBreak()]

    # --- Checklisten ---
    story += [P("Checklisten", S_H1)]
    for name, items in [("Vorbereitung", CHECKLIST_PREP), ("Vor Ort", CHECKLIST_SHOOT), ("Übergabe", CHECKLIST_DELIVERY)]:
        story += [P(name, S_H2)]
        story += [P(f"[ ]   {x}", S_BODY) for x in items]
        story += [Spacer(1, 6)]
    story += [PageBreak()]

    # --- Einverständnis + Statusliste ---
    story += [P("Vorlage: Einverständniserklärung", S_H1), P("Vom Betreiber ausfüllen und unterschreiben lassen. Keine Rechtsberatung - bei Unsicherheit rechtlich prüfen lassen.", S_BODY), Spacer(1, 8)]
    form = Table([[P(line if line else " ", S_MONO)] for line in RELEASE_FORM], colWidths=[CONTENT_W])
    form.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BOX),
                ("BOX", (0, 0), (-1, -1), 0.6, RULE),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story += [form, Spacer(1, 12), P("Statusliste zum Abhaken", S_H1), P("Dieselbe Liste wie die Master-Shotliste, mit getrennten Spalten für die vier Schritte der Übergabe.", S_BODY), Spacer(1, 6)]
    status_rows = [[m["id"], "[ ]", "[ ]", "[ ]", "[ ]"] for m in ALL_MOTIFS]
    story += [grid_table(["ID", "Aufgenommen", "Rechte", "Alt/Caption", "Export"], status_rows, [55, 115, 100, 115, CONTENT_W - 385])]
    story += [
        Spacer(1, 14),
        P("Offene Entscheidungen", S_H1),
        P("- Wer fotografiert, wer ist Rechteinhaber, wer unterschreibt die Einverständniserklärung?", S_BODY),
        P("- Welches Fahrzeug wird abgebildet (Kennzeichen und Markenembleme aus dem Ausschnitt)?", S_BODY),
        P("- Wer füllt lib/siteLegal.ts und die Datenschutzerklärung aus (P0-Blocker für SEA)?", S_BODY),
        Spacer(1, 10),
        P("Kein Ranking-Versprechen. Bilder verbessern die Nachprüfbarkeit, keine Position.", S_SMALL),
    ]

    doc.build(story)
    return state["pages"]


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(MD_PATH, "w", encoding="utf-8") as f:
        f.write(build_markdown())
    pages = build_pdf()
    print(f"Motive: {len(ALL_MOTIFS)} | Gruppen: {len(GROUPS)} | PDF-Seiten: {pages}")
    print(f"MD : {MD_PATH} ({os.path.getsize(MD_PATH)} bytes)")
    print(f"PDF: {PDF_PATH} ({os.path.getsize(PDF_PATH)} bytes)")


if __name__ == "__main__":
    main()
