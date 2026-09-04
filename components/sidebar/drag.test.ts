import { describe, expect, it } from 'vitest';
import { DESKTOP_CATALOG_DRAG_MIN_WIDTH, shouldStartCatalogDrag } from './drag';

describe('shouldStartCatalogDrag', () => {
  it('starts the ghost drag only for a mouse with sufficient canvas room', () => {
    expect(shouldStartCatalogDrag('mouse', DESKTOP_CATALOG_DRAG_MIN_WIDTH)).toBe(true);
    expect(shouldStartCatalogDrag('mouse', DESKTOP_CATALOG_DRAG_MIN_WIDTH - 1)).toBe(false);
  });

  it('keeps one-tap adding available for touch and pen on a landscape tablet', () => {
    expect(shouldStartCatalogDrag('touch', 1024)).toBe(false);
    expect(shouldStartCatalogDrag('pen', 1366)).toBe(false);
  });
});
