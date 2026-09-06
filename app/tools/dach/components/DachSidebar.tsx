"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { vehicles } from "../data/vehicles";

interface DachSidebarProps {
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  onAddNode: (nodeType: string) => void;
}

export function DachSidebar({
  selectedVehicleId,
  setSelectedVehicleId,
  onAddNode,
}: DachSidebarProps) {
  const handleSelectChange = (value: string | null) => {
    if (value) {
      setSelectedVehicleId(value);
    }
  };

  return (
    <div className="w-full lg:w-80 bg-card border-r border-border p-6 flex flex-col gap-6 overflow-y-auto z-10 shrink-0 h-full">
      <div className="space-y-4">
        <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Fahrzeug Modell</Label>
        <Select value={selectedVehicleId} onValueChange={(val: string | null) => val && setSelectedVehicleId(val)}>
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
        <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Komponenten hinzufügen</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNode("Batterie")}
            className="text-xs"
          >
            🔋 Batterie
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNode("Solar")}
            className="text-xs"
          >
            ☀️ Solar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNode("Wechselrichter")}
            className="text-xs"
          >
            ⚡ Wechselrichter
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNode("Verbraucher")}
            className="text-xs"
          >
            💡 Verbraucher
          </Button>
        </div>
      </div>
    </div>
  );
}
