const fs = require('fs');

let content = fs.readFileSync('components/planner/ui/FloatingMetricsCard.tsx', 'utf8');

// Fix string interpolation escaping
content = content.replace(/\\\$\\{/g, '${');
content = content.replace(/\\`/g, '`');

fs.writeFileSync('components/planner/ui/FloatingMetricsCard.tsx', content, 'utf8');
