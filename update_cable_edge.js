const fs = require('fs');

let content = fs.readFileSync('components/edges/CableEdge.tsx', 'utf8');

// Add useState
content = content.replace("import React, { useMemo } from 'react';", "import React, { useMemo, useState } from 'react';");

// Add hover state
content = content.replace(
  "  const isProMode = useAppStore(state => state.isProMode);",
  "  const isProMode = useAppStore(state => state.isProMode);\n  const [isHovered, setIsHovered] = useState(false);"
);

// Update edge domain logic to detect Solar
content = content.replace(
  "    const edgeDomain = data?.edgeDomain || getEdgeDomain(sourceNode?.type, targetNode?.type, sourceHandle);",
  "    let edgeDomain = data?.edgeDomain || getEdgeDomain(sourceNode?.type, targetNode?.type, sourceHandle);\n    if (sourceNode?.type === 'solar' || targetNode?.type === 'solar' || sourceNode?.type === 'roofSolar' || targetNode?.type === 'roofSolar') {\n      edgeDomain = 'Solar' as any;\n    }"
);

// Update color mapping
content = content.replace(
  "  let stroke = selected ? '#f97316' : '#9ca3af';\n  if (edgeDomain !== 'AC_230V' && totalDropPercentage > 2) {\n    stroke = '#ef4444'; // strict red for > 2%\n  }",
  `  let stroke = selected ? '#9ca3af' : (edgeDomain === 'AC_230V' ? '#ef4444' : (edgeDomain === 'Solar' as any ? '#f59e0b' : '#3b82f6'));
  if (selected) {
    stroke = '#9ca3af';
  } else if (edgeDomain === 'AC_230V') {
    stroke = '#ef4444'; // Rot/Gelb gestreift theoretisch, aber wir nutzen Warn-Rot laut Spezifikation
  } else if (edgeDomain === 'Solar' as any) {
    stroke = '#f59e0b';
  } else {
    stroke = '#3b82f6';
  }

  if (edgeDomain !== 'AC_230V' && totalDropPercentage > 2) {
    stroke = '#ef4444'; // strict red for > 2%
  }`
);

// Add smart labeling wrap
content = content.replace(
  "          <span>{length.toFixed(2)} m</span>",
  "          { (selected || isHovered) && <span>{length.toFixed(2)} m</span> }"
);
content = content.replace(
  "          {edgeDomain === 'AC_230V' ? (",
  "          {(selected || isHovered) && edgeDomain === 'AC_230V' ? ("
);
content = content.replace(
  "          ) : (",
  "          ) : (selected || isHovered) ? ("
);
content = content.replace(
  "              {errors.map((err, idx) => (\n                <span key={idx} style={{ background: 'red', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', marginTop: '2px' }}>{err}</span>\n              ))}\n            </>\n          )}",
  "              {errors.map((err, idx) => (\n                <span key={idx} style={{ background: 'red', color: 'white', padding: '1px 4px', borderRadius: '4px', fontSize: '10px', marginTop: '2px' }}>{err}</span>\n              ))}\n            </>\n          ) : null}"
);


// Add onMouseEnter and onMouseLeave to the interaction path
content = content.replace(
  "        style={{ cursor: 'pointer' }}",
  "        style={{ cursor: 'pointer' }}\n        onMouseEnter={() => setIsHovered(true)}\n        onMouseLeave={() => setIsHovered(false)}"
);

fs.writeFileSync('components/edges/CableEdge.tsx', content, 'utf8');
