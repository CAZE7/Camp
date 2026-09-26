import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia for GSAP and Radix UI in jsdom
/**
 * AUDIT T1: `vi.fn().mockImplementation(...)` gibt `any` zurück — der Stub
 * landete untypt an `window.matchMedia`. Mit benannter Factory bleibt der
 * Mock das, was er sein soll: eine MediaQueryList-Attrappe.
 */
const createMatchMediaStub = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(), // Deprecated
  removeListener: vi.fn(), // Deprecated
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(createMatchMediaStub),
});

// Mock ResizeObserver for Radix UI in jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock PointerEvent for Radix UI in jsdom
if (typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 0;
      this.pointerType = params.pointerType || '';
      this.isPrimary = params.isPrimary || false;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEvent;
}

// Mock HTMLElement.prototype.hasPointerCapture
if (typeof window.HTMLElement.prototype.hasPointerCapture === 'undefined') {
  window.HTMLElement.prototype.hasPointerCapture = function hasPointerCapture() {
    return false;
  };
}

// Mock next/font/google
vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'inter-mock', variable: '--inter-mock' }),
  Geist: () => ({ className: 'geist-mock', variable: '--geist-mock' }),
  Outfit: () => ({ className: 'outfit-mock', variable: '--outfit-mock' }),
}));
