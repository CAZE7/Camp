import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const repositoryRoot = path.join(__dirname, '..', '..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf-8');
}

describe('planner domain boundaries', () => {
  const pureDomainModules = [
    'lib/planner/domain.ts',
    'lib/planner/domainModel.ts',
    'lib/planner/graph.ts',
    'lib/planner/handles.ts',
    'lib/planner/routing.ts',
    'lib/planner/layout.ts',
    'lib/planner/cableCurrent.ts',
    'lib/planner/autoWire.ts',
    'lib/planner/cableAnalysis.ts',
    'lib/planner/bom.ts',
    'lib/planner/nodeFactory.ts',
    'lib/planner/initialGraph.ts',
    'lib/planner/solar.ts',
    'lib/planner/geometry/geometryTokens.ts',
    'lib/planner/geometry/primitives.ts',
    'lib/planner/geometry/index.ts',
    'lib/planner/routingV2/collision.ts',
    'lib/planner/routingV2/laneRegistry.ts',
    'lib/planner/routingV2/costModel.ts',
    'lib/planner/routingV2/hopping.ts',
    'lib/planner/routingV2/elkAdapter.ts',
    'lib/planner/routingV2/orchestrator.ts',
    'lib/planner/routingV2/index.ts',
    'lib/planner/electrical/standards.ts',
    'lib/planner/electrical/ampacity.ts',
    'lib/planner/electrical/voltageDrop.ts',
    'lib/planner/electrical/fuseSizing.ts',
    'lib/planner/electrical/cableSizing.ts',
    'lib/planner/electrical/conduit.ts',
    'lib/planner/electrical/validation.ts',
    'lib/planner/electrical/index.ts',
    'lib/planner/autowire/types.ts',
    'lib/planner/autowire/analyse.ts',
    'lib/planner/autowire/topology.ts',
    'lib/planner/autowire/wiringStrategy.ts',
    'lib/planner/autowire/sizing.ts',
    'lib/planner/autowire/routing.ts',
    'lib/planner/autowire/index.ts',
    'lib/vde-standards.ts',
    'store/planner/types.ts',
    'store/planner/helpers.ts',
    'store/planner/baseSlice.ts',
    'store/planner/connectionSlice.ts',
    'store/planner/autoWireSlice.ts',
    'store/planner/layoutSlice.ts',
    'store/planner/bomSlice.ts',
    'store/planner/index.ts',
    'store/usePlannerStore.ts',
  ];

  it.each(pureDomainModules)('%s stays free of direct React Flow imports', (relativePath) => {
    expect(readSource(relativePath)).not.toMatch(/from ['"]reactflow['"]|import\(['"]reactflow['"]\)/);
  });

  it('keeps all direct React Flow helpers behind the adapter', () => {
    const adapter = readSource('lib/planner/reactFlowAdapter.ts');
    expect(adapter).toMatch(/from ['"]reactflow['"]/);
  });
});
