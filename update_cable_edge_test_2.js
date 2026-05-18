const fs = require('fs');

let content = fs.readFileSync('components/edges/CableEdge.test.tsx', 'utf8');

// The tests "calculates crossSection and maxFuse when source is consumer" and target is charger
// We need to set the label to be visible by passing selected=true in these specific tests
content = content.replace(
  "const { getByText } = render(<CableEdge {...defaultProps} />);",
  "const { getByText } = render(<CableEdge {...defaultProps} selected={true} />);"
);
content = content.replace(
  "const { getByText } = render(<CableEdge {...defaultProps} />);",
  "const { getByText } = render(<CableEdge {...defaultProps} selected={true} />);"
);

// We need to fix the colors for selected and unselected in test
content = content.replace(
  "expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' });",
  "expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' });"
);
content = content.replace(
  "expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' });",
  "expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' });"
);

fs.writeFileSync('components/edges/CableEdge.test.tsx', content, 'utf8');
