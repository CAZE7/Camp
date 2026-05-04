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
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-96 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">
          Stückliste (BOM)
        </h2>

        <div className="mb-4">
          <h3 className="font-semibold mb-2 text-gray-700">Komponenten:</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {Object.entries(bom.counts).map(([type, count]) => (
              <li key={type} className="capitalize">
                {count}x {type}
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2 text-gray-700">Kabelbedarf:</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {Object.entries(bom.cableLengths).map(([cs, length]) => (
              <li key={cs}>
                {length.toFixed(1)} Meter {cs} mm² Kabel
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded transition-colors"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
