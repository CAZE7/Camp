1. **Goal**: Optimize the O(N) lookup and `filter` in `CableEdge.tsx` which causes O(N*E) complexity on rerenders.
2. **Current state**: In `CableEdge.tsx`, inside a `useMemo` that runs per edge, it calls:
   ```ts
   const sourceNode = nodes.find(n => n.id === source);
   const targetNode = nodes.find(n => n.id === target);
   ...
   const allConsumers = nodes.filter(n => n.type === 'consumer');
   ```
   This is extremely inefficient because `getNodes()` returns all nodes, and the edge iterates over it multiple times.
3. **Approach**:
   - We need to memoize the mapping of `id -> Node` and `consumers` array at a higher level or cache it locally inside the component block such that it doesn't recalculate multiple times per render.
   - Wait, `CableEdge` is a component, so it renders separately for each edge. We cannot just share a local `useMemo` easily across all edge instances unless we put it in a context or global state.
   - We *can* use a module-level cached Map to optimize the lookups! As I see in `store/usePlannerStore.ts`, there is already a `cachedNodeMap` pattern:
     ```ts
     let cachedNodesRef: Node[] | null = null;
     let cachedNodeMap = new Map<string, Node>();
     ```
   - Let's apply a similar module-level cache in `CableEdge.tsx`:
     ```ts
     let lastNodesRef: any[] | null = null;
     let cachedNodeMap = new Map<string, any>();
     let cachedConsumers: any[] = [];
     ```
     When `CableEdge` renders, it gets `nodes` from `getNodes()`.
     If `nodes !== lastNodesRef`, we rebuild `cachedNodeMap` and `cachedConsumers`. Because React Flow's `getNodes()` returns a stable array reference until nodes change, this module-level cache will rebuild EXACTLY ONCE per nodes change, and then all edges will just do O(1) Map lookups and use the cached consumers array.
4. **Execution Plan**:
   - Add a module-level cache to `CableEdge.tsx` for nodes map and consumers array.
   - Replace `nodes.find` with `cachedNodeMap.get`.
   - Replace `nodes.filter` with `cachedConsumers`.
   - Update `useMemo` dependencies so it doesn't break React rules. Actually, `getNodes` might return the same array reference, but `getNodes` is just a function. The `nodes` array itself should be part of the dependencies, but wait, `useMemo` doesn't depend on `nodes` currently, it depends on `getNodes` (which is stable). Wait, if `useMemo` depends on `getNodes` only, it does not re-run when nodes change unless something else triggers a re-render. `useReactFlow()` does not trigger re-render on nodes change by default in custom edges. React Flow recommends using `useStore` to get specific node data if it needs to trigger re-renders.
   - Wait, the current `useMemo` dependency array is `[getNodes, data?.length, data?.crossSection, source, target]`. It does NOT re-run when nodes change! It only calculates this on mount or when `data` changes. If that's the case, we just optimize the calculation that happens.
   - Even better, let's keep the existing behaviour (not adding nodes to dep array if it wasn't there before) and just add the module-level cache to speed up the calculation when it *does* run.
