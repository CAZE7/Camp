import React from 'react';
import { Edge } from 'reactflow';
import { ValidatingInput, COMMON_RULES } from '../ui/ValidatingInput';
import { usePlannerStore } from '../../store/usePlannerStore';

export function WaterPipeInspector({
  edge,
  onChangeLength,
}: {
  edge: Edge;
  onChangeLength: (id: string, length: number) => void;
}) {
  const setWaterEdges = usePlannerStore((state) => state.setWaterEdges);
  const pipeType = edge.data?.pipeType === 'gray' ? 'gray' : 'fresh';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Wasserleitung</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Frischwasser ist durchgezogen, Abwasser gestrichelt dargestellt.
        </p>
      </div>
      <div>
        <label htmlFor={`${edge.id}-pipe-type`} className="mb-1 block text-sm font-medium text-foreground">
          Leitungsart
        </label>
        <select
          id={`${edge.id}-pipe-type`}
          value={pipeType}
          onChange={(event) =>
            setWaterEdges((items) =>
              items.map((item) =>
                item.id === edge.id ? { ...item, data: { ...item.data, pipeType: event.target.value } } : item
              )
            )
          }
          className="min-h-11 w-full rounded border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="fresh">Frischwasser</option>
          <option value="gray">Abwasser</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${edge.id}-pipe-length`} className="mb-1 block text-sm font-medium text-foreground">
          Länge in Metern
        </label>
        <ValidatingInput
          id={`${edge.id}-pipe-length`}
          type="number"
          min="0.1"
          step="0.1"
          isFloat
          value={edge.data?.length ?? 2}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(value) => onChangeLength(edge.id, value)}
          className="min-h-11 rounded border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <p className="rounded-lg bg-accent p-3 text-sm text-foreground">
        Rohrdurchmesser und Anschlussstücke hängen von Pumpe und Armaturen ab und müssen vor dem Einkauf
        geprüft werden.
      </p>
    </div>
  );
}
