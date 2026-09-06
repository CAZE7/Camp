'use client';

import { Battery, Cable, Earth, Gauge, Lightbulb, Network, PlugZap, Shield, Sun, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type NodeSymbolKind =
  | 'battery'
  | 'charger'
  | 'consumer'
  | 'consumer-ac'
  | 'fuse'
  | 'ground'
  | 'inverter'
  | 'shore'
  | 'shunt'
  | 'solar'
  | 'busbar'
  | 'conduit';

const SYMBOLS: Record<NodeSymbolKind, { icon: LucideIcon; code: string; tone: string }> = {
  battery: { icon: Battery, code: 'BAT', tone: 'node-symbol--dc' },
  charger: { icon: PlugZap, code: 'CHG', tone: 'node-symbol--solar' },
  consumer: { icon: Lightbulb, code: 'LOAD', tone: 'node-symbol--load' },
  'consumer-ac': { icon: Zap, code: 'AC LOAD', tone: 'node-symbol--ac' },
  fuse: { icon: Shield, code: 'FUSE', tone: 'node-symbol--protect' },
  ground: { icon: Earth, code: 'PE', tone: 'node-symbol--ground' },
  inverter: { icon: Zap, code: 'INV', tone: 'node-symbol--ac' },
  shore: { icon: PlugZap, code: 'AC IN', tone: 'node-symbol--ac' },
  shunt: { icon: Gauge, code: 'SHUNT', tone: 'node-symbol--measure' },
  solar: { icon: Sun, code: 'PV', tone: 'node-symbol--solar' },
  busbar: { icon: Network, code: 'BUS', tone: 'node-symbol--measure' },
  conduit: { icon: Cable, code: 'WIRE', tone: 'node-symbol--measure' },
};

export function NodeSymbol({ kind }: { kind: NodeSymbolKind }) {
  const { icon: Icon, code, tone } = SYMBOLS[kind];

  return (
    <div className={cn('node-symbol', tone)} aria-hidden="true">
      <span className="node-symbol__icon">
        <Icon size={21} strokeWidth={2.2} />
      </span>
      <span className="node-symbol__code">{code}</span>
    </div>
  );
}
