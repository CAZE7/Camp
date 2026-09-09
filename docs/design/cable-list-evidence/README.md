# Kabelliste (Recherche A4) — visueller Nachweis

Neue Tabellenansicht für Leitungen im Elektrikplaner (Menü „Weitere Aktionen“ →
„Kabelliste“), umgesetzt am 2026-09-09 als eigenes Modal im Stil der
Stückliste (lazy geladen, `AccessibleDialog`).

## Bilder

| Datei                                     | Inhalt                                                              |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `cable-list-1440-light.png` / `-dark.png` | Vollständige Tabelle am Referenzplan (Auto-Wire + ELK), hell/dunkel |
| `cable-list-375-light.png` / `-dark.png`  | Mobil: gleiche Tabelle mit horizontalem Scrollen (min-width 760 px) |

Da es sich um ein **neues** Feature handelt, gibt es kein Vorher-Bild; die
Aufnahmen belegen die Nachher-Zustände. Erzeugt mit
`scripts/design/capture-cable-list.mjs` gegen den frischen Static Export
(Aufruf wie im CAD-Evidence-Skript dokumentiert).

## Ergänzende DOM-Probe (2026-09-09, Referenzplan, 1440 px)

- Spaltenköpfe: Von · Nach · Funktion · Adern · mm² · Länge · Sicherung /
  Stromkreis · Status.
- 14 Leitungszeilen nach Auto-Wire; Plus/Minus-Paare einer Strecke als eine
  Zeile mit „Adern 2“, einzelne Rückleiter als eigene Zeile („Adern 1“).
- Sortierklick „Adern“ stellt um (Kopf-Buttons mit aria-sort).
- Status-Badges aus der Plan-Validierung (kritisch/Warnung/Hinweis/OK).
- Zeilen-Klick: Modal schließt, die zugehörige Kante ist im Canvas selektiert
  (`edge.selected`), der Stromkreis-Trace aktiv (`planner-trace-active`),
  der Rest gedimmt (`planner-trace-dim`) — Zeile↔Kante synchron in beide
  Richtungen (Canvas-Selektion hebt die Zeile nicht hervor; die Richtung
  Liste→Canvas ist die Nutzerführung).
