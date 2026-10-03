# Camp SEO — Analyse und Vision

_Suchraum, Befunde und Zielbild für die organische Sichtbarkeit · Stand 2026-10-03 · Commit 2854f82_

Stand: 2026-10-03 · Commit: `2854f82` (2026-10-03) · Grundlage: gebauter Static Export unter `out/`, ohne JavaScript gemessen.

## Ausgangslage

Camp ist ein Planungswerkzeug: Der Nutzer zeichnet seine 12-V-Anlage, das Werkzeug prüft jede Leitung gegen Strombelastbarkeit, Spannungsfall und Sicherung und erzeugt daraus eine Stückliste. Das ist ein starkes Ziel für Besucher mit einer konkreten Absicht — aber es ist kein Einstieg. Wer „kabelquerschnitt 12v camper" sucht, will zuerst wissen, wie gerechnet wird, nicht sofort zeichnen. Zwischen dieser Frage und dem Planer lag vor dieser Arbeit nichts: Die Auslieferung hatte neun indexierbare Seiten, und keine einzige beantwortete eine 12-V-Fachfrage.

Die Messung des gebauten Exports bestätigt das: Die Startseite hatte 186 Wörter ohne JavaScript, die Werkzeugseiten 207 (Dach) und 436 (Heizung) Wörter und keine einzige Zwischenüberschrift. Es gab keine Pillar-Seite, keine Rechnerseite mit erklärendem Text, keine Vertrauensseite und keine Verlinkung zwischen den Bereichen. Gleichzeitig — und das ist der wichtigste Befund — war die technische Zusage intakt: genau eine H1 je Seite, vollständiger Inhalt ohne JavaScript, gültige strukturierte Daten, Sitemap und Robots in Ordnung. Das Problem war nicht die Technik, sondern die Sprache: Es fehlten Seiten für die Fragen der Nutzer.

## Der Suchraum

Der Suchraum zerfällt in fünf Absichten, die unterschiedliche Seitentypen verlangen. Die Zuordnung ist die Grundlage der Informationsarchitektur.

| Absicht     | Beispielfrage                    | Seitentyp                                     | Weg danach                         |
| ----------- | -------------------------------- | --------------------------------------------- | ---------------------------------- |
| Rechnen     | „kabelquerschnitt 12v berechnen" | Rechnerseite mit Erklärung, Formel, Beispiel  | Ergebnis in den Planer übertragen  |
| Verstehen   | „spannungsabfall 12v formel"     | Clusterseite mit Herleitung, Tabelle, Grenzen | Querschnitt und Sicherung auslegen |
| Auslegen    | „batterie camper berechnen ah"   | Rechnerseite mit Annahmen und Quellen         | Solar und Verbraucherbilanz prüfen |
| Vergleichen | „lifepo4 oder agm camper"        | Clusterseite mit Vergleichstabelle            | Chemie wählen, Kapazität rechnen   |
| Planen      | „schaltplan camper 12v"          | Pillar und Cluster mit Beispielplan           | Anlage im Planer zeichnen          |

Zwei Absichten fehlen bewusst: „Kaufen" (Produkt- und Preisvergleiche) und „Reparieren" (Fehlersuche an bestehenden Anlagen). Beide gehören nicht zu einem Planungswerkzeug, und beide würden die inhaltliche Verantwortung verwässern: Wer Preise nennt, muss sie pflegen; wer Reparaturen beschreibt, muss Fahrzeuge kennen, die wir nicht kennen.

## Befunde aus dem Audit

- Es fehlte die Inhaltsebene: Aus neun indexierbaren Seiten wurden 26 — Pillar, elf Cluster, vier Rechner-Landingpages und eine Vertrauensseite.
- Die stärksten Rechner waren nicht adressierbar: Der Kabelquerschnittrechner steckte im Planer, der Spannungsabfall hatte keine eigene Rechnerseite, Batterie- und Solarrechnung existierten nur als Formeln.
- Die Werkzeuge erklären sich nicht: /tools/dach/ (207 Wörter) und /tools/heizung/ (436 Wörter) haben keine Zwischenüberschrift und keinen erklärenden Text — sie liefern die Funktion, aber nicht die Antwort auf „wofür und wie lese ich das?".
- Der Ausbauguide lud GSAP (rund 136 KB) im Erstaufbau einer Textseite; die Animation ist Dekoration und wird jetzt nachgeladen.
- Es gab keine Vertrauensseite: Wer einem Rechner folgt, will wissen, wie er rechnet, worauf er sich stützt und wo er irrt — diese Angaben stehen jetzt auf jeder Seite und gebündelt unter /ueber-werft/.
- Die Verlinkung war sternförmig: Alles hing an der Startseite. Jetzt führt ein Themenbaum von der Pillar in die Cluster und von jedem Cluster über ein bis zwei Schritte in den Planer.

## Zielbild

Die Zielstruktur hat vier Ebenen und eine Richtung: von der Frage zur Zeichnung. Jede Ebene hat genau eine Aufgabe, und jede Seite verweist auf die nächste.

1. Pillar (/camper-elektrik/): das Thema als Ganzes — Reihenfolge der Auslegung, Überblick über alle Unterthemen, Einstieg für „camper elektrik" und „elektrik ausbau".
2. Cluster: je eine Frage — Kabelquerschnitt, Spannungsabfall, Sicherungen, Batterie, LiFePO4, AGM, Solar, MPPT, Wechselrichter, 230 V, Schaltplan. Jede Seite rechnet mit denselben Modellwerten wie der Planer.
3. Rechner-Landingpages (/rechner/…): die Absicht „berechnen" mit Eingabe, Ergebnis, Einordnung und Beispielen — ohne Umweg über den Planer.
4. Werkzeug und Planer: das Ziel. Wer die Werte kennt, zeichnet die Anlage im Planer und lässt sie prüfen — dort entstehen Stückliste und Fehlermeldungen.

Quer dazu stehen zwei Zusagen, die für ein Thema mit Sicherheitsbezug nicht optional sind: Transparenz (Quellen, Annahmen, Grenzen und Stand auf jeder Seite) und Bescheidenheit (keine erfundenen Prüfsiegel, keine Bewertungen, keine Preise). Beides ist nicht nur eine Haltung, sondern auch die einzige belastbare Grundlage für Sichtbarkeit in einem Themenfeld, in dem falsche Angaben Schaden anrichten können.

## Funnel: von der Suche in den Planer

| Stufe     | Seite               | Was der Nutzer tut                    | Was danach folgt               |
| --------- | ------------------- | ------------------------------------- | ------------------------------ |
| Frage     | Cluster             | liest, rechnet nach, prüft eine Zahl  | Link „Im Planer weiterrechnen" |
| Rechnung  | Rechner-Landingpage | gibt Werte ein, liest das Ergebnis    | Übernahme in die Anlage        |
| Zeichnung | /elektrik-planung/  | legt Leitungen, prüft Fehlermeldungen | Stückliste, Ausdruck           |
| Vertrauen | /ueber-werft/       | prüft Methodik, Quellen, Grenzen      | teilt den Link weiter          |

Der Übergang von der Rechnung in den Planer ist der wichtigste Klick der ganzen Struktur. Deshalb steht er auf jeder Inhaltsseite als eigener Abschnitt, und deshalb gibt es keine Popups und keine Zwischenseiten: Wer eine Zahl sucht, bekommt sie zuerst.

## Messung und Erfolgskriterien

- Was der Bau messen kann: Seitenzahl, Wortzahl ohne JavaScript, Überschriftenstruktur, interne Verlinkung, Waisen, doppelte Metadaten, Struktur der strukturierten Daten, Sitemap, Bundles. Diese Zahlen entstehen bei jedem Bau neu (docs/seo/AUDIT.md).
- Was nur die Search Console messen kann: Impressionen, Klicks, durchschnittliche Position je Anfrage, welche Seiten tatsächlich in den Index kommen. Der Ablauf steht in docs/seo/SEARCH-CONSOLE.md.
- Erfolgskriterium 90 Tage: Für die zehn wichtigsten Anfragen des Elektrik-Themas steht mindestens eine Seite in den Top-20 der Search Console, und der Planer erhält messbar mehr Aufrufe aus organischer Suche als vorher (Basiswert beim Anschließen festhalten).
- Erfolgskriterium Inhalt: Kein Cluster unter 700 Wörtern ohne JavaScript, jeder Rechner mit Formel, Annahmen, Grenzen und mindestens zwei Rechenbeispielen.

## Roadmap

| Stufe | Inhalt                                                                                                                     | Zustand  |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| P0    | Suchraum inventarisieren, Pillar und elf Cluster, Rechnerseiten, Verlinkung, Waisen- und Dublettenprüfung, Vertrauensseite | erledigt |
| P1    | Werkzeugseiten erklären, echte Bilder und Diagramme, Search Console anschließen, Titel anhand von Daten schärfen           | offen    |
| P2    | Ladebooster/DC-DC, Sinus-Wechselrichter-Vergleich, englische Fassung der stärksten Seiten                                  | offen    |
| P3    | Fahrzeugspezifische Seiten mit belegbarem Inhalt, weitere Rechner (Kabelverluste, Laderegler-Auslegung)                    | offen    |

## Risiken und ihre Behandlung

- Fachliche Genauigkeit: Alle Zahlen kommen aus dem Modell der Anwendung, nicht aus fremden Quellen. Wo das Modell etwas nicht weiß (Ladespannungen, Temperaturfenster einzelner Chemien), steht es als Herstellerangabe gekennzeichnet oder fehlt bewusst.
- Regulatorik: 230-V-Anlagen sind abnahmepflichtig. Jede Seite mit Landstrombezug nennt das; die Vertrauensseite wiederholt es.
- Erwartungen: Kein Ranking-Versprechen. Die Prüfungen belegen technische Zusagen, nicht Platzierungen — der Bericht sagt das ausdrücklich.
- Überproduktion: Neue Seiten entstehen nur für belegte oder klar benannte Intentionen. Die Anfrageliste ist die Bremse gegen beliebige Textmengen.
