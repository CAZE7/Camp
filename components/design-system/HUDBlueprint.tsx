'use client';

/**
 * HUD & WARNING CENTER BLUEPRINT — Modul 3
 * Floating Metrics Cards + hierarchisch sortierte Fehlerliste
 */

import React, { useState } from 'react';

interface Metric {
  label: string;
  value: string;
  unit?: string;
  status?: 'ok' | 'warn' | 'error';
  trend?: 'up' | 'down' | 'stable';
}

function KPICard({ metrics, title }: { metrics: Metric[]; title: string }) {
  return (
    <div className="de-hud-card w-[280px]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="de-label-eyebrow">{title}</h3>
        <span className="h-2 w-2 rounded-full bg-[var(--de-ok)] animate-pulse" />
      </div>
      <div className="flex flex-col gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-[var(--de-text-med)]">{m.label}</span>
            <span className="de-mono-numeric text-[13px] font-semibold">
              {m.value}
              {m.unit ? <span className="ml-1 text-[var(--de-text-low)]">{m.unit}</span> : null}
              {m.status && (
                <span
                  className={[
                    'ml-2 inline-block h-1.5 w-1.5 rounded-full',
                    m.status === 'ok' ? 'bg-[var(--de-ok)]' : m.status === 'warn' ? 'bg-[var(--de-warn)]' : 'bg-[var(--de-error)]',
                  ].join(' ')}
                />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface WarningItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  ruleId: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

function WarningCenter({ warnings }: { warnings: WarningItem[] }) {
  const [expanded, setExpanded] = useState(true);
  const critical = warnings.filter((w) => w.severity === 'critical').length;
  const warning = warnings.filter((w) => w.severity === 'warning').length;

  return (
    <div className="de-warning-center w-[360px] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex h-10 w-full items-center justify-between px-4 hover:bg-[var(--de-surface-2)]"
      >
        <div className="flex items-center gap-3">
          <span className="de-label-eyebrow">Warnings</span>
          <div className="flex gap-1">
            {critical > 0 && (
              <span className="rounded-[2px] bg-[var(--de-error-bg)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--de-error)]">
                {critical} CRIT
              </span>
            )}
            {warning > 0 && (
              <span className="rounded-[2px] bg-[var(--de-warn-bg)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--de-warn)]">
                {warning} WARN
              </span>
            )}
          </div>
        </div>
        <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {expanded && (
        <div className="flex flex-col divide-y divide-[var(--de-rule)]">
          {warnings
            .sort((a, b) => {
              const order = { critical: 0, warning: 1, info: 2 };
              return order[a.severity] - order[b.severity];
            })
            .map((w) => (
              <div
                key={w.id}
                className={[
                  'flex gap-3 px-4 py-2.5 text-[12px]',
                  w.severity === 'critical'
                    ? 'bg-[var(--de-error-bg)]'
                    : w.severity === 'warning'
                      ? 'bg-[var(--de-warn-bg)]'
                      : 'bg-transparent',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    w.severity === 'critical'
                      ? 'bg-[var(--de-error)]'
                      : w.severity === 'warning'
                        ? 'bg-[var(--de-warn)]'
                        : 'bg-[var(--de-text-low)]',
                  ].join(' ')}
                />
                <div className="flex flex-1 flex-col gap-1">
                  <span className="font-medium leading-tight">{w.message}</span>
                  <span className="font-mono text-[11px] text-[var(--de-text-low)]">
                    {w.ruleId} {w.nodeId ? `· ${w.nodeId}` : ''} {w.edgeId ? `· ${w.edgeId}` : ''}
                  </span>
                </div>
                <button className="shrink-0 font-mono text-[11px] text-[var(--de-accent)] hover:underline">
                  Fokus →
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export function HUDBlueprint() {
  const systemMetrics: Metric[] = [
    { label: 'Ladebilanz', value: '+12.4', unit: 'Ah/d', status: 'ok', trend: 'up' },
    { label: 'Krit. ΔU', value: '2.8', unit: '%', status: 'warn' },
    { label: 'Gewicht', value: '42.3', unit: 'kg' },
    { label: 'BOM', value: '1.240', unit: '€' },
  ];

  const warnings: WarningItem[] = [
    { id: '1', severity: 'critical', ruleId: 'fuse-missing', message: 'Sicherung fehlt auf DC+ Hauptleitung', nodeId: 'BAT-01', edgeId: 'cable-03' },
    { id: '2', severity: 'critical', ruleId: 'drop-exceeded', message: 'Gesamt-Drop 3.4% > 3% (VDE)', edgeId: 'cable-07' },
    { id: '3', severity: 'warning', ruleId: 'cross-section-undersized', message: 'Querschnitt 2.5mm² < empf. 4mm²', edgeId: 'cable-02' },
    { id: '4', severity: 'info', ruleId: 'main-fuse-distance', message: 'Hauptsicherung >20cm vom Pol', nodeId: 'BAT-01' },
  ];

  return (
    <div className="flex flex-col gap-6 rounded-[4px] border border-[var(--de-rule)] bg-[var(--de-surface-0)] p-6">
      <h3 className="de-label-eyebrow">HUD — Floating Metrics & Warning Center</h3>

      <div className="flex flex-wrap gap-6">
        <KPICard title="Systembalance" metrics={systemMetrics} />
        <WarningCenter warnings={warnings} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] p-3">
          <h4 className="mb-2 font-mono text-[11px] font-bold uppercase">HUD Do&apos;s</h4>
          <ul className="space-y-1 font-mono text-[11px]">
            <li className="text-[var(--de-ok)]">✓ Surface Overlay + 16-20px Backdrop-Blur</li>
            <li className="text-[var(--de-ok)]">✓ KPI-Karten schwebend, 1px Border, kein Schatten</li>
            <li className="text-[var(--de-ok)]">✓ Tabular-nums für alle Zahlen, rechtsbündig</li>
            <li className="text-[var(--de-ok)]">✓ Warnings hierarchisch: critical → warning → info</li>
            <li className="text-[var(--de-ok)]">✓ Click to inspect: Direkt-Fokus auf Node/Edge</li>
          </ul>
        </div>
        <div className="rounded-[2px] border border-[var(--de-error-border)] bg-[var(--de-error-bg)] p-3">
          <h4 className="mb-2 font-mono text-[11px] font-bold uppercase text-[var(--de-error)]">HUD Don&apos;ts</h4>
          <ul className="space-y-1 font-mono text-[11px]">
            <li className="text-[var(--de-error)]">✗ Keine dauerhaft eingeblendeten Metriken über Canvas</li>
            <li className="text-[var(--de-error)]">✗ Keine bunten Schatten, nur 1px Border + Blur</li>
            <li className="text-[var(--de-error)]">✗ Keine Text-Wrapping-Fehler in KPI-Karten</li>
            <li className="text-[var(--de-error)]">✗ Kein Auto-Dismiss für kritische Fehler</li>
            <li className="text-[var(--de-error)]">✗ Keine generischen „Fehler“-Texte ohne Regel-ID</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
