import { useCallback, useEffect } from 'react';
import { XYPosition } from 'reactflow';
import { usePlannerStore } from '../../../store/usePlannerStore';

export function usePlannerDragDrop(screenToFlowPosition: (pos: { x: number, y: number }) => XYPosition) {
  const onDropFromStore = usePlannerStore((state) => state.onDrop);
  const onCustomDropFromStore = usePlannerStore((state) => state.onCustomDrop);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      onDropFromStore(event, screenToFlowPosition);
    },
    [onDropFromStore, screenToFlowPosition]
  );

  useEffect(() => {
    const handleCustomDrop = (event: Event) => {
      onCustomDropFromStore(event, screenToFlowPosition);
    };
    window.addEventListener('custom-node-drop', handleCustomDrop);
    return () => window.removeEventListener('custom-node-drop', handleCustomDrop);
  }, [onCustomDropFromStore, screenToFlowPosition]);

  return { onDragOver, onDrop };
}
