import React from 'react';
import { Handle, Position } from 'reactflow';

export type Polarity = 'plus' | 'minus' | 'ground' | 'neutral';

const POLARITY_COLOR: Record<Polarity, string> = {
  plus: 'var(--pol-plus)',
  minus: 'var(--pol-minus)',
  ground: 'var(--pol-ground)',
  neutral: 'var(--pol-neutral)',
};

export interface HandleSpec {
  type: 'source' | 'target';
  position: Position;
  id: string;
  polarity: Polarity;
  /** Vertical position within the node, as a CSS percentage. */
  top: string;
  /** Accessible label for this terminal. */
  label?: string;
}

function TerminalDot({ polarity }: { polarity: Polarity }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 9,
        height: 9,
        borderRadius: 2,
        background: POLARITY_COLOR[polarity],
        boxShadow: '0 0 0 1px var(--node-surface), 0 0 0 2px oklch(0 0 0 / 18%)',
        pointerEvents: 'none',
      }}
    />
  );
}

export function ConnectionHandles({
  config,
  isConnectable = true,
}: {
  config: HandleSpec[];
  isConnectable?: boolean;
}) {
  return (
    <>
      {config.map((h) => (
        <Handle
          key={`${h.type}-${h.id}-${h.position}`}
          type={h.type}
          position={h.position}
          id={h.id}
          isConnectable={isConnectable}
          aria-label={h.label ?? `${h.polarity} terminal`}
          title={h.label ?? h.polarity}
          style={{
            background: 'transparent',
            border: 'none',
            width: 18,
            height: 18,
            minWidth: 18,
            minHeight: 18,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            top: h.top,
          }}
        >
          <TerminalDot polarity={h.polarity} />
        </Handle>
      ))}
    </>
  );
}

const leftPair: HandleSpec[] = [
  { type: 'target', position: Position.Left, id: 'plus', polarity: 'plus', top: '30%', label: 'Plus (+12V)' },
  { type: 'target', position: Position.Left, id: 'minus', polarity: 'minus', top: '70%', label: 'Minus (Return)' },
];
const rightPair: HandleSpec[] = [
  { type: 'source', position: Position.Right, id: 'plus', polarity: 'plus', top: '30%', label: 'Plus (+12V)' },
  { type: 'source', position: Position.Right, id: 'minus', polarity: 'minus', top: '70%', label: 'Minus (Return)' },
];
const leftSingle = (id: string, polarity: Polarity, top = '50%', label = id): HandleSpec[] => [
  { type: 'target', position: Position.Left, id, polarity, top, label },
];
const rightSingle = (id: string, polarity: Polarity, top = '50%', label = id): HandleSpec[] => [
  { type: 'source', position: Position.Right, id, polarity, top, label },
];

/** Most 12V components: plus/minus on both sides. */
export const DC_TERMINALS = [...leftPair, ...rightPair];
/** Input (target) on the left only. */
export const DC_INPUT = leftPair;
/** Output (source) on the right only. */
export const DC_OUTPUT = rightPair;
/** Ground component: single minus terminal on both sides. */
export const GROUND_TERMINALS = [
  ...leftSingle('minus', 'minus', '50%', 'Minus (Karosserie)'),
  ...rightSingle('minus', 'minus', '50%', 'Minus (Karosserie)'),
];
/** Single pass-through terminal (water, shore power, 230V). */
export const SINGLE_IN = leftSingle('in', 'neutral', '50%', 'Eingang');
export const SINGLE_OUT = rightSingle('out', 'neutral', '50%', 'Ausgang');
export const SINGLE_IN_PLUS = leftSingle('plus', 'plus', '50%', 'Plus (+12V)');
export const SINGLE_IN_230 = leftSingle('plus', 'plus', '50%', '230V Eingang');
export const SINGLE_OUT_230 = rightSingle('plus', 'plus', '50%', '230V Ausgang');
