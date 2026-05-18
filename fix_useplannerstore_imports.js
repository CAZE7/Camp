const fs = require('fs');
const path = require('path');

const nodesDir = 'components/nodes';
const files = fs.readdirSync(nodesDir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !f.startsWith('Water') && !f.startsWith('Conduit') && !f.startsWith('Roof'));

files.forEach(file => {
  const filePath = path.join(nodesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  let changed = false;

  if (content.includes('usePlannerStore') && !content.includes("import { usePlannerStore }")) {
    content = content.replace(
      "import { Handle, Position, useNodes } from 'reactflow';",
      "import { Handle, Position, useNodes } from 'reactflow';\nimport { usePlannerStore } from '../../store/usePlannerStore';"
    );
    // if still missing (because of different import)
    if (!content.includes("import { usePlannerStore }")) {
       content = content.replace(
          "import { Handle, Position } from 'reactflow';",
          "import { Handle, Position } from 'reactflow';\nimport { usePlannerStore } from '../../store/usePlannerStore';"
       );
    }
    changed = true;
  }

  if (content.includes('useState') && !content.includes("import React, { useState }")) {
      content = content.replace(
          "import React, { useMemo } from 'react';",
          "import React, { useMemo, useState } from 'react';"
      );
      if (!content.includes("useState")) {
         content = content.replace(
            "import React from 'react';",
            "import React, { useState } from 'react';"
         );
      }
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed imports in ${file}`);
  }
});
