'use client';

import { CircuitBoard, Ruler, ShieldCheck } from 'lucide-react';
import type { PlannerMode } from '../../../store/slices/types';

/**
 * PlannerModeSwitch — die drei Fragen des Planers, getrennt (V2-UX-001).
 *
 * Vorher beantwortete ein Bildschirm gleichzeitig „was gehört zusammen?",
 * „wo liegt es?" und „stimmt es?". Das Ergebnis war ein Plan, auf dem
 * Topologie, Kabelweg und Befunde um dieselbe Fläche konkurrierten — und auf
 * dem niemand sah, welche Frage er gerade bearbeitet.
 *
 * Der Modus ändert ausschließlich die ANZEIGE. Er verändert weder Topologie
 * noch Geometrie (ADR 0008). Deshalb ist er auch kein „Bearbeitungsmodus":
 * Es gibt nichts, was man in einem Modus kann und im anderen nicht.
 */

export const PLANNER_MODES: readonly {
  mode: PlannerMode;
  label: string;
  question: string;
  Icon: typeof CircuitBoard;
}[] = [
  {
    mode: 'planung',
    label: 'Planung',
    question: 'Was gehört elektrisch zusammen? (Bänke, Stromkreise, Verbindungen)',
    Icon: CircuitBoard,
  },
  {
    mode: 'physisch',
    label: 'Physisch',
    question: 'Wo liegt es? (Einbauorte, Leitungslängen, Kabelführung)',
    Icon: Ruler,
  },
  {
    mode: 'pruefung',
    label: 'Prüfung',
    question: 'Stimmt es? (Befunde, Grenzen, offene Entscheidungen)',
    Icon: ShieldCheck,
  },
];

type PlannerModeSwitchProps = {
  mode: PlannerMode;
  onSelect: (mode: PlannerMode) => void;
};

export function PlannerModeSwitch({ mode, onSelect }: PlannerModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label="Arbeitsmodus"
      className="flex gap-1 rounded border border-border bg-surface-panel/95 p-1 shadow-sm"
    >
      {PLANNER_MODES.map((option) => {
        const active = option.mode === mode;
        return (
          <button
            key={option.mode}
            type="button"
            data-testid={`planner-mode-${option.mode}`}
            aria-pressed={active}
            title={option.question}
            onClick={() => onSelect(option.mode)}
            className="flex min-h-11 items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-ink"
          >
            <option.Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
