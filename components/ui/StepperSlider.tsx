'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepperSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  unit?: string;
  ariaLabel?: string;
}

export function StepperSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  className,
  unit = '',
  ariaLabel = 'Wert anpassen',
}: StepperSliderProps) {
  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  return (
    // Designkonzept 2026-10 (Touch & Knöpfe): 4 px Radius, keine Karte mit
    // Schatten, Kante in --control-border (≥ 3:1). Der Regler selbst ist
    // 44 px hoch, damit der 28-px-Daumen eine Trefferfläche hat; Akzent ist
    // Oxid — Moos ist ein Status und nie die Farbe eines Bedienelements.
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded border border-control-border bg-surface-panel p-3',
        className
      )}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="flex h-11 min-h-11 w-11 min-w-11 touch-manipulation items-center justify-center rounded border border-control-border bg-surface-raised text-ink-soft transition-colors hover:bg-oxide/10 hover:text-oxide active:scale-95 disabled:opacity-40 disabled:hover:bg-surface-raised disabled:hover:text-ink-soft"
        aria-label="Wert verringern"
      >
        <Minus size={18} />
      </button>

      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          aria-label={ariaLabel}
          className="range-slider w-full"
        />
        <span className="mt-1 rounded border border-control-border bg-surface-raised px-2.5 py-0.5 text-xs font-semibold text-ink tabular-nums select-none">
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit}
        </span>
      </div>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className="flex h-11 min-h-11 w-11 min-w-11 touch-manipulation items-center justify-center rounded border border-control-border bg-surface-raised text-ink-soft transition-colors hover:bg-oxide/10 hover:text-oxide active:scale-95 disabled:opacity-40 disabled:hover:bg-surface-raised disabled:hover:text-ink-soft"
        aria-label="Wert erhöhen"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
