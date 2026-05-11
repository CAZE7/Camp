"use client";

import React from 'react';
import { Panel, Node } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RoofNodeData } from '@/components/nodes/types';

export function DachPanel({
  selectedNode,
  updateSelectedNodeWatts,
  updateSelectedNodeWidth,
  updateSelectedNodeHeight,
  totalRoofSolarWatts
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
    <Panel position="top-right" className="mt-4 mr-4 pointer-events-auto flex flex-col gap-4">
      {selectedNode && (isSolar || isWindow) && (
        <Card className="min-w-[260px] shadow-2xl border border-border bg-card/95 backdrop-blur-md rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span className="text-base">{isSolar ? "⚡" : "🚐"}</span>
              <span>{isSolar ? "Solarpanel anpassen" : "Dachfenster anpassen"}</span>
            </CardTitle>
            <CardDescription className="text-xs">Größe & Parameter konfigurieren</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSolar && (
              <div className="space-y-1.5">
                <Label htmlFor="watts-input" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Leistung (Wp)</Label>
                <div className="relative">
                  <Input
                    id="watts-input"
                    type="number"
                    value={selectedNode.data.watts || 0}
                    onChange={(e) => updateSelectedNodeWatts(Number(e.target.value))}
                    className="h-9 pr-8"
                    min={0}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">W</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="width-input" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Breite (cm)</Label>
                <div className="relative">
                  <Input
                    id="width-input"
                    type="number"
                    value={Math.round(selectedNode.data.width || (isSolar ? 100 : 40))}
                    onChange={(e) => updateSelectedNodeWidth(Number(e.target.value))}
                    className="h-9 pr-9"
                    min={10}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">cm</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="height-input" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Länge (cm)</Label>
                <div className="relative">
                  <Input
                    id="height-input"
                    type="number"
                    value={Math.round(selectedNode.data.height || (isSolar ? 60 : 40))}
                    onChange={(e) => updateSelectedNodeHeight(Number(e.target.value))}
                    className="h-9 pr-9"
                    min={10}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold">cm</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="min-w-[260px] shadow-2xl border-none bg-slate-900 text-white rounded-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        <CardHeader className="pb-2">
          <CardDescription className="text-blue-400 font-bold uppercase tracking-[0.2em] text-[10px]">System Check</CardDescription>
          <CardTitle className="flex items-center justify-between text-2xl font-black">
            <span>Solarleistung</span>
            <span className="text-orange-400">{totalRoofSolarWatts} W</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (totalRoofSolarWatts / 1000) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-white/50 mt-3 font-medium">
            Daten werden in Echtzeit mit dem Elektrik-Planer synchronisiert.
          </p>
        </CardContent>
      </Card>
    </Panel>
  );
}
