'use client';

/**
 * INSPEKTOR BLUEPRINT — Modul 3: Informationsarchitektur & Dichte
 *
 * - Zweispaltiges Key-Value-Layout mit perfekter vertikaler Fluchtlinie
 * - Spezialisierte Eingabeelemente: Stepper, Validating Number Field mit Einheit
 * - Visuelle Trennung Nutzer-Input vs. berechneter Wert (ΔU Ampel)
 */

import React, { useState } from 'react';

type Unit = 'V' | 'A' | 'mm²' | 'W' | 'm' | 'Ah' | '%' | '°C';

interface FieldSpec {
  key: string;
  label: string;
  value: number | string;
  unit?: Unit;
  computed?: boolean;
  min?: number;
  max?: number;
  step?: number;
  status?: 'ok' | 'warn' | 'error';
  hint?: string;
}

function ValidatingNumberField({
  spec,
  onChange,
}: {
  spec: FieldSpec;
  onChange?: (v: number) => void;
}) {
  const [val, setVal] = useState(String(spec.value));
  const num = Number(val);
  const invalid = Number.isNaN(num) || (spec.min !== undefined && num < spec.min) || (spec.max !== undefined && num > spec.max);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[12px] font-medium text-[var(--de-text-med)]">{spec.label}</label>
        {spec.computed && <span className="de-label-eyebrow text-[10px]">berechnet</span>}
      </div>
      <div className="relative flex items-center">
        <input
          type="text"
          inputMode="decimal"
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange?.(n);
          }}
          className={[
            'h-8 w-full rounded-[2px] border bg-[var(--de-surface-2)] px-2 pr-12',
            'font-mono text-[13px] tabular-nums text-right',
            'focus:outline-none focus:ring-1',
            invalid
              ? 'border-[var(--de-error)] focus:ring-[var(--de-error)]'
              : 'border-[var(--de-rule-strong)] focus:border-[var(--de-accent)] focus:ring-[var(--de-accent)]',
            spec.computed ? 'border-dashed bg-[var(--de-surface-1)]' : '',
          ].join(' ')}
          aria-invalid={invalid}
        />
        {spec.unit && (
          <span className="pointer-events-none absolute right-2 font-mono text-[11px] text-[var(--de-text-low)]">
            {spec.unit}
          </span>
        )}
        {/* Stepper */}
        <div className="absolute right-8 flex flex-col">
          <button
            className="h-4 w-4 text-[10px] leading-none hover:bg-[var(--de-surface-1)]"
            onClick={() => {
              const next = (Number(val) || 0) + (spec.step ?? 1);
              setVal(String(next));
              onChange?.(next);
            }}
          >
            ▲
          </button>
          <button
            className="h-4 w-4 text-[10px] leading-none hover:bg-[var(--de-surface-1)]"
            onClick={() => {
              const next = (Number(val) || 0) - (spec.step ?? 1);
              setVal(String(next));
              onChange?.(next);
            }}
          >
            ▼
          </button>
        </div>
      </div>
      {spec.hint && (
        <span className="font-mono text-[11px] text-[var(--de-text-low)]">{spec.hint}</span>
      )}
      {spec.status && (
        <span
          className={[
            'inline-flex w-fit rounded-[2px] px-1.5 py-0.5 font-mono text-[11px]',
            spec.status === 'ok'
              ? 'bg-[var(--de-ok-bg)] text-[var(--de-ok)] border border-[var(--de-ok-border)]'
              : spec.status === 'warn'
                ? 'bg-[var(--de-warn-bg)] text-[var(--de-warn)] border border-[var(--de-warn-border)]'
                : 'bg-[var(--de-error-bg)] text-[var(--de-error)] border border-[var(--de-error-border)]',
          ].join(' ')}
        >
          {spec.status === 'ok' ? '● OK' : spec.status === 'warn' ? '▲ WARN' : '■ ERR'} {spec.hint}
        </span>
      )}
    </div>
  );
}

function KVRow({ label, value, computed, unit, status }: { label: string; value: string; computed?: boolean; unit?: string; status?: 'ok' | 'warn' | 'error' }) {
  return (
    <div className="grid grid-cols-2 items-baseline gap-4 py-1">
      <span className="de-kv-key">{label}</span>
      <span className={computed ? 'de-kv-value--computed de-kv-value' : 'de-kv-value'}>
        {value}
        {unit ? <span className="ml-1 text-[var(--de-text-low)]">{unit}</span> : null}
        {status && (
          <span
            className={[
              'ml-2 inline-block h-2 w-2 rounded-full',
              status === 'ok' ? 'bg-[var(--de-ok)]' : status === 'warn' ? 'bg-[var(--de-warn)]' : 'bg-[var(--de-error)]',
            ].join(' ')}
          />
        )}
      </span>
    </div>
  );
}

export function InspectorBlueprint() {
  return (
    <div className="de-inspector flex w-[320px] flex-col">
      {/* Header */}
      <div className="de-inspector__header">
        <h2 className="de-label-eyebrow">Details — BAT-01</h2>
        <span className="font-mono text-[11px] text-[var(--de-text-low)]">LiFePO4</span>
      </div>

      {/* Section: Nutzer-Inputs */}
      <div className="de-inspector__section">
        <h3 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--de-text-med)]">
          Konfiguration (Eingabe)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <ValidatingNumberField spec={{ key: 'capacity', label: 'Kapazität', value: 100, unit: 'Ah', min: 10, max: 1000, step: 10 }} />
          <ValidatingNumberField spec={{ key: 'voltage', label: 'Nennspannung', value: 12.8, unit: 'V', min: 10, max: 15, step: 0.1 }} />
          <ValidatingNumberField spec={{ key: 'cable', label: 'Leitung', value: 2.5, unit: 'm', min: 0.1, max: 20, step: 0.1 }} />
          <ValidatingNumberField spec={{ key: 'cross', label: 'Querschnitt', value: 16, unit: 'mm²', min: 0.5, max: 70, step: 1 }} />
        </div>
      </div>

      {/* Section: Berechnete Werte — visuell getrennt */}
      <div className="de-inspector__section bg-[color-mix(in_srgb,var(--de-surface-0)_60%,var(--de-surface-1))]">
        <h3 className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--de-text-med)]">
          <span className="inline-block h-px w-4 bg-[var(--de-rule)]" />
          Physik (berechnet)
          <span className="inline-block h-px w-4 bg-[var(--de-rule)]" />
        </h3>
        <div className="flex flex-col">
          <KVRow label="Spannungsfall ΔU" value="0.18" unit="V" computed status="ok" />
          <KVRow label="ΔU %" value="1.4" unit="%" computed status="ok" />
          <KVRow label="Strom I" value="85" unit="A" computed />
          <KVRow label="Max Sicherung" value="100" unit="A" computed status="warn" />
        </div>

        {/* Ampel-Indikator für ΔU */}
        <div className="mt-3 flex items-center gap-2 rounded-[2px] border border-[var(--de-ok-border)] bg-[var(--de-ok-bg)] px-2 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--de-ok)]" />
          <span className="font-mono text-[11px] text-[var(--de-ok)]">ΔU im Budget (&lt;3%)</span>
          <span className="ml-auto font-mono text-[11px] text-[var(--de-text-low)]">VDE 0298-4</span>
        </div>
      </div>

      {/* Section: Aktionen */}
      <div className="de-inspector__section flex gap-2">
        <button className="h-8 flex-1 rounded-[2px] border border-[var(--de-rule-strong)] bg-[var(--de-surface-2)] font-mono text-[12px] font-medium hover:border-[var(--de-rule-highlight)]">
          Duplizieren
        </button>
        <button className="h-8 flex-1 rounded-[2px] bg-[var(--de-error)] font-mono text-[12px] font-medium text-[var(--on-signal)] hover:bg-[var(--de-error)]/90">
          Löschen
        </button>
      </div>

      {/* Fluchtlinien-Hilfe (nur Blueprint) */}
      <div className="border-t border-dashed border-[var(--de-rule)] p-2">
        <span className="font-mono text-[10px] text-[var(--de-text-dim)]">
          4px Grid • 12px/16px Innenabstand • tabular-nums rechtsbündig
        </span>
      </div>
    </div>
  );
}

export function InspectorBlueprintCompact() {
  return (
    <div className="flex gap-4">
      <InspectorBlueprint />
      <div className="w-[280px] rounded-[4px] border border-dashed border-[var(--de-rule)] p-4">
        <h4 className="de-label-eyebrow mb-2">Do&apos;s &amp; Don&apos;ts Inspektor</h4>
        <ul className="space-y-2 font-mono text-[11px] leading-snug">
          <li className="text-[var(--de-ok)]">✓ 2-spaltig, Fluchtlinie bündig</li>
          <li className="text-[var(--de-ok)]">✓ Einheit im Suffix, nicht im Label</li>
          <li className="text-[var(--de-ok)]">✓ Computed = gestrichelt + tint</li>
          <li className="text-[var(--de-error)]">✗ Kein zentrierter Zahlenwust</li>
          <li className="text-[var(--de-error)]">✗ Kein Schatten, nur 1px Border</li>
          <li className="text-[var(--de-error)]">✗ Kein Text unter 11px</li>
        </ul>
      </div>
    </div>
  );
}
