## 2024-05-04 - Fix O(N*M) bottlenecks in array lookups
**Learning:** In a graph editor with `nodes` and `edges`, nested array searches like `Array.find` inside `Array.some` or `Array.includes` inside `Array.map` create O(N*M) and O(N*E) performance bottlenecks. This becomes increasingly noticeable as the user adds more components to the planner.
**Action:** Always pre-compute a `Map` of node properties (e.g., `nodeTypeMap`) and use `Set` for array inclusions (`assignedEdgesSet`) before iterating over graph edges.
