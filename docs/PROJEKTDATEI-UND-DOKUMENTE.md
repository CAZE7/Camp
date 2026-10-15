# Projektdatei, Stückliste, Freigabestatus und Druckbericht

Stand: 2026-10-12 · Gilt für den Elektroplaner (`/planer`).

Diese Datei beschreibt die Funktionen, mit denen ein Plan gesichert, weitergegeben
und dokumentiert wird. Sie beschreibt auch, was **nicht** geprüft wird.

## 1. Was der Planer kann

| Funktion                            | Ort im Menü                       | Umsetzung                                            |
| ----------------------------------- | --------------------------------- | ---------------------------------------------------- |
| Projekt speichern (`.json`)         | Datei → Projekt speichern         | `store/projectFile.ts` (`serializePlannerProject`)   |
| Projekt öffnen (`.json`)            | Datei → Projekt öffnen            | `parsePlannerProject` + Store-Aktion `importProject` |
| Stückliste anzeigen / JSON kopieren | Datei → Stückliste                | `components/planner/utils/bom.ts`, `BOMModal.tsx`    |
| Stückliste als CSV                  | Stückliste → „CSV exportieren“    | `bomToCsv`                                           |
| Druckbericht (PDF über Druckdialog) | Stückliste → „Druckbericht (PDF)“ | `components/planner/utils/printReport.ts`            |
| Freigabestatus                      | Stückliste, Kopf des Berichts     | `components/planner/utils/releaseStatus.ts`          |

Die lokale Speicherung im Browser (`elektroplaner-planner-v1`; früher `werft-planner-v1`) bleibt unverändert; die
Projektdatei ist die **zusätzliche** Sicherung außerhalb des Browsers.

## 2. Projektdatei (Format 1)

```json
{
  "format": "camp-elektroplaner-projekt",
  "formatVersion": 1,
  "savedAt": "2026-10-12T10:00:00.000Z",
  "plan": {
    "viewMode": "electric",
    "season": "summer",
    "nodes": [],
    "edges": [],
    "waterNodes": [],
    "waterEdges": []
  }
}
```

- `nodes`/`edges` enthalten Bauteile, Leitungen und deren Daten (inkl. Kabelweg,
  Absicht und Länge). Messwerte der Darstellung (`measured`, `width`, `height`)
  werden **nicht** gespeichert; sie entstehen beim Laden neu.
- Das Format ist versioniert. Eine künftige Version bekommt einen Eintrag in
  `MIGRATIONS` (`n → n+1`), damit ältere Dateien erhalten bleiben.

### Import-Regeln

Der Import ist **alles oder nichts**:

| Befund                                                                    | Verhalten                                      |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| kein gültiges JSON, falsches `format`, fehlende/ungültige `formatVersion` | abgelehnt, Plan unverändert                    |
| `formatVersion` neuer als diese Version                                   | abgelehnt (Hinweis: neuere Version)            |
| Datei größer als 5 MB                                                     | abgelehnt, bevor geparst wird                  |
| Knoten/Leitung mit ungültiger Form (z. B. Position `NaN`, leere ID)       | abgelehnt                                      |
| doppelte IDs oder Leitung zu fehlendem Knoten                             | abgelehnt                                      |
| bekanntes Datenfeld mit falschem Typ (z. B. `watts: "viel"`)              | Feld wird entfernt, **Hinweis** wird angezeigt |
| fehlender Wasserbereich (`waterNodes`/`waterEdges`)                       | erlaubt (ältere Pläne)                         |

Ein erfolgreicher Import ist über **Rückgängig** (Strg+Z) zurücknehmbar. Sind im
aktuellen Plan fest verdrahtete Leitungen (Absicht „fixiert“) vorhanden, wird der
Import abgelehnt — dasselbe Verhalten wie beim Leeren des Plans.

Der Import fragt vor dem Ersetzen eines nicht leeren Plans nach.

## 3. Freigabestatus

Genau eine Regel (`assessRelease`) bestimmt den Status. Die Oberfläche liest nur das Ergebnis.

| Status                                         | Bedingung                                                                           | Dokumente                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Entwurf**                                    | Plan leer, oder Prüfung nicht vollständig entscheidbar, oder nur Warnungen/Hinweise | erlaubt, mit Kennzeichnung „Entwurf“                |
| **Softwareprüfung bestanden (keine Freigabe)** | Verifikations-Engine: `COMPLIANT` und kein kritischer, verletzter Befund            | erlaubt, mit Kennzeichnung                          |
| **Gesperrt – kritische Befunde**               | mindestens ein Befund vom Typ „kritisch“ im Zustand „verletzt“                      | **nicht erlaubt**; CSV und Bericht sind deaktiviert |

Wichtig:

- „Softwareprüfung bestanden“ ist **keine** Freigabe, **keine** Elektrofachkraft-Prüfung und **keine** normative Abnahme.
- Der Status bezieht sich auf den Planstand (`planFingerprintHash`). Stückliste, Bericht und CSV-Zeilen tragen denselben Fingerprint und den Status. Eine Änderung am Plan ändert den Fingerprint; eine ältere Bewertung kann dann nicht mehr gelten, weil die Prüfung bei jedem Öffnen aus dem aktuellen Plan berechnet wird.

## 4. Stückliste und CSV

- Eine Berechnung (`buildBom`) liefert Anzeige, JSON und CSV.
- Je Strecke gilt die **größere** von eingetragener und gerouteter Länge; Abweichungen > 10 % und fehlende Längen werden als Längenhinweis ausgewiesen.
- CSV: Semikolon-getrennt, UTF-8 mit BOM, Dezimalpunkt. Spalten:
  `Typ;Bezeichnung;Menge;Einheit;Querschnitt_mm2;Laenge_m;Quelle;Planstand;Dokumentstatus`.
- Zellen, die mit `= + - @` beginnen, werden als Text markiert (Schutz vor Formelinjektion).

## 5. Druckbericht (PDF)

Der Bericht ist ein druckoptimiertes HTML-Dokument. Im Druckdialog den Eintrag
„Als PDF speichern“ wählen. Er enthält: Dokumentstatus und Erklärung, kritische
Befunde, Stückliste mit Längenhinweisen, Prüfbericht (Regelzahlen, Befunde,
Modellgrenzen), Planstand, Engine-Version, Zertifikat-Hash und einen
Haftungs-/Geltungshinweis.

Bei gesperrtem Status enthält der Bericht **keine** Stückliste.

Der Bericht braucht ein erlaubtes Pop-up-Fenster. Der Browser meldet, wenn es blockiert wurde.

## 6. Grenzen (wichtig für die Nutzung)

- Der Planer ist ein **Planungswerkzeug**. Die Software-Prüfung deckt nur die
  implementierten Regeln ab; nicht entscheidbare Regeln werden als solche
  ausgewiesen, nicht als bestanden gezählt.
- Es gibt keine Zertifizierung, keine normative Freigabe und keine Abnahme.
- Die Stückliste ist eine Bestellhilfe, keine Materialabrechnung; Montageweg und
  Reserve müssen geprüft werden.
- Kein PDF-Format im eigentlichen Sinn: Die PDF-Datei entsteht über den Druckdialog
  des Browsers, der Schriftsatz kann je nach Browser leicht abweichen.
- Eine Projektdatei enthält keine Bilder und keine Chat-Verläufe.

## 7. Tests

| Bereich                                                        | Datei                                            |
| -------------------------------------------------------------- | ------------------------------------------------ |
| Projektdatei Export/Import, Round-trip, Fehlerfälle, Versionen | `store/projectFile.test.ts`                      |
| Store-Import, Undo, fixierte Leitungen                         | `store/importProject.test.ts`                    |
| Stückliste, Längenquellen, CSV-Format und -Schutz              | `components/planner/utils/bom.test.ts`           |
| Freigabestatus                                                 | `components/planner/utils/releaseStatus.test.ts` |
| Druckbericht, HTML-Escaping, gesperrter Plan                   | `components/planner/utils/printReport.test.ts`   |
| Dialog, Sperre des CSV-Exports bei kritischem Befund           | `components/planner/BOMModal.test.tsx`           |

## 8. Noch offen

- Kein End-to-End-Test (Playwright) für Projekt speichern → neu laden → öffnen; die Logik ist unit- und store-getestet.
- Die Freigabe-Regel bewertet die Elektrik (Verifikations-Engine). Der Wasserbereich fließt nur über Längen in die Stückliste ein und ist nicht Teil der Prüfung.
- Die Website `/elektrik-planung/` beschreibt die Funktionen noch nicht in dem Umfang, der oben steht.
