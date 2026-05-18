const fs = require('fs');
const file = 'components/nodes/InverterNode.tsx';

let content = fs.readFileSync(file, 'utf8');
if (!content.includes('import { usePlannerStore }')) {
  content = content.replace("import { Handle, Position } from 'reactflow';", "import { Handle, Position } from 'reactflow';\nimport { usePlannerStore } from '../../store/usePlannerStore';");
  fs.writeFileSync(file, content, 'utf8');
}
