# Verlegebedingungen für Fahrzeugleitungen (P0-3, 2026-11-03)

Dieses Dokument ist die **Datengrundlage** der auswählbaren Verlegebedingungen
im Kabel-Inspektor (`lib/cableConditions.ts`). Es beschreibt, welche Zahlen
gerechnet, welche angenommen und welche ausdrücklich **nicht** behauptet werden.

## 1. Ausgangslage und Abgrenzung

Vor diesem Schnitt galt für jede Leitung, unabhängig vom Einbauort:

```text
I_z = I_z,Tabelle · 0,7     (DERATE_FACTOR, dokumentierte Planerpauschale)
```

Der Faktor 0,7 ersetzte Temperatur, Bündelung und Verlegeart zugleich. Das war
ehrlich kommentiert (AUDIT NORM-003 / ELE-001), aber fachlich zu grob: Ein
einzeln im Innenraum verlegtes Kabel und ein Bündel im 60 °C heißen Motorraum
bekamen denselben Querschnitt, dieselbe Sicherung und dasselbe „geeignet".

**Dieser Schnitt fügt KEINEN weiteren pauschalen Sicherheitsfaktor hinzu.**
Die 0,7-Pauschale bleibt als _untere Grenze_ (`min`) erhalten. Neu ist, dass
die beiden bereits im Repo dokumentierten, physikalischen Korrekturfaktoren
**je Leitung** aus wählbaren, messbaren Zuständen gesetzt werden:

```text
I_z = I_z,Basis · min(0,7, f₁ · f₂ · f₃)

f₁ = √((T_max − ϑ_U) / (T_max − 30 °C))
f₂ = k_B(n)                                (1…9 belastete Stromkreise)
f₃ = 1                                     (bewusst: keine geprüfte Tabelle)
```

Dies ist dieselbe eine I_z-Funktion wie bisher (`calculateCableIz` in
`lib/electrical.ts`). Es gibt keine zweite Rechnung und keine zweite Wahrheit.

## 2. Herkunft der Zahlen

| Größe              | Wert                                                                     | Herkunft / Status                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `I_z,Basis` je mm² | 16,5 / 23 / 30 / 38 / 52 / 69 / 90 / 111 / 136 / 172 A                   | Veröffentlichte Belastbarkeitstabellen **DIN VDE 0298-4, Verlegeart B2** (im Rohr auf Wand), 2 belastete Adern, 30 °C, Kupfer/PVC. Sekundärquellen-Transkription, **kein lizenzierter Normtext**; 50/70 mm² weichen von einer verbreiteten Referenz leicht ab und sind aus Golden-Master-Gründen unverändert übernommen (AUDIT NORM-003). |
| `T_max`            | PVC 70 °C, XLPE 90 °C                                                    | IEC 60364-5-52 Tab. 52-4, bereits in `MAX_CONDUCTOR_TEMPERATURE_C` (`lib/electrical.ts`) hinterlegt.                                                                                                                                                                                                                                      |
| `f₁`               | Wurzelformel oben                                                        | `ambientTemperatureFactor()`; IEC-60364-5-52-Temperaturkorrektur. Ein Kältebonus (f₁ > 1) wird nie kapazitätserhöhend angesetzt.                                                                                                                                                                                                          |
| `f₂`               | 1,00 / 0,80 / 0,70 / 0,65 / 0,60 / 0,57 / 0,54 / 0,52 / 0,50 für n = 1…9 | `VDE_GROUP_FACTORS`, Transkription zweier unabhängiger Publikationen zu DIN VDE 0298-4 Tab. 22 / IEC 60364-5-52 (Q1: electrical-installation.org, Stand 2020-12-29; Q2: elekrechner.com, Stand 2026-03-07; Zitatprüfung 2026-09-28, s. Quellkommentar in `lib/electrical.ts`). n > 9 ist **nicht definiert** ⇒ Fehler, kein Schätzwert.   |
| `f₃`               | 1,00                                                                     | Für Verlegeart-Korrekturen liegt im Repo **keine geprüfte Tabelle** vor. Es wird kein Faktor erfunden; der Parameter ist in `calculateCableIz` vorhanden, damit ein künftig belegter Wert an derselben Stelle landet.                                                                                                                     |
| `0,7`              | Planerpauschale                                                          | `DERATE_FACTOR`, AUDIT ELE-001. Bleibt die strikte Untergrenze: mildere Bedingungen können die Belastbarkeit **nie erhöhen**.                                                                                                                                                                                                             |
| Fahrzeugleitung    | FLRY-B → PVC/70 °C, FLR2X-B → XLPE/90 °C                                 | **Nur Temperaturklasse**, keine ISO-6722-Ampazitätstabelle. Die Basistabelle stammt aus der Hausinstallation, nicht aus einer Fahrzeugleitungsnorm.                                                                                                                                                                                       |
| `manufacturerIzA`  | frei, > 0 A                                                              | Konkreter Datenblattwert des Nutzers; übersteuert die Tabellenrechnung und wird im Bericht als Herstellerangabe ausgewiesen.                                                                                                                                                                                                              |

## 3. Auswählbare Bedingungen

| ID                | Situation                                 | ϑ_U    | n      | Isolierung | Wirkung                                                               |
| ----------------- | ----------------------------------------- | ------ | ------ | ---------- | --------------------------------------------------------------------- |
| `reference`       | bisheriges Auslieferungsmodell            | 30 °C  | 1      | PVC        | unverändert `0,7` (byte-stabile Golden Master)                        |
| `interior-single` | Innenraum, einzeln frei                   | 30 °C  | 1      | PVC        | `f₁·f₂ = 1` ⇒ Pauschale 0,7 bleibt maßgeblich                         |
| `interior-bundle` | Kabelkanal, 3 Stromkreise                 | 30 °C  | 3      | PVC        | `f₂ = 0,70` ⇒ genau die Pauschale, keine Verschärfung                 |
| `cavity`          | hinter Verkleidung / Dachhohlraum         | 40 °C  | 1      | PVC        | `f₁ ≈ 0,866` ⇒ Pauschale 0,7 bleibt maßgeblich                        |
| `engine-bay`      | Motorraum / Abgasnähe                     | 60 °C  | 1      | PVC        | `f₁ = 0,50` ⇒ **I_z halbiert**, Querschnitt und Sicherung ändern sich |
| `roof-solar`      | Dach unter Modul, 2 Stränge               | 60 °C  | 2      | XLPE       | `f₁ ≈ 0,707 × f₂ 0,80 ≈ 0,566` ⇒ deutliche Abminderung                |
| `custom`          | eigene Temperatur, Bündelung, Leitungstyp | Nutzer | Nutzer | Nutzer     | dieselben dokumentierten Formeln                                      |
| `datasheet`       | Herstellerangabe                          | —      | —      | —          | `I_z` direkt aus dem Datenblatt                                       |

Die Temperaturwerte der Presets sind **Planungsannahmen für typische Zonen**,
keine Messwerte und keine Herstellerangaben. Sie werden im Inspektor und im
Prüfbericht als Annahmen genannt (`assumptions`). Wer eine echte Messung oder
ein Datenblatt hat, wählt `custom` bzw. `datasheet`.

## 4. Bewertungsstufen (kein „geeignet" ohne Grundlage)

| Anzeige                                     | Bedeutung                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **rechnerisch mit Referenzmodell bewertet** | keine eigene Bedingung; die dokumentierte 0,7-Pauschale auf B2/30 °C gilt                                               |
| **mit Annahmen bewertet**                   | Preset oder eigene Temperatur/Bündelung; die Zahlenbasis ist benannt, die Eingaben sind Annahmen                        |
| **Herstellerangabe hinterlegt**             | `manufacturerIzA` aus dem Datenblatt übersteuert die Tabelle                                                            |
| **nicht bewertbar**                         | ungültige/fehlende Eingaben (z. B. ϑ_U ≥ T_max, n > 9) ⇒ `UNVERIFIABLE` im Prüfbericht, kein stiller Rückfall auf 30 °C |

Oberhalb der größten Normstufe (70 mm²) liefert die Suche `outside-model` und
einen `fuseWarning`-Marker; es wird **nie** behauptet, „70 mm² reicht".

### 4.1 Eingaberegeln (Review-Korrektur 2026-11-04)

| Eingabe                                                                  | Verhalten                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| gar keine Felder                                                         | Referenzmodell, byte-stabil (Altpläne, Golden Master)                                                                                      |
| `installationCondition: 'reference'` ohne weitere Felder                 | ausdrücklich Referenz; überschreibt auch strengere Laufannahmen des Prüfberichts                                                           |
| eigene Werte **ohne** gewähltes Preset                                   | werden als `custom` gewertet, **nicht** ignoriert                                                                                          |
| `datasheet` ohne `manufacturerIzA`                                       | Fehler / `UNVERIFIABLE` — es wird keine 30-°C-Temperatur angenommen                                                                        |
| unbekannte Preset-ID, unbekannter Leitungstyp, `NaN`, n > 9, ϑ_U ≥ T_max | Fehler; Inspektor zeigt ihn, Prüfbericht `UNVERIFIABLE`, AutoWire markiert die Leitung als **nicht ausführbar** statt den Lauf abzubrechen |
| `reference` plus eigene Werte                                            | widersprüchlich ⇒ Fehler, kein stilles Verwerfen                                                                                           |

Physisch unzulässige, aber schema-gültige Werte (z. B. 95 °C bei PVC) bleiben
absichtlich im Plan sichtbar: Sie werden nicht durch einen Ranger-Check
gelöscht, sondern als Fehler gemeldet. Nur Werte außerhalb der Schema-Grenzen
werden beim Speichern bzw. Import verworfen.

### 4.2 Begründung im AutoWire-Review (P0-Nachlauf 2026-11-04)

Der Review-Dialog zeigt je vorgeschlagener Leitung Vorher/Nachher für
Querschnitt, Sicherung und Verlegebedingung. Die Begründung nennt bei eigener
Bedingung die **Bewertungsstufe** (`Referenzmodell`, `eigene Annahmen`,
`Datenblatt`) und die `explanation` aus `lib/cableConditions.ts`; bei ungültigen
Angaben steht „Nicht ausführbar … UNVERIFIABLE". Die Werte stammen aus den
Kantendaten, **nicht** aus einer erneuten Berechnung der Anzeige
(`lib/autoWire/reviewDiff.ts`). Eine Sammelnote allein (`autowire-condition-note`)
hätte die Änderung an der einzelnen Leitung unsichtbar gelassen.

## 5. Wo die Bedingungen wirken

- **AutoWire:** `sizeDcEdges` (thermischer Mindestquerschnitt), `applyFuseSizes`
  (Sicherung ≤ I_z), `markInfeasibleSizing`, `sizeAcEdges` und die
  Selektivitätskoordination lesen `cableSizingFor(edge.data)`.
- **Verifikation:** `lib/verify/ampacity.ts` setzt für AMP-001/AMP-002 die
  I_z der jeweiligen Kante statt der globalen Laufannahme; `izBreakdown`
  im Bericht enthält die Faktoren und die Herkunft.
- **Inspektor:** Auswahl, I_z, größte zulässige Sicherung, Rechenweg und
  Datengrundlage; Persistenz über `edge.data` mit Schemafeldern in
  `lib/edgeSchema.ts` (unbekannte Werte werden entfernt, nicht geraten).
- **AutoWire-Review:** Eigene Verlegebedingungen werden im Vorschlag vor der
  Übernahme namentlich erklärt („Querschnitt und Sicherung gegen die eigene
  I_z, nicht gegen die 0,7-Pauschale").
- **Gespeicherte Pläne ohne Angabe** bleiben byte-stabil: der Referenzpfad
  delegiert an die unveränderten Funktionen. Keine Golden-Master-Neuerfassung.

## 6. Ausdrückliche Grenzen

- **Keine normgeprüfte Auslegung.** Die Basistabelle ist eine
  Hausinstallations-Verlegeart (B2); eine vollständige Fahrzeugleitungsnorm
  (ISO 6722 / DIN EN 1648-2), Leitungslängen, Wärmeabgabe an Karosserie,
  Steckverbinder, Übergangswiderstände und Hersteller-Kennlinien sind nicht
  modelliert.
- **Kein f₃.** Für Verlegearten (Rohr, Kanal, frei, auf Wand) existiert im Repo
  keine zitiergeprüfte Korrekturtabelle. Der Faktor bleibt 1,0 und wird als
  solche Lücke ausgewiesen.
- **230 V:** Dieses Modell bewertet die thermische Belastbarkeit einer Leitung,
  nicht L/N/PE, Netzform, FI/LS, Umschaltung oder Rückspeisung. Die 230-V-Prüfung
  und die Abnahme dürfen nur durch entsprechend qualifiziertes Personal erfolgen.
- **Kein Ersatz für Messung oder Datenblatt.** Preset-Temperaturen sind
  Annahmen; bei kritischen Strömen (Batteriehauptstrang, Wechselrichter) ist
  die tatsächliche Einbausituation zu prüfen.
