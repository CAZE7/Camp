'use client';

/**
 * EDGE / TRASSE BLUEPRINT — Modul 2: Kanten & Trassen
 *
 * - Orthogonale Linienführung, Kantenhierarchie
 * - Hauptstromschienen dicker + Glow bei Selektion
 * - Kreuzungsbrücken (Bridges/Hops) gestochen scharf
 * - Flussindikatoren diskret, animationsarm
 */

import React from 'react';

type EdgeDomain = 'DC_12V' | 'AC_230V' | 'SOLAR' | 'CAN' | 'SENSOR' | 'PIPE_FRESH';

interface EdgeSpec {
  domain: EdgeDomain;
  isMain: boolean;
  selected?: boolean;
  error?: boolean;
  crossings?: number;
}

function EdgeLegend({ spec }: { spec: EdgeSpec }) {
  const colorMap: Record<EdgeDomain, string> = {
    DC_12V: 'var(--de-wire-dc-12v-plus)',
    AC_230V: 'var(--de-wire-ac-l)',
    SOLAR: 'var(--de-wire-solar)',
    CAN: 'var(--de-wire-can-h)',
    SENSOR: 'var(--de-wire-sensor)',
    PIPE_FRESH: 'var(--de-pipe-fresh)',
  };

  const widthMap: Record<string, number> = {
    main: 3,
    branch: 2,
    sensor: 1.5,
  };

  const w = spec.isMain
    ? widthMap.main
    : spec.domain === 'SENSOR' || spec.domain === 'CAN'
      ? widthMap.sensor!
      : widthMap.branch!;

  return (
    <div className="flex items-center gap-3">
      <svg width={60} height={16} className="overflow-visible">
        <line
          x1={0}
          y1={8}
          x2={60}
          y2={8}
          stroke={colorMap[spec.domain]}
          strokeWidth={w}
          strokeLinecap="round"
          className={spec.selected ? 'de-edge--selected' : ''}
          style={{
            filter: spec.selected ? 'drop-shadow(0 0 4px var(--de-edge-glow))' : undefined,
          }}
        />
        {spec.domain === 'CAN' || spec.domain === 'SENSOR' ? (
          <line
            x1={0}
            y1={8}
            x2={60}
            y2={8}
            stroke={colorMap[spec.domain]}
            strokeWidth={w}
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <div className="flex flex-col">
        <span className="font-mono text-[12px] font-medium">
          {spec.domain} {spec.isMain ? 'MAIN' : 'BRANCH'}
        </span>
        <span className="font-mono text-[11px] text-[var(--de-text-low)]">
          {w}px {spec.domain === 'CAN' || spec.domain === 'SENSOR' ? '· dashed' : '· solid'}{' '}
          {spec.selected ? '· selected + glow' : ''}
        </span>
      </div>
    </div>
  );
}

function BridgeExample() {
  return (
    <div className="relative">
      <svg width={200} height={80} className="overflow-visible">
        {/* Horizontale Trasse unten */}
        <line
          x1={0}
          y1={50}
          x2={200}
          y2={50}
          stroke="var(--de-wire-dc-12v-plus)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Vertikale Trasse mit Brücke */}
        <line
          x1={100}
          y1={0}
          x2={100}
          y2={38}
          stroke="var(--de-wire-ac-l)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Brücke — Halbkreis */}
        <path
          d="M 88 38 A 12 12 0 0 1 112 38"
          fill="none"
          stroke="var(--de-wire-ac-l)"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 86 36 A 14 14 0 0 1 114 36"
          fill="var(--de-surface-0)"
          stroke="var(--de-rule-strong)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className="de-edge-bridge"
        />
        <path
          d="M 88 38 A 12 12 0 0 1 112 38"
          fill="none"
          stroke="var(--de-wire-ac-l)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={100}
          y1={62}
          x2={100}
          y2={80}
          stroke="var(--de-wire-ac-l)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute -bottom-2 left-0 font-mono text-[11px] text-[var(--de-text-dim)]">
        CROSSING BRIDGE — gestochen scharf, 1px Border, Surface-0 Fill
      </span>
    </div>
  );
}

function FlowIndicatorExample() {
  return (
    <div className="flex flex-col gap-2">
      <svg width={200} height={24} className="overflow-visible">
        <line
          x1={0}
          y1={12}
          x2={200}
          y2={12}
          stroke="var(--de-wire-dc-12v-plus)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Diskrete Flussindikatoren — kleine Dreiecke, 100ms Animation */}
        <g>
          <polygon points="40,8 48,12 40,16" fill="var(--de-wire-dc-12v-plus)" opacity={0.9} />
          <polygon points="100,8 108,12 100,16" fill="var(--de-wire-dc-12v-plus)" opacity={0.6} />
          <polygon points="160,8 168,12 160,16" fill="var(--de-wire-dc-12v-plus)" opacity={0.3} />
        </g>
      </svg>
      <span className="font-mono text-[11px] text-[var(--de-text-dim)]">
        FLUSSINDIKATOR — diskret, 3 Stufen Opacity, keine Dauer-Animation
      </span>
    </div>
  );
}

export function EdgeBlueprint() {
  const specs: EdgeSpec[] = [
    { domain: 'DC_12V', isMain: true, selected: true },
    { domain: 'DC_12V', isMain: false },
    { domain: 'AC_230V', isMain: true },
    { domain: 'SOLAR', isMain: true },
    { domain: 'CAN', isMain: false },
    { domain: 'SENSOR', isMain: false },
    { domain: 'PIPE_FRESH', isMain: false },
  ];

  return (
    <div className="flex flex-col gap-8 rounded-[4px] border border-[var(--de-rule)] bg-[var(--de-surface-0)] p-6">
      <h3 className="de-label-eyebrow">Trassen-Hierarchie — Dark Engineering</h3>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          {specs.map((s, i) => (
            <EdgeLegend key={i} spec={s} />
          ))}
        </div>
        <div className="flex flex-col gap-8">
          <BridgeExample />
          <FlowIndicatorExample />
        </div>
      </div>

      <div className="rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] p-3">
        <h4 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-widest">Regeln</h4>
        <ul className="space-y-1 font-mono text-[11px] leading-relaxed">
          <li>• Hauptstromschienen (DC MAIN / AC MAIN): 3px, Glow bei Selektion (drop-shadow 4px)</li>
          <li>• Zweigleitungen: 2px solid</li>
          <li>• CAN/Sensor: 1.5px dashed, filigran</li>
          <li>
            • Kreuzungsbrücken: 12px Halbkreis, Surface-0 Fill + 1px Border, vector-effect: non-scaling-stroke
          </li>
          <li>
            • Flussindikatoren: statische Dreiecke mit Opacity-Stufen, keine Laufanimation (respektiert
            reduced-motion)
          </li>
          <li>• Labels: 12px Mono, Surface-1 Hintergrund, 1px Border, niemals über Nodes</li>
        </ul>
      </div>
    </div>
  );
}
