"use client";

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
    <div className={cn("flex items-center gap-3 w-full bg-stone-50/80 p-3 rounded-2xl border border-border/80 shadow-sm", className)}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="w-11 h-11 min-w-11 min-h-11 flex items-center justify-center bg-white border border-border hover:bg-emerald-50 hover:text-emerald-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-stone-600 text-stone-600 rounded-xl transition-all shadow-sm active:scale-95 touch-manipulation"
        aria-label="Wert verringern"
      >
        <Minus size={18} />
      </button>

      <div className="flex-1 flex flex-col gap-1 items-center justify-center px-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          aria-label={ariaLabel}
          className="w-full h-2 bg-stone-200 rounded-full appearance-none cursor-pointer accent-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
        />
        <span className="text-xs font-mono font-bold text-stone-700 bg-white border border-border/50 rounded-lg px-2.5 py-0.5 mt-1 shadow-sm select-none">
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>

      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className="w-11 h-11 min-w-11 min-h-11 flex items-center justify-center bg-white border border-border hover:bg-emerald-50 hover:text-emerald-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-stone-600 text-stone-600 rounded-xl transition-all shadow-sm active:scale-95 touch-manipulation"
        aria-label="Wert erhöhen"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
