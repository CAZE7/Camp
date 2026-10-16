import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import { ComponentTile } from './ComponentTile';
import type { Comp } from './catalog';
import * as drag from './drag';

const comp = {
  type: 'battery',
  label: 'Batterie',
  description: 'Akku',
  icon: () => null,
} as unknown as Comp;

describe('ComponentTile — Klick fügt hinzu (B-05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  });

  // Der Ghost-Drag hängt einen Klon an <body>; er wird hier nicht per Pointerup entfernt.
  afterEach(() => {
    document.querySelectorAll('body > [style*="position: fixed"]').forEach((node) => node.remove());
  });

  it('a desktop click without moving adds the component at the visible centre', () => {
    const addSpy = vi.spyOn(drag, 'addAtVisibleCenter').mockImplementation(() => {});
    const { container } = render(<ComponentTile comp={comp} accent="default" />);
    const tile = within(container).getByRole('option', { name: /Batterie hinzufügen/ });

    fireEvent.pointerDown(tile, { pointerType: 'mouse', clientX: 100, clientY: 100 });
    fireEvent.click(tile, { clientX: 101, clientY: 100 });

    expect(addSpy).toHaveBeenCalledTimes(1);
  });

  it('a real drag (release far away) does not add on click', () => {
    const addSpy = vi.spyOn(drag, 'addAtVisibleCenter').mockImplementation(() => {});
    const { container } = render(<ComponentTile comp={comp} accent="default" />);
    const tile = within(container).getByRole('option', { name: /Batterie hinzufügen/ });

    fireEvent.pointerDown(tile, { pointerType: 'mouse', clientX: 100, clientY: 100 });
    fireEvent.click(tile, { clientX: 400, clientY: 300 });

    expect(addSpy).not.toHaveBeenCalled();
  });
});
