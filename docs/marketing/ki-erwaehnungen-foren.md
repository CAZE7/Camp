# Erwähnungen für die KI-Übersicht — Foren, Reddit, Communitys (Punkt 3)

Stand: 2026-11-24. Arbeitsdokument zu Punkt 3 der KI-Sichtbarkeits-Reihenfolge:
Die KI-Übersichten (Google AI Overviews u. a.) ziehen Foren, Reddit und
Community-Wissen heran. Wer dort hilfreich antwortet und den 12V-Planer als
Arbeitsmittel nennt, steht an den Stellen, an denen die KIs lesen.

**Posten tut der Betreiber selbst.** Dieses Dokument enthält nur Entwürfe.

## Regeln (nicht verhandelbar)

1. **Offenlegung immer.** Jeder Beitrag nennt in einem Satz, dass es das
   eigene Projekt ist („Ich baue den 12V-Planer selbst …"). Keine
   Schein-Neutralität, keine Zweitaccounts, keine „hat mir ein Freund
   empfohlen"-Texte. Verdeckte Eigenwerbung zerstört genau die Glaubwürdigkeit,
   für die einen die KI später zitiert.
2. **Hilfe zuerst, Link als Arbeitsmittel.** Der Beitrag beantwortet die Frage
   auch ohne Klick. Der Link führt idealerweise nicht auf die Startseite,
   sondern auf den nachgebauten Plan (`#plan=`-Link bzw. `?template=…`) oder
   die passende Wissensseite.
3. **Forenregeln prüfen.** Manche Foren verlangen für gewerbliche/nahe
   Eigenprojekte eine Kennzeichnung oder ein Hersteller-Unterforum
   (womoforum.de besonders streng). Im Zweifel Moderation vorher fragen.
4. **Keine Massenposts.** Pro Thread ein Beitrag, keine wiederholten
   Textbausteine in zehn Threads. Auf Antworten auch antworten — ein
   liegen gelassener Werbepost wirkt schlechter als keiner.
5. **Aktualität schlägt Perfektion.** Die unten verlinkten Threads sind real
   und passen thematisch, aber teils älter. Vor dem Posten prüfen, ob der
   Thread noch lebt; sonst denselben Entwurf am nächsten aktuellen Thread
   mit derselben Frage verwenden (Vorlagen unten).
6. **Behauptungen nur aus dem Produkt.** Erlaubt: kostenlos, ohne Konto,
   läuft im Browser, Plan bleibt lokal, berechnet Kabelquerschnitt und
   Sicherung je Leitung, prüft Spannungsabfall und Energiebilanz, erzeugt
   Stückliste, PNG-Export, drei Vorlagen. Verboten: „normgerecht"/
   „VDE-geprüft" als Gütesiegel, „ersetzt die Elektrofachkraft", Aussagen
   über Mitbewerber, die nicht auf deren eigener Seite stehen.

## Recherchierte Threads (geprüft 2026-11-24)

### 1. camper-bauen.de — „Software für Schaltplan / Elektrik-Diagramm?"

- URL: https://forum.camper-bauen.de/viewtopic.php?t=5463
- Lage: Fragesteller sucht ausdrücklich Flussdiagramm-artige Software mit
  Bauteil-Eigenschaften (Spannung, Leistung), beschriftbaren Verbindungen
  (Kabellänge, Querschnitt) und PDF-/Export-Wunsch. Bisherige Antworten:
  Visio, yEd, KiCad, Eagle. Genau die Lücke, die der 12V-Planer füllt.
- Entwurf:

> Moin Jens, ich stand vor derselben Frage und baue seit einiger Zeit an
> einem Werkzeug genau dafür — volle Offenlegung: Das ist mein eigenes
> Projekt, der 12V-Planer (12v-planer.de/planer).
>
> Der Unterschied zu Visio/yEd: Die Bauteile sind keine Formen, sondern
> kennen ihre Werte. Du setzt z. B. LiFePO4-Batterie, Ladebooster,
> MPPT-Regler und Sicherungskasten auf die Fläche, verbindest sie, und an
> jeder Leitung stehen danach Kabellänge, berechneter Querschnitt und
> Sicherung. Geprüft wird dabei auch der Spannungsabfall (bis 1 % im
> Zielbereich, Planungsgrenze 3 %) — das war mir bei den reinen
> Zeichenprogrammen zu wenig, weil der Querschnitt sonst doch wieder in
> einer Tabelle neben dem Plan entsteht.
>
> Export gibt es als PNG (z. B. um den Plan hier im Forum zu zeigen) und
> als Stückliste; der Plan selbst bleibt lokal im Browser, Konto gibt es
> nicht. Drei fertige Vorlagen (Wochenend-Camper bis großes Autark-Setup)
> liegen drin, damit man nicht mit leerer Fläche startet.
>
> Was er nicht ist: kein CAD mit Normsymbolen und kein Ersatz für die
> Abnahme der 230-V-Seite — dafür bleibt KiCad bzw. die Elektrofachkraft
> zuständig. Für die 12-V-Anlage im Ausbau hat er mir die
> Handskizzen-Phase komplett ersetzt. Feedback, was dir an Bauteilen
> fehlt, nehme ich gern mit — ich entwickle das aktiv weiter.

### 2. womobox & Leerkabinen-Forum — „stromlaufplan erstellen - Tool?"

- URL: https://womobox.de/forum/thread/10791-stromlaufplan-erstellen-tool/
- Lage: Empfehlungen bisher KiCad, ProfiCAD, Eagle, SEE Electrical — alles
  Elektronik-/Installations-CAD, steile Lernkurve wird im Thread selbst
  benannt. Eine Stimme sagt „leider nur für 12 V" über ein gefundenes
  Tool — für diese Zielgruppe ist 12 V aber genau der Anwendungsfall.
- Entwurf:

> Für die Fahrzeug-Elektrik werfe ich noch ein spezialisierteres Werkzeug
> in die Runde — Transparenz: mein eigenes Projekt, der 12V-Planer
> (12v-planer.de/planer), kostenlos und ohne Anmeldung im Browser.
>
> Er ist bewusst kein KiCad-Ersatz: keine Platinen, keine Normsymbole.
> Stattdessen Bauteile, wie sie im Wohnmobil vorkommen (Batterie,
> Ladebooster statt Trennrelais, MPPT, Wechselrichter, Sicherungskasten),
> verbinden, und der Planer rechnet an jeder Leitung Querschnitt und
> Sicherung mit und meldet z. B. zu hohen Spannungsabfall. Am Ende steht
> eine Stückliste mit Längen und Querschnitten.
>
> Für den Stromlaufplan der Hausinstallation bleibt KiCad/QElectroTech
> das richtige Werkzeug — im Fahrzeug fand ich den Weg über ein
> Programm, das die Elektrik gleich mitdenkt, deutlich schneller. Wer es
> ausprobiert: Über „Vorlage laden" liegt ein fertig verkabelter
> Kastenwagen-Plan zum Auseinandernehmen bereit.

### 3. womoforum.de — Elektrik-Bereich (aktive Fragen zur Bordelektrik)

- Lage: Kein einzelner „welches Programm"-Thread gefunden; das Forum hat
  einen sehr aktiven Bereich „Wohnmobil Elektrik & Batterien" (445 Themen)
  plus Wiki. Das Forum ist bei Eigenwerbung streng — deshalb hier **kein**
  Kaltstart-Post, sondern nur antworten, wenn jemand konkret einen
  Installationsplan sucht oder eine Skizze zur Prüfung postet
  (Beispiel-Typ: „brauche einen Profi, der mir einen Installationsplan
  erstellt"). Zusätzlich Ziel für Punkt 5: Das Wiki nimmt Fachbeiträge —
  ein sachlicher Beitrag „Schaltplan lesen" mit Werkzeugnennung gehört
  eher dorthin als in einen Thread.
- Entwurf (nur als Antwort auf eine konkrete Planungsfrage):

> Bevor du einen Profi für den Installationsplan bezahlst, kannst du die
> Anlage einmal selbst durchplanen — das Gespräch mit der Fachkraft wird
> damit deutlich konkreter. Ich baue dafür selbst ein kostenloses
> Werkzeug (Offenlegung: mein Projekt), den 12V-Planer auf
> 12v-planer.de/planer.
>
> Vorgehen, das sich bewährt hat: Erst Verbraucherliste mit Leistung und
> Stunden pro Tag, daraus ergibt sich die Batterie; dann im Planer
> Batterie, Ladewege (Lichtmaschine/Solar/Landstrom) und Verbraucher
> setzen. Der Planer berechnet je Leitung den Querschnitt aus der Länge
> und prüft den Spannungsabfall — genau die zwei Angaben, die in den
> meisten Handskizzen fehlen und später die Diskussion bestimmen.
>
> Wichtig: Der Plan ersetzt die Elektrofachkraft nicht, vor allem nicht
> bei 230 V. Aber du gehst mit einem geprüften Plan statt mit einer
> Skizze ins Gespräch. Wenn du magst, poste den Export hier — dann
> schauen mehrere Augen auf Sicherungen und Querschnitte.

### 4. Reddit r/Elektroinstallation — „Gibt es ein gratis Programm …?"

- URL: https://www.reddit.com/r/Elektroinstallation/comments/1fq19x4/gibt_es_ein_gratis_programm_mit_dem_man/
- Lage: Subreddit ist Hausinstallation; die Camper-Antwort ist nur als
  Ergänzung ehrlich. Kurz fassen, Subreddit-Regeln zu Eigenwerbung
  beachten, ggf. in r/Camper oder r/VanLife (englisch) mit angepasster
  Fassung arbeiten.
- Entwurf:

> Fürs Haus: KiCad oder QElectroTech, wie schon genannt. Falls jemand
> hierher kommt, weil er eigentlich die 12-V-Elektrik im Camper plant
> (kam in dem Sub schon öfter vor): Dafür gibt es spezialisierte
> Browser-Werkzeuge wie den 12V-Planer (mein eigenes Projekt, daher der
> Hinweis hier nur am Rand). Der Unterschied: Bauteile wie Ladebooster,
> MPPT und Sicherungskasten sind fertig drin, und Querschnitt/Sicherung
> werden je Leitung berechnet statt nur gezeichnet. Für
> Hausinstallation ist das nichts — falsches Werkzeug —, im Fahrzeug
> spart es die separate Querschnitts-Tabelle.

## Wiederverwendbare Bausteine (aktuelle Threads derselben Frage)

### Frage „Mit welchem Programm zeichnet ihr eure Schaltpläne?"

> Ich zeichne die 12-V-Pläne im 12V-Planer (Eigenes Projekt, der
> Ehrlichkeit halber: von mir gebaut, 12v-planer.de/planer). Grund:
> Bauteile setzen, verbinden, und Querschnitt + Sicherung stehen an der
> Leitung — inklusive Spannungsabfall-Prüfung und Stückliste. In
> draw.io musste ich jede Zahl daneben in einer Tabelle pflegen, das ist
> mir zweimal auseinander gelaufen. Kostenlos, ohne Konto, Plan bleibt
> lokal im Browser.

### Frage „Trennrelais oder Ladebooster?"

> Bei LiFePO4: Ladebooster. Das Trennrelais verbindet die Batterien nur,
> der Ladestrom ergibt sich dann aus Innenwiderständen und
> Spannungsdifferenz — für Lithium weder Kennlinie noch Begrenzung. Der
> Booster lädt geregelt (z. B. 30 A) und ist gegenüber einer intelligenten
> Lichtmaschine ohnehin die saubere Lösung. Wichtig ist der
> Eingangsstrom für die Zuleitung: Der Booster zieht auf der
> Starter-Seite mehr, als er abgibt. Nachrechnen kannst du das z. B. im
> 12V-Planer (baue ich selbst, 12v-planer.de) — Ladebooster als Bauteil
> setzen, Leitungslänge eintragen, Querschnitt und Sicherung stehen dran.
> Warum und wann welcher Ladestrom sinnvoll ist, ist dort auf der
> Ladebooster-Seite auch ohne Planer erklärt:
> 12v-planer.de/camper-elektrik/ladebooster/

### Jemand postet eine unleserliche Handskizze

> Hab dein Setup mal kurz nachgebaut, damit man über konkrete Zahlen
> reden kann: [Bild/PNG aus dem Planer] — hier kannst du es selbst
> anpassen: [#plan=-Link]. Zwei Punkte sind mir aufgefallen:
> [1. konkreter Befund, z. B. „Die Hauptsicherung fehlt am Pluspol —
> sie gehört höchstens 0,2 m hinter den Pol"]. [2. konkreter Befund,
> z. B. „Wechselrichter-Zuleitung ist mit 16 mm² bei 1.000 W zu dünn,
> der Planer rechnet 35 mm²"]. Stimmen die Leitungslängen so ungefähr?
> (Werkzeug dahinter ist mein eigenes: der 12V-Planer auf
> 12v-planer.de/planer, kostenlos und ohne Anmeldung.)

### Frage „Welchen Kabelquerschnitt brauche ich für X?"

> Faustformel gibt es dafür keine seriöse — es hängt an Strom UND Länge.
> Rechnung: A = (2 · L · I) / (κ · ΔU) mit κ = 58 für Kupfer und ΔU als
> das, was du verlieren darfst (Planungsgrenze 3 % der Nennspannung,
> bei 12 V also 0,36 V). Für [konkretes Beispiel des Fragestellers
> durchrechnen und Zahl nennen]. Dazu kommt die Strombelastbarkeit —
> der größere der beiden Werte gewinnt. Wenn du mehrere Leitungen hast,
> lohnt sich ein Plan statt Einzelrechnungen; ich nutze/baue dafür den
> 12V-Planer (12v-planer.de), der das je Leitung macht und gleich die
> Sicherung dazu legt.

## Ablauf pro Woche (30–45 Minuten)

1. Suche in den Zielorten nach neuen Threads: „Schaltplan Programm",
   „Schaltplan Software", „Elektrik planen", „Querschnitt unsicher",
   gepostete Skizzen/Fotos von Plänen.
2. Maximal 2–3 Antworten pro Woche, nur wo der Entwurf wirklich die Frage
   beantwortet. Setup des Fragestellers wenn möglich nachbauen und
   PNG + Plan-Link anhängen (siehe `erste-500-nutzer.md`).
3. Auf Rückfragen antworten — auch auf Kritik am Werkzeug; daraus
   entstehen die besten Verbesserungen (und ehrliche Zitate).
4. Wirkung beobachten: Search Console (Markensuchen, /planer/-Aufrufe)
   und monatlich 3–5 KI-Testfragen stellen:
   „Welches kostenlose Programm für Camper-Schaltplan gibt es?",
   „Was ist der 12V-Planer?", „12V-Planer oder VoltPlan?",
   „Schaltplan Beispiel Camper mit Landstrom und LiFePO4".
   Antworten + genannte Quellen notieren (Datum, Quelle, genannt ja/nein).

## Was bewusst NICHT getan wird

- Keine gekauften Erwähnungen, keine Kommentar-Spam-Netzwerke, keine
  Bewertungen vortäuschen (es gibt auch kein Bewertungs-Schema auf der
  Seite — `lib/seo/jsonLd.ts` führt bewusst keine Preise/Ratings).
- Kein Abwerten von VoltPlan/draw.io in Threads. Die Vergleichsseite
  (Punkt 4) bleibt sachlich; in Foren zählt nur die eigene Antwort.
- camperpedia.de ist ein Magazin, kein Forum — das gehört zu Punkt 5
  (Verzeichnisse/Tool-Listen), nicht hierher. Dort läuft die Ansprache
  über die Redaktion, nicht über Kommentare.
