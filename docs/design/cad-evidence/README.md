# CAD-Evidence: Funktionszonen (B3) + Kabel-Label-Dichte (B2)

Vorher/Nachher-Screenshots zum M11-1-Lückenpaket (agent.md „Design-Relaunch“,
Erweiterung „Routing-Qualität“-Konvention: Merge erst nach optischer Freigabe).

## Worauf die Bilder antworten

- **B3 – Funktionszonen sichtbar:** Hintergrund-Bänder je Funktionsstufe
  (Quellen → Laden & Wandeln → Speichern & Verteilen → Wechselrichter →
  Verbrauchen), abgeleitet aus den IST-Positionen der Bauteile
  (`components/planner/utils/functionZones.ts`, Layer in
  `components/planner/ui/FunctionZoneLayer.tsx`). Schalter „Zonen“ in den
  Canvas-Optionen, Default an, persistiert.
- **B2 – Kabel-Label-Dichte:** Stufen Voll/Kern/Aus (Schalter in den
  Canvas-Optionen). Default „Kern“: Dauerlabels nur an Hauptrouten
  (Backbone); Hover, Auswahl und Fehlerzustand blenden jedes Label ein.
  Reduziert das Dauerlabel-Rauschen an Sammelsternen (Befund B2).

## Vergleichspaare

| Datei                           | Inhalt                                  |
| ------------------------------- | --------------------------------------- |
| `plan-<vp>-<theme>-vorher.png`  | Alt-Verhalten: Zonen aus, Labels „Voll“ |
| `plan-<vp>-<theme>-nachher.png` | Neuer Default: Zonen an, Labels „Kern“  |

„Vorher“ ist kein alter Commit, sondern derselbe Planstand mit
ausgeschalteten neuen Optionen — die Paare unterscheiden sich pixelgenau nur
durch die Features (identische Geometrie, identische Daten).

Gemessene Pixel-Differenz je Paar (Referenzplan, 11 Bauteile, Auto-Wire + ELK):

| Viewport | hell   | dunkel |
| -------- | ------ | ------ |
| 375      | 23,6 % | 23,5 % |
| 768      | 17,1 % | 17,6 % |
| 1440     | 14,4 % | 10,6 % |

## Reproduzieren

```bash
npm run build                                  # Static Export (E2E-Basis)
node scripts/e2e/static-server.mjs 4173 out &  # oder: npm run dev
node scripts/design/capture-cad-evidence.mjs --base-url http://127.0.0.1:4173
```

Das Skript baut den Plan über die echte UI (Sidebar → Auto-Wire → ELK-Layout)
und schaltet die Optionen über die echten UI-Schalter um
(`scripts/design/capture-cad-evidence.mjs`).

## Blickfang fürs Review

Die große Flächenwirkung (14–24 % Pixel-Diff) stammt überwiegend von den
Zonen-Bändern; die Label-Stufen sind im Detail-Vergleich der Sammelsterne
(1440 px, Busbar/Sicherungskasten) am deutlichsten.
