'use client';

import React from 'react';
import {
  NodeBlueprint,
  BatteryNodeExample,
  InverterNodeExample,
} from '@/components/design-system/NodeBlueprint';
import { InspectorBlueprint } from '@/components/design-system/InspectorBlueprint';
import { EdgeBlueprint } from '@/components/design-system/EdgeBlueprint';
import { HUDBlueprint } from '@/components/design-system/HUDBlueprint';

export default function DesignSystemPage() {
  return (
    <main id="main" className="min-h-screen bg-[var(--de-surface-0)] p-6 text-[var(--de-text-high)]">
      <header className="mb-8 border-b border-[var(--de-rule)] pb-6">
        <h1 className="font-mono text-[24px] font-bold tracking-tight">DARK ENGINEERING DESIGN SYSTEM</h1>
        <p className="mt-2 max-w-3xl font-mono text-[13px] leading-relaxed text-[var(--de-text-med)]">
          Industrial-Grade EDA/CAD — 4px Subgrid / 8px Layoutgrid, Minor Third 1.200 Typografie,
          Surface-Layering mit 1px Border statt Schatten, farbenblind-taugliche Elektro-Semantik, WCAG AAA/AA.
          Quelle: app/dark-engineering.css + lib/design-system/tokens.ts
        </p>
        <div className="mt-4 flex gap-2">
          <span className="rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] px-2 py-1 font-mono text-[11px]">
            GRID 4px/8px
          </span>
          <span className="rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] px-2 py-1 font-mono text-[11px]">
            RADIUS ≤4px
          </span>
          <span className="rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] px-2 py-1 font-mono text-[11px]">
            MOTION 100-160ms
          </span>
          <span className="rounded-[2px] border border-[var(--de-ok-border)] bg-[var(--de-ok-bg)] px-2 py-1 font-mono text-[11px] text-[var(--de-ok)]">
            WCAG AAA
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-12">
        {/* Tokens */}
        <section>
          <h2 className="de-label-eyebrow mb-4">1 — Tokens (CSS-Variablen & TS)</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-[4px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] p-4">
              <h3 className="mb-2 font-mono text-[12px] font-bold">Surface-Layering</h3>
              <div className="flex flex-col gap-2">
                <div className="flex h-8 items-center rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-canvas-base)] px-2 font-mono text-[11px]">
                  Canvas Base --de-canvas-base
                </div>
                <div className="flex h-8 items-center rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-surface-0)] px-2 font-mono text-[11px]">
                  Surface-0 --de-surface-0
                </div>
                <div className="flex h-8 items-center rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] px-2 font-mono text-[11px]">
                  Surface-1 --de-surface-1
                </div>
                <div className="flex h-8 items-center rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-surface-2)] px-2 font-mono text-[11px]">
                  Surface-2 --de-surface-2
                </div>
              </div>
            </div>
            <div className="rounded-[4px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] p-4">
              <h3 className="mb-2 font-mono text-[12px] font-bold">Elektro-Semantik (farbenblind-safe)</h3>
              <div className="flex flex-col gap-1.5">
                {[
                  ['DC 12V+', 'var(--de-wire-dc-12v-plus)', '●'],
                  ['DC 12V-', 'var(--de-wire-dc-12v-minus)', '■'],
                  ['AC L', 'var(--de-wire-ac-l)', '◆'],
                  ['AC N', 'var(--de-wire-ac-n)', '◆'],
                  ['PE', 'var(--de-wire-ac-pe)', '▲'],
                  ['Solar', 'var(--de-wire-solar)', '●'],
                  ['CAN-H', 'var(--de-wire-can-h)', '●'],
                  ['Sensor', 'var(--de-wire-sensor)', '●'],
                ].map(([label, color, shape]) => (
                  <div key={label} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="h-3 w-3 rounded-full" style={{ background: color as string }} />
                    <span>{shape}</span>
                    <span className="text-[var(--de-text-med)]">{label}</span>
                    <span className="ml-auto text-[var(--de-text-low)]">{color}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[4px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] p-4">
              <h3 className="mb-2 font-mono text-[12px] font-bold">Typography — Minor Third 1.200</h3>
              <div className="flex flex-col gap-1">
                <span style={{ fontSize: 'var(--de-text-11)' }} className="font-mono">
                  11px — Port-Labels, DIN
                </span>
                <span style={{ fontSize: 'var(--de-text-12)' }}>12px — Metadaten</span>
                <span style={{ fontSize: 'var(--de-text-13)' }}>13px — Labels, Key-Value</span>
                <span style={{ fontSize: 'var(--de-text-14)' }}>14px — UI Base</span>
                <span style={{ fontSize: 'var(--de-text-16)' }}>16px — Fließtext</span>
                <span className="de-mono-numeric mt-2 text-[13px]">123.45 V — tabular-nums</span>
              </div>
            </div>
          </div>
        </section>

        {/* Nodes */}
        <section>
          <h2 className="de-label-eyebrow mb-4">2 — Node-Anatomie (EDA/CAD)</h2>
          <div className="flex flex-wrap gap-8 rounded-[4px] border border-[var(--de-rule)] bg-[var(--de-surface-0)] p-8">
            <BatteryNodeExample />
            <InverterNodeExample />
            <NodeBlueprint
              typeCode="FUSE"
              label="Sicherung 100A"
              status="ready"
              telemetry={[
                { key: 'I_n', value: '100', unit: 'A' },
                { key: 'I_cn', value: '1500', unit: 'A' },
                { key: 'Char', value: 'gG' },
              ]}
              ports={[
                { id: 'in', polarity: '+', position: 'left', offsetPercent: 50, voltageDomain: 'DC_12V' },
                { id: 'out', polarity: '+', position: 'right', offsetPercent: 50, voltageDomain: 'DC_12V' },
              ]}
            />
            <NodeBlueprint
              typeCode="SHUNT"
              label="Shunt 500A"
              status="ready"
              telemetry={[
                { key: 'U', value: '0.05', unit: 'V' },
                { key: 'I', value: '42.3', unit: 'A', computed: true },
              ]}
              ports={[
                { id: 'plus', polarity: '+', position: 'left', offsetPercent: 30, voltageDomain: 'DC_12V' },
                { id: 'minus', polarity: '-', position: 'left', offsetPercent: 70, voltageDomain: 'DC_12V' },
                { id: 'data', polarity: 'DATA', position: 'right', offsetPercent: 50, voltageDomain: 'CAN' },
              ]}
            />
          </div>
        </section>

        {/* Edges */}
        <section>
          <h2 className="de-label-eyebrow mb-4">3 — Edges & Trassen</h2>
          <EdgeBlueprint />
        </section>

        {/* Inspector */}
        <section>
          <h2 className="de-label-eyebrow mb-4">4 — Inspektor & HUD</h2>
          <div className="flex flex-wrap gap-8">
            <InspectorBlueprint />
            <div className="flex flex-col gap-6">
              <HUDBlueprint />
            </div>
          </div>
        </section>

        {/* Motion */}
        <section>
          <h2 className="de-label-eyebrow mb-4">5 — Motion & States</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ['Default', 'border-[var(--de-rule-strong)]'],
              ['Hover', 'border-[var(--de-rule-highlight)] scale-[1.01]'],
              ['Selected', 'border-[var(--de-accent)] shadow-[0_0_0_1px_var(--de-accent)]'],
              ['Error', 'border-[var(--de-error)]'],
            ].map(([label, cls]) => (
              <div
                key={label}
                className={`h-20 rounded-[4px] border bg-[var(--de-surface-2)] p-3 transition-all duration-150 ${cls}`}
              >
                <span className="font-mono text-[11px]">{label}</span>
                <div className="mt-2 font-mono text-[10px] text-[var(--de-text-low)]">150ms ease-out</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="mt-12 border-t border-[var(--de-rule)] pt-6 font-mono text-[11px] text-[var(--de-text-low)]">
        Dark Engineering Design System — WCAG AAA/AA, 4px/8px Grid, 1px Border statt Schatten, 100-160ms
        Motion, Shape-Coding für Farbenblindheit.
        <br />
        Quelle: app/dark-engineering.css (Hex) + lib/design-system/tokens.ts (TS) +
        docs/DARK-ENGINEERING-DESIGN-SYSTEM.md
      </footer>
    </main>
  );
}
