'use client';

/**
 * NODE-ANATOMIE BLUEPRINT — Dark Engineering EDA/CAD Ergonomie
 *
 * Drei Zonen nach Modul 2:
 * - Header-Zone: DIN/ISO-Symbol, Typenbezeichner, Betriebsstatus
 * - Body-Zone: Key-Value-Telemetrie mit monospaced Ziffern
 * - Port-Terminal-Zone: Geometrisch verankert, Polaritätsindikatoren, 44px Hit-Targets
 *
 * Grid: 4px Subgrid, 8px Layoutgrid, 1px Border statt Schatten
 * Motion: 100-160ms ease-out, kein verspieltes Bouncing
 */

import React from 'react';

type NodeStatus = 'ready' | 'warning' | 'error' | 'offline';
type PortPolarity = '+' | '-' | 'PE' | 'L' | 'N' | 'CAN_H' | 'CAN_L' | 'DATA';

interface PortSpec {
  id: string;
  polarity: PortPolarity;
  position: 'left' | 'right' | 'top' | 'bottom';
  offsetPercent: number; // 0-100 entlang der Kante
  voltageDomain: 'DC_12V' | 'DC_24V' | 'AC_230V' | 'SOLAR' | 'CAN' | 'SENSOR';
}

interface NodeBlueprintProps {
  typeCode: string; // z.B. BAT, FUSE, INV
  label: string;
  status: NodeStatus;
  telemetry: Array<{ key: string; value: string; unit?: string; computed?: boolean }>;
  ports: PortSpec[];
  selected?: boolean;
  focused?: boolean;
}

// DIN/ISO Symbol-Platzhalter — in Produktion via lucide-react oder eigene SVG-Sprites
function DINSymbol({ code }: { code: string }) {
  return (
    <div className="de-symbol-icon grid h-8 w-8 place-items-center rounded-[2px] border border-[var(--de-rule-strong)] bg-[var(--de-surface-1)]">
      <span className="font-mono text-[11px] font-bold tracking-wider">{code}</span>
    </div>
  );
}

function StatusDot({ status }: { status: NodeStatus }) {
  const map: Record<NodeStatus, string> = {
    ready: 'bg-[var(--de-ok)]',
    warning: 'bg-[var(--de-warn)]',
    error: 'bg-[var(--de-error)]',
    offline: 'bg-[var(--de-text-dim)]',
  };
  return (
    <span
      className={`inline-block h-[8px] w-[8px] rounded-full ${map[status]}`}
      aria-label={`Status: ${status}`}
    />
  );
}

function PortHandle({ spec }: { spec: PortSpec }) {
  const polarityStyle: Record<PortPolarity, string> = {
    '+': 'de-port__visual--plus bg-[var(--de-wire-dc-12v-plus)]',
    '-': 'de-port__visual--minus bg-[var(--de-wire-dc-12v-minus)]',
    PE: 'de-port__visual--pe bg-[var(--de-wire-ac-pe)]',
    L: 'de-port__visual--ac bg-[var(--de-wire-ac-l)]',
    N: 'de-port__visual--ac bg-[var(--de-wire-ac-n)]',
    CAN_H: 'rounded-full bg-[var(--de-wire-can-h)]',
    CAN_L: 'rounded-full bg-[var(--de-wire-can-l)]',
    DATA: 'rounded-[2px] bg-[var(--de-wire-sensor)]',
  };

  const positionStyle: Record<PortSpec['position'], React.CSSProperties> = {
    left: { left: 0, top: `${spec.offsetPercent}%`, transform: 'translate(-50%, -50%)' },
    right: { right: 0, top: `${spec.offsetPercent}%`, transform: 'translate(50%, -50%)' },
    top: { top: 0, left: `${spec.offsetPercent}%`, transform: 'translate(-50%, -50%)' },
    bottom: { bottom: 0, left: `${spec.offsetPercent}%`, transform: 'translate(-50%, -50%)' },
  };

  return (
    <button
      className="de-port"
      style={positionStyle[spec.position]}
      aria-label={`Port ${spec.polarity} ${spec.voltageDomain}`}
      data-polarity={spec.polarity}
      data-domain={spec.voltageDomain}
    >
      {/* 44px Hit-Target, 12px Visual per Spec */}
      <span className={`de-port__visual ${polarityStyle[spec.polarity]}`} />
      {/* Polaritätsindikator — 11px Mono */}
      <span className="de-port-label absolute -bottom-4 left-1/2 -translate-x-1/2 text-[var(--de-text-low)]">
        {spec.polarity}
      </span>
    </button>
  );
}

export function NodeBlueprint({
  typeCode,
  label,
  status,
  telemetry,
  ports,
  selected,
  focused,
}: NodeBlueprintProps) {
  return (
    <div
      className={[
        'de-node-card',
        'w-[224px]', // --de-node-w-md
        selected ? 'de-node-card--selected' : '',
        focused ? 'de-node-card--focused' : '',
        status === 'error' ? 'de-node-card--error' : '',
        status === 'warning' ? 'de-node-card--warning' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={`${label} ${typeCode}`}
      data-selected={selected || undefined}
      data-status={status}
    >
      {/* === HEADER-ZONE (40px) === */}
      <div className="flex h-10 items-center justify-between gap-2 border-b border-[var(--de-rule)] px-3">
        <div className="flex items-center gap-2">
          <DINSymbol code={typeCode} />
          <div className="flex flex-col">
            <span className="font-mono text-[11px] font-bold leading-none tracking-[0.12em] text-[var(--de-text-med)]">
              {typeCode}
            </span>
            <span className="max-w-[100px] truncate text-[13px] font-semibold leading-tight">{label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          {/* Drag-Handle — nur visuell, echte Interaktion via .custom-drag-handle */}
          <span className="h-4 w-4 opacity-40" aria-hidden>
            ⠿
          </span>
        </div>
      </div>

      {/* === BODY-ZONE: Key-Value-Telemetrie === */}
      <div className="flex flex-col gap-1 p-3">
        {telemetry.map((row) => (
          <div key={row.key} className="flex items-baseline justify-between gap-2 text-[12px] leading-4">
            <span className="text-[var(--de-text-med)]">{row.key}</span>
            <span
              className={[
                'de-mono-numeric text-right font-medium',
                row.computed ? 'de-kv-value--computed' : 'text-[var(--de-text-high)]',
              ].join(' ')}
            >
              {row.value}
              {row.unit ? <span className="ml-1 text-[var(--de-text-low)]">{row.unit}</span> : null}
            </span>
          </div>
        ))}
      </div>

      {/* === PORT-TERMINAL-ZONE === */}
      {ports.map((p) => (
        <PortHandle key={p.id} spec={p} />
      ))}

      {/* === VISUELLE HILFEN (nur Blueprint) === */}
      <div className="pointer-events-none absolute -bottom-6 left-0 right-0 flex justify-between px-1">
        <span className="font-mono text-[11px] text-[var(--de-text-dim)]">8px GRID</span>
        <span className="font-mono text-[11px] text-[var(--de-text-dim)]">HIT ≥24×24</span>
      </div>
    </div>
  );
}

/* === BEISPIEL-INSTANZEN für Doku / Storybook === */

export function BatteryNodeExample() {
  return (
    <NodeBlueprint
      typeCode="BAT"
      label="LiFePO4 100Ah"
      status="ready"
      telemetry={[
        { key: 'U', value: '13.2', unit: 'V' },
        { key: 'I', value: '0.0', unit: 'A' },
        { key: 'SOC', value: '87', unit: '%' },
        { key: 'ΔU', value: '0.18', unit: 'V', computed: true },
      ]}
      ports={[
        { id: 'plus', polarity: '+', position: 'right', offsetPercent: 30, voltageDomain: 'DC_12V' },
        { id: 'minus', polarity: '-', position: 'right', offsetPercent: 70, voltageDomain: 'DC_12V' },
        { id: 'plus-in', polarity: '+', position: 'left', offsetPercent: 30, voltageDomain: 'DC_12V' },
        { id: 'minus-in', polarity: '-', position: 'left', offsetPercent: 70, voltageDomain: 'DC_12V' },
      ]}
      selected
    />
  );
}

export function InverterNodeExample() {
  return (
    <NodeBlueprint
      typeCode="INV"
      label="Victron 1200VA"
      status="warning"
      telemetry={[
        { key: 'P', value: '850', unit: 'W' },
        { key: 'η', value: '93', unit: '%' },
        { key: 'U_AC', value: '230', unit: 'V' },
      ]}
      ports={[
        { id: 'dc-plus', polarity: '+', position: 'left', offsetPercent: 30, voltageDomain: 'DC_12V' },
        { id: 'dc-minus', polarity: '-', position: 'left', offsetPercent: 70, voltageDomain: 'DC_12V' },
        { id: 'ac-l', polarity: 'L', position: 'right', offsetPercent: 35, voltageDomain: 'AC_230V' },
        { id: 'ac-n', polarity: 'N', position: 'right', offsetPercent: 55, voltageDomain: 'AC_230V' },
        { id: 'pe', polarity: 'PE', position: 'right', offsetPercent: 75, voltageDomain: 'AC_230V' },
      ]}
    />
  );
}

/* === STATE MATRIX DOKUMENTATION (für visuelle Regression) === */
export const NODE_STATES = [
  'Default',
  'Hover',
  'Active',
  'Focus-Visible',
  'Selected',
  'Dragging',
  'Disabled',
  'Error',
  'Warning',
] as const;

export const NODE_STATE_CLASSES: Record<(typeof NODE_STATES)[number], string> = {
  Default: 'de-node-card',
  Hover: 'de-node-card hover:border-[var(--de-rule-highlight)]',
  Active: 'de-node-card active:scale-[0.99]',
  'Focus-Visible':
    'de-node-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--de-accent)]',
  Selected: 'de-node-card de-node-card--selected',
  Dragging: 'de-node-card opacity-90 rotate-[0.5deg] shadow-none',
  Disabled: 'de-node-card opacity-40 pointer-events-none',
  Error: 'de-node-card de-node-card--error',
  Warning: 'de-node-card de-node-card--warning',
};
