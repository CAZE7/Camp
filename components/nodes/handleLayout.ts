import type { CSSProperties } from 'react';

/**
 * Handle convention for the schematic editor (inputs left, outputs right).
 *
 * DC nodes: Plus at 30%, Minus at 70% so Plus/Minus pairs stay parallel.
 * AC / water / ground use the vertical center — they are not Plus/Minus pairs.
 * Handle IDs are part of the Auto-Wire / getHandleDomain contract and must not change.
 *
 * Intentional deviations (do not "unify" onto Plus/Minus):
 *  - ShorePower: source `plus` @ 50% (AC out; domain is the node type)
 *  - Consumer230V: target `plus` @ 50% (AC in)
 *  - Inverter: target `ac_in` on Top; DC plus/minus on the left; AC out is source `plus` @ 50%
 *  - Ground: minus only @ 50%
 *  - Water: `in` / `out` @ 50%
 *  - Conduit: dummy non-connectable handles
 */
export const HANDLE_PLUS_TOP = '30%';
export const HANDLE_MINUS_TOP = '70%';
export const HANDLE_CENTER_TOP = '50%';

const SHELL: CSSProperties = {
  background: 'transparent',
  border: 'none',
  width: '24px',
  height: '24px',
  zIndex: 10,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

export const plusHandleStyle: CSSProperties = { ...SHELL, top: HANDLE_PLUS_TOP };
export const minusHandleStyle: CSSProperties = { ...SHELL, top: HANDLE_MINUS_TOP };
export const centerHandleStyle: CSSProperties = { ...SHELL, top: HANDLE_CENTER_TOP };

export const plusDotStyle: CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: 'red',
  pointerEvents: 'none',
};

export const minusDotStyle: CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: 'black',
  pointerEvents: 'none',
};
