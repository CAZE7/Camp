# AI-SEO-Prüfung 2026-10-28

**Anlass:** Durchgang durch den Skill `ai-seo` (marketingskills, v2.11.0) mit den
Referenzen `agent-readiness` und `content-patterns` — Prüfung, ob diese Seite
von Sprachmodell-Agenten gefunden, gelesen und richtig beschrieben wird.
**Prüfgegenstand:** gebauter Static Export (`out/`, 44 Seiten, 40 im Audit).
**Ergebnis in einem Satz:** Der Zugang ist in Ordnung, die Auffindbarkeit hatte
eine Lücke (`llms.txt`), und zwei Empfehlungen des Skills lassen sich für diese
Seite nicht ehrlich umsetzen (Autorenschaft, Preisangaben).

## 1. Zugang — kann ein Agent die Seite überhaupt lesen?

| Prüfung                                    | Befund              | Beleg                                                                                                                                                                          |
| ------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inhalt im ersten HTML (AR-READ-01)         | **bestanden**       | Jede der 40 Seiten liefert ihren Text ohne JavaScript; das ist bereits durch `tests/e2e/seo-nojs.spec.ts` und den Export-Audit abgesichert                                     |
| Echte Statuscodes, echter 404 (AR-READ-02) | **bestanden**       | `out/404.html` wird von GitHub Pages mit Status 404 ausgeliefert; keine SPA, die jede Adresse mit 200 beantwortet                                                              |
| Crawler-Zugang (AR-FIND-01)                | **bestanden**       | `app/robots.ts`: eine Wildcard-Regel `User-agent: * / Allow: /`. Genau der Zustand, den AgentReady empfiehlt — keine Allowlist benannter Bots, die Agenten-Such-APIs aussperrt |
| Kein Bot-Schutz davor                      | **bestanden**       | GitHub Pages setzt weder WAF noch Challenge vor die Auslieferung                                                                                                               |
| Preis als Text                             | **nicht anwendbar** | Die Anwendung ist kostenlos; es gibt keine Tarife. Der Satz „Kostenlos, ohne Anmeldung, ohne Abo“ steht als Text auf der Startseite                                            |

## 2. Auffindbarkeit — sagen die Dateien einem Agenten, was es hier gibt?

| Prüfung                                         | Befund                                          | Beleg                                                                |
| ----------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| `robots.txt`                                    | vorhanden, Wildcard, verweist auf die Sitemap   | `out/robots.txt`                                                     |
| `sitemap.xml`                                   | vorhanden, 36 Einträge, 5 mit `lastModified`    | `out/sitemap.xml`, `app/sitemap.ts`                                  |
| `llms.txt`                                      | **fehlte — an diesem Tag ergänzt**              | `app/llms.txt/route.ts` → `out/llms.txt`                             |
| Verweis auf die Datei aus dem HTML              | ergänzt                                         | `<link rel="alternate" type="text/plain" href="…/llms.txt">` im Kopf |
| `AGENTS.md` im Repo                             | vorhanden (für Beitragende, nicht ausgeliefert) | `AGENTS.md`                                                          |
| `llms-full.txt`, `/.well-known/ai-catalog.json` | bewusst nicht                                   | siehe §5                                                             |

Die neue `llms.txt` wird beim Build aus `lib/seo/inventory.ts` erzeugt: Titel,
Zusammenfassung, jede indexierbare Seite mit einem Satz, ein Block mit Fakten
zur Anwendung. Sie kann deshalb nicht veralten, ohne dass das Inventar
veraltet. `scripts/seo/auditExport.ts` prüft den gebauten Text gegen das
Inventar (`LLMS-*`): H1 am Anfang, jede P0-Seite vorhanden, kein relativer
Verweis, kein toter Verweis, kein Platzhalter. Beim ersten Lauf hat die Prüfung
sofort einen eigenen Fehler gefunden — absolute Adressen wurden gegen
Export-Pfade geprüft, alle 36 Verweise galten als tot.

## 3. Lesbarkeit — kann ein Agent die Seite richtig beschreiben?

Gemessen am gebauten Export, Text ohne JavaScript:

| Seite                                | Wörter |  H2 | Tabellen | aufklappbare Fragen | JSON-LD                                 |
| ------------------------------------ | -----: | --: | -------: | ------------------: | --------------------------------------- |
| `/`                                  |    744 |   6 |        0 |                   5 | WebPage, FAQPage, WebSite, Organization |
| `/camper-elektrik/`                  |  1 885 |  13 |        3 |                   3 | + BreadcrumbList                        |
| `/camper-elektrik/kabelquerschnitt/` |  1 737 |  12 |        2 |                   4 | + WebApplication, Offer                 |
| `/elektrik-planung/`                 |  1 529 |   6 |        1 |                   4 | WebApplication, Offer, FAQPage          |
| `/tools/dach/`                       |    659 |   2 |        0 |                   4 | WebApplication, Offer, FAQPage          |
| `/tools/heizung/`                    |    928 |   2 |        0 |                  10 | WebApplication, Offer, FAQPage          |
| `/rechner/batteriekapazitaet/`       |    881 |  10 |        0 |                   3 | WebApplication, Offer, FAQPage          |

Was aus der Checkliste des Skills bereits erfüllt ist: Definition im ersten
Absatz, Antwort vor der Erklärung (die Erklärblöcke der Werkzeuge beginnen mit
der Antwort und stellen die Frage als Überschrift), Vergleichstabellen dort, wo
verglichen wird, FAQ als `details`/`summary` (ohne JavaScript lesbar),
strukturierte Daten aus derselben Quelle wie die sichtbare Anzeige, genau eine
H1 je Seite.

**Nachtrag noch am 2026-10-28: Autorenangabe umgesetzt.** Der Betreiber hat
Name und Grundlage geliefert (Jonas Rieckhoff, eigene Camper-Ausbauten, Studium
an einer Universität), seitdem steht sie an vier Stellen:

| Stelle                      | Umsetzung                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Fußzeile jeder Inhaltsseite | `components/seo/AuthorNote.tsx`: „Von Jonas Rieckhoff, Betreiber von Elektroplaner · Wer schreibt hier“                |
| Vertrauensseite             | Abschnitt `#autor` auf `/ueber-elektroplaner/`, Name und Grundlage aus `lib/author.ts`                                 |
| JSON-LD                     | `Person`-Knoten einmal im Wurzel-Layout (`#author`), jede `WebPage` verweist mit `author: { '@id': … }`                |
| Quelle der Angaben          | `lib/author.ts` — ein Ort für Name, Rolle und Grundlage; ein Test hält ihn mit `SITE_LEGAL` (Impressum) deckungsgleich |

Bewusst nicht erfunden: Studienfach und Hochschule. Der bisherige Abschnitt
nannte außerdem einen „Ducato L2H2“ als eigenes Ausbauprojekt — eine Angabe, die
niemand bestätigt hatte. Der Betreiber hat am 2026-10-28 die tatsächlichen
Fahrzeuge genannt: **VW T6 und Sprinter L2H2**. Sie stehen jetzt in
`lib/author.ts` und in der Autorenvorstellung.

Dabei ist eine Lücke im Planer aufgefallen, die nicht in diesen Bericht gehört,
aber notiert werden muss: `lib/vehicleTemplates.ts` kannte nur Ducato, Sprinter
und Transit, aber **keinen VW T6**. Wer einen T6 ausbaut, konnte sein Fahrzeug im
Planer nicht auswählen. Die Lücke ist am 2026-10-28 geschlossen: Die Vorlagen
decken jetzt zwölf Baureihen in allen angebotenen Längen- und Dachvarianten ab
(59 Varianten), darunter T5/T6/T6.1, Crafter/TGE, Vito und Daily. Die Maße
stammen aus Herstellerangaben und Aufbauunterlagen, die Quellen stehen als
Kommentar an jeder Baureihe.

Was weiterhin fehlt, ohne dass es sich erfinden lässt: ein Nachweis der
Erfahrung (Fotos, Messwerte, dokumentierte Umbauten) und eine zweite,
unabhängige Quelle, die die Seite zitiert. Das ist Inhalt, nicht Markup.

## 4. Was der Skill empfiehlt und hier nicht gilt

- **`/pricing.md`** — setzt ein Produkt mit Tarifen voraus. Diese Anwendung ist
  kostenlos; ein Preisdokument würde eine Preisstruktur erfinden.
- **Dedizierte „AI-Inhalte“ oder Zerstückelung in Häppchen** — Google nennt
  beides ausdrücklich schädlich („scaled content abuse“, „don’t break your
  content into tiny pieces“). Die Erklärblöcke dieser Seite sind normaler
  Fließtext mit Überschriften, keine Chunks.
- **Markdown-Spiegel je Seite** (`Accept: text/markdown`) — im Skill als „MAY“
  geführt, ohne gemessenen Effekt auf den Aufgabenerfolg. Für einen statischen
  Export wäre es eine zweite Auslieferungsform mit eigenem Veraltungsrisiko.

## 5. Offene Punkte

1. **Autorenschaft** (größter Hebel, blockiert): Name, Rolle und ein Satz
   Erfahrung je Themenseite, vom Betreiber zu liefern. Erst danach lohnt
   `author` im JSON-LD, weil es sonst eine leere Zusage wäre.
2. **`llms-full.txt`** — der gesamte Seiteninhalt in einer Datei. Technisch
   leicht erzeugbar; ohne Nachfrage nicht eingebaut, weil es die Auslieferung
   verdoppelt und der Nutzen für diese Seitengröße nicht gemessen ist.
3. **`/.well-known/ai-catalog.json`** — sinnvoll ab mehreren Agenten-Oberflächen
   (MCP, API, OpenAPI). Diese Seite hat keine; der Katalog wäre leer.
4. **`author`/`dateModified`** — `dateModified` steht seit dem 2026-10-28 an
   fünf Seiten mit belegtem Datum (ADR 0039). Weitere Daten brauchen weitere
   Belege, keine Schätzung.

## Quellen

- Skill `ai-seo` v2.11.0 (marketingskills): `SKILL.md`, `references/agent-readiness.md`,
  `references/content-patterns.md`
- Google, AI features and your website — <https://developers.google.com/search/docs/appearance/ai-features>
- AgentReady.org — Praktiken AR-FIND-01, AR-READ-01, AR-READ-02 (Stand Oktober 2026)
- Eigene Messung: `npm run build` → `out/`, Node 22.22.3, `scripts/seo/auditExport.ts`
- Vorherige Bestandsaufnahme: `docs/seo/RESEARCH-SEITENAUFBAU-2026-10-27.md`
