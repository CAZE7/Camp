"use client";

import React from 'react';
import { Panel, Node } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RoofNodeData } from '@/components/nodes/types';

export function DachPanel({
  selectedSolarNode,
  updateSelectedNodeWatts,
  totalRoofSolarWatts
}: {
  selectedSolarNode: Node<RoofNodeData> | undefined;
  updateSelectedNodeWatts: (watts: number) => void;
  totalRoofSolarWatts: number;
}) {
  return (
    <Panel position="top-right" className="mt-4 mr-4 pointer-events-auto flex flex-col gap-4">
      {selectedSolarNode && (
        <Card className="min-w-[240px] shadow-xl border border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Einstellungen</CardTitle>
            <CardDescription className="text-xs">Solarpanel anpassen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="watts-input" className="text-xs">Leistung (Wp)</Label>
              <Input
                id="watts-input"
                type="number"
                value={selectedSolarNode.data.watts || 0}
                onChange={(e) => updateSelectedNodeWatts(Number(e.target.value))}
                className="h-8"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="min-w-[240px] shadow-2xl border-none bg-slate-900 text-white">
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
