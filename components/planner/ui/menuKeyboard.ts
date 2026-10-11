import type { KeyboardEvent } from 'react';

/** Keyboard navigation shared by the planner's popup menus. */
export function handleMenuKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onClose: (restoreFocus?: boolean) => void
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    onClose(true);
    return;
  }

  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
  );
  if (items.length === 0) return;

  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  let nextIndex: number;
  if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = items.length - 1;
  else if (event.key === 'ArrowDown') nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
  else if (event.key === 'ArrowUp')
    nextIndex = currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
  else return;

  event.preventDefault();
  items[nextIndex]?.focus();
}
