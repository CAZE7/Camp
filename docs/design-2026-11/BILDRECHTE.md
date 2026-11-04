# Bildrechte — Konzept 2026-11

> Vorlage, noch **nicht** ausgefüllt. Die sechs Dateien in `bilder/` sind
> KI-generierte Konzeptplatzhalter für Bildausschnitt, Licht und Tonalität. Sie
> sind **nicht für die Auslieferung freigegeben** und werden vor Livegang durch
> eigene Werkstatt-Fotografie ersetzt (`DESIGN-KONZEPT-2026-11.md` §4.3).
>
> Die 50 Motive, die dafür aufgenommen werden müssen, stehen im
> [`FOTOMOTIV-KATALOG.pdf`](FOTOMOTIV-KATALOG.pdf) (70 Seiten, eine Seite je
> Motiv) und als [Markdown-Quelle](FOTOMOTIV-KATALOG.md). Jede Motivseite hat
> am Ende Kästchen für „Rechte geklärt“ – die Ergebnisse gehören in die
> Tabelle unten.

**Ergänzung 2026-11-03:** Aus dem Anhang „Nischenforschung und Content-Ausbau“
kommen **28 weitere Hero-Motive** hinzu – [`FOTOMOTIV-ERGAENZUNG-2026-11-03.md`](FOTOMOTIV-ERGAENZUNG-2026-11-03.md).
Sie sind **bedingt**: die zugehörigen Seiten existieren in diesem Checkout noch
nicht. Sobald sie gebaut werden, gilt für alle 78 Fotomotive dieselbe Tabelle
und dieselben Regeln wie für die ursprünglichen 50. Herkunft und Abgleich:
[`ANHAENGE-INTEGRATION-2026-11-03.md`](ANHAENGE-INTEGRATION-2026-11-03.md).

| Nr. | Motiv                 | Datei (Platzhalter)      | Status                | Fotograf:in | Datum | Lizenz / Rechte | Freigabe | Ersetzt durch |
| --- | --------------------- | ------------------------ | --------------------- | ----------- | ----- | --------------- | -------- | ------------- |
| 01  | Kabelverlegung        | `01-elektrik-einbau.*`   | Platzhalter, gesperrt | —           | —     | —               | nein     | —             |
| 02  | Sicherungsträger      | `02-sicherungstraeger.*` | Platzhalter, gesperrt | —           | —     | —               | nein     | —             |
| 03  | Crimpverbindung       | `03-crimpverbindung.*`   | Platzhalter, gesperrt | —           | —     | —               | nein     | —             |
| 04  | Solarpanel auf Dach   | `04-solar-dach.*`        | Platzhalter, gesperrt | —           | —     | —               | nein     | —             |
| 05  | Plan auf der Werkbank | `05-plan-auf-werkbank.*` | Platzhalter, gesperrt | —           | —     | —               | nein     | —             |
| 06  | Batteriekasten        | `06-batteriekasten.*`    | Platzhalter, gesperrt | —           | —     | —               | nein     | —             |

## Produktionsbilder (nach dem Dreh ausfüllen)

Die Tabelle oben führt nur die sechs Platzhalter. Nach dem Fototermin wird sie
um **eine Zeile je Motiv** aus dem Katalog ergänzt – 50 Zeilen mit denselben
IDs (`A-01` bis `H-05`). Vorlage:

| Nr.    | Motiv          | Datei                        | Status | Fotograf:in | Datum | Lizenz / Rechte | Freigabe | Ersetzt durch          |
| ------ | -------------- | ---------------------------- | ------ | ----------- | ----- | --------------- | -------- | ---------------------- |
| `A-01` | Kabelverlegung | `a-01-kabelverlegung-*.avif` | offen  | —           | —     | —               | nein     | `01-elektrik-einbau.*` |

## Regeln für die Produktionsbilder

1. **Herkunft:** eigene Aufnahme oder lizenzierte Fotografie mit schriftlicher
   Nutzungserlaubnis für Web, Werbung (SEA) und Bearbeitung. Kein Hotlinking —
   die CSP erlaubt nur `'self'` (`app/layout.tsx`, `public/_headers`).
2. **Eintrag je Motiv:** Fotograf:in, Aufnahmedatum, Rechteinhaber, Lizenz,
   Ablaufdatum, Freigabe durch den Betreiber, ersetzte Platzhalter-Datei.
3. **Personen:** sichtbare Hände und Körperteile brauchen eine Einverständnis-
   erklärung; Gesichter und Kennzeichen werden grundsätzlich nicht gezeigt.
4. **Fremde Marken:** keine lesbaren Logos, Produktnamen oder Typenschilder im
   Bild. Bauteile werden in der Bildunterschrift sachlich benannt, nicht beworben.
5. **Kein KI-Bild in der Auslieferung.** Generierte Motive bleiben im Konzeptordner
   und werden nicht nach `public/bilder/` kopiert.
6. **Technik:** AVIF (`-640`, `-1200`), JPEG-Fallback, `width`/`height`, Alt-Text,
   Bildunterschrift, `ImageObject`, `images` in der Sitemap. Dateinamen
   beschreibend in `kebab-case`.
7. **OG-Karten** (1200 × 630) sind die einzigen Bilder mit Text; sie werden je
   Suchintention separat erzeugt und ebenfalls hier eingetragen.

## Warum das hier steht

Ein Bild, dessen Rechte ungeklärt sind, ist für bezahlte Anzeigen ein größeres
Risiko als ein fehlendes Bild: Ablehnung der Anzeige, Abmahnrisiko und ein
Verstoß gegen die im Konzept zugesagte Nachprüfbarkeit. Die Tabelle ist deshalb
Teil der Abnahme-Checkliste in `DESIGN-KONZEPT-2026-11.md` §9.
