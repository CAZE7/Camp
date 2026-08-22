import { describe, it, expect } from 'vitest';
import { NODE_TYPES, EDGE_TYPES } from './constants';

describe('components/planner/constants', () => {
  it('exports NODE_TYPES with expected node types', () => {
    expect(NODE_TYPES).toBeDefined();
    expect(Object.keys(NODE_TYPES)).toContain('battery');
    expect(Object.keys(NODE_TYPES)).toContain('consumer');
    expect(Object.keys(NODE_TYPES)).toContain('fuse');
    expect(Object.keys(NODE_TYPES)).toContain('inverter');
    expect(Object.keys(NODE_TYPES)).toContain('solar');
  });

  it('exports EDGE_TYPES with expected edge types', () => {
    expect(EDGE_TYPES).toBeDefined();
    expect(Object.keys(EDGE_TYPES)).toContain('cableEdge');
  });

  it('exports keine Demo-Fixtures mehr (initialNodes/initialEdges entfernt)', () => {
    // Mission 4: Die Fixtures waren toter Code — der Plan startet leer bzw.
    // über Templates/Onboarding. Das Modul ist jetzt rein deklarativ.
    expect(Object.keys({ NODE_TYPES, EDGE_TYPES }).sort()).toEqual(['EDGE_TYPES', 'NODE_TYPES']);
  });
});
