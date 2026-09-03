import { useEffect } from 'react';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { type Connection } from 'reactflow';

export function useSequentialTapConnect(onFeedback?: (message: string, timeout?: number) => void) {
  const onConnect = usePlannerStore((state) => state.onConnect);
  const isValidConnection = usePlannerStore((state) => state.isValidConnection);
  const setFirstTappedHandle = usePlannerStore((state) => state.setFirstTappedHandle);

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const handleElement = target.closest<HTMLElement>('.react-flow__handle');
      if (handleElement) {
        const nodeId = handleElement.getAttribute('data-nodeid');
        const handleId = handleElement.getAttribute('data-handleid');
        const handleType = handleElement.classList.contains('source') ? 'source' : 'target';
        if (!nodeId || !handleId) return;

        setFirstTappedHandle((previous) => {
          if (!previous) {
            onFeedback?.('Erster Anschluss gewählt. Wähle jetzt den zweiten Anschluss.', 0);
            return { nodeId, handleId, handleType };
          }
          if (previous.nodeId === nodeId && previous.handleId === handleId) {
            onFeedback?.('Verbindung abgebrochen.', 1800);
            return null;
          }

          const connection: Connection = {
            source: previous.handleType === 'source' ? previous.nodeId : nodeId,
            target: previous.handleType === 'target' ? previous.nodeId : nodeId,
            sourceHandle: previous.handleType === 'source' ? previous.handleId : handleId,
            targetHandle: previous.handleType === 'target' ? previous.handleId : handleId,
          };

          if (isValidConnection(connection)) {
            onConnect(connection);
            onFeedback?.('Verbindung erstellt.', 2200);
          } else {
            onFeedback?.(
              'Diese Verbindung ist nicht möglich. Prüfe Spannung, Polung und Richtung; möglicherweise besteht die Verbindung bereits.',
              4000
            );
          }
          return null;
        });
      } else if (!target.closest('button, input, select, textarea, [role="dialog"]')) {
        setFirstTappedHandle(null);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [isValidConnection, onConnect, onFeedback, setFirstTappedHandle]);
}
