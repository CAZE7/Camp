import fs from 'fs';

const content = fs.readFileSync('components/planner/PlannerDashboard.tsx', 'utf8');

console.log(content.includes('export function PlannerDashboard() {'));
