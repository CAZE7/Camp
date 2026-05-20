import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { usePlannerStore } from '../../store/usePlannerStore';

export function BOMModal() {
  const typeLabels: Record<string, string> = {
    battery: 'Batterie',
    consumer: '12V Verbraucher',
    charger: 'Ladegerät / Booster',
    fuse: 'Sicherung',
    shorePower: 'Landstrom',
    inverter: 'Wechselrichter',
    consumer230v: '230V Verbraucher',
    solar: 'Solarpanel (Planer)',
    roofWindow: 'Dachfenster',
    roofSolar: 'Dach-Solarpanel',
    conduit: 'Kabelkanal',
    busbar: 'Sammelschiene',
    shunt: 'Mess-Shunt',
    freshWaterTank: 'Frischwassertank',
    grayWaterTank: 'Abwassertank',
    pump: 'Wasserpumpe',
    accumulator: 'Druckausgleichsgefäß',
    preFilter: 'Vorfilter',
    sink: 'Spülbecken',
    shower: 'Dusche',
  };


  const [showBOM, setShowBOM] = useState(false);
  const [bomData, setBomData] = useState<{ counts: Record<string, number>, cableLengths: Record<string, number> } | null>(null);

  useEffect(() => {
    const handleShowBom = () => {
      // Re-calculate directly to match original local state flow
      const { nodes, edges } = (usePlannerStore as any).getState();
      const counts: Record<string, number> = {};
      for (let i = 0, len = nodes.length; i < len; i++) {
        const type = nodes[i].type;
        if (type) {
          counts[type] = (counts[type] || 0) + 1;
        }
      }

      const cableLengths: Record<string, number> = {};
      for (let i = 0, len = edges.length; i < len; i++) {
        const data = edges[i].data;
        const cs = data?.crossSection || 2.5;
        cableLengths[cs] = (cableLengths[cs] || 0) + (data?.length || 3);
      }
      setBomData({ counts, cableLengths });
      setShowBOM(true);
    };
    window.addEventListener('show-bom-modal', handleShowBom);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowBOM(false);
    };
    if (showBOM) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('show-bom-modal', handleShowBom);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showBOM]);

  const bomCountsEntries = useMemo(() => {
    return bomData?.counts ? Object.entries(bomData.counts) : [];
  }, [bomData?.counts]);

  const bomCableEntries = useMemo(() => {
    return bomData?.cableLengths ? Object.entries(bomData.cableLengths) : [];
  }, [bomData?.cableLengths]);

  if (!showBOM || !bomData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pointer-events-auto" onClick={() => setShowBOM(false)}>
      <div className="bg-card p-6 rounded-lg shadow-lg w-96 max-h-[80vh] overflow-y-auto border border-border" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 border-b border-border pb-2">Stückliste (BOM)</h2>

        <div className="mb-4">
          <h3 className="font-semibold mb-2 text-muted-foreground">Komponenten:</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {bomCountsEntries.map(([type, count]) => (
              <li key={type} className="capitalize">{count}x {typeLabels[type] || type}</li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2 text-muted-foreground">Kabelbedarf:</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {bomCableEntries.map(([cs, length]) => (
              <li key={cs}>{length.toFixed(1)} Meter {cs} mm² Kabel</li>
            ))}
          </ul>
        </div>

        <Button
          onClick={() => setShowBOM(false)}
          className="w-full"
        >
          Schließen
        </Button>
      </div>
    </div>
  );
}
