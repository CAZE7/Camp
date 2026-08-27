'use client';

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import ReactFlow, { Background, Controls, ReactFlowProvider, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { vehicleTemplates } from '@/lib/vehicleTemplates';
import { useDachNodes } from './hooks/useDachNodes';
import { DachPanel } from './components/DachPanel';
import RoofBackgroundNode from '@/components/nodes/RoofBackgroundNode';
import RoofSolarNode from '@/components/nodes/RoofSolarNode';
import RoofWindowNode from '@/components/nodes/RoofWindowNode';
import { RoofNodeData } from '@/components/nodes/types';
import { SAFE_MARGINS } from './validation';
import { SiteHeader } from '@/components/brand/SiteHeader';
import { SiteFooter } from '@/components/brand/SiteFooter';
import { Plus, AlertTriangle, Sparkles, ArrowRight, Info, X as XIcon } from 'lucide-react';

// Outfit wird lokal über @fontsource-variable/outfit gebündelt.
const outfit = { className: 'font-outfit' };

const nodeTypes = {
  roofBackground: RoofBackgroundNode,
  roofSolar: RoofSolarNode,
  roofWindow: RoofWindowNode,
};

/** Berechnet einen laienverständlichen Text, wenn ein Node außerhalb der Safe
 *  Zone liegt. Rein anzeigend – die Regel-Logik in validation.ts bleibt
 *  unverändert. */
function describeOverrun(node: Node<RoofNodeData>, roofWidthCm: number, roofHeightCm: number): string | null {
  if (!node.data?.isInvalid) return null;
  if (node.type !== 'roofSolar' && node.type !== 'roofWindow') return null;

  const xCm = Math.round(node.position.x / 2);
  const yCm = Math.round(node.position.y / 2);
  const widthCm = Math.round(node.data.width ?? 0);
  const heightCm = Math.round(node.data.height ?? 0);

  const overruns: string[] = [];
  const overFront = SAFE_MARGINS.front - yCm;
  if (overFront > 0)
    overruns.push(`${overFront} cm über die vordere Kante (min. ${SAFE_MARGINS.front} cm Abstand)`);
  const overRear = yCm + heightCm - (roofHeightCm - SAFE_MARGINS.rear);
  if (overRear > 0) overruns.push(`${overRear} cm über die hintere Kante (min. ${SAFE_MARGINS.rear} cm)`);
  const overLeft = SAFE_MARGINS.left - xCm;
  if (overLeft > 0) overruns.push(`${overLeft} cm über die linke Kante (min. ${SAFE_MARGINS.left} cm)`);
  const overRight = xCm + widthCm - (roofWidthCm - SAFE_MARGINS.right);
  if (overRight > 0) overruns.push(`${overRight} cm über die rechte Kante (min. ${SAFE_MARGINS.right} cm)`);

  if (overruns.length === 0) return 'liegt außerhalb der Safe Zone';
  const label = node.data.label || (node.type === 'roofSolar' ? 'Solarpanel' : 'Dachfenster');
  return `${label} ragt ${overruns.join(', ')}.`;
}

function DachPlanerInner() {
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicleTemplates[0].id);
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  const selectedVehicle = useMemo(
    () => vehicleTemplates.find((v) => v.id === selectedVehicleId) || vehicleTemplates[0],
    [selectedVehicleId]
  );

  const {
    nodes,
    setNodes,
    onNodesChange,
    selectedNode,
    updateSelectedNodeWatts,
    updateSelectedNodeWidth,
    updateSelectedNodeHeight,
    totalRoofSolarWatts,
    onNodeResize,
  } = useDachNodes(selectedVehicle);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const roofWidthCm = selectedVehicle.roofWidth * 100;
  const roofHeightCm = selectedVehicle.roofLength * 100;

  const invalidNodes = useMemo(
    () => nodes.filter((n) => n.data?.isInvalid && (n.type === 'roofSolar' || n.type === 'roofWindow')),
    [nodes]
  );

  const overlappingNodes = useMemo(
    () => nodes.filter((n) => n.data?.isOverlapping && (n.type === 'roofSolar' || n.type === 'roofWindow')),
    [nodes]
  );

  const placementCount = useMemo(
    () => nodes.filter((n) => n.type === 'roofSolar' || n.type === 'roofWindow').length,
    [nodes]
  );

  // Onboarding schließt automatisch, sobald der Nutzer platziert hat.
  useEffect(() => {
    if (placementCount > 0) setOnboardingOpen(false);
  }, [placementCount]);

  const addNode = useCallback(
    (type: 'roofSolar' | 'roofWindow') => {
      const isSolar = type === 'roofSolar';
      const widthPx = isSolar ? 200 : 80;
      const heightPx = isSolar ? 120 : 80;
      // Freie Position innerhalb der Safe Zone finden — einfacher Offset pro
      // vorhandenem Node vermeidet Übereinanderplatzierung.
      const existing = nodes.filter((n) => n.type === type).length;
      const offset = existing * 20;
      const startX = SAFE_MARGINS.left * 2 + 10 + offset;
      const startY = SAFE_MARGINS.front * 2 + 10 + offset;

      const newNode: Node<RoofNodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position: { x: startX, y: startY },
        width: widthPx,
        height: heightPx,
        style: { width: widthPx, height: heightPx },
        data: {
          label: isSolar ? 'Solarpanel' : 'Dachfenster',
          watts: isSolar ? 200 : undefined,
          width: isSolar ? 100 : 40,
          height: isSolar ? 60 : 40,
          onNodeResize,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, onNodeResize, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = {
        x: Math.max(40, event.clientX - (bounds?.left || 0) - 40),
        y: Math.max(40, event.clientY - (bounds?.top || 0) - 40),
      };

      const isSolar = type === 'roofSolar';
      const widthPx = isSolar ? 200 : 80;
      const heightPx = isSolar ? 120 : 80;
      const newNode: Node<RoofNodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        width: widthPx,
        height: heightPx,
        style: { width: widthPx, height: heightPx },
        data: {
          label: isSolar ? 'Solarpanel' : 'Dachfenster',
          watts: isSolar ? 200 : undefined,
          width: isSolar ? 100 : 40,
          height: isSolar ? 60 : 40,
          onNodeResize,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [onNodeResize, setNodes]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        {/* Sub-Header mit Titel + Watt-KPI */}
        <div className="border-b border-rule bg-bone px-5 py-3">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center text-sm text-ink-soft hover:text-ink"
              >
                ← Zurück
              </Link>
              <span aria-hidden="true" className="h-6 w-px bg-rule" />
              <h1 className={cn('font-display text-xl font-semibold text-ink md:text-2xl', outfit.className)}>
                Dach-Planer
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="label-eyebrow text-ink-soft">Solarleistung gesamt</p>
                <p className="measure text-xl font-semibold text-ink">
                  {totalRoofSolarWatts} <span className="caption-xs font-semibold text-ink-soft">W</span>
                </p>
              </div>
              <Link
                href="/elektrik-planung"
                className="hidden sm:inline-flex min-h-11 items-center gap-2 border border-ink bg-ink px-4 text-sm font-semibold text-paper hover:bg-soot focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
              >
                Im Schaltplan öffnen
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        {/* Onboarding */}
        {onboardingOpen && placementCount === 0 && (
          <div className="border-b border-rule bg-warn-info-bg px-5 py-3">
            <div className="mx-auto flex max-w-6xl items-start justify-between gap-3">
              <div className="flex items-start gap-3 text-sm text-warn-info">
                <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">So planst du dein Dach in 3 Schritten:</p>
                  <ol className="mt-1 list-decimal pl-5">
                    <li>Fahrzeug links auswählen.</li>
                    <li>
                      Solarpanel oder Dachfenster hinzufügen (Button „+ Aufs Dach") oder auf die Fläche
                      ziehen.
                    </li>
                    <li>
                      Position, Größe und Watt rechts anpassen — Gesamt-Watt wandert automatisch in den
                      Schaltplan.
                    </li>
                  </ol>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOnboardingOpen(false)}
                className="flex h-11 w-11 items-center justify-center text-warn-info hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warn-info"
                aria-label="Anleitung schließen"
              >
                <XIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col lg:flex-row min-h-0">
          {/* Sidebar */}
          <aside className="w-full shrink-0 border-b border-rule bg-bone p-5 lg:w-72 lg:border-b-0 lg:border-r overflow-y-auto">
            <div className="space-y-3">
              <Label className="label-eyebrow text-ink-soft">Fahrzeug Modell</Label>
              <Select value={selectedVehicleId} onValueChange={(val) => val && setSelectedVehicleId(val)}>
                <SelectTrigger className="h-12 border-rule bg-bone text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-rule">
                  {vehicleTemplates.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} {vehicle.model} {vehicle.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="caption-xs text-ink-soft">
                Nutzbare Dachfläche:{' '}
                <strong className="text-ink">
                  {roofWidthCm} × {roofHeightCm} cm
                </strong>
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <Label className="label-eyebrow text-ink-soft">Komponenten</Label>

              {/* Solarpanel-Karte: Drag + Tap-to-place-Button */}
              <div
                className="cursor-grab border border-rule bg-paper p-3 text-sm font-medium text-ink transition-colors hover:border-copper"
                draggable
                onDragStart={(e) => onDragStart(e, 'roofSolar')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div>Solarpanel</div>
                    <div className="caption-xs measure text-copper">200 W · 100 × 60 cm</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addNode('roofSolar')}
                    aria-label="Solarpanel aufs Dach setzen"
                    className="min-h-11 gap-1 border-copper text-copper hover:bg-paper"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Aufs Dach
                  </Button>
                </div>
                <p className="caption-xs mt-2 text-ink-soft">
                  Ziehen oder tippen — auf Mobilgeräten nur der Button.
                </p>
              </div>

              {/* Dachfenster-Karte */}
              <div
                className="cursor-grab border border-rule bg-paper p-3 text-sm font-medium text-ink transition-colors hover:border-warn-info"
                draggable
                onDragStart={(e) => onDragStart(e, 'roofWindow')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div>Dachfenster</div>
                    <div className="caption-xs measure text-warn-info">40 × 40 cm</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addNode('roofWindow')}
                    aria-label="Dachfenster aufs Dach setzen"
                    className="min-h-11 gap-1 border-warn-info text-warn-info hover:bg-paper"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Aufs Dach
                  </Button>
                </div>
              </div>
            </div>

            {/* Validierungsliste */}
            {invalidNodes.length > 0 && (
              <div className="mt-6 space-y-2">
                <Label className="label-eyebrow text-warn-critical">Hinweise</Label>
                <ul className="space-y-2" role="alert">
                  {invalidNodes.map((n) => {
                    const text = describeOverrun(n, roofWidthCm, roofHeightCm);
                    if (!text) return null;
                    return (
                      <li key={n.id} className="warn-card warn-card-critical text-sm">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>{text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Überlappungswarnung */}
            {overlappingNodes.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label className="label-eyebrow text-warn-warning">Überlappung</Label>
                <ul className="space-y-2" role="alert">
                  {overlappingNodes.map((n) => (
                    <li key={n.id} className="warn-card warn-card-warning text-sm">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>
                        {n.data.label || (n.type === 'roofSolar' ? 'Solarpanel' : 'Dachfenster')} überlappt
                        sich mit einem anderen Element. Verschiebe es, damit keine Abschattung oder Kollision
                        entsteht.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Empfehlungshinweis */}
            {placementCount > 0 && invalidNodes.length === 0 && overlappingNodes.length === 0 && (
              <div className="warn-card warn-card-ok mt-6 text-sm">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Alle Elemente liegen sicher und ohne Überlappung in der Safe Zone.</span>
              </div>
            )}

            {/* Mobile CTA */}
            <Link
              href="/elektrik-planung"
              className="mt-6 flex min-h-12 items-center justify-center gap-2 border border-ink bg-ink px-4 text-sm font-semibold text-paper sm:hidden"
            >
              Im Schaltplan öffnen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>

          {/* Canvas */}
          <div
            className="react-flow-wrapper relative flex-1 min-h-[60vh]"
            ref={reactFlowWrapper}
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            <ReactFlow
              nodes={nodes}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              fitView
              minZoom={0.2}
              maxZoom={2}
            >
              <Background />
              <Controls />
              <DachPanel
                selectedNode={selectedNode}
                updateSelectedNodeWatts={updateSelectedNodeWatts}
                updateSelectedNodeWidth={updateSelectedNodeWidth}
                updateSelectedNodeHeight={updateSelectedNodeHeight}
                totalRoofSolarWatts={totalRoofSolarWatts}
              />
            </ReactFlow>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function DachPlanerPage() {
  return (
    <ReactFlowProvider>
      <DachPlanerInner />
    </ReactFlowProvider>
  );
}
