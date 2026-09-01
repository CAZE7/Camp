'use client';
import { useCallback, useState } from 'react';
import { usePlannerStore } from '../../../store/usePlannerStore';

/**
 * Gemeinsames Inline-Editing für Planer-Nodes (AGENTS.md M6-2).
 *
 * Vorher kopierten alle 11 Node-Komponenten denselben Block aus
 * Double-Click-Editor, Numeric-Validierung und Error-Broadcast. Diese Kopien
 * waren ein Drift-Risiko: ein Fix in einer Node (z. B. Escape bricht ab)
 * erreichte die anderen nicht. Das Hook ist jetzt die einzige Stelle.
 *
 * Verhalten (identisch zur bisherigen Implementierung):
 *  - Double-Click auf ein Feld öffnet einen Inline-Input mit dem alten Wert.
 *  - Textfelder (`label`, `chemistry`) werden unvalidiert übernommen.
 *  - Alle anderen Felder müssen endliche Zahlen > 0 sein; `hours` darf 0 sein.
 *  - Ungültige Eingaben senden ein `planner-input-error`-CustomEvent
 *    (PlannerDashboard blendet es als Toast ein) und verwerfen den Edit.
 *  - Enter und Blur committen, Escape bricht ab (Verbesserung ggü. Kopie).
 */

/** Felder, die Freitext sind und keine Zahlenvalidierung durchlaufen. */
const DEFAULT_TEXT_FIELDS = ['label', 'chemistry'] as const;
/** Felder, bei denen 0 ein zulässiger Wert ist (sonst > 0). */
const DEFAULT_ZERO_ALLOWED_FIELDS = ['hours'] as const;

export interface InlineNodeEditingOptions {
  /** Feldnamen, die als Freitext behandelt werden. Standard: label, chemistry. */
  textFields?: readonly string[];
  /** Feldnamen, bei denen 0 erlaubt ist. Standard: hours. */
  zeroAllowedFields?: readonly string[];
}

export interface InlineNodeEditing<K extends string = string> {
  /** Aktuell in Bearbeitung befindliches Feld oder null. */
  editingField: K | null;
  /** Rohtext des Eingabefelds. */
  tempValue: string;
  setTempValue: (value: string) => void;
  /** Öffnet den Editor für `field` vorbelegt mit `currentValue`. */
  handleDoubleClick: (field: K, currentValue: string | number | undefined) => void;
  /** Validiert und schreibt den Wert in den Store; Blur-Handler. */
  handleBlur: () => void;
  /** Enter commitiert, Escape bricht ab; KeyDown-Handler des Inputs. */
  handleKeyDown: (event: React.KeyboardEvent) => void;
  /** Bequemlichkeit fürs JSX: `isEditing('capacity')` statt Vergleich. */
  isEditing: (field: K) => boolean;
  /** Schließt den Editor ohne zu schreiben. */
  cancelEditing: () => void;
}

function dispatchInputError(message: string): void {
  window.dispatchEvent(new CustomEvent('planner-input-error', { detail: message }));
}

export function useInlineNodeEditing<K extends string = string>(
  id: string,
  options: InlineNodeEditingOptions = {}
): InlineNodeEditing<K> {
  const updateNodeData = usePlannerStore((state) => state.updateNodeData);
  const [editingField, setEditingField] = useState<K | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const textFields = options.textFields ?? DEFAULT_TEXT_FIELDS;
  const zeroAllowedFields = options.zeroAllowedFields ?? DEFAULT_ZERO_ALLOWED_FIELDS;

  const handleDoubleClick = useCallback((field: K, currentValue: string | number | undefined) => {
    setEditingField(field);
    setTempValue(String(currentValue ?? ''));
  }, []);

  const cancelEditing = useCallback(() => setEditingField(null), []);

  const handleBlur = useCallback(() => {
    if (!editingField) return;
    const field: string = editingField;
    const isText = (textFields as readonly string[]).includes(field);

    let finalValue: string | number = tempValue;
    if (!isText) {
      const parsed = Number(tempValue);
      const allowsZero = (zeroAllowedFields as readonly string[]).includes(field);
      if (!Number.isFinite(parsed) || parsed < 0 || (!allowsZero && parsed === 0)) {
        dispatchInputError(allowsZero ? 'Gib eine Zahl ab 0 ein.' : 'Der Wert muss größer als 0 sein.');
        setEditingField(null);
        return;
      }
      finalValue = parsed;
    }
    updateNodeData(id, { [field]: finalValue });
    setEditingField(null);
    // textFields/zeroAllowedFields sind stabil (Modul-Konstanten oder
    // Moduleigene Arrays der aufrufenden Komponente); ein Re-Memoing pro
    // Render wäre Rauschen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingField, tempValue, id, updateNodeData]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        handleBlur();
      } else if (event.key === 'Escape') {
        setEditingField(null);
      }
    },
    [handleBlur]
  );

  const isEditing = useCallback((field: K) => editingField === field, [editingField]);

  return {
    editingField,
    tempValue,
    setTempValue,
    handleDoubleClick,
    handleBlur,
    handleKeyDown,
    isEditing,
    cancelEditing,
  };
}
