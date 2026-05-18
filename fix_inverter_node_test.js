const fs = require('fs');

let content = fs.readFileSync('components/nodes/InverterNode.test.tsx', 'utf8');

// Mock usePlannerStore
if (!content.includes('vi.mock(\'../../store/usePlannerStore\'')) {
  content = content.replace("import React from 'react';", "import React from 'react';\nimport { vi } from 'vitest';\n\nvi.mock('../../store/usePlannerStore', () => ({\n  usePlannerStore: () => vi.fn()\n}));");
}

fs.writeFileSync('components/nodes/InverterNode.test.tsx', content, 'utf8');
