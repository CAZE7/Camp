let listenerCount = 0;
let pendingOpen = false;

/**
 * Dynamic import can leave a short gap between the toolbar action and the
 * modal's event listener. Remember one request until the lazy component mounts.
 */
export function requestBomModalOpen() {
  if (typeof window === 'undefined') return;
  if (listenerCount === 0) pendingOpen = true;
  window.dispatchEvent(new CustomEvent('show-bom-modal'));
}

export function subscribeToBomModalOpen(onOpen: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleOpen = () => onOpen();
  window.addEventListener('show-bom-modal', handleOpen);
  listenerCount += 1;

  if (pendingOpen) {
    pendingOpen = false;
    onOpen();
  }

  return () => {
    window.removeEventListener('show-bom-modal', handleOpen);
    listenerCount = Math.max(0, listenerCount - 1);
  };
}
