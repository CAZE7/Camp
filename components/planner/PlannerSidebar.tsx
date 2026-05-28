import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '../Sidebar';
import { usePlannerStore } from '../../store/usePlannerStore';

interface PlannerSidebarProps {
  onMobileAdd?: () => void;
}

export function PlannerSidebar({ onMobileAdd }: PlannerSidebarProps) {
  const { viewMode, isSidebarOpen, toggleSidebar } = usePlannerStore((state) => ({
    viewMode: state.viewMode,
    isSidebarOpen: state.isSidebarOpen,
    toggleSidebar: state.toggleSidebar,
  }));

  return (
    <>
      <div
        className={`transition-all duration-300 ease-in-out relative z-40 h-full flex-shrink-0 shadow-lg bg-card border-r border-border overflow-hidden ${
          isSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0'
        }`}
      >
        <div className="w-full h-full">
          <Sidebar mode={viewMode} onMobileAdd={onMobileAdd} />
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={toggleSidebar}
        className="absolute top-1/2 -translate-y-1/2 z-30 shadow-md transition-all duration-300 h-8 w-8 hidden md:flex items-center justify-center bg-white"
        style={{ left: isSidebarOpen ? '17.5rem' : '0.75rem' }}
        title={isSidebarOpen ? "Sidebar einklappen" : "Sidebar ausklappen"}
        aria-label={isSidebarOpen ? "Linke Sidebar einklappen" : "Linke Sidebar ausklappen"}
        aria-expanded={isSidebarOpen}
      >
        {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </Button>
    </>
  );
}
