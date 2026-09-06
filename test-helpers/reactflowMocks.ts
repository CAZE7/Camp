import type { CSSProperties, HTMLAttributes, MouseEvent as ReactMouseEvent } from 'react';

/**
 * Geteilte, typisierte Props für gemockte reactflow-Komponenten in Tests (M6-7).
 *
 * `vi.mock`-Factories ersetzen `Handle`/`NodeResizer` durch flache DOM-Elemente.
 * Statt `props: any` descrubben die Mocks hier genau die Attribute, die die
 * Produktionskomponenten tatsächlich durchreichen — Typfehler in Tests zeigen
 * damit echte API-Drifts an, statt sie zu verstecken.
 */
export type MockHandleProps = {
  'data-testid'?: string;
  id?: string | null;
  type?: 'source' | 'target';
  position?: string;
  isConnectable?: boolean;
  style?: CSSProperties;
  onMouseDown?: (event: ReactMouseEvent) => void;
};

/** Props, die `NodeResizer`-Mocks im Test empfangen (onResize-Signatur wie reactflow). */
export type MockNodeResizerProps = {
  'data-testid'?: string;
  isVisible?: boolean;
  minWidth?: number;
  minHeight?: number;
  lineClassName?: string;
  handleClassName?: string;
  onResize?: (event: ReactMouseEvent, box: { width: number; height: number }, direction?: string) => void;
};

/**
 * Streut die Rest-Props eines gemockten reactflow-Elements auf ein <div>.
 * Der Cast sitzt zentral an einer Stelle statt `as any` pro Testdatei.
 */
export const asDivProps = (props: object): HTMLAttributes<HTMLDivElement> =>
  props as unknown as HTMLAttributes<HTMLDivElement>;

/**
 * Zustand-Hook-Mock: leitet Selectoren gegen einen (partiellen) State weiter —
 * typisiert, ohne `any`. Aufruf: `.mockImplementation(withSelector(state) as
 * typeof usePlannerStore)`.
 */
export const withSelector =
  <S>(state: S) =>
  <T>(selector: (s: S) => T): T =>
    selector(state);
