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
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-border/80 bg-paper/80 p-3 shadow-sm',
        className
      )}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="flex h-11 min-h-11 w-11 min-w-11 touch-manipulation items-center justify-center rounded-md border border-border bg-bone text-ink-soft shadow-sm transition-all hover:bg-moss/10 hover:text-moss active:scale-95 disabled:opacity-40 disabled:hover:bg-bone disabled:hover:text-ink-soft"
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
          className="stepper-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-rule/40 accent-moss focus:outline-none focus:ring-1 focus:ring-moss/40"
        />
        <span className="mt-1 select-none rounded-lg border border-border/50 bg-bone px-2.5 py-0.5 font-mono text-xs font-bold text-ink-soft shadow-sm">
          {value.toFixed(step < 1 ? 1 : 0)}
          {unit}
        </span>
      </div>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className="flex h-11 min-h-11 w-11 min-w-11 touch-manipulation items-center justify-center rounded-md border border-border bg-bone text-ink-soft shadow-sm transition-all hover:bg-moss/10 hover:text-moss active:scale-95 disabled:opacity-40 disabled:hover:bg-bone disabled:hover:text-ink-soft"
        aria-label="Wert erhöhen"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
