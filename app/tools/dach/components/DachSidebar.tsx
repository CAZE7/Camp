'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { vehicles } from '../data/vehicles';

interface DachSidebarProps {
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  onAddNode: (nodeType: string) => void;
}

export function DachSidebar({ selectedVehicleId, setSelectedVehicleId, onAddNode }: DachSidebarProps) {
  return (
    <div className="z-10 flex h-full w-full shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-card p-6 lg:w-80">
      <div className="space-y-4">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Fahrzeug Modell
        </Label>
        <Select
          value={selectedVehicleId}
          onValueChange={(val: string | null) => val && setSelectedVehicleId(val)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {vehicle.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Komponenten hinzufügen
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => onAddNode('Batterie')} className="text-xs">
            🔋 Batterie
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAddNode('Solar')} className="text-xs">
            ☀️ Solar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAddNode('Wechselrichter')} className="text-xs">
            ⚡ Wechselrichter
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAddNode('Verbraucher')} className="text-xs">
            💡 Verbraucher
          </Button>
        </div>
      </div>
    </div>
  );
}
