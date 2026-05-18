const fs = require('fs');

let content = fs.readFileSync('components/edges/CableEdge.test.tsx', 'utf8');

// Fix colors
content = content.replace(
  "it('renders selected state with #9ca3af stroke', () => {\n    const { getByTestId } = render(<CableEdge {...defaultProps} selected={true} />);\n\n    const baseEdge = getByTestId('base-edge');\n    expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' });\n  });",
  "it('renders selected state with #9ca3af stroke', () => {\n    const { getByTestId } = render(<CableEdge {...defaultProps} selected={true} />);\n\n    const baseEdge = getByTestId('base-edge');\n    expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' });\n  });"
);

content = content.replace(
  "it('renders unselected state with #3b82f6 stroke', () => {\n    const { getByTestId } = render(<CableEdge {...defaultProps} selected={false} />);\n\n    const baseEdge = getByTestId('base-edge');\n    expect(baseEdge).toHaveStyle({ stroke: '#9ca3af' });\n  });",
  "it('renders unselected state with #3b82f6 stroke', () => {\n    const { getByTestId } = render(<CableEdge {...defaultProps} selected={false} />);\n\n    const baseEdge = getByTestId('base-edge');\n    expect(baseEdge).toHaveStyle({ stroke: '#3b82f6' });\n  });"
);

fs.writeFileSync('components/edges/CableEdge.test.tsx', content, 'utf8');
