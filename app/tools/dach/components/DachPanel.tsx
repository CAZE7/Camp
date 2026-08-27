"use client";

import React from 'react';
import { Panel, Node } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RoofNodeData } from '@/components/nodes/types';
import { Sun, Home } from 'lucide-react';

export function DachPanel({
  selectedNode,
  updateSelectedNodeWatts,
  updateSelectedNodeWidth,
  updateSelectedNodeHeight,
  totalRoofSolarWatts,
}: {
  selectedNode: Node<RoofNodeData> | undefined;
  updateSelectedNodeWatts: (watts: number) => void;
  updateSelectedNodeWidth: (widthCm: number) => void;
  updateSelectedNodeHeight: (heightCm: number) => void;
  totalRoofSolarWatts: number;
}) {
  const isSolar = selectedNode?.type === 'roofSolar';
  const isWindow = selectedNode?.type === 'roofWindow';

  return (
    <Panel
      position="top-right"
      className="pointer-events-auto m-3 flex max-w-[calc(100vw-1.5rem)] flex-col gap-3"
    >
      {selectedNode && (isSolar || isWindow) && (
        <Card className="w-72 max-w-full rounded-none border border-rule bg-bone shadow-xl ring-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-ink">
              {isSolar ? (
                <Sun className="h-4 w-4 text-copper" aria-hidden="true" />
              ) : (
                <Home className="h-4 w-4 text-warn-info" aria-hidden="true" />
              )}
              {isSolar ? 'Solarpanel anpassen' : 'Dachfenster anpassen'}
            </CardTitle>
            <CardDescription className="text-xs text-ink-soft">
              Werte werden sofort übernommen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSolar && (
              <div className="space-y-1.5">
                <Label htmlFor="watts-input" className="text-xs font-semibold text-ink-soft">
                  Leistung (Wp)
                </Label>
                <div className="relative">
                  <Input
                    id="watts-input"
                    type="number"
                    value={selectedNode.data.watts ?? 0}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') return; // beim Editieren nicht auf 0 zwingen
                      updateSelectedNodeWatts(Number(raw));
                    }}
                    className="h-11 pr-8"
                    min={0}
                    aria-describedby="watts-unit"
                  />
                  <span
                    id="watts-unit"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-soft"
                  >
                    W
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="width-input" className="text-xs font-semibold text-ink-soft">
                  Breite (cm)
                </Label>
                <div className="relative">
                  <Input
                    id="width-input"
                    type="number"
                    value={Math.round(selectedNode.data.width || (isSolar ? 100 : 40))}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') return;
                      updateSelectedNodeWidth(Number(raw));
                    }}
                    className="h-11 pr-9"
                    min={10}
                    aria-describedby="width-unit"
                  />
                  <span
                    id="width-unit"
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 caption-xs font-semibold text-ink-soft"
                  >
                    cm
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="height-input" className="text-xs font-semibold text-ink-soft">
                  Länge (cm)
                </Label>
                <div className="relative">
                  <Input
                    id="height-input"
                    type="number"
                    value={Math.round(selectedNode.data.height || (isSolar ? 60 : 40))}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') return;
                      updateSelectedNodeHeight(Number(raw));
                    }}
                    className="h-11 pr-9"
                    min={10}
                    aria-describedby="height-unit"
                  />
                  <span
                    id="height-unit"
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 caption-xs font-semibold text-ink-soft"
                  >
                    cm
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="w-72 max-w-full rounded-none border border-rule bg-soot text-paper shadow-xl ring-0">
        <CardHeader className="pb-2">
          <CardDescription className="label-eyebrow text-paper/70">
            Live-Sync
          </CardDescription>
          <CardTitle className="flex items-center justify-between text-lg font-semibold text-paper">
            <span>Solarleistung</span>
            <span className="measure text-copper">{totalRoofSolarWatts} W</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="h-1.5 w-full overflow-hidden bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={1000}
            aria-valuenow={Math.min(1000, totalRoofSolarWatts)}
            aria-label="Solarleistung von 1000 W"
          >
            <div
              className="h-full bg-copper transition-[width] duration-300"
              style={{ width: `${Math.min(100, (totalRoofSolarWatts / 1000) * 100)}%` }}
            />
          </div>
          <p className="caption-xs mt-3 text-paper/70">
            Wird in Echtzeit an den Schaltplan übergeben.
          </p>
        </CardContent>
      </Card>
    </Panel>
  );
}
