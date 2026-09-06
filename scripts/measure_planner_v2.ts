import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const lines = (file: string) => fs.readFileSync(file, 'utf8').split('\n').length;
const checks = [
  { name: 'CableEdge presentation boundary', ok: lines('components/edges/CableEdge.tsx') <= 180, value: `${lines('components/edges/CableEdge.tsx')} lines (limit 180)` },
  { name: 'routing facade boundary', ok: lines('lib/planner/routing.ts') <= 80, value: `${lines('lib/planner/routing.ts')} lines (limit 80)` },
  { name: 'pure planner boundary', ok: !fs.readFileSync('lib/planner/routing.ts', 'utf8').match(/from ['"]reactflow['"]|from ['"]@xyflow\/react['"]/), value: 'no React Flow import' },
  { name: 'routing rules extracted', ok: fs.existsSync('lib/planner/routingRules.ts') && fs.existsSync('lib/planner/edgeFactories.ts'), value: 'rules + factories present' },
];

for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.value}`);
console.log(`V2 exit score: ${checks.filter((check) => check.ok).length}/${checks.length}`);
if (checks.some((check) => !check.ok)) process.exitCode = 1;

// Keep the measurement reproducible in CI without depending on a reporter's
// output format. The full test command remains the functional gate.
try {
  const result = execFileSync('npm', ['test'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const summary = result.replace(/\u001b\[[0-9;]*m/g, '').match(/Tests\s+(\d+) passed/);
  if (summary) console.log(`Functional gate: ${summary[1]} tests passed`);
  else console.log('Functional gate: passed (test count unavailable)');
} catch {
  console.error('Functional gate: npm test failed');
  process.exitCode = 1;
}
