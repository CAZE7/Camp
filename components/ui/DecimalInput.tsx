'use client';
import React from 'react';
import { Input } from './input';

/**
 * QA B-01: Zahlenfeld für deutsche Eingaben.
 *
 * `type="number"` liefert im Browser bei „12,5“ einen leeren Wert bzw. einen
 * Wert, den `Number(...)` als 0 oder NaN liest — dadurch wurde aus einer
 * Eingabe ein falscher Zahlenwert. Dieses Feld ist ein Textfeld mit
 * Dezimal-Tastatur. Das Dezimalkomma wird vor dem `onChange` des Aufrufers zum
 * Punkt, damit jeder bestehende `Number(e.target.value)`-Pfad korrekt rechnet.
 */
export function normalizeDecimalInput(raw: string): string {
  // Nur ein Komma als Dezimaltrenner, und nur wenn kein Punkt vorkommt.
  if (/^[-+]?\d*,\d*$/.test(raw.trim())) return raw.trim().replace(',', '.');
  return raw;
}

export const DecimalInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  function DecimalInput({ onChange, ...props }, ref) {
    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        {...props}
        onChange={(event) => {
          const normalized = normalizeDecimalInput(event.currentTarget.value);
          if (normalized !== event.currentTarget.value) event.currentTarget.value = normalized;
          onChange?.(event);
        }}
      />
    );
  }
);
