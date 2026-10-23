import React, { useState, useId, useRef } from 'react';
import { formatDecimalForInput, isAmbiguousDecimalString, parseDecimalString } from '../../lib/units';

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
  maxPower: {
    validate: (v: number) => v <= 50_000,
    message: 'Leistung darf höchstens 50.000 W betragen.',
  },
  maxCapacity: {
    validate: (v: number) => v <= 10_000,
    message: 'Kapazität darf höchstens 10.000 Ah betragen.',
  },
  maxAmps: {
    validate: (v: number) => v <= 2_000,
    message: 'Strom darf höchstens 2.000 A betragen.',
  },
  nominalVoltage: {
    validate: (v: number) => v >= 6 && v <= 60,
    message: 'Nennspannung muss zwischen 6 und 60 V liegen.',
  },
  maxInternalResistance: {
    validate: (v: number) => v <= 500,
    message: 'Innenwiderstand darf höchstens 500 mΩ betragen.',
  },
  peukertRange: {
    validate: (v: number) => v === 0 || (v >= 1 && v <= 2),
    message: 'Peukert-Exponent muss zwischen 1,00 und 2,00 liegen (0 = Chemie-Standard).',
  },
  maxPvVoltage: {
    validate: (v: number) => v <= 250,
    message: 'PV-Spannung darf höchstens 250 V betragen.',
  },
  maxPvCurrent: {
    validate: (v: number) => v <= 200,
    message: 'Solarstrom darf höchstens 200 A betragen.',
  },
  maxChargerCurrent: {
    validate: (v: number) => v <= 500,
    message: 'Ladestrom darf höchstens 500 A betragen.',
  },
  maxFuseRating: {
    validate: (v: number) => v <= 1_000,
    message: 'Sicherungswert darf höchstens 1.000 A betragen.',
  },
  maxShoreCurrent: {
    validate: (v: number) => v <= 125,
    message: 'Absicherung darf höchstens 125 A betragen.',
  },
  maxProspectiveIk: {
    validate: (v: number) => v <= 50_000,
    message: 'Kurzschlussstrom Ik darf höchstens 50.000 A betragen.',
  },
  maxIdleWatts: {
    validate: (v: number) => v <= 500,
    message: 'Eigenverbrauch im Betrieb darf höchstens 500 W betragen.',
  },
  maxRoofDimensionCm: {
    validate: (v: number) => v <= 1_000,
    message: 'Abmessung darf höchstens 1.000 cm betragen.',
  },
  maxCableLengthM: {
    validate: (v: number) => v <= 100,
    message: 'Kabellänge darf höchstens 100 m betragen.',
  },
  maxFuseOffsetM: {
    validate: (v: number) => v <= 10,
    message: 'Abstand zur Batterie darf höchstens 10 m betragen.',
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
  ambiguousDecimal:
    'Mehrdeutige Punkt-Schreibweise: Bitte Komma für Nachkommastellen (z. B. 1,125) oder ohne Punkt für Tausender (z. B. 1125) verwenden.',
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
  const [localValue, setLocalValue] = useState(() => formatDecimalForInput(value));
  const [error, setError] = useState<string | null>(null);
  /**
   * Fokus-Marke gegen den „12520“-Effekt (Nachtest 2026-10-16): Solange der
   * Nutzer tippt, ist der lokale Text die Wahrheit. Der Prop-Abgleich darf
   * „12,50“ nicht mitten im Tippen durch „12.5“ ersetzen — sonst hängt die
   * nächste Ziffer an einer anderen Stelle, als der Nutzer sieht.
   */
  const [focused, setFocused] = useState(false);
  /**
   * H4: Ausgangswert zu Beginn des Fokus. Tippt der Nutzer z. B. „1e3“ oder
   * „2,5,5“, war der Präfix („1“ bzw. „2,5“) kurzzeitig gültig; wird die
   * Eingabe danach im selben Fokus-Durchgang ungültig, stellt der Rollback
   * sofort den Wert vor Fokusbeginn wieder her statt den Teilpräfix zu behalten.
   */
  const focusBaselineRef = useRef<number | null>(null);
  const dirtyInFocusRef = useRef(false);
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
    const valStr = formatDecimalForInput(value);
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

  const rollbackFocusIfDirty = () => {
    if (dirtyInFocusRef.current && focusBaselineRef.current !== null) {
      dirtyInFocusRef.current = false;
      onValidChange(focusBaselineRef.current);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const strVal = e.target.value;
    setLocalValue(strVal);

    if (strVal.trim() === '') {
      // Optionales Feld: leer ist eine gültige Aussage („nicht angegeben"),
      // kein Fehler — und der Blur darf den alten Wert nicht zurückholen.
      if (allowEmpty) {
        setError(null);
        setClearedOptional(true);
        dirtyInFocusRef.current = false;
        onEmptyChange?.();
        return;
      }
      rollbackFocusIfDirty();
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

    if (isAmbiguousDecimalString(strVal)) {
      rollbackFocusIfDirty();
      setError(INPUT_ERROR_MESSAGES.ambiguousDecimal);
      return;
    }

    // AUDIT S2/S4: ein strenger Parser statt parseFloat/parseInt. Beide lasen
    // nur einen Präfix — "2,5" wurde zu 2 (Dezimalkomma verschluckt),
    // "2.5mm" zu 2.5 (Rest verschluckt) und jeweils als gültig gemeldet.
    // parseDecimalString kennt das deutsche Dezimalkomma UND verlangt, dass
    // der gesamte Text eine Zahl ist.
    const numVal = parseDecimalString(strVal);

    if (numVal === null) {
      rollbackFocusIfDirty();
      setError(INPUT_ERROR_MESSAGES.invalidNumber);
      return;
    }

    if (!isFloat && !Number.isInteger(numVal)) {
      rollbackFocusIfDirty();
      setError(INPUT_ERROR_MESSAGES.integerRequired);
      return;
    }

    for (const rule of rules) {
      if (!rule.validate(numVal)) {
        rollbackFocusIfDirty();
        setError(rule.message);
        return;
      }
    }

    setError(null);
    if (focused) dirtyInFocusRef.current = true;
    onValidChange(numVal);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    if (error || isPendingDecimalText(localValue)) {
      // Revert to the pre-focus / last valid value on blur if invalid or unfinished.
      const revertTarget =
        focusBaselineRef.current !== null
          ? formatDecimalForInput(focusBaselineRef.current)
          : formatDecimalForInput(value);
      setLocalValue(revertTarget);
      setError(null);
    } else if (!(allowEmpty && clearedOptional) && typeof value === 'number' && Number.isFinite(value)) {
      setLocalValue(formatDecimalForInput(value));
    }
    focusBaselineRef.current = null;
    dirtyInFocusRef.current = false;
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
          focusBaselineRef.current = typeof value === 'number' ? value : parseDecimalString(String(value));
          dirtyInFocusRef.current = false;
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
