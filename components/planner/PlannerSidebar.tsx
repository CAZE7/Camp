import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from '../Sidebar';
import { usePlannerStore } from '../../store/usePlannerStore';

export function PlannerSidebar() {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const viewMode = usePlannerStore((state) => state.viewMode);

  return (
    <>
      <div
        className={`transition-all duration-300 ease-in-out absolute md:relative z-40 h-full ${isLeftSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full'} flex-shrink-0 shadow-xl bg-white/80 backdrop-blur-md max-w-[calc(100vw-2rem)]`}
      >
        <div className="w-64 h-full max-w-full">
          <Sidebar mode={viewMode} />
        </div>
      </div>

      <button
        onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-30 bg-white text-gray-700 hover:bg-gray-100 p-2 rounded shadow-md transition-all duration-300 border border-gray-200"
        style={{ left: isLeftSidebarOpen ? 'calc(16rem + 1rem)' : '1rem' }}
        title={isLeftSidebarOpen ? "Sidebar einklappen" : "Sidebar ausklappen"}
        aria-label={isLeftSidebarOpen ? "Linke Sidebar einklappen" : "Linke Sidebar ausklappen"}
      >
        {isLeftSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>
    </>
  );
}
