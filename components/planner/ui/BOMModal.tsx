import React from 'react';

interface BOMModalProps {
  bom: {
    counts: Record<string, number>;
    cableLengths: Record<string, number>;
  };
  onClose: () => void;
}

export function BOMModal({ bom, onClose }: BOMModalProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[80vh] w-96 overflow-y-auto rounded-xl border border-border bg-panel p-6 shadow-xl">
        <h2 className="mb-4 border-b border-border pb-2 text-xl font-bold text-foreground">
          Stückliste (BOM)
        </h2>

        <div className="mb-4">
          <h3 className="mb-2 font-semibold text-muted-foreground">Komponenten:</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {Object.entries(bom.counts).map(([type, count]) => (
              <li key={type} className="capitalize">
                {count}x {type}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="mb-2 font-semibold text-muted-foreground">Kabelbedarf:</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {Object.entries(bom.cableLengths).map(([cs, length]) => (
              <li key={cs}>
                {length.toFixed(1)} Meter {cs} mm² Kabel
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-md bg-accentp px-4 py-2 font-semibold text-accentp-foreground transition-colors hover:bg-accentp/90"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
