const fs = require('fs');
const path = require('path');

const nodesDir = 'components/nodes';
const files = fs.readdirSync(nodesDir).filter(f => f.endsWith('.tsx') && !f.endsWith('.test.tsx') && !f.startsWith('Water') && !f.startsWith('Conduit') && !f.startsWith('Roof'));

files.forEach(file => {
  const filePath = path.join(nodesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('updateNodeData')) {
    console.log(`Skipping ${file}, already has updateNodeData`);
    return;
  }

  // Ensure useState and usePlannerStore are imported
  if (!content.includes('useState')) {
    content = content.replace("import React from 'react';", "import React, { useState } from 'react';");
  }
  if (!content.includes('usePlannerStore')) {
    content = content.replace("import { Handle, Position } from 'reactflow';", "import { Handle, Position } from 'reactflow';\nimport { usePlannerStore } from '../../store/usePlannerStore';");
  }

  // Update component signature to inject hook and local state
  const compRegex = /(const [A-Za-z0-9]+Node = function\({ id, data, isConnectable, selected }: any\) {)/;
  const match = content.match(compRegex);

  if (match) {
    const hookInjection = `\n  const updateNodeData = usePlannerStore((state) => state.updateNodeData);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const handleDoubleClick = (field: string, currentValue: any) => {
    setEditingField(field);
    setTempValue(String(currentValue));
  };

  const handleBlur = () => {
    if (editingField) {
      let finalValue: any = tempValue;
      if (editingField !== 'label' && editingField !== 'chemistry') {
        finalValue = Number(tempValue) || 0;
      }
      updateNodeData(id, { [editingField]: finalValue });
    }
    setEditingField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };\n`;

    content = content.replace(match[0], match[0] + hookInjection);

    // Replace text elements with conditionally rendered inputs

    // Replace <div className="font-bold mb-2 text-sm text-center">{data.label || 'Verbraucher'}</div>
    // Note: the default label differs per file. We can regex match it.
    content = content.replace(
      /<div className="font-bold mb-2 text-sm text-center">\{data\.label \|\| '(.*?)'\}<\/div>/,
      `{editingField === 'label' ? (
        <input
          autoFocus
          className="font-bold mb-2 text-sm text-center w-full border border-blue-500 rounded px-1"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div className="font-bold mb-2 text-sm text-center cursor-text" onDoubleClick={() => handleDoubleClick('label', data.label || '$1')}>{data.label || '$1'}</div>
      )}`
    );

    // Replace properties like <div>Leistung: {data.watts || 0} W</div>
    const propRegex = /<div>(.*?):\s*\{data\.([a-zA-Z0-9]+)\s*\|\|\s*([0-9]+|'[^']+')\}\s*(.*?)<\/div>/g;
    content = content.replace(propRegex, (match, labelText, dataField, defaultVal, suffix) => {
      return `{editingField === '${dataField}' ? (
          <div className="flex items-center gap-1">
            <span>${labelText}:</span>
            <input
              autoFocus
              type="text"
              className="w-16 border border-blue-500 rounded px-1 text-xs"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
            <span>${suffix}</span>
          </div>
        ) : (
          <div className="cursor-text" onDoubleClick={() => handleDoubleClick('${dataField}', data.${dataField} || ${defaultVal})}>${labelText}: {data.${dataField} || ${defaultVal}} ${suffix}</div>
        )}`;
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
