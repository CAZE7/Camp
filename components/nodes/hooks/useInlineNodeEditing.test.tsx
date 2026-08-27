import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useInlineNodeEditing } from './useInlineNodeEditing';

vi.mock('../../../store/usePlannerStore', () => ({
  usePlannerStore: vi.fn((selector: (state: { updateNodeData: unknown }) => unknown) =>
    selector({ updateNodeData: mockUpdateNodeData })
  ),
}));

const mockUpdateNodeData = vi.fn();

function renderNode(id: string) {
  const Node = () => {
    const { editingField, tempValue, setTempValue, handleDoubleClick, handleBlur, handleKeyDown, isEditing } =
      useInlineNodeEditing(id);
    return (
      <div>
        {isEditing('capacity') ? (
          <input
            data-testid="editor"
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div data-testid="display" onDoubleClick={() => handleDoubleClick('capacity', 100)}>
            Kapazität
          </div>
        )}
        <span data-testid="editing">{String(editingField)}</span>
      </div>
    );
  };
  return render(React.createElement(Node));
}

describe('useInlineNodeEditing', () => {
  let errorEvents: CustomEvent[];
  const collectError = (e: Event) => {
    errorEvents.push(e as CustomEvent);
  };

  beforeEach(() => {
    mockUpdateNodeData.mockClear();
    errorEvents = [];
    window.addEventListener('planner-input-error', collectError);
  });

  afterEach(() => {
    window.removeEventListener('planner-input-error', collectError);
  });

  it('öffnet den Editor mit dem String-Wert des Vorbelegswerts', () => {
    const { result } = renderHook(() => useInlineNodeEditing('n1'));
    act(() => result.current.handleDoubleClick('capacity', 100));
    expect(result.current.editingField).toBe('capacity');
    expect(result.current.tempValue).toBe('100');
  });

  it('definiert den Vorbelegswert bei undefined leer', () => {
    const { result } = renderHook(() => useInlineNodeEditing('n1'));
    act(() => result.current.handleDoubleClick('label', undefined));
    expect(result.current.tempValue).toBe('');
  });

  it('übernimmt einen gültigen Zahlenwert als number', () => {
    const { result } = renderHook(() => useInlineNodeEditing('n1'));
    act(() => result.current.handleDoubleClick('capacity', 100));
    act(() => result.current.setTempValue('240'));
    act(() => result.current.handleBlur());
    expect(mockUpdateNodeData).toHaveBeenCalledWith('n1', { capacity: 240 });
    expect(result.current.editingField).toBeNull();
  });

  it('übernimmt Textfelder (label/chemistry) ohne Zahlenvalidierung', () => {
    const { result } = renderHook(() => useInlineNodeEditing('n1'));
    act(() => result.current.handleDoubleClick('label', 'Batterie'));
    act(() => result.current.setTempValue('Aufbau'));
    act(() => result.current.handleBlur());
    expect(mockUpdateNodeData).toHaveBeenCalledWith('n1', { label: 'Aufbau' });
  });

  it('lehnt NaN ab, sendet planner-input-error und schreibt nichts', () => {
    const { result } = renderHook(() => useInlineNodeEditing('n1'));
    act(() => result.current.handleDoubleClick('capacity', 100));
    act(() => result.current.setTempValue('abc'));
    act(() => result.current.handleBlur());
    expect(mockUpdateNodeData).not.toHaveBeenCalled();
    expect(result.current.editingField).toBeNull();
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].detail).toBe('Der Wert muss größer als 0 sein.');
  });

  it('lehnt 0 für Nicht-Null-Felder ab', () => {
    const { result } = renderHook(() => useInlineNodeEditing('n1'));
    act(() => result.current.handleDoubleClick('capacity', 100));
    act(() => result.current.setTempValue('0'));
    act(() => result.current.handleBlur());
    expect(mockUpdateNodeData).not.toHaveBeenCalled();
  });

  it('erlaubt 0 für hours (Default-Konfiguration)', () => {
    const { result } = renderHook(() => useInlineNodeEditing('n1'));
    act(() => result.current.handleDoubleClick('hours', 3));
    act(() => result.current.setTempValue('0'));
    act(() => result.current.handleBlur());
    expect(mockUpdateNodeData).toHaveBeenCalledWith('n1', { hours: 0 });
  });

  it('Enter commitiert, Escape bricht ab', () => {
    const { result } = renderHook(() => useInlineNodeEditing('n1'));
    act(() => result.current.handleDoubleClick('capacity', 100));
    act(() => result.current.setTempValue('150'));
    act(() =>
      result.current.handleKeyDown({
        key: 'Enter',
      } as React.KeyboardEvent)
    );
    expect(mockUpdateNodeData).toHaveBeenCalledWith('n1', { capacity: 150 });

    act(() => result.current.handleDoubleClick('capacity', 100));
    act(() => result.current.setTempValue('999'));
    act(() =>
      result.current.handleKeyDown({
        key: 'Escape',
      } as React.KeyboardEvent)
    );
    expect(result.current.editingField).toBeNull();
    expect(mockUpdateNodeData).toHaveBeenCalledTimes(1); // kein zweiter Write
  });

  it('handleBlur ohne offenen Editor ist ein No-Op', () => {
    const { result } = renderHook(() => useInlineNodeEditing('n1'));
    act(() => result.current.handleBlur());
    expect(mockUpdateNodeData).not.toHaveBeenCalled();
  });

  it('Integration: Doppelklick → Tippen → Blur schreibt in den Store', () => {
    const { getByTestId } = renderNode('n42');
    fireEvent.doubleClick(getByTestId('display'));
    expect(getByTestId('editing').textContent).toBe('capacity');
    const input = getByTestId('editor') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '230' } });
    fireEvent.blur(input);
    expect(mockUpdateNodeData).toHaveBeenCalledWith('n42', { capacity: 230 });
    expect(getByTestId('editing').textContent).toBe('null');
  });
});
