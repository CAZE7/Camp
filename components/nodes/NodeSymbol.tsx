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

/**
 * DIN/ISO-Symbolik nach DIN 72552 / ISO 14617 / IEC 60617
 * Industrial-Grade: Strichstärke 1.5px, 1px Border, 4px Radius Max,
 * non-scaling-stroke für gestochen scharfe Darstellung bei jedem Zoom.
 * Jeder Typ hat DIN-Code + Tone (DC/AC/PE/Solar/Measure)
 */

// Echte DIN-Symbole als inline SVG — 24x24, 1.5px Stroke, non-scaling
function DinBatteryIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ vectorEffect: 'non-scaling-stroke' } as React.CSSProperties}>
      {/* DIN Batterie: kurzer dicker Strich = Minus, langer dünner = Plus, Abstand 4px */}
      <rect x="3" y="7" width="2" height="10" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="8" y="5" width="1.5" height="14" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="13" y="7" width="2" height="10" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="18" y="5" width="1.5" height="14" rx="0.5" fill="none" stroke="currentColor" />
    </svg>
  );
}

function DinFuseIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ vectorEffect: 'non-scaling-stroke' } as React.CSSProperties}>
      {/* DIN Sicherung: Rechteck mit Anschlussdrähten, Schmelzleiter als Zickzack */}
      <rect x="7" y="9" width="10" height="6" rx="1" />
      <line x1="2" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="22" y2="12" />
      <path d="M9 12 L10.5 9.5 L12 14.5 L13.5 9.5 L15 12" />
    </svg>
  );
}

function DinGroundIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ vectorEffect: 'non-scaling-stroke' } as React.CSSProperties}>
      {/* DIN PE: Erdungssymbol — 3 abnehmende horizontale Linien */}
      <line x1="12" y1="5" x2="12" y2="11" />
      <line x1="7" y1="11" x2="17" y2="11" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="11" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function DinInverterIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ vectorEffect: 'non-scaling-stroke' } as React.CSSProperties}>
      {/* DIN Wechselrichter: Rechteck mit ~ innen */}
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M7 12 Q9 7 12 12 T17 12" />
    </svg>
  );
}

function DinSolarIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ vectorEffect: 'non-scaling-stroke' } as React.CSSProperties}>
      {/* DIN PV: Zelle mit Grid + Sonne */}
      <rect x="4" y="8" width="12" height="10" rx="0.5" />
      <line x1="4" y1="12" x2="16" y2="12" />
      <line x1="4" y1="15" x2="16" y2="15" />
      <line x1="8" y1="8" x2="8" y2="18" />
      <line x1="12" y1="8" x2="12" y2="18" />
      <circle cx="18" cy="6" r="2.5" />
      <line x1="18" y1="2" x2="18" y2="2.5" />
      <line x1="18" y1="9.5" x2="18" y2="10" />
      <line x1="14.5" y1="6" x2="15" y2="6" />
      <line x1="21" y1="6" x2="21.5" y2="6" />
    </svg>
  );
}

const DIN_ICONS: Record<string, React.FC> = {
  battery: DinBatteryIcon,
  fuse: DinFuseIcon,
  ground: DinGroundIcon,
  inverter: DinInverterIcon,
  solar: DinSolarIcon,
};

const SYMBOLS: Record<NodeSymbolKind, { icon: LucideIcon; dinIcon?: React.FC; code: string; tone: string; dinCode: string }> = {
  battery: { icon: Battery, dinIcon: DinBatteryIcon, code: 'BAT', dinCode: 'G1', tone: 'node-symbol--dc' },
  charger: { icon: PlugZap, code: 'CHG', dinCode: 'G2', tone: 'node-symbol--solar' },
  consumer: { icon: Lightbulb, code: 'LOAD', dinCode: 'E1', tone: 'node-symbol--load' },
  'consumer-ac': { icon: Zap, code: 'AC LOAD', dinCode: 'E2', tone: 'node-symbol--ac' },
  fuse: { icon: Shield, dinIcon: DinFuseIcon, code: 'FUSE', dinCode: 'F1', tone: 'node-symbol--protect' },
  ground: { icon: Earth, dinIcon: DinGroundIcon, code: 'PE', dinCode: 'PE', tone: 'node-symbol--ground' },
  inverter: { icon: Zap, dinIcon: DinInverterIcon, code: 'INV', dinCode: 'U1', tone: 'node-symbol--ac' },
  shore: { icon: PlugZap, code: 'AC IN', dinCode: 'X1', tone: 'node-symbol--ac' },
  shunt: { icon: Gauge, code: 'SHUNT', dinCode: 'R1', tone: 'node-symbol--measure' },
  solar: { icon: Sun, dinIcon: DinSolarIcon, code: 'PV', dinCode: 'G3', tone: 'node-symbol--solar' },
  busbar: { icon: Network, code: 'BUS', dinCode: 'W1', tone: 'node-symbol--measure' },
  conduit: { icon: Cable, code: 'WIRE', dinCode: 'W0', tone: 'node-symbol--measure' },
};

export function NodeSymbol({ kind }: { kind: NodeSymbolKind }) {
  const { icon: Icon, dinIcon: DinIcon, code, tone, dinCode } = SYMBOLS[kind];

  return (
    <div className={cn('node-symbol', tone)} aria-hidden="true" data-din={dinCode}>
      <span className="node-symbol__icon">
        {DinIcon ? <DinIcon /> : <Icon size={21} strokeWidth={2.2} style={{ vectorEffect: 'non-scaling-stroke' } as React.CSSProperties} />}
      </span>
      <span className="node-symbol__code" data-testid="din-code">
        {code}
        <span className="ml-1 hidden text-[8px] opacity-60 md:inline">·{dinCode}</span>
      </span>
    </div>
  );
}
