import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from './Sidebar';

describe('Sidebar Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders electric components by default', () => {
      render(<Sidebar />);
      expect(screen.getByText('Batterie')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Strom verteilen/ }));
      expect(screen.getByText('Batteriemonitor (Shunt)')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Strom laden/ }));
      expect(screen.getByText('Solarmodul')).toBeInTheDocument();
      expect(screen.queryByText('Frischwassertank')).not.toBeInTheDocument();
    });

    it('renders water components when mode is water', () => {
      render(<Sidebar mode="water" />);
      expect(screen.getByText('Frischwassertank')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Fördern & filtern/ }));
      expect(screen.getByText('Wasserpumpe')).toBeInTheDocument();
      expect(screen.queryByText('Batterie')).not.toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('filters components based on search term', () => {
      render(<Sidebar />);
      const searchInput = screen.getByPlaceholderText('Suchen...');

      fireEvent.change(searchInput, { target: { value: 'Solar' } });

      expect(screen.getByText('Solarmodul')).toBeInTheDocument();
      expect(screen.queryByText('Batterie')).not.toBeInTheDocument();
    });

    it('shows empty state when no components match search', () => {
      render(<Sidebar />);
      const searchInput = screen.getByPlaceholderText('Suchen...');

      fireEvent.change(searchInput, { target: { value: 'XYZ123' } });

      expect(screen.getByText(/Keine Treffer für/)).toBeInTheDocument();
      // Using getAllByRole because both the clear search icon and the empty state button have the same aria-label/text
      const resetButtons = screen.getAllByRole('button', { name: 'Filter zurücksetzen' });
      expect(resetButtons.length).toBeGreaterThan(0);

      fireEvent.click(resetButtons[resetButtons.length - 1]!);
      expect((searchInput as HTMLInputElement).value).toBe('');
    });
  });

  describe('Drag and Drop', () => {
    it('handles pointer drag and drop over react-flow pane', () => {
      render(<Sidebar />);

      // Mock document.elementsFromPoint to simulate dropping over the canvas
      const mockElementsFromPoint = vi
        .fn()
        .mockReturnValue([{ classList: { contains: (cls: string) => cls === 'react-flow__pane' } }]);
      document.elementsFromPoint = mockElementsFromPoint as unknown as typeof document.elementsFromPoint;

      // Spy on window.dispatchEvent
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      const batteryItem = screen.getByText('Batterie');

      // Simulate pointer down to start drag
      fireEvent.pointerDown(batteryItem, { clientX: 10, clientY: 10 });

      // Simulate pointer move
      const pointerMoveEvent = new Event('pointermove');
      Object.assign(pointerMoveEvent, { clientX: 100, clientY: 100 });
      document.dispatchEvent(pointerMoveEvent);

      // Simulate pointer up to drop
      const pointerUpEvent = new Event('pointerup');
      Object.assign(pointerUpEvent, { clientX: 100, clientY: 100 });
      document.dispatchEvent(pointerUpEvent);

      expect(mockElementsFromPoint).toHaveBeenCalledWith(100, 100);

      expect(dispatchEventSpy).toHaveBeenCalled();
      const dispatchedEvent = dispatchEventSpy.mock.calls[0]![0] as CustomEvent;
      expect(dispatchedEvent.type).toBe('custom-node-drop');
      expect(dispatchedEvent.detail).toEqual({
        clientX: 100,
        clientY: 100,
        type: 'battery',
        label: 'Batterie',
      });
    });

    it('does not dispatch event if not dropped over react-flow pane', () => {
      render(<Sidebar />);

      // Mock document.elementsFromPoint to simulate dropping outside the canvas
      const mockElementsFromPoint = vi.fn().mockReturnValue([{ classList: { contains: () => false } }]);
      document.elementsFromPoint = mockElementsFromPoint as unknown as typeof document.elementsFromPoint;

      // Spy on window.dispatchEvent
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      const batteryItem = screen.getByText('Batterie');

      // Simulate pointer down to start drag
      fireEvent.pointerDown(batteryItem, { clientX: 10, clientY: 10 });

      // Simulate pointer up to drop
      const pointerUpEvent = new Event('pointerup');
      Object.assign(pointerUpEvent, { clientX: 100, clientY: 100 });
      document.dispatchEvent(pointerUpEvent);

      expect(dispatchEventSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'custom-node-drop' })
      );
    });
  });
});
