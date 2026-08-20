import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccessibleDialog } from './AccessibleDialog';

function renderDialog(onClose = vi.fn()) {
  render(
    <AccessibleDialog open onClose={onClose} title="Testdialog" description="Beschreibung">
      <button type="button">Erste Aktion</button>
      <button type="button">Letzte Aktion</button>
    </AccessibleDialog>
  );
  return onClose;
}

describe('AccessibleDialog', () => {
  it('exposes modal dialog semantics and labels', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Testdialog' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Beschreibung')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps tab focus inside the dialog', () => {
    renderDialog();
    const first = screen.getByRole('button', { name: 'Dialog schließen' });
    const last = screen.getByRole('button', { name: 'Letzte Aktion' });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
  });
});
