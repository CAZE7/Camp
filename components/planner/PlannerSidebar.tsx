import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '../Sidebar';
import { usePlannerStore } from '../../store/usePlannerStore';

interface PlannerSidebarProps {
  onMobileAdd?: () => void;
}

export function PlannerSidebar({ onMobileAdd }: PlannerSidebarProps) {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const viewMode = usePlannerStore((state) => state.viewMode);

  return (
    <>
      <div
        className={`transition-all duration-300 ease-in-out relative z-40 h-full min-w-0 ${isLeftSidebarOpen ? 'md:w-64' : 'w-0'} flex-shrink-0 shadow-lg bg-card border-r border-border overflow-hidden`}
      >
        <div className="w-full h-full">
          <Sidebar mode={viewMode} onMobileAdd={onMobileAdd} />
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-30 shadow-md transition-all duration-300 h-8 w-8 hidden md:flex items-center justify-center"
        style={{ left: isLeftSidebarOpen ? 'calc(16rem + 0.75rem)' : '0.75rem' }}
        title={isLeftSidebarOpen ? "Sidebar einklappen" : "Sidebar ausklappen"}
        aria-label={isLeftSidebarOpen ? "Linke Sidebar einklappen" : "Linke Sidebar ausklappen"}
      >
        {isLeftSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </Button>
    </>
  );
}
