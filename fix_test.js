const fs = require('fs');

let content = fs.readFileSync('components/planner/PlannerDashboard.test.tsx', 'utf8');

content = content.replace(
`  it('does not export image if react flow wrapper is not found', () => {
    // Ensure no wrapper exists
    const existing = document.querySelector('.react-flow');
    if (existing) document.body.removeChild(existing);

    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Als Bild speichern'));

    expect(toPng).not.toHaveBeenCalled();
  });`,
`  it('does not export image if react flow wrapper is not found', () => {
    // Ensure no wrapper exists
    const existingElements = document.querySelectorAll('.react-flow');
    existingElements.forEach(el => document.body.removeChild(el));

    vi.mocked(toPng).mockClear();

    render(<PlannerDashboard />);

    fireEvent.click(screen.getByTestId('menu-item-Als Bild speichern'));

    expect(toPng).not.toHaveBeenCalled();
  });`
);

fs.writeFileSync('components/planner/PlannerDashboard.test.tsx', content);
