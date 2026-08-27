import {
  Battery,
  Gauge,
  Network,
  Sun,
  RefreshCw,
  PlugZap,
  Zap,
  Lightbulb,
  Shield,
  Earth,
  Cable,
  Droplets,
  Waves,
  Filter,
  ShowerHead,
  CircleGauge,
} from 'lucide-react';

import BatteryNode from '../nodes/BatteryNode';
import ConsumerNode from '../nodes/ConsumerNode';
import ChargerNode from '../nodes/ChargerNode';
import FuseNode from '../nodes/FuseNode';
import ShorePowerNode from '../nodes/ShorePowerNode';
import Consumer230VNode from '../nodes/Consumer230VNode';
import InverterNode from '../nodes/InverterNode';
import SolarNode from '../nodes/SolarNode';
import GroundNode from '../nodes/GroundNode';
import ConduitNode from '../nodes/ConduitNode';
import BusbarNode from '../nodes/BusbarNode';
import ShuntNode from '../nodes/ShuntNode';
import WaterNode from '../nodes/WaterNode';

import type { ComponentSpec, HandleSpec } from './componentRegistry';

/**
 * components/registry/builtinComponents.ts
 *
 * Die eingebauten Bauteile. Eine Zeile pro Bauteil statt sechs verstreuter
 * Einträge (Sidebar, NODE_TYPES, Stückliste, Domänen-Filter, Minimap).
 *
 * Die Anschluss-Listen spiegeln exakt das Markup der Node-Komponenten
 * (`components/nodes/*.tsx`, siehe `handleLayout.ts`). Sie sind Dokumentation
 * **und** Prüfgrundlage: `builtinComponents.test.ts` vergleicht sie mit den
 * tatsächlich gerenderten Handles.
 */

/** DC-Anschlusspaar links (Eingang) und rechts (Ausgang). */
const dcPassThrough: HandleSpec[] = [
  { id: 'plus', type: 'target', domain: 'DC_12V' },
  { id: 'minus', type: 'target', domain: 'DC_12V' },
  { id: 'plus', type: 'source', domain: 'DC_12V' },
  { id: 'minus', type: 'source', domain: 'DC_12V' },
];

const waterPassThrough: HandleSpec[] = [
  { id: 'in', type: 'target', domain: 'WATER' },
  { id: 'out', type: 'source', domain: 'WATER' },
];

/** Hilfsfunktion für die immer gleichen Wasser-Bauteile. */
const waterSpec = (
  id: string,
  label: string,
  category: string,
  description: string,
  purpose: string,
  icon: ComponentSpec['icon']
): ComponentSpec => ({
  id,
  label,
  category,
  description,
  purpose,
  mode: 'water',
  domains: ['WATER'],
  icon,
  node: WaterNode,
  handles: waterPassThrough,
});

export const BUILTIN_COMPONENT_SPECS: readonly ComponentSpec[] = [
  // ── Strom speichern ───────────────────────────────────────────────────────
  {
    id: 'battery',
    label: 'Batterie',
    category: 'Strom speichern',
    description: 'Speichert Energie für alle Geräte.',
    purpose: 'Speichert Energie für die Bordelektrik.',
    mode: 'electric',
    domains: ['DC_12V'],
    icon: Battery,
    node: BatteryNode,
    handles: dcPassThrough,
    defaults: { capacity: 100, chemistry: 'LiFePO4' },
  },

  // ── Strom verteilen ───────────────────────────────────────────────────────
  {
    id: 'shunt',
    label: 'Batteriemonitor (Shunt)',
    category: 'Strom verteilen',
    description: 'Misst zuverlässig, wie voll die Batterie ist.',
    purpose: 'Misst ein- und ausgehende Batterieströme.',
    mode: 'electric',
    domains: ['DC_12V'],
    icon: Gauge,
    node: ShuntNode,
    handles: dcPassThrough,
  },
  {
    id: 'busbar',
    label: 'Sammelschiene',
    category: 'Strom verteilen',
    description: 'Verteilt Plus oder Minus auf mehrere Leitungen.',
    purpose: 'Verteilt Plus oder Minus auf mehrere Leitungen.',
    mode: 'electric',
    domains: ['DC_12V'],
    icon: Network,
    node: BusbarNode,
    handles: dcPassThrough,
  },

  // ── Strom laden ───────────────────────────────────────────────────────────
  {
    id: 'mpptController',
    label: 'Solar-Laderegler (MPPT)',
    category: 'Strom laden',
    description: 'Passt Solarstrom sicher an die Batterie an.',
    purpose: 'Regelt die Ladung der Batterie durch Solarmodule.',
    mode: 'electric',
    domains: ['DC_12V', 'Solar'],
    icon: Sun,
    node: ChargerNode,
    handles: dcPassThrough,
    defaults: { amps: 30 },
  },
  {
    id: 'dcdcCharger',
    label: 'Ladebooster (DC-DC)',
    category: 'Strom laden',
    description: 'Lädt während der Fahrt über die Lichtmaschine.',
    purpose: 'Lädt die Aufbaubatterie während der Fahrt.',
    mode: 'electric',
    domains: ['DC_12V'],
    icon: RefreshCw,
    node: ChargerNode,
    handles: dcPassThrough,
    defaults: { amps: 30 },
  },
  {
    id: 'acBatteryCharger',
    label: '230-V-Ladegerät',
    category: 'Strom laden',
    description: 'Lädt die Batterie über Landstrom.',
    purpose: 'Lädt die Batterie über Landstrom.',
    mode: 'electric',
    domains: ['DC_12V', 'AC_230V'],
    icon: PlugZap,
    node: ChargerNode,
    // Mischdomäne (AUDIT Issue 4): AC-Eingang ist das plus-TARGET, der
    // Ladeausgang (plus/minus SOURCE) ist DC_12V. Deckungsgleich mit
    // getHandleDomain in lib/electrical.ts.
    handles: [
      { id: 'plus', type: 'target', domain: 'AC_230V' },
      { id: 'minus', type: 'target', domain: 'DC_12V' },
      { id: 'plus', type: 'source', domain: 'DC_12V' },
      { id: 'minus', type: 'source', domain: 'DC_12V' },
    ],
    defaults: { amps: 20 },
  },
  {
    id: 'solar',
    label: 'Solarmodul',
    category: 'Strom laden',
    description: 'Erzeugt unterwegs Energie aus Sonnenlicht.',
    purpose: 'Erzeugt Energie aus Sonnenlicht.',
    mode: 'electric',
    domains: ['Solar'],
    icon: Sun,
    node: SolarNode,
    handles: dcPassThrough,
    defaults: { watts: 200 },
  },
  {
    id: 'charger',
    // Alt-Typ aus früheren Plänen: wird weiterhin gerendert und in der
    // Stückliste benannt, aber nicht mehr zum Einfügen angeboten.
    label: 'Ladegerät',
    category: 'Strom laden',
    description: 'Älterer Sammeltyp für Ladegeräte.',
    purpose: 'Lädt die Aufbaubatterie.',
    mode: 'electric',
    domains: ['DC_12V'],
    icon: RefreshCw,
    node: ChargerNode,
    handles: dcPassThrough,
    selectable: false,
  },

  // ── 230 Volt ──────────────────────────────────────────────────────────────
  {
    id: 'inverter',
    label: 'Wechselrichter',
    category: '230 Volt',
    description: 'Wandelt Batteriespannung in 230 V um.',
    purpose: 'Erzeugt 230 V aus der Batteriespannung.',
    mode: 'electric',
    domains: ['DC_12V', 'AC_230V'],
    icon: RefreshCw,
    node: InverterNode,
    handles: [
      { id: 'ac_in', type: 'target', domain: 'AC_230V' },
      { id: 'plus', type: 'target', domain: 'DC_12V' },
      { id: 'minus', type: 'target', domain: 'DC_12V' },
      { id: 'plus', type: 'source', domain: 'AC_230V' },
    ],
    defaults: { watts: 1000 },
  },
  {
    id: 'shorePower',
    label: 'Landstromanschluss',
    category: '230 Volt',
    description: 'Verbindet den Camper mit dem Campingplatznetz.',
    purpose: 'Verbindet den Camper mit dem 230-V-Netz.',
    mode: 'electric',
    domains: ['AC_230V'],
    icon: PlugZap,
    node: ShorePowerNode,
    handles: [{ id: 'plus', type: 'source', domain: 'AC_230V' }],
  },

  // ── Geräte ────────────────────────────────────────────────────────────────
  {
    id: 'consumer',
    label: '12-V-Gerät',
    category: 'Geräte',
    description: 'Allgemeines Gerät für das 12-V-Bordnetz.',
    purpose: 'Verbraucher im Gleichstromnetz.',
    mode: 'electric',
    domains: ['DC_12V'],
    icon: Lightbulb,
    node: ConsumerNode,
    handles: dcPassThrough,
    defaults: { watts: 50 },
  },
  {
    id: 'consumer230v',
    label: '230-V-Gerät',
    category: 'Geräte',
    description: 'Gerät, das 230 V Wechselspannung benötigt.',
    purpose: 'Verbraucher im Wechselstromnetz.',
    mode: 'electric',
    domains: ['AC_230V'],
    icon: Zap,
    node: Consumer230VNode,
    handles: [{ id: 'plus', type: 'target', domain: 'AC_230V' }],
    defaults: { watts: 500 },
  },

  // ── Schutz & Einbau ───────────────────────────────────────────────────────
  {
    id: 'fuse',
    label: 'Sicherungskasten',
    category: 'Schutz & Einbau',
    description: 'Schützt Leitungen und verteilt abgesicherte Stromkreise.',
    purpose: 'Schützt und verteilt elektrische Stromkreise.',
    mode: 'electric',
    domains: ['DC_12V'],
    icon: Shield,
    node: FuseNode,
    handles: dcPassThrough,
    defaults: { rating: 100 },
  },
  {
    id: 'ground',
    label: 'Massepunkt',
    category: 'Schutz & Einbau',
    description: 'Gemeinsamer Minus- oder Karosserieanschluss.',
    purpose: 'Stellt einen gemeinsamen Minusanschluss bereit.',
    mode: 'electric',
    domains: ['DC_12V'],
    icon: Earth,
    node: GroundNode,
    handles: [
      { id: 'minus', type: 'target', domain: 'DC_12V' },
      { id: 'minus', type: 'source', domain: 'DC_12V' },
    ],
  },
  {
    id: 'conduit',
    label: 'Leerrohr',
    category: 'Schutz & Einbau',
    description: 'Schützt Kabel vor Scheuern und Hitze.',
    purpose: 'Schützt Leitungen vor Scheuern und Hitze.',
    mode: 'electric',
    domains: ['DC_12V'],
    icon: Cable,
    node: ConduitNode,
    handles: [
      { id: 'in', type: 'target', domain: 'DC_12V' },
      { id: 'out', type: 'source', domain: 'DC_12V' },
    ],
    defaults: { conduitType: 'EN 20' },
  },

  // ── Wasser ────────────────────────────────────────────────────────────────
  waterSpec(
    'freshWaterTank',
    'Frischwassertank',
    'Speichern',
    'Speichert sauberes Wasser.',
    'Speichert sauberes Wasser.',
    Droplets
  ),
  waterSpec(
    'grayWaterTank',
    'Abwassertank',
    'Speichern',
    'Sammelt gebrauchtes Wasser.',
    'Sammelt gebrauchtes Wasser.',
    Waves
  ),
  waterSpec(
    'pump',
    'Wasserpumpe',
    'Fördern & filtern',
    'Baut Druck auf und fördert Frischwasser.',
    'Fördert Wasser und erzeugt Leitungsdruck.',
    CircleGauge
  ),
  waterSpec(
    'accumulator',
    'Druckausgleichsgefäß',
    'Fördern & filtern',
    'Beruhigt den Wasserfluss und schont die Pumpe.',
    'Beruhigt den Wasserfluss und schont die Pumpe.',
    Gauge
  ),
  waterSpec(
    'preFilter',
    'Vorfilter',
    'Fördern & filtern',
    'Hält Schmutz vor der Pumpe zurück.',
    'Schützt die Pumpe vor Schmutz.',
    Filter
  ),
  waterSpec(
    'sink',
    'Spüle',
    'Entnahmestellen',
    'Entnahmestelle mit Frisch- und Abwasser.',
    'Entnahmestelle für Frischwasser.',
    Droplets
  ),
  waterSpec(
    'shower',
    'Dusche',
    'Entnahmestellen',
    'Wasserentnahme mit Abwasserleitung.',
    'Entnahmestelle für Frischwasser.',
    ShowerHead
  ),
];
