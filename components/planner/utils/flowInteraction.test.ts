import { describe, it, expect } from 'vitest';
import {
  getFlowInteractionProps,
  pointerModeFromCoarse,
  MOUSE_CONNECTION_RADIUS,
  TOUCH_CONNECTION_RADIUS,
  NODE_DRAG_HANDLE_SELECTOR,
  LONG_PRESS_MS,
} from './flowInteraction';

describe('getFlowInteractionProps (coarse pointer / Touch)', () => {
  const touch = getFlowInteractionProps('coarse');

  it('pans with one finger on empty canvas', () => {
    expect(touch.panOnDrag).toBe(true);
  });

  it('zooms with pinch but never with scroll', () => {
    expect(touch.zoomOnPinch).toBe(true);
    expect(touch.zoomOnScroll).toBe(false);
    expect(touch.panOnScroll).toBe(false);
  });

  it('keeps the page from scrolling behind the canvas', () => {
    expect(touch.preventScrolling).toBe(true);
  });

  it('uses a finger-sized connection radius', () => {
    expect(touch.connectionRadius).toBe(TOUCH_CONNECTION_RADIUS);
    expect(touch.connectionRadius).toBe(40);
  });

  it('requires a drag handle so node drag cannot collide with panning (A4)', () => {
    expect(touch.nodesDraggable).toBe(true);
    expect(touch.requiresDragHandle).toBe(true);
    expect(touch.nodeDragThreshold).toBeGreaterThan(0);
  });

  it('disables keyboard-only interactions that need a hardware keyboard', () => {
    expect(touch.deleteKeyCode).toBeNull();
    expect(touch.multiSelectionKeyCode).toBeNull();
    expect(touch.selectionKeyCode).toBeNull();
  });

  it('disables double-click zoom so it cannot swallow tap-to-connect', () => {
    expect(touch.zoomOnDoubleClick).toBe(false);
  });
});

describe('getFlowInteractionProps (fine pointer / Maus)', () => {
  const mouse = getFlowInteractionProps('fine');

  it('pans with left/middle drag and leaves the right button for the context menu', () => {
    expect(mouse.panOnDrag).toEqual([0, 1]);
    expect((mouse.panOnDrag as number[]).includes(2)).toBe(false);
  });

  it('zooms on scroll', () => {
    expect(mouse.zoomOnScroll).toBe(true);
    expect(mouse.panOnScroll).toBe(false);
  });

  it('uses the precise connection radius', () => {
    expect(mouse.connectionRadius).toBe(MOUSE_CONNECTION_RADIUS);
    expect(mouse.connectionRadius).toBe(20);
  });

  it('drags nodes anywhere — no handle needed', () => {
    expect(mouse.requiresDragHandle).toBe(false);
    expect(mouse.nodesDraggable).toBe(true);
  });

  it('offers shift-selection and multi-selection modifiers', () => {
    expect(mouse.selectionKeyCode).toBe('Shift');
    expect(mouse.multiSelectionKeyCode).toEqual(['Meta', 'Control']);
    expect(mouse.panActivationKeyCode).toBe('Space');
  });

  it('never deletes without the app-level confirmation dialog', () => {
    expect(mouse.deleteKeyCode).toBeNull();
  });
});

describe('constants', () => {
  it('maps matchMedia results to pointer modes', () => {
    expect(pointerModeFromCoarse(true)).toBe('coarse');
    expect(pointerModeFromCoarse(false)).toBe('fine');
  });

  it('exposes the drag-handle selector and long-press duration', () => {
    expect(NODE_DRAG_HANDLE_SELECTOR).toBe('.node-drag-handle');
    expect(LONG_PRESS_MS).toBe(200);
  });
});
