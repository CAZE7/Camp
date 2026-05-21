import re

with open("components/inspector/NodeInspectors.tsx", "r") as f:
    content = f.read()

# 1. Add import for ValidatingNumberInput
if "ValidatingNumberInput" not in content:
    content = content.replace("import { CableEdgeData } from '../edges/CableEdge';", "import { CableEdgeData } from '../edges/CableEdge';\nimport { ValidatingNumberInput } from '../ui/ValidatingNumberInput';")

# 2. Replace <input type="number" ... /> patterns

# A regex to capture the entire <input ... /> element
# It looks for <input ... onChange={(e) => onUpdateNodeData?.(node.id, { KEY: Number(e.target.value) })} ... />
# Actually, since the inputs span multiple lines, let's just do targeted replacements.

# Let's replace `<input id=` with `<ValidatingNumberInput id=`
# Then replace `type="number"` with nothing (ValidatingNumberInput already has it, or we can keep it as props. Wait, ValidatingNumberInput passes ...props to input, so type="number" inside it is fine. It will overwrite or get overwritten? ValidatingNumberInput has type="number" hardcoded but ...props comes after. So we can remove type="number" from the usage.

# Let's just do search and replace for each field.

replacements = [
    (r'<input id={`\$\{node.id\}-capacity`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*value=\{node.data\?\.capacity \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ capacity: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-capacity`}\n          min="0"\n          required={true}\n          value={node.data?.capacity ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ capacity: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-watts`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*value=\{node.data\?\.watts \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ watts: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-watts`}\n          min="0"\n          required={true}\n          value={node.data?.watts ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ watts: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-hours`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*max="24"\s*\n\s*value=\{node.data\?\.hours \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ hours: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-hours`}\n          min="0"\n          max="24"\n          required={true}\n          value={node.data?.hours ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ hours: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-amps`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*value=\{node.data\?\.amps \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ amps: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-amps`}\n          min="0"\n          required={true}\n          value={node.data?.amps ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ amps: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-efficiency`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*max="100"\s*\n\s*value=\{node.data\?\.efficiency \?\? 100\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ efficiency: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-efficiency`}\n          min="0"\n          max="100"\n          required={true}\n          value={node.data?.efficiency ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ efficiency: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-rating`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*value=\{node.data\?\.rating \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ rating: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-rating`}\n        min="0"\n        required={true}\n        value={node.data?.rating ?? null}\n        onChange={(val) => onUpdateNodeData?.\1{ rating: val })}\n        className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n      />'),

    (r'<input id={`\$\{node.id\}-continuousPower`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*value=\{node.data\?\.continuousPower \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ continuousPower: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-continuousPower`}\n          min="0"\n          required={true}\n          value={node.data?.continuousPower ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ continuousPower: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-watts230`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*value=\{node.data\?\.watts \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ watts: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-watts230`}\n          min="0"\n          required={true}\n          value={node.data?.watts ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ watts: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-hours230`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*max="24"\s*\n\s*value=\{node.data\?\.hours \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ hours: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-hours230`}\n          min="0"\n          max="24"\n          required={true}\n          value={node.data?.hours ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ hours: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-voltage`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*step="0.1"\s*\n\s*value=\{node.data\?\.voltage \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ voltage: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-voltage`}\n          min="0"\n          step="0.1"\n          required={true}\n          value={node.data?.voltage ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ voltage: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-ampsSolar`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*step="0.1"\s*\n\s*value=\{node.data\?\.amps \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ amps: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-ampsSolar`}\n          min="0"\n          step="0.1"\n          required={true}\n          value={node.data?.amps ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ amps: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-width`}\s*\n\s*type="number"\s*\n\s*min="1"\s*\n\s*value=\{node.data\?\.width \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ width: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-width`}\n          min="1"\n          required={true}\n          value={node.data?.width ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ width: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-height`}\s*\n\s*type="number"\s*\n\s*min="1"\s*\n\s*value=\{node.data\?\.height \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ height: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-height`}\n          min="1"\n          required={true}\n          value={node.data?.height ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ height: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-width2`}\s*\n\s*type="number"\s*\n\s*min="1"\s*\n\s*value=\{node.data\?\.width \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ width: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-width2`}\n          min="1"\n          required={true}\n          value={node.data?.width ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ width: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-height2`}\s*\n\s*type="number"\s*\n\s*min="1"\s*\n\s*value=\{node.data\?\.height \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ height: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-height2`}\n          min="1"\n          required={true}\n          value={node.data?.height ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ height: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),

    (r'<input id={`\$\{node.id\}-wattsRoof`}\s*\n\s*type="number"\s*\n\s*min="0"\s*\n\s*value=\{node.data\?\.watts \|\| 0\}\s*\n\s*onChange=\{\(e\) => onUpdateNodeData\?\.([^)]+)\{ watts: Number\(e.target.value\) \}\)\}\s*\n\s*className="[^"]+"\s*\n\s*/>',
     r'<ValidatingNumberInput id={`${node.id}-wattsRoof`}\n          min="0"\n          required={true}\n          value={node.data?.watts ?? null}\n          onChange={(val) => onUpdateNodeData?.\1{ watts: val })}\n          className="border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"\n        />'),
]

for old, new_r in replacements:
    content, count = re.subn(old, new_r, content)
    print(f"Replaced {count} occurrences of {old[:40]}...")

with open("components/inspector/NodeInspectors.tsx", "w") as f:
    f.write(content)
