import React from 'react';
import { cn } from '@/lib/utils';

interface ValidatingNumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  required?: boolean;
  errorMessage?: string;
}

export function ValidatingNumberInput({
  value,
  onChange,
  required,
  errorMessage = 'Dieses Feld ist erforderlich.',
  className,
  id,
  ...props
}: ValidatingNumberInputProps) {
  const [localValue, setLocalValue] = React.useState<string>(
    value === null || value === undefined ? '' : value.toString()
  );
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setLocalValue(value === null || value === undefined ? '' : value.toString());
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    if (val === '') {
      onChange(null);
    } else {
      onChange(Number(val));
    }
  };

  const isInvalid = required && localValue === '';

  return (
    <div className="flex w-full flex-col">
      <input
        id={id}
        type="number"
        {...props}
        value={localValue}
        onChange={handleChange}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        aria-invalid={isInvalid ? 'true' : 'false'}
        aria-errormessage={isInvalid ? `${id}-error` : undefined}
        className={cn(
          'min-h-11 rounded border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2',
          isInvalid ? 'border-signal bg-signal/5 focus:ring-signal' : 'border-border focus:ring-ring',
          className
        )}
      />
      {isInvalid && (
        <span id={`${id}-error`} className="mt-1 text-xs font-semibold text-signal" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
