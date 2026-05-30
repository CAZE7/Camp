import React, { useState, useEffect, useId } from 'react';

export type ValidationRule = {
  validate: (val: number) => boolean;
  message: string;
};

export const COMMON_RULES = {
  positive: { validate: (v: number) => v >= 0, message: 'Wert darf nicht negativ sein.' },
  strictlyPositive: { validate: (v: number) => v > 0, message: 'Wert muss größer als 0 sein.' },
  hours: { validate: (v: number) => v >= 0 && v <= 24, message: 'Stunden müssen zwischen 0 und 24 liegen.' },
  efficiency: { validate: (v: number) => v >= 0 && v <= 100, message: 'Effizienz muss zwischen 0 und 100 liegen.' },
};

interface ValidatingInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string;
  onValidChange: (val: number) => void;
  rules?: ValidationRule[];
  isFloat?: boolean;
}

export function ValidatingInput({ value, onValidChange, rules = [], isFloat = false, className, ...props }: ValidatingInputProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const generatedId = useId();
  const inputId = props.id || generatedId;

  useEffect(() => {
    const valStr = String(value);
    if (localValue !== valStr && !error) {
      setLocalValue(valStr);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const strVal = e.target.value;
    setLocalValue(strVal);

    if (strVal.trim() === '') {
      setError('Wert erforderlich.');
      return;
    }

    const numVal = isFloat ? parseFloat(strVal) : parseInt(strVal, 10);

    if (isNaN(numVal)) {
      setError('Ungültige Zahl.');
      return;
    }

    for (const rule of rules) {
      if (!rule.validate(numVal)) {
        setError(rule.message);
        return;
      }
    }

    setError(null);
    onValidChange(numVal);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (error) {
      // Revert to the last valid value on blur if invalid
      setLocalValue(String(value));
      setError(null);
    }
    props.onBlur?.(e);
  };

  return (
    <div className="flex flex-col w-full">
      <input
        {...props}
        id={inputId}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={!!error}
        aria-errormessage={error ? `${inputId}-error` : undefined}
        className={`${className || ''} ${error ? 'border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500' : ''}`}
      />
      {error && <span id={`${inputId}-error`} role="alert" className="text-red-500 text-xs mt-1 font-medium">{error}</span>}
    </div>
  );
}
