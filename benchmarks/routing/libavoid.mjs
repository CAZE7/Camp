// Research-only adapter: deliberately not imported by product code.
// LGPL library remains a dev dependency. No WASM is copied into public/.
import { AvoidLib } from 'libavoid-js';
let loaded = false;
export async function routeWithLibavoid(input) {
  if (!loaded) {
    await AvoidLib.load();
    loaded = true;
  }
  const A = AvoidLib.getInstance();
  const router = new A.Router(2); // Avoid::OrthogonalRouting (router.h); missing from JS beta exports
  const allocated = [];
  const own = (value) => {
    allocated.push(value);
    return value;
  };
  try {
    router.setRoutingParameter(A.RoutingParameter.shapeBufferDistance, input.clearance);
    router.setRoutingParameter(A.RoutingParameter.idealNudgingDistance, input.laneSpacing);
    router.setRoutingParameter(A.RoutingParameter.crossingPenalty, input.crossingCost);
    router.setRoutingParameter(A.RoutingParameter.segmentPenalty, input.bendCost);
    const shapes = new Map();
    for (const rect of input.obstacles) {
      const a = own(new A.Point(rect.x, rect.y));
      const b = own(new A.Point(rect.x + rect.width, rect.y + rect.height));
      const shape = new A.ShapeRef(router, own(new A.Rectangle(a, b)));
      shapes.set(rect.id, { shape, rect });
    }
    const directions = { top: 1, bottom: 2, left: 4, right: 8 };
    const pins = new Map();
    let nextPin = 1;
    const endpoint = (nodeId, port) => {
      const { shape, rect } = shapes.get(nodeId);
      const key = JSON.stringify([nodeId, port.x, port.y, port.position]);
      if (!pins.has(key)) {
        const id = nextPin++;
        const pin = new A.ShapeConnectionPin(
          shape,
          id,
          port.x - rect.x,
          port.y - rect.y,
          false,
          0,
          directions[port.position]
        );
        pin.setExclusive(false);
        pins.set(key, id);
      }
      return own(new A.ConnEnd(shape, pins.get(key)));
    };
    const connectors = input.edges.map((edge) => {
      const connector = new A.ConnRef(
        router,
        endpoint(edge.source, edge.from),
        endpoint(edge.target, edge.to)
      );
      // Pins constrain ports. Checkpoints alone are NOT an immutable-route guarantee.
      if (edge.lockedWaypoints) {
        const checkpoints = own(new A.CheckpointVector());
        for (const point of edge.lockedWaypoints.slice(1, -1))
          checkpoints.push_back(own(new A.Checkpoint(own(new A.Point(point.x, point.y)))));
        connector.setRoutingCheckpoints(checkpoints);
      }
      return [edge.id, connector];
    });
    router.processTransaction();
    return connectors.map(([id, connector]) => {
      const line = connector.displayRoute();
      const waypoints = Array.from({ length: line.size() }, (_, i) => {
        const point = line.at(i);
        const result = { x: point.x, y: point.y };
        point.delete();
        return result;
      });
      // displayRoute() is owned by the connector; do not delete its reference.
      return { id, waypoints };
    });
  } finally {
    router.delete(); // Router owns shapes, pins and connectors.
    for (const object of allocated.reverse()) object.delete();
  }
}
