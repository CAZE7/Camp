import React, { useState, useEffect, useId } from 'react';

export type ValidationRule = {
  validate: (val: number) => boolean;
  message: string;
};

export const COMMON_RULES = {
  positive: { validate: (v: number) => v >= 0, message: 'Wert darf nicht negativ sein.' },
  strictlyPositive: { validate: (v: number) => v > 0, message: 'Wert muss größer als 0 sein.' },
  hours: { validate: (v: number) => v >= 0 && v <= 24, message: 'Stunden müssen zwischen 0 und 24 liegen.' },
  efficiency: {
    validate: (v: number) => v > 0 && v <= 100,
    message: 'Effizienz muss größer als 0 und höchstens 100 Prozent sein.',
  },
};

interface ValidatingInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> {
  value: number | string;
  onValidChange: (val: number) => void;
  rules?: ValidationRule[];
  isFloat?: boolean;
}

export function ValidatingInput({
  value,
  onValidChange,
  rules = [],
  isFloat = false,
  className,
  ...props
}: ValidatingInputProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  const generatedId = useId();
  const inputId = props.id || generatedId;
  const errorId = `${inputId}-error`;

  useEffect(() => {
    const valStr = String(value);
    if (localValue !== valStr && !error) {
      setLocalValue(valStr);
    }
    // localValue/error werden nur als Bedingung gelesen; der Guard macht den
    // Effekt bei Gleichstand zum No-Op, ein Nachziehen ist also konvergent.
  }, [value, localValue, error]);

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
        aria-invalid={error ? 'true' : undefined}
        aria-errormessage={error ? errorId : undefined}
        className={`min-h-11 ${className || ''} ${error ? 'border-signal bg-signal/5 focus:ring-signal focus:border-signal' : ''}`}
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1 text-xs font-semibold text-signal">
          {error}
        </span>
      )}
    </div>
  );
}
