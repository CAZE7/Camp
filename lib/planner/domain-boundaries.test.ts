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
    'lib/planner/graph.ts',
    'lib/planner/handles.ts',
    'lib/planner/routing.ts',
    'lib/planner/layout.ts',
    'lib/planner/electrical.ts',
    'lib/planner/autoWire.ts',
    'lib/planner/cableAnalysis.ts',
    'lib/planner/bom.ts',
    'lib/planner/nodeFactory.ts',
    'lib/planner/initialGraph.ts',
    'lib/planner/solar.ts',
    'lib/vde-standards.ts',
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
