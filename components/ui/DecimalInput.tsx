'use client';

import React from 'react';
import { Input } from './input';

/**
 * Zahlenfeld für deutsche Eingaben (Nachtest 2026-10-16, Komma-Bug;
 * übernommen aus PR #536, B-01).
 *
 * `type="number"` liefert im Browser bei „12,5“ einen leeren oder
 * verstümmelten Wert, bevor React ihn sieht — daraus wurde ein falscher
 * Zahlenwert (125 statt 12,5). Dieses Feld ist ein Textfeld mit
 * Dezimal-Tastatur. Das Dezimalkomma wird vor dem `onChange` des Aufrufers
 * zum Punkt, damit jeder bestehende `Number(e.target.value)`-Pfad korrekt
 * rechnet. Für Felder mit Validierung ist `ValidatingInput` zuständig;
 * dieses Feld ist für die einfachen Rechner-/Werkzeug-Formulare, die ihren
 * Rohtext selbst parsen.
 */
export function normalizeDecimalInput(raw: string): string {
  // Nur ein Komma als Dezimaltrenner, und nur wenn kein Punkt vorkommt.
  if (/^[-+]?\d*,\d*$/.test(raw.trim())) return raw.trim().replace(',', '.');
  return raw;
}

export const DecimalInput = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  // `type`/`inputMode` des Aufrufers werden bewusst geschluckt: Ein
  // vergessenes `type="number"` an einer Verwendungsstelle darf den
  // Komma-Fix nicht wieder aushebeln.
  function DecimalInput({ onChange, type: _ignoredType, inputMode: _ignoredInputMode, ...props }, ref) {
    return (
      <Input
        ref={ref}
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        onChange={(event) => {
          const normalized = normalizeDecimalInput(event.currentTarget.value);
          if (normalized !== event.currentTarget.value) event.currentTarget.value = normalized;
          onChange?.(event);
        }}
      />
    );
  }
);
