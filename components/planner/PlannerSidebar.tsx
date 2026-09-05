import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '../Sidebar';
import { usePlannerStore } from '../../store/usePlannerStore';
import { useShallow } from 'zustand/react/shallow';

interface PlannerSidebarProps {
  onMobileAdd?: () => void;
}

/**
 * Linke Spalte: Bauteil-Katalog.
 *
 * Breiten sind fix und breakpoint-genau statt `w-auto`:
 *   Handy   : volle Breite (eigener Tab)
 *   Tablet  : 260 px, einklappbar auf 0
 *   Desktop : 280 px, einklappbar auf 0
 * Der Umschalter liegt außerhalb des Panels, damit er im eingeklappten
 * Zustand erreichbar bleibt; seine Position folgt der CSS-Variablen
 * `--planner-sidebar-w` (siehe globals.css), die dieselben Breakpoints kennt.
 */
export function PlannerSidebar({ onMobileAdd }: PlannerSidebarProps) {
  const { viewMode, isSidebarOpen, toggleSidebar } = usePlannerStore(
    useShallow((state) => ({
      viewMode: state.viewMode,
      isSidebarOpen: state.isSidebarOpen,
      toggleSidebar: state.toggleSidebar,
    }))
  );

  return (
    <>
      <div
        id="planner-sidebar-panel"
        className={`relative z-40 h-full flex-shrink-0 overflow-hidden border-r border-border bg-card shadow-lg transition-all duration-300 ease-in-out motion-reduce:transition-none ${
          isSidebarOpen
            ? 'w-full opacity-100 md:w-[260px] xl:w-[280px]'
            : 'w-full opacity-100 md:w-0 md:opacity-0'
        }`}
      >
        <div className="h-full w-full">
          <Sidebar mode={viewMode} onMobileAdd={onMobileAdd} />
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={toggleSidebar}
        className={`planner-sidebar-toggle absolute top-1/2 z-50 hidden h-11 w-11 -translate-y-1/2 items-center justify-center bg-card shadow-md transition-all duration-300 motion-reduce:transition-none md:flex ${
          isSidebarOpen ? 'planner-sidebar-toggle--open' : 'left-3'
        }`}
        title={isSidebarOpen ? 'Sidebar einklappen' : 'Sidebar ausklappen'}
        aria-label={isSidebarOpen ? 'Linke Sidebar einklappen' : 'Linke Sidebar ausklappen'}
        aria-expanded={isSidebarOpen}
        aria-controls="planner-sidebar-panel"
      >
        {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </Button>
    </>
  );
}
