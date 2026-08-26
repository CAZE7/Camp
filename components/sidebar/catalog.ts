import React from 'react';
import {
  Droplets, CookingPot, Coffee, Refrigerator, Flame, Fan, Lightbulb,
  Laptop, Smartphone, Box,
} from 'lucide-react';
import { listSelectableSpecs, type ComponentSpec } from '../registry';

export type Comp = {
  type: string;
  label: string;
  category: string;
  description: string;
  icon: React.ElementType;
  watts?: number;
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
  { type: 'consumer230v', label: 'Induktionskochfeld', watts: 2000, category: 'Geräte-Vorlagen', description: 'Typischer starker 230-V-Verbraucher.', icon: CookingPot },
  { type: 'consumer230v', label: 'Kaffeemaschine', watts: 1500, category: 'Geräte-Vorlagen', description: 'Typischer kurzzeitiger 230-V-Verbraucher.', icon: Coffee },
  { type: 'consumer', label: 'Kompressorkühlschrank', watts: 60, category: 'Geräte-Vorlagen', description: 'Effizienter 12-V-Kühlschrank.', icon: Refrigerator },
  { type: 'consumer', label: 'Standheizung', watts: 40, category: 'Geräte-Vorlagen', description: '12-V-Strombedarf einer Dieselheizung.', icon: Flame },
  { type: 'consumer', label: 'Dachventilator', watts: 30, category: 'Geräte-Vorlagen', description: 'Belüftung für den Wohnraum.', icon: Fan },
  { type: 'consumer', label: 'LED-Beleuchtung', watts: 20, category: 'Geräte-Vorlagen', description: 'Sparsame 12-V-Beleuchtung.', icon: Lightbulb },
  { type: 'consumer230v', label: 'Satelliten-Internet', watts: 50, category: 'Geräte-Vorlagen', description: 'Internet-Hardware mit Netzteil.', icon: Box },
  { type: 'consumer230v', label: 'Laptop-Ladegerät', watts: 65, category: 'Geräte-Vorlagen', description: '230-V-Netzteil für einen Laptop.', icon: Laptop },
  { type: 'consumer', label: 'Handyladegerät', watts: 18, category: 'Geräte-Vorlagen', description: 'USB-Ladeanschluss im 12-V-Netz.', icon: Smartphone },
  { type: 'consumer', label: 'Elektrische Wasserpumpe', watts: 40, category: 'Geräte-Vorlagen', description: 'Stromanschluss der Wasserpumpe.', icon: Droplets },
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
export const groupByCategory = (components: Comp[]): {
  categories: string[];
  byCategory: Record<string, Comp[]>;
} => {
  const categories: string[] = [];
  const byCategory: Record<string, Comp[]> = {};
  for (const component of components) {
    if (!byCategory[component.category]) {
      byCategory[component.category] = [];
      categories.push(component.category);
    }
    byCategory[component.category].push(component);
  }
  return { categories, byCategory };
};
