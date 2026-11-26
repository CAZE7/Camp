import React from 'react';
import {
  Droplets,
  CookingPot,
  Coffee,
  Refrigerator,
  Flame,
  Fan,
  Lightbulb,
  Laptop,
  Smartphone,
  Box,
} from 'lucide-react';
import { listSelectableSpecs, type ComponentSpec } from '../registry';

export type Comp = {
  type: string;
  label: string;
  category: string;
  description: string;
  icon: React.ElementType;
  watts?: number;
  /** Nutzungsdauer (h/Tag) — nur für selbst angelegte Geräte (R8-07). */
  hours?: number;
};

/**
 * Bauteil-Katalog aus der Registry (K4).
 *
 * Vorher standen Label, Kategorie, Beschreibung und Icon hier — und dieselben
 * Labels nochmal in der Stückliste. Jetzt gibt es eine Quelle:
 * `components/registry`. Ein dort registriertes Bauteil erscheint
 * automatisch in dieser Liste.
 */
const toComp = (spec: ComponentSpec): Comp => ({
  type: spec.id,
  label: spec.label,
  category: spec.category,
  description: spec.description,
  icon: spec.icon,
});

/**
 * Der Katalog wird bei jedem Rendern aus der Registry gelesen, nicht einmalig
 * beim Laden des Moduls. Sonst wäre ein nachträglich registriertes Bauteil
 * (Plugin, Test, künftige Lazy-Registrierung) unsichtbar — genau das hat der
 * Registry-Test aufgedeckt.
 */
export const useComponentCatalog = (mode: 'electric' | 'water'): Comp[] =>
  React.useMemo(() => listSelectableSpecs(mode).map(toComp), [mode]);

/**
 * Geräte-Vorlagen sind KEINE eigenen Bauteiltypen, sondern vorbelegte
 * Varianten vorhandener Typen (gleicher `type`, anderer Name und Wattwert).
 * Sie bleiben deshalb bewusst eine eigene Liste — eine Registrierung als
 * Bauteil würde doppelte IDs erzeugen.
 */
export const deviceAssistant: Comp[] = [
  {
    type: 'consumer230v',
    label: 'Induktionskochfeld',
    watts: 2000,
    category: 'Geräte-Vorlagen',
    description: 'Typischer starker 230-V-Verbraucher.',
    icon: CookingPot,
  },
  {
    type: 'consumer230v',
    label: 'Kaffeemaschine',
    watts: 1500,
    category: 'Geräte-Vorlagen',
    description: 'Typischer kurzzeitiger 230-V-Verbraucher.',
    icon: Coffee,
  },
  {
    type: 'consumer',
    label: 'Kompressorkühlschrank',
    watts: 60,
    category: 'Geräte-Vorlagen',
    description: 'Effizienter 12-V-Kühlschrank.',
    icon: Refrigerator,
  },
  {
    type: 'consumer',
    label: 'Standheizung',
    watts: 40,
    category: 'Geräte-Vorlagen',
    description: '12-V-Strombedarf einer Dieselheizung.',
    icon: Flame,
  },
  {
    type: 'consumer',
    label: 'Dachventilator',
    watts: 30,
    category: 'Geräte-Vorlagen',
    description: 'Belüftung für den Wohnraum.',
    icon: Fan,
  },
  {
    type: 'consumer',
    label: 'LED-Beleuchtung',
    watts: 20,
    category: 'Geräte-Vorlagen',
    description: 'Sparsame 12-V-Beleuchtung.',
    icon: Lightbulb,
  },
  {
    type: 'consumer230v',
    label: 'Satelliten-Internet',
    watts: 50,
    category: 'Geräte-Vorlagen',
    description: 'Internet-Hardware mit Netzteil.',
    icon: Box,
  },
  {
    type: 'consumer230v',
    label: 'Laptop-Ladegerät',
    watts: 65,
    category: 'Geräte-Vorlagen',
    description: '230-V-Netzteil für einen Laptop.',
    icon: Laptop,
  },
  {
    type: 'consumer',
    label: 'Handyladegerät',
    watts: 18,
    category: 'Geräte-Vorlagen',
    description: 'USB-Ladeanschluss im 12-V-Netz.',
    icon: Smartphone,
  },
  {
    type: 'consumer',
    label: 'Elektrische Wasserpumpe',
    watts: 40,
    category: 'Geräte-Vorlagen',
    description: 'Stromanschluss der Wasserpumpe.',
    icon: Droplets,
  },
];

export const DEFAULT_OPEN_CATEGORY: Record<'electric' | 'water', string> = {
  electric: 'Strom speichern',
  water: 'Speichern',
};

/**
 * Gruppierung nach Kategorie — reine Funktion, damit die Sidebar-Schale
 * schlank bleibt und die Gruppierung separat testbar ist. Die Reihenfolge
 * folgt dem Erstauftreten (Insertion Order) im gefilterten Katalog.
 */
export const groupByCategory = (
  components: Comp[]
): {
  categories: string[];
  byCategory: Record<string, Comp[]>;
} => {
  const categories: string[] = [];
  const byCategory: Record<string, Comp[]> = {};
  for (const component of components) {
    const existing = byCategory[component.category];
    if (!existing) {
      byCategory[component.category] = [component];
      categories.push(component.category);
    } else {
      existing.push(component);
    }
  }
  return { categories, byCategory };
};

/**
 * Alltagswörter je Katalog-Label (R8-07). Die Suche fand „Licht“ nur in
 * Beschreibungen („Lichtmaschine“, „Sonnenlicht“), aber nicht die
 * LED-Beleuchtung; „Kühlbox“ und „Inverter“ hatten gar keine Treffer,
 * obwohl die Bauteile existieren. Synonyme stehen am Label — eine Quelle,
 * keine zweite Liste, die vom Katalog abweichen kann.
 */
export const SUCH_SYNONYME: Readonly<Record<string, readonly string[]>> = {
  'LED-Beleuchtung': ['licht', 'lampe', 'leuchte', 'beleuchtung', 'deckenlicht'],
  Kompressorkühlschrank: ['kuhlbox', 'kuhlschrank', 'fridge', 'kuhlung'],
  Wechselrichter: ['inverter', 'spannungswandler'],
  Solarmodul: ['solarpanel', 'panel', 'pv', 'photovoltaik', 'solar'],
  'Ladebooster (DC-DC)': ['booster', 'lichtmaschine', 'dcdc', 'ladewandler'],
  Sicherungskasten: ['sicherungen', 'verteiler', 'sicherungsverteiler'],
  Standheizung: ['heizung', 'heizgerat', 'dieselheizung'],
  Dachventilator: ['lufter', 'ventilator', 'maxxfan', 'dachlufter'],
  Kaffeemaschine: ['kaffee', 'espresso', 'kaffeeautomat'],
  Induktionskochfeld: ['herd', 'kochfeld', 'kochen', 'induktion'],
  Handyladegerät: ['handy', 'usb', 'smartphone', 'laden'],
  'Laptop-Ladegerät': ['laptop', 'notebook', 'computer'],
  'Satelliten-Internet': ['starlink', 'internet', 'wlan', 'satellit'],
  'Elektrische Wasserpumpe': ['pumpe', 'wasserpumpe', 'druckpumpe'],
  Batterie: ['akku', 'bordbatterie', 'speicher'],
};

/** Suchnormalisierung: Kleinschreibung, Umlaute und ß angleichen. */
export function normalizeSearch(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replaceAll('ß', 'ss').trim();
}

/**
 * Treffer-Rang eines Katalogeintrags: 0 = Name, 1 = Synonym exakt, 2 = Synonym-Wortteil, 3 = Beschreibung,
 * -1 = kein Treffer. Namensergebnisse stehen damit immer vor
 * Beschreibungstreffern (R8-07: „Licht“ lieferte Ladebooster vor LED).
 */
export function searchRank(item: Pick<Comp, 'label' | 'description'>, query: string): number {
  const q = normalizeSearch(query);
  if (q === '') return -1;
  if (normalizeSearch(item.label).includes(q)) return 0;
  const synonyme = (SUCH_SYNONYME[item.label] ?? []).map(normalizeSearch);
  // Exaktes Alltagswort („Licht“) schlägt Wortteil-Treffer („Lichtmaschine“).
  if (synonyme.some((wort) => wort === q)) return 1;
  if (synonyme.some((wort) => wort.includes(q) || q.includes(wort))) return 2;
  if (normalizeSearch(item.description).includes(q)) return 3;
  return -1;
}
