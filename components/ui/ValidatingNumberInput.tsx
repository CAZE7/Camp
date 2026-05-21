import React from 'react';
import { cn } from '@/lib/utils';

interface ValidatingNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | null | undefined;
  onChange: (val: number | null) => void;
  required?: boolean;
  errorMessage?: string;
}

export function ValidatingNumberInput({
  value,
  onChange,
  required,
  errorMessage = "Dieses Feld ist erforderlich.",
  className,
  id,
  ...props
}: ValidatingNumberInputProps) {
  const [localValue, setLocalValue] = React.useState<string>(value === null || value === undefined ? "" : value.toString());
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setLocalValue(value === null || value === undefined ? "" : value.toString());
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    if (val === "") {
      onChange(null);
    } else {
      onChange(Number(val));
    }
  };

  const isInvalid = required && localValue === "";

  return (
    <div className="flex flex-col w-full">
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
        aria-invalid={isInvalid ? "true" : "false"}
        aria-errormessage={isInvalid ? `${id}-error` : undefined}
        className={cn(
          "border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow",
          isInvalid
            ? "border-red-500 focus:ring-red-500 bg-red-50/10"
            : "border-gray-300 focus:ring-orange-500",
          className
        )}
      />
      {isInvalid && (
        <span id={`${id}-error`} className="text-red-500 text-xs mt-1 font-medium" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
