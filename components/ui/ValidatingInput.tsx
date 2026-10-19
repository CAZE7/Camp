import React, { useState, useId } from 'react';
import { parseDecimalString } from '../../lib/units';

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
  /**
   * Feld ist optional: Leer bedeutet „nicht angegeben" statt „Pflichtfeld".
   * Ohne diesen Schalter konnte ein optionales Feld nie zurückgesetzt werden —
   * Leer tippen setzte den Fehler „Wert erforderlich", und der Blur stellte
   * den alten Wert wieder her. Ein Wert, den die UI nicht mehr loswird, ist
   * eine Falle (AUDIT N1: gemessener I_k der Einspeisung ist optional).
   */
  allowEmpty?: boolean;
  /** Wird bei geleertem Feld aufgerufen, wenn `allowEmpty` gesetzt ist. */
  onEmptyChange?: () => void;
}

/**
 * Fehlermeldungen der Eingabe — eine Quelle für UI und Tests (AUDIT S4).
 * `integerRequired` ist neu: vorher kürzte `parseInt("2.5")` still auf `2` und
 * meldete den gekürzten Wert als gültig. Eine gerundete Zahl ist keine Tatsache.
 */
export const INPUT_ERROR_MESSAGES = {
  required: 'Wert erforderlich.',
  invalidNumber: 'Ungültige Zahl.',
  integerRequired: 'Bitte eine ganze Zahl eingeben.',
} as const;

/**
 * Ist der Text ein unfertiger Zwischenstand beim Tippen („12,“, „-“, „.“)?
 *
 * Nachtest 2026-10-16 (Komma-Bug): „12,“ wurde bisher als gültige 12 bzw.
 * als Fehler behandelt; in beiden Fällen schrieb der Prop-Abgleich den
 * Feldtext zurück auf „12“ und die nächste Ziffer machte daraus „125“
 * (mobil: „12520“). Ein Zwischenstand ist weder Wert noch Fehler — er
 * gehört dem Tippenden, bis die Zahl vollständig ist oder das Feld
 * verlassen wird.
 */
export function isPendingDecimalText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === '-' || trimmed === '+' || /^[-+]?\d*[.,]$/.test(trimmed);
}

export function ValidatingInput({
  value,
  onValidChange,
  rules = [],
  isFloat = false,
  allowEmpty = false,
  onEmptyChange,
  className,
  ...props
}: ValidatingInputProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  /**
   * Fokus-Marke gegen den „12520“-Effekt (Nachtest 2026-10-16): Solange der
   * Nutzer tippt, ist der lokale Text die Wahrheit. Der Prop-Abgleich darf
   * „12,50“ nicht mitten im Tippen durch „12.5“ ersetzen — sonst hängt die
   * nächste Ziffer an einer anderen Stelle, als der Nutzer sieht.
   */
  const [focused, setFocused] = useState(false);
  /**
   * Optionales Feld vom Nutzer bewusst geleert (AUDIT N1). Ohne diese Marke
   * holt der Sync-Effekt unten den alten Prop-Wert sofort zurück, solange die
   * Elternkomponente das `undefined` noch nicht übernommen hat — das Feld
   * würde sich gegen das Löschen wehren.
   */
  const [clearedOptional, setClearedOptional] = useState(false);

  const generatedId = useId();
  const inputId = props.id || generatedId;
  const errorId = `${inputId}-error`;

  // AUDIT T1 (react-hooks/set-state-in-effect): Beide Abgleiche (Anzeige aus
  // dem Prop nachziehen, `clearedOptional` bei neuem Prop-Wert löschen) laufen
  // zur Render-Zeit. Der Vergleichszustand trägt genau die alten Effekt-
  // Abhängigkeiten, die eine Änderung auslösen konnten — value, localValue,
  // error, allowEmpty, clearedOptional. Die Guards bleiben unverändert, der
  // Abgleich ist bei Gleichstand ein No-Op und damit konvergent.
  const [syncState, setSyncState] = useState({ value, localValue, error, allowEmpty, clearedOptional });
  if (
    syncState.value !== value ||
    syncState.localValue !== localValue ||
    syncState.error !== error ||
    syncState.allowEmpty !== allowEmpty ||
    syncState.clearedOptional !== clearedOptional
  ) {
    const valueChanged = syncState.value !== value;
    setSyncState({ value, localValue, error, allowEmpty, clearedOptional });
    const valStr = String(value);
    // Beim Tippen (Fokus im Feld) gehört der Text dem Nutzer — der Abgleich
    // wartet bis zum Blur. Sonst ersetzt der Prop „12,5“/„12,50“ mitten im
    // Tippen durch seine eigene Schreibweise, und die nächste Ziffer landet
    // an falscher Stelle (Nachtest: „125“/„12520“). Externe Änderungen
    // (Vorlage, Rückgängig) kommen ohnehin über Knöpfe/Tastatur außerhalb
    // des Felds — sie greifen beim nächsten Blur bzw. Render ohne Fokus.
    if (localValue !== valStr && !error && !focused && !(allowEmpty && clearedOptional)) {
      setLocalValue(valStr);
    }
    // Sobald die Eltern einen neuen Wert durchreichen (auch `''` nach dem
    // Leeren), ist die Marke erledigt: ab dann gilt wieder der Prop.
    if (valueChanged) {
      setClearedOptional(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const strVal = e.target.value;
    setLocalValue(strVal);

    if (strVal.trim() === '') {
      // Optionales Feld: leer ist eine gültige Aussage („nicht angegeben"),
      // kein Fehler — und der Blur darf den alten Wert nicht zurückholen.
      if (allowEmpty) {
        setError(null);
        setClearedOptional(true);
        onEmptyChange?.();
        return;
      }
      setError(INPUT_ERROR_MESSAGES.required);
      return;
    }
    setClearedOptional(false);

    // Unfertiges Tippen („12,“ auf dem Weg zu „12,5“) ist kein Fehler und
    // noch kein Wert: kein `onValidChange`, keine Fehlermeldung, kein
    // Zurückschreiben des Feldtexts (Nachtest 2026-10-16, Komma-Bug).
    if (isPendingDecimalText(strVal)) {
      setError(null);
      return;
    }

    // AUDIT S2/S4: ein strenger Parser statt parseFloat/parseInt. Beide lasen
    // nur einen Präfix — "2,5" wurde zu 2 (Dezimalkomma verschluckt),
    // "2.5mm" zu 2.5 (Rest verschluckt) und jeweils als gültig gemeldet.
    // parseDecimalString kennt das deutsche Dezimalkomma UND verlangt, dass
    // der gesamte Text eine Zahl ist.
    const numVal = parseDecimalString(strVal);

    if (numVal === null) {
      setError(INPUT_ERROR_MESSAGES.invalidNumber);
      return;
    }

    if (!isFloat && !Number.isInteger(numVal)) {
      setError(INPUT_ERROR_MESSAGES.integerRequired);
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
    setFocused(false);
    if (error || isPendingDecimalText(localValue)) {
      // Revert to the last valid value on blur if invalid or unfinished.
      setLocalValue(String(value));
      setError(null);
    }
    props.onBlur?.(e);
  };

  return (
    <div className="flex w-full flex-col">
      <input
        {...props}
        // B-01 (QA-Bericht): `type="number"` lässt das deutsche Dezimalkomma
        // vom Browser verwerfen oder verschlucken („12,5“ → 125). Der Parser
        // (`parseDecimalString`) liest Komma und Punkt — deshalb Textfeld mit
        // numerischer Tastatur. Die Validierung bleibt im Parser.
        id={inputId}
        // Nachtest 2026-10-16 (Komma-Bug): `type="number"` lässt den Browser
        // das deutsche Dezimalkomma vor React verwerfen — „12,5“ kam als
        // „125“ oder gar nicht an. Alle Zahlenfelder sind Textfelder; die
        // Tastatur kommt über `inputMode`, die Gültigkeit prüft
        // `parseDecimalString`.
        type="text"
        inputMode={props.inputMode ?? (isFloat ? 'decimal' : 'numeric')}
        autoComplete="off"
        value={localValue}
        onChange={handleChange}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={handleBlur}
        aria-invalid={error ? 'true' : undefined}
        aria-errormessage={error ? errorId : undefined}
        className={`min-h-11 ${className || ''} ${error ? 'border-signal bg-signal/5 focus:border-signal focus:ring-signal' : ''}`}
      />
      {error && (
        <span id={errorId} role="alert" className="mt-1 text-xs font-semibold text-signal">
          {error}
        </span>
      )}
    </div>
  );
}
