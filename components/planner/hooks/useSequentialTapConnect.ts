import { useEffect } from 'react';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { Connection } from 'reactflow';

export function useSequentialTapConnect() {
  const onConnect = usePlannerStore((state) => state.onConnect);
  const isValidConnection = usePlannerStore((state) => state.isValidConnection);
  const setFirstTappedHandle = usePlannerStore((state) => state.setFirstTappedHandle);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      const handleEl = target.closest('.react-flow__handle');
      if (handleEl) {
        const nodeId = handleEl.getAttribute('data-nodeid');
        const handleId = handleEl.getAttribute('data-handleid');
        const handleType = handleEl.classList.contains('source') ? 'source' : 'target';

        if (nodeId && handleId) {
          setFirstTappedHandle((prev) => {
            if (!prev) {
               // First tap
               return { nodeId, handleId, handleType };
            } else {
               // Second tap
               if (prev.nodeId === nodeId && prev.handleId === handleId) {
                  return null; // Cancel if same handle tapped twice
               }

               // Attempt connection
               const connection: Connection = {
                 source: prev.handleType === 'source' ? prev.nodeId : nodeId,
                 target: prev.handleType === 'target' ? prev.nodeId : nodeId,
                 sourceHandle: prev.handleType === 'source' ? prev.handleId : handleId,
                 targetHandle: prev.handleType === 'target' ? prev.handleId : handleId,
               };

               if (isValidConnection(connection)) {
                 onConnect(connection);
               }

               return null; // Reset after attempt
            }
          });
        }
      } else {
        // Clicked somewhere else, reset tap connect
        setFirstTappedHandle(null);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [isValidConnection, onConnect, setFirstTappedHandle]);
}
