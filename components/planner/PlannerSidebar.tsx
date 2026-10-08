import React from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
        className={`relative z-40 h-full flex-shrink-0 overflow-hidden border-r border-border bg-surface-panel transition-[width] duration-150 ease-out motion-reduce:transition-none ${
          isSidebarOpen ? 'w-full md:w-[260px] xl:w-[248px]' : 'w-full md:w-0'
        }`}
      >
        <div className="h-full w-full">
          <Sidebar mode={viewMode} onMobileAdd={onMobileAdd} />
        </div>
      </div>

      <button
        type="button"
        onClick={toggleSidebar}
        className={`planner-sidebar-toggle cad-btn cad-btn--line absolute top-1 z-50 hidden h-7 w-4 items-center justify-center transition-[left] duration-150 motion-reduce:transition-none md:inline-flex ${
          isSidebarOpen ? 'planner-sidebar-toggle--open' : 'left-0.5'
        }`}
        title={isSidebarOpen ? 'Sidebar einklappen' : 'Sidebar ausklappen'}
        aria-label={isSidebarOpen ? 'Linke Sidebar einklappen' : 'Linke Sidebar ausklappen'}
        aria-expanded={isSidebarOpen}
      >
        {isSidebarOpen ? (
          <PanelLeftClose size={14} aria-hidden="true" />
        ) : (
          <PanelLeftOpen size={14} aria-hidden="true" />
        )}
      </button>
    </>
  );
}
