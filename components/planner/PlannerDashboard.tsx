"use client";

import React, { useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  LayoutGrid,
  Image as ImageIcon,
  Sparkles,
  Wand2,
  CheckCircle2,
  Droplets,
  Zap,
  Menu,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { usePlannerStore } from '../../store/usePlannerStore';
import { useAppStore } from '../../lib/store';
import { toPng } from 'html-to-image';
import { useReactFlow } from 'reactflow';
import { ThemeToggle } from './ThemeToggle';

function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'sm',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className="inline-flex items-center gap-0.5 border border-border bg-node-muted p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1 rounded px-2.5 font-medium transition-colors ${
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm'
            } ${
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PlannerDashboard() {
  const { fitView } = useReactFlow();
  const viewMode = usePlannerStore((state) => state.viewMode);
  const setViewMode = usePlannerStore((state) => state.setViewMode);
  const season = usePlannerStore((state) => state.season);
  const setSeason = usePlannerStore((state) => state.setSeason);

  const exportBOM = usePlannerStore((state) => state.exportBOM);
  const autoWireSystem = usePlannerStore((state) => state.autoWireSystem);
  const checkSchematic = usePlannerStore((state) => state.checkSchematic);
  const onLayout = usePlannerStore((state) => state.onLayout);

  const { isProMode, toggleProMode } = useAppStore();

  const handleExportBOM = useCallback(() => {
    exportBOM();
    window.dispatchEvent(new CustomEvent('show-bom-modal'));
  }, [exportBOM]);

  const onExportImage = useCallback(() => {
    const reactFlowWrapper = document.querySelector('.react-flow') as HTMLElement;
    if (!reactFlowWrapper) return;

    toPng(reactFlowWrapper, {
      filter: (node) => {
        if (
          node?.classList?.contains('react-flow__panel') ||
          node?.classList?.contains('react-flow__controls') ||
          node?.classList?.contains('react-flow__minimap')
        ) {
          return false;
        }
        return true;
      },
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'schaltplan.png';
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => console.error('Failed to export image', err));
  }, []);

  const isWater = viewMode === 'water';

  return (
    <header className="relative z-40 flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border bg-toolbar px-2 py-1.5 text-sm">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-muted-foreground hover:bg-node-muted hover:text-foreground"
      >
        <ArrowLeft size={14} />
      </Link>

      {/* Title */}
      <div className="px-2">
        <h1 className="text-[13px] font-semibold text-foreground">{isWater ? 'Wasser & Sanitär' : 'Elektrik-Schaltplan'}</h1>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

      {/* View mode segmented */}
      <Segmented
        value={viewMode}
        onChange={setViewMode}
        options={[
          { value: 'electric', label: 'Elektrik', icon: <Zap size={13} /> },
          { value: 'water', label: 'Wasser', icon: <Droplets size={13} /> },
        ]}
      />

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 border-none text-xs font-medium text-muted-foreground shadow-none hover:bg-node-muted hover:text-foreground">
            <Menu size={14} />
            <span className="hidden md:inline">Aktionen</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-60 rounded-md border-border p-1">
          <DropdownMenuItem onClick={handleExportBOM} className="cursor-pointer gap-2 rounded py-1.5 text-[13px]">
            <Sparkles size={15} className="text-muted-foreground" /> Stückliste an KI senden
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => autoWireSystem(fitView)} className="cursor-pointer gap-2 rounded py-1.5 text-[13px]">
            <Wand2 size={15} className="text-muted-foreground" /> Automatisch Verkabeln
          </DropdownMenuItem>
          <DropdownMenuItem onClick={checkSchematic} className="cursor-pointer gap-2 rounded py-1.5 text-[13px]">
            <CheckCircle2 size={15} className="text-muted-foreground" /> Schaltplan prüfen lassen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLayout(fitView)} className="cursor-pointer gap-2 rounded py-1.5 text-[13px]">
            <LayoutGrid size={15} className="text-muted-foreground" /> Schaltplan aufräumen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportImage} className="cursor-pointer gap-2 rounded py-1.5 text-[13px]">
            <ImageIcon size={15} className="text-muted-foreground" /> Als Bild speichern
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Season segmented */}
      {!isWater && (
        <Segmented
          value={season}
          onChange={setSeason}
          options={[
            { value: 'summer', label: 'Sommer' },
            { value: 'winter', label: 'Winter' },
          ]}
        />
      )}

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant={isProMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleProMode}
          className="h-7 gap-1.5 text-xs font-medium"
        >
          <LayoutGrid size={14} />
          <span className="hidden md:inline">{isProMode ? 'Profi-Modus' : 'Standard'}</span>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
