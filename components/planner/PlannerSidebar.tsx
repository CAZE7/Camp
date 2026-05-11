import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from '../Sidebar';
import { usePlannerStore } from '../../store/usePlannerStore';

export function PlannerSidebar() {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const viewMode = usePlannerStore((state) => state.viewMode);

  return (
    <>
      <div
        className={`transition-all duration-300 ease-in-out absolute md:relative z-40 h-full ${isLeftSidebarOpen ? 'w-full md:w-64 translate-x-0' : 'w-0 -translate-x-full'} flex-shrink-0 shadow-lg bg-card border-r border-border max-w-[calc(100vw-2rem)]`}
      >
        <div className="w-full md:w-64 h-full max-w-full">
          <Sidebar mode={viewMode} />
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-30 shadow-md transition-all duration-300 h-8 w-8"
        style={{ left: isLeftSidebarOpen ? 'calc(16rem + 0.75rem)' : '0.75rem' }}
        title={isLeftSidebarOpen ? "Sidebar einklappen" : "Sidebar ausklappen"}
        aria-label={isLeftSidebarOpen ? "Linke Sidebar einklappen" : "Linke Sidebar ausklappen"}
      >
        {isLeftSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </Button>
    </>
  );
}
