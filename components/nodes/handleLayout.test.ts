import { describe, it, expect } from 'vitest';
import {
  plusHandleStyle,
  minusHandleStyle,
  centerHandleStyle,
  HANDLE_PLUS_TOP,
  HANDLE_MINUS_TOP,
  HANDLE_CENTER_TOP,
} from './handleLayout';

describe('handleLayout', () => {
  it('places plus above minus', () => {
    expect(HANDLE_PLUS_TOP).toBe('30%');
    expect(HANDLE_MINUS_TOP).toBe('70%');
    expect(plusHandleStyle.top).toBe(HANDLE_PLUS_TOP);
    expect(minusHandleStyle.top).toBe(HANDLE_MINUS_TOP);
    expect(parseFloat(HANDLE_PLUS_TOP)).toBeLessThan(parseFloat(HANDLE_MINUS_TOP));
  });

  it('centers unpaired AC / water / ground handles', () => {
    expect(centerHandleStyle.top).toBe(HANDLE_CENTER_TOP);
  });
});
