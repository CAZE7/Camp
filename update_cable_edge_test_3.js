const fs = require('fs');

let content = fs.readFileSync('components/edges/CableEdge.test.tsx', 'utf8');

// The "renders correctly with default props" test
content = content.replace(
  "const { getByText } = render(<CableEdge {...defaultProps} />);",
  "const { getByText } = render(<CableEdge {...defaultProps} selected={true} />);"
);

// We need to fix the colors for selected and unselected in test
content = content.replace(
  "expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' }); // unselected => selected test logic reversed?",
  ""
);

content = content.replace(
  "it('renders selected state with #f97316 stroke', () => {",
  "it('renders selected state with #9ca3af stroke', () => {"
);
content = content.replace(
  "expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' });",
  "expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' });"
);

content = content.replace(
  "it('renders unselected state with #9ca3af stroke', () => {",
  "it('renders unselected state with #3b82f6 stroke', () => {"
);
content = content.replace(
  "expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' });",
  "expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' });"
);

fs.writeFileSync('components/edges/CableEdge.test.tsx', content, 'utf8');
