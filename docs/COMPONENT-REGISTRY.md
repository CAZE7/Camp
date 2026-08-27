# Bauteil-Registry — Analyse und Umsetzung

Stand: 2026-08-21 · Betrifft AGENTS.md **K4**

## 1. Analyse: wo Bauteile vorher definiert waren

AGENTS.md verlangt ausdrücklich, erst zu prüfen, ob eine Registry die
Komplexität tatsächlich senkt. Die Bestandsaufnahme:

| #   | Ort                                        | Was dort stand                                                                     |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | `components/Sidebar.tsx`                   | Label, Kategorie, Beschreibung, Icon (3 Arrays: Elektrik, Wasser, Geräte-Vorlagen) |
| 2   | `components/planner/constants.ts`          | `NODE_TYPES`: Typ → React-Komponente (22 Einträge, 15 Imports)                     |
| 3   | `components/planner/BOMModal.tsx`          | `TYPE_INFO`: Label **nochmal** + Zweck (22 Einträge)                               |
| 4   | `components/planner/utils/domainFilter.ts` | `MINIMAP_NODE_TOKEN` (17 Einträge) und `NODE_DOMAINS` (17 Einträge)                |
| 5   | `lib/electrical.ts`                        | AC-Typlisten in `getEdgeDomain` / `getHandleDomain`                                |
| 6   | `store/usePlannerStore.ts`                 | Standardwerte und Verbindungsregeln je Typ                                         |

**Ein neues Bauteil erforderte also Änderungen an bis zu sechs Dateien.**

### Der Beweis, dass das schadet

Die Tabellen waren bereits auseinandergelaufen:

| Bauteil | Sidebar                   | Stückliste                  |
| ------- | ------------------------- | --------------------------- |
| Shunt   | „Batteriemonitor (Shunt)“ | „Batteriemonitor mit Shunt“ |

Zwei Namen für dasselbe Bauteil in derselben Anwendung — genau der Drift, den
eine gemeinsame Quelle verhindert. Das ist der sachliche Grund für die
Registry; ohne einen solchen Befund wäre sie nach AGENTS.md K4 nicht
gerechtfertigt gewesen.

## 2. Umsetzung

```
components/registry/
├── componentRegistry.ts   Typen, Validierung, register/get/list
├── builtinComponents.ts   die 22 eingebauten Bauteile (eine Zeile pro Bauteil)
└── index.ts               registriert die Builtins beim Import
```

`ComponentSpec` beschreibt ein Bauteil vollständig:

```ts
{
  id, label, category, description, purpose,   // Text
  mode: 'electric' | 'water',                  // Betriebsart
  domains: ('DC_12V'|'AC_230V'|'Solar'|'WATER')[],
  icon,                                        // Sidebar
  node,                                        // React-Flow-Komponente
  handles: [{ id, type: 'source'|'target', domain }],
  defaults?, selectable?
}
```

### Umgestellte Konsumenten

| Datei                           | vorher                                | jetzt                       |
| ------------------------------- | ------------------------------------- | --------------------------- |
| `Sidebar.tsx`                   | zwei Arrays mit 21 Einträgen          | `listSelectableSpecs(mode)` |
| `planner/constants.ts`          | 15 Imports + 22-Zeilen-Map            | `buildNodeTypes()`          |
| `planner/BOMModal.tsx`          | `TYPE_INFO` mit 22 Einträgen          | `getComponentSpec(type)`    |
| `planner/utils/domainFilter.ts` | zwei Typ-Tabellen mit je 17 Einträgen | Domänen aus der Spec        |

### Bewusst NICHT umgestellt

- **`lib/electrical.ts` (`getHandleDomain`, `getEdgeDomain`)** und
  **`lib/autoWire.ts`.** Dort steht elektrische Sicherheitslogik. Sie darf
  nicht davon abhängen, ob jemand ein Bauteil korrekt registriert hat: eine
  vergessene Registrierung würde sonst die AC/DC-Trennung aushebeln. Die
  Registry beschreibt, _was_ ein Bauteil ist — nicht, wie daraus ein sicherer
  Stromkreis wird. Die `handles`-Angaben der Spec sind Dokumentation und
  Prüfgrundlage, keine Laufzeitquelle für die Validierung.
- **Die Node-Komponenten selbst.** Batterie, Wechselrichter und Leerrohr haben
  fachlich unterschiedliche Darstellungen und Inspector-Felder. Eine
  generische „Spec rendert sich selbst“-Lösung würde diese Spezialfälle in
  Konfiguration übersetzen und dabei unübersichtlicher werden.
- **Geräte-Vorlagen** („Induktionskochfeld“, 2000 W). Das sind keine
  Bauteiltypen, sondern vorbelegte Varianten von `consumer` / `consumer230v`.
  Als Specs registriert hätten sie doppelte IDs. Sie bleiben eine eigene
  Liste in `components/sidebar/catalog.ts` (`deviceAssistant`).
- **`charger`** bleibt als Alt-Typ registriert (`selectable: false`): alte
  gespeicherte Pläne enthalten ihn, er muss darstellbar und benennbar bleiben,
  aber nicht mehr angeboten werden.

## 3. Laufzeitvalidierung

`registerComponent` prüft und wirft statt still zu übernehmen:

- ID vorhanden, einfacher Bezeichner, **nicht doppelt**
- `label`, `category`, `description`, `purpose` nicht leer
- `mode` gültig, `domains` nicht leer und bekannt
- `icon` und `node` vorhanden
- keine doppelten Anschlüsse (`source:plus` nur einmal)
- keine Domänenmischung: Wasser-Bauteil mit DC-Anschluss wird abgelehnt

Fehlermeldungen nennen immer die betroffene ID (`ComponentSpecError`).

## 4. Beleg: ein neues Bauteil ist isoliert ergänzbar

`components/registry/componentRegistry.test.tsx` registriert im Test ein
Bauteil `testHeatPump`, das im Produktionscode **nirgends** vorkommt, und
prüft danach:

| Konsument          | Erwartung                                            | Ergebnis |
| ------------------ | ---------------------------------------------------- | -------- |
| Sidebar            | Kachel mit Label und `data-component-type` erscheint | ✓        |
| `buildNodeTypes()` | Typ ist in der React-Flow-Tabelle                    | ✓        |
| Domänen-Filter     | `nodeDomains()` liefert die Spec-Domäne              | ✓        |
| Minimap            | Farbe entspricht der Domäne, nicht einer Typ-Tabelle | ✓        |
| Stückliste         | Label und Zweck aus der Spec                         | ✓        |
| Deregistrierung    | überall wieder verschwunden                          | ✓        |

**Keine dieser Dateien wurde für das Testbauteil angefasst.**

### Dabei gefundene Schwäche (behoben)

Die erste Fassung las den Katalog beim Laden des Moduls
(`const components = listSelectableSpecs('electric')`). Ein nachträglich
registriertes Bauteil war damit unsichtbar — die Registry hätte nur für
Bauteile funktioniert, die zufällig vor dem ersten Import registriert werden.
Behoben: `Sidebar` liest den Katalog per `useMemo` bei jedem Rendern.

## 5. Liste aller Kernänderungen

```
neu       components/registry/componentRegistry.ts     (Typen, Validierung, API)
neu       components/registry/builtinComponents.ts     (22 Specs)
neu       components/registry/index.ts                 (Registrierung beim Import)
neu       components/registry/componentRegistry.test.tsx (20 Tests)
geändert  components/Sidebar.tsx                       (Katalog aus Registry)
geändert  components/planner/constants.ts              (NODE_TYPES aus Registry)
geändert  components/planner/BOMModal.tsx              (Label/Zweck aus Registry)
geändert  components/planner/utils/domainFilter.ts     (Domänen aus Registry)
```

Netto entfallen vier von Hand gepflegte Typ-Tabellen mit zusammen
78 Einträgen.

## 6. Bekannte Grenzen

- **Zwei Wahrheiten für Anschlüsse.** Die `handles` der Spec beschreiben, was
  die Node-Komponente rendert — erzwungen wird das nicht zur Laufzeit,
  sondern durch Tests. Eine automatische Ableitung würde bedeuten, die
  Node-Komponenten generisch zu machen (siehe Abschnitt 2).
- **Registrierung ist global.** Es gibt einen Prozess-weiten Registry-Store.
  Für Tests existiert `unregisterComponent`; ein echtes Plugin-System mit
  Isolation pro Plan gibt es nicht (und wird ohne Anwendungsfall auch nicht
  gebaut).
- **`roofSolar`** ist ein Dach-Element aus dem Dachplaner, kein
  Planer-Bauteil. Es hat bewusst keine Spec und wird in `domainFilter.ts`
  explizit als Solar behandelt.
