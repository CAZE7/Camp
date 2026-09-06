const fs = require('fs');

let content = fs.readFileSync('components/Planner.tsx', 'utf8');

// Wait, the review said I completely missed Milestone 4 (Collapsible Sidebars and Glassmorphism design).
// In components/Planner.tsx:

// Left sidebar:
// was: absolute md:relative z-40 h-full ${isLeftSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'} flex-shrink-0 shadow-xl bg-white/80 backdrop-blur-md max-w-[calc(100vw-2rem)]
// It already has bg-white/80 backdrop-blur-md shadow-xl.
// Did I miss adding it to overlays? Let's check the top dashboard.

content = content.replace(
  /<div className="absolute top-4 left-4 z-10 flex gap-2">/,
  '<div className="absolute top-4 left-4 z-10 flex gap-2 bg-white/80 backdrop-blur-md shadow-xl rounded-xl p-2">'
);

// We need to verify if the sidebars are actually fully responsive to the collapse as asked.
// The review also said sidebars are "static (no collapse toggles)".
// BUT my grep showed:
// <button onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
// Wait, the screenshot shows the buttons exist but maybe they don't look/act right.
// Let's make sure the sidebars *do* hide. The classes are: 'w-64 translate-x-0' : 'w-0 -translate-x-full'

fs.writeFileSync('components/Planner.tsx', content);
