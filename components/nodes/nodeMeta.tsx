import {
  Battery,
  BatteryCharging,
  Cable,
  Droplet,
  Droplets,
  Filter,
  Plug,
  Plug2,
  PlugZap,
  Repeat,
  Shield,
  ShieldCheck,
  ShowerHead,
  Sun,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface NodeMeta {
  label: string;
  icon: LucideIcon;
  /** CSS var referencing the token (e.g. `var(--acc-battery)`). */
  accent: string;
  /** Tailwind colour class utility for the accent. */
  accentClass: string;
}

export const NODE_META: Record<string, NodeMeta> = {
  battery: { label: 'Batterie', icon: Battery, accent: 'var(--acc-battery)', accentClass: 'acc-battery' },
  consumer: { label: 'Verbraucher', icon: Plug, accent: 'var(--acc-consumer)', accentClass: 'acc-consumer' },
  charger: { label: 'Ladequelle', icon: BatteryCharging, accent: 'var(--acc-charger)', accentClass: 'acc-charger' },
  fuse: { label: 'Sicherungskasten', icon: Shield, accent: 'var(--acc-fuse)', accentClass: 'acc-fuse' },
  shorePower: { label: 'Landstromanschluss', icon: PlugZap, accent: 'var(--acc-shore)', accentClass: 'acc-shore' },
  consumer230v: { label: '230V Verbraucher', icon: Plug2, accent: 'var(--acc-consumer230v)', accentClass: 'acc-consumer230v' },
  inverter: { label: 'Wechselrichter', icon: Repeat, accent: 'var(--acc-inverter)', accentClass: 'acc-inverter' },
  solar: { label: 'Solarmodul', icon: Sun, accent: 'var(--acc-solar)', accentClass: 'acc-solar' },
  ground: { label: 'Massepunkt', icon: ShieldCheck, accent: 'var(--acc-ground)', accentClass: 'acc-ground' },
  conduit: { label: 'Leerrohr', icon: Cable, accent: 'var(--acc-conduit)', accentClass: 'acc-conduit' },
  busbar: { label: 'Main Busbar', icon: Zap, accent: 'var(--acc-busbar)', accentClass: 'acc-busbar' },
  shunt: { label: 'Smart Shunt', icon: Zap, accent: 'var(--acc-shunt)', accentClass: 'acc-shunt' },

  // Water / sanitary components (mapped from reactflow node type)
  freshWaterTank: { label: 'Frischwassertank', icon: Droplet, accent: 'var(--acc-water-fresh)', accentClass: 'acc-water-fresh' },
  grayWaterTank: { label: 'Grauwassertank', icon: Droplets, accent: 'var(--acc-water-gray)', accentClass: 'acc-water-gray' },
  pump: { label: 'Wasserpumpe', icon: Waves, accent: 'var(--acc-pump)', accentClass: 'acc-pump' },
  accumulator: { label: 'Druckgefäß', icon: Droplets, accent: 'var(--acc-accumulator)', accentClass: 'acc-accumulator' },
  preFilter: { label: 'Vorfilter', icon: Filter, accent: 'var(--acc-prefilter)', accentClass: 'acc-prefilter' },
  sink: { label: 'Spüle', icon: Droplet, accent: 'var(--acc-sink)', accentClass: 'acc-sink' },
  shower: { label: 'Dusche', icon: ShowerHead, accent: 'var(--acc-shower)', accentClass: 'acc-shower' },
};
