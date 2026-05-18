const fs = require('fs');

let content = fs.readFileSync('components/planner/FlowCanvas.tsx', 'utf8');

// remove the old DashboardPanel logic
content = content.replace(
  /\{viewMode === 'electric' && \(\n\s*<Panel position="top-center".*?<\/Panel>\n\s*\)\}/s,
  ''
);

// import FloatingMetricsCard instead of using Panel
content = content.replace(
  "import { useAppStore } from '../../lib/store';",
  "import { useAppStore } from '../../lib/store';\nimport { FloatingMetricsCard } from './ui/FloatingMetricsCard';"
);

// add FloatingMetricsCard inside ReactFlow or outside? Let's add it right after ReactFlow or inside ReactFlow. It can be just a child of the container since it uses absolute positioning.
content = content.replace(
  "<ReactFlow",
  "<FloatingMetricsCard />\n      <ReactFlow"
);

fs.writeFileSync('components/planner/FlowCanvas.tsx', content, 'utf8');
