# Die ersten 500 aktiven Nutzer — bevor SEO greift

Stand: nach dem Canonical-Fix auf `https://elektroplaner-camper.de`, seit dem
2026-10-31 umgezogen auf `https://12v-planer.de` (Umzugs-Checkliste:
`docs/seo/SEARCH-CONSOLE.md`). Bis Google
die Seiten nach der Korrektur hochrankt, vergehen Wochen. Die ersten echten
Nutzer kommen dorther, wo täglich nach genau dieser Lösung gefragt wird:
Foren, Facebook-Gruppen, Reddit. Dieses Dokument ist die Arbeitsliste dafür —
kein Werbeplan, sondern Hilfe an konkreten Beiträgen, die das Werkzeug trägt
(fertig verkabelte Beispiele, PNG-Export mit Wasserzeichen, teilbarer
Plan-Link ohne Konto).

## Sofort nach dem Deployment (einmalig, ca. 30 Minuten)

1. Prüfen, dass die Auslieferung unter `https://12v-planer.de/`
   antwortet und `public/CNAME` im Export liegt (`out/CNAME`). GitHub:
   Repo → Settings → Pages → Custom domain = `12v-planer.de`,
   „Enforce HTTPS“ aktivieren. DNS beim Registrar: A-Records auf die
   GitHub-Pages-IPs bzw. CNAME für `www` auf `caze7.github.io` — danach muss
   `https://12v-planer.de/planer/` den Planer zeigen, nicht
   `…/Camp/planer/`.
2. Google Search Console: Property `12v-planer.de` anlegen (falls
   noch nicht geschehen), Sitemap `https://12v-planer.de/sitemap.xml`
   einreichen.
3. Für `/`, `/planer/` und `/elektrik-planung/` manuell „Indexierung
   beantragen“. Alte Property (`caze7.github.io`, nach dem Umzug auch
   `elektroplaner-camper.de`) nicht löschen — sie zeigt,
   ob noch irgendwo auf die alte Adresse verlinkt wird.
4. Kontrollblick: Quelltext von `/planer/` muss als Canonical
   `https://12v-planer.de/planer/` zeigen (nicht github.io).
   Genau dieser falsche Verweis hat die Domain aus dem Index geworfen.

## Der „Draw.io-Ersatz“ in Gruppen und Foren (laufend)

Zielgruppen, in denen täglich Handskizzen und Schaltplan-Fragen landen:
Facebook-Gruppen wie „Camper Selbstausbau“ und „Wohnmobil Elektrik &
Autarkie“, Wohnmobilforum, Sprinter-Forum, Ducatoforum.

Taktik je Beitrag (ca. 5 Minuten):

1. Beitrag finden, in dem jemand eine unleserliche Skizze postet oder fragt
   „Mit welchem Programm zeichnet ihr eure Schaltpläne?“.
2. Dessen Setup im Planer nachbauen (Vorlage laden → Werte anpassen).
   Über „Link zum Plan kopieren“ den `#plan=`-Link und über den PNG-Export
   das Bild mit Wasserzeichen erzeugen.
3. Als Antwort posten — Hilfe zuerst, Link als Arbeitsmittel:

> Hab dir dein Setup mal kurz im Elektroplaner nachgebaut, damit man die
> Querschnitte und Sicherungen direkt sauber sieht:
> [Bild]
> Hier kannst du es ohne Anmeldung direkt anpassen: [Link]
> Zwei Sachen sind mir aufgefallen: [konkreter Hinweis, z. B. Sicherung /
> Querschnitt am Wechselrichter]. Passt das so zu deinen Längen?

Warum das funktioniert: Es ist keine Werbung, sondern die Antwort auf die
Frage im Beitrag. Jede Korrektur der Helfer läuft über denselben Link zurück
ins Werkzeug — der Thread erzeugt seine eigenen neuen Nutzer.

Nicht tun: denselben Text in viele Gruppen kopieren, Links ohne Bezug zum
Beitrag posten, fremde Pläne ungefragt „korrigieren“.

## Reddit-Showcase (ein guter Post statt zehn kleiner)

Subreddits: r/wohnmobil, r/camping, r/selbermachen.

- 15-Sekunden-Screenrecording: zwei Bauteile verbinden →
  „Automatisch verbinden“ → Querschnitt und Stückliste entstehen.
- Titel (ehrlich, Entwicklerstimme): „Mich hat genervt, dass man
  Camper-Schaltpläne immer noch in Draw.io oder Paint basteln muss — habe
  deshalb einen kostenlosen 12V-Online-Planer (ohne Login/Account) gebaut.
  Welches Bauteil fehlt euch noch?“
- Im Post: Was er rechnet (Querschnitt, Sicherung, Spannungsabfall), was er
  nicht tut (keine Elektroinstallation ersetzen, Grenzen nennen), Link auf
  `https://12v-planer.de/planer/?template=kastenwagen`, damit
  niemand vor einer leeren Fläche landet.
- Auf jede Antwort eingehen; Bauteil-Wünsche sammeln und sichtbar umsetzen.
  Der Thread ist Produktforschung, nicht nur Reichweite.

## Deep-Links statt pauschaler Verweise

Aus Ratgebern, Foren-Antworten und Gruppen nie nur auf `/planer/` verlinken:

| Ziel                                 | Link                                                |
| ------------------------------------ | --------------------------------------------------- |
| Wochenend-Camper (ohne 230 V)        | `/planer/?template=wochenende`                      |
| Kastenwagen mit Ladebooster + Solar  | `/planer/?template=ladebooster-solar`               |
| Großes Autark-Setup                  | `/planer/?template=autark`                          |
| Konkreter fremder Plan zur Korrektur | `/planer/#plan=…` (über „Teilen“ im Planer erzeugt) |

## Messen, ob es wirkt

- Search Console wöchentlich: indexierte Seiten (Ziel: alle aus der
  Sitemap), Impressionen für `/planer/` und `/elektrik-planung/`.
- Im Planer gibt es bewusst kein Tracking. Der ehrliche Zähler ist deshalb:
  Wie viele Foren-Antworten verlinken einen `#plan=`-Link zurück, und wie
  viele PNGs mit Wasserzeichen tauchen ohne eigenes Zutun auf?
- Nach 4 Wochen entscheiden: Welche Vorlage wird am häufigsten geöffnet
  (aus den Rückfragen ablesen), welcher Beitragstyp bringt aktive Nutzer —
  dorthin die nächste Woche investieren, nicht in neue Kanäle.
