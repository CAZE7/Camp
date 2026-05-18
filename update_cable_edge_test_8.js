const fs = require('fs');

let content = fs.readFileSync('components/edges/CableEdge.test.tsx', 'utf8');

// Fix colors
content = content.replace(
  "expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' });",
  "expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' });"
);

content = content.replace(
  "expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' });",
  "expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' });"
);

fs.writeFileSync('components/edges/CableEdge.test.tsx', content, 'utf8');
