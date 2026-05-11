"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { vehicleTemplates } from '@/lib/vehicleTemplates';

export function DachSidebar({
  selectedVehicleId,
  setSelectedVehicleId,
  onDragStart
}: {
  selectedVehicleId: string;
  setSelectedVehicleId: (val: string) => void;
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}) {
  return (
    <div className="w-80 bg-card border-r border-border p-6 flex flex-col gap-6 overflow-y-auto z-10 shrink-0">
      <div className="space-y-4">
        <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Fahrzeug Modell</Label>
        <Select value={selectedVehicleId} onValueChange={(val: string | null) => val && setSelectedVehicleId(val)}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Wähle dein Fahrzeug" />
          </SelectTrigger>
          <SelectContent>
            {vehicleTemplates.map(v => (
              <SelectItem key={v.id} value={v.id}>
                {v.brand} {v.version}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Komponenten</p>
        <div className="space-y-3">
          <Card
            className="cursor-grab hover:ring-2 hover:ring-blue-400 transition-all active:cursor-grabbing border-blue-100 bg-blue-50/20"
            onDragStart={(event) => onDragStart(event, 'roofSolar')}
            draggable
          >
            <CardContent className="flex items-center gap-4 py-3 px-4">
              <div className="w-10 h-10 bg-blue-500 text-white rounded-lg flex items-center justify-center text-xl shadow-sm">☀️</div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">Solarpanel</span>
                <span className="text-[10px] uppercase tracking-widest text-blue-600/70 font-bold">Basis: 100x60cm</span>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-grab hover:ring-2 hover:ring-amber-400 transition-all active:cursor-grabbing border-amber-100 bg-amber-50/20"
            onDragStart={(event) => onDragStart(event, 'roofWindow')}
            draggable
          >
            <CardContent className="flex items-center gap-4 py-3 px-4">
              <div className="w-10 h-10 bg-amber-500 text-white rounded-lg flex items-center justify-center text-xl shadow-sm">🪟</div>
              <div className="flex flex-col">
                <span className="font-bold text-sm">Dachfenster</span>
                <span className="text-[10px] uppercase tracking-widest text-amber-600/70 font-bold">Basis: 40x40cm</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-auto border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-tighter text-muted-foreground">Hinweis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Die <strong>Safe Zone</strong> berücksichtigt 15cm Front-Abstand und 5cm Seiten-Abstand. Elemente außerhalb werden rot markiert und nicht zur Leistung addiert.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
