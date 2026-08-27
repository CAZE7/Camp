import React from 'react';
import { Node, Edge } from 'reactflow';
import { CableEdgeData } from '../edges/CableEdge';
import { ValidatingInput, COMMON_RULES } from '../ui/ValidatingInput';

export interface BaseNodeInspectorProps {
  node: Node;
  onUpdateNodeData?: (id: string, data: any) => void;
}

const COMPONENT_HELP: Record<string, string> = {
  shunt:
    'Der Batteriemonitor mit Shunt wird in die Minusleitung eingebaut und misst alle ein- und ausgehenden Ströme.',
  ground:
    'Der Massepunkt bündelt Minusverbindungen. Korrosionsschutz und fachgerechter Kabelquerschnitt sind wichtig.',
  freshWaterTank: 'Speichert sauberes Wasser und speist die Pumpe über den Ausgang.',
  grayWaterTank: 'Sammelt Abwasser von Spüle und Dusche.',
  pump: 'Fördert Frischwasser. Ein Vorfilter vor der Pumpe schützt sie vor Schmutz.',
  accumulator:
    'Das Druckausgleichsgefäß beruhigt den Wasserfluss und reduziert das häufige Ein- und Ausschalten der Pumpe.',
  preFilter: 'Der Vorfilter sitzt vor der Pumpe und muss für die Reinigung erreichbar bleiben.',
  sink: 'Die Spüle benötigt einen Frischwasser-Zulauf und einen getrennten Abwasser-Ablauf.',
  shower: 'Die Dusche benötigt einen Frischwasser-Zulauf und einen getrennten Abwasser-Ablauf.',
};

export function ComponentInfoInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  if (node.type === 'busbar') {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-accent p-3 text-sm text-foreground">
          Die Sammelschiene verteilt Plus oder Minus auf mehrere Leitungen. Ihr Nennstrom muss mindestens dem
          maximalen Gesamtstrom entsprechen.
        </p>
        <div>
          <label htmlFor={`${node.id}-rating`} className="mb-1 block text-sm font-medium text-foreground">
            Maximaler Strom in Ampere
          </label>
          <ValidatingInput
            id={`${node.id}-rating`}
            type="number"
            min="1"
            value={node.data?.rating || 250}
            rules={[COMMON_RULES.strictlyPositive]}
            onValidChange={(value) => onUpdateNodeData?.(node.id, { rating: value })}
            className="min-h-11 rounded border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    );
  }
  return (
    <p className="rounded-lg bg-accent p-3 text-sm leading-relaxed text-foreground">
      {COMPONENT_HELP[node.type || ''] || 'Für dieses Bauteil sind keine weiteren Werte erforderlich.'}
    </p>
  );
}

export function BatteryInspector({
  node,
  onUpdateNodeData,
  chargingTimeStr,
  calculatedSolarWatts,
}: BaseNodeInspectorProps & {
  chargingTimeStr?: string;
  calculatedSolarWatts?: number;
}) {
  return (
    <>
      <div className="flex flex-col">
        {(chargingTimeStr || calculatedSolarWatts !== undefined) && (
          <div className="warn-card warn-card-info mb-4 flex-col gap-2 p-3">
            <h4 className="label-eyebrow text-warn-info">Lade-Informationen</h4>
            <div className="flex flex-col gap-1 text-sm text-ink-soft">
              {chargingTimeStr && (
                <div className="flex justify-between">
                  <span>Ladezeit:</span>
                  <span className="font-semibold">{chargingTimeStr}</span>
                </div>
              )}
              {calculatedSolarWatts !== undefined && (
                <div className="flex justify-between">
                  <span>Ladeleistung (Dach):</span>
                  <span className="font-semibold">{calculatedSolarWatts} W</span>
                </div>
              )}
            </div>
          </div>
        )}
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-capacity`}
        >
          Kapazität (Ah)
        </label>
        <ValidatingInput
          id={`${node.id}-capacity`}
          type="number"
          min="0"
          value={node.data?.capacity || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { capacity: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-chemistry`}
        >
          Zellchemie
        </label>
        <select
          id={`${node.id}-chemistry`}
          value={node.data?.chemistry || 'LiFePO4'}
          onChange={(e) => onUpdateNodeData?.(node.id, { chemistry: e.target.value })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        >
          <option value="LiFePO4">LiFePO4</option>
          <option value="AGM">AGM</option>
        </select>
      </div>
    </>
  );
}

export function ConsumerInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-watts`}
        >
          Leistung (W)
        </label>
        <ValidatingInput
          id={`${node.id}-watts`}
          type="number"
          min="0"
          value={node.data?.watts || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { watts: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-hours`}
        >
          Nutzung (h/Tag)
        </label>
        <ValidatingInput
          id={`${node.id}-hours`}
          type="number"
          min="0"
          max="24"
          isFloat={true}
          value={node.data?.hours || 0}
          rules={[COMMON_RULES.hours]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { hours: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function ChargerInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-amps`}
        >
          Ladeleistung (A)
        </label>
        <ValidatingInput
          id={`${node.id}-amps`}
          type="number"
          min="0"
          value={node.data?.amps || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { amps: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-efficiency`}
        >
          Effizienz in %
        </label>
        <ValidatingInput
          id={`${node.id}-efficiency`}
          type="number"
          min="0"
          max="100"
          value={node.data?.efficiency ?? 100}
          rules={[COMMON_RULES.efficiency]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { efficiency: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function FuseInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <div className="flex flex-col">
      <label
        className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
        htmlFor={`${node.id}-rating`}
      >
        Sicherung (A)
      </label>
      <ValidatingInput
        id={`${node.id}-rating`}
        type="number"
        min="0"
        value={node.data?.rating || 0}
        rules={[COMMON_RULES.strictlyPositive]}
        onValidChange={(val) => onUpdateNodeData?.(node.id, { rating: val })}
        className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
      />
    </div>
  );
}

export function ShorePowerInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={node.data?.hasRcd || false}
          onChange={(e) => onUpdateNodeData?.(node.id, { hasRcd: e.target.checked })}
          className="rounded border-rule text-primary focus:ring-ring"
        />
        RCD (FI-Schalter) 30mA installiert
      </label>
      {!node.data?.hasRcd && (
        <div className="warn-card warn-card-critical text-xs p-2">
          Ein FI-Schutzschalter (max. 30mA) ist bei Landstromanschlüssen vorgeschrieben (DIN VDE 0100-721).
        </div>
      )}
    </div>
  );
}

export function InverterInspector({
  node,
  onUpdateNodeData,
  nodes,
}: BaseNodeInspectorProps & { nodes?: Node[] }) {
  const consumerNodes = React.useMemo(() => {
    return nodes?.filter((n) => n.type === 'consumer230v') || [];
  }, [nodes]);

  return (
    <>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-continuousPower`}
        >
          Dauerleistung (W)
        </label>
        <ValidatingInput
          id={`${node.id}-continuousPower`}
          type="number"
          min="0"
          value={node.data?.continuousPower || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { continuousPower: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col mt-4">
        <label className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
          Gleichzeitige 230V Geräte
        </label>
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto border border-rule rounded p-1">
          {consumerNodes.map((consumer) => {
            const isChecked = (node.data?.concurrentDevices || []).includes(consumer.id);
            return (
              <label
                key={consumer.id}
                className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-1 hover:bg-paper rounded"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const curr = node.data?.concurrentDevices || [];
                    const next = e.target.checked
                      ? [...curr, consumer.id]
                      : curr.filter((id: string) => id !== consumer.id);
                    onUpdateNodeData?.(node.id, { concurrentDevices: next });
                  }}
                  className="rounded border-rule text-primary focus:ring-ring"
                />
                <span className="truncate flex-1">
                  {consumer.data?.label || '230V Verbraucher'} ({consumer.data?.watts || 0}W)
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function Consumer230VInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-watts230`}
        >
          Leistung 230V (W)
        </label>
        <ValidatingInput
          id={`${node.id}-watts230`}
          type="number"
          min="0"
          value={node.data?.watts || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { watts: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-hours230`}
        >
          Nutzung (h/Tag)
        </label>
        <ValidatingInput
          id={`${node.id}-hours230`}
          type="number"
          min="0"
          max="24"
          isFloat={true}
          value={node.data?.hours || 0}
          rules={[COMMON_RULES.hours]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { hours: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function SolarInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-wattsSolar`}
        >
          Leistung (W)
        </label>
        <ValidatingInput
          id={`${node.id}-wattsSolar`}
          type="number"
          min="0"
          value={node.data?.watts || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { watts: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-voltage`}
        >
          Arbeitsspannung (V)
        </label>
        <ValidatingInput
          id={`${node.id}-voltage`}
          type="number"
          min="0"
          step="0.1"
          isFloat={true}
          value={node.data?.voltage || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { voltage: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-ampsSolar`}
        >
          Strom (A)
        </label>
        <ValidatingInput
          id={`${node.id}-ampsSolar`}
          type="number"
          min="0"
          step="0.1"
          isFloat={true}
          value={node.data?.amps || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { amps: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function RoofWindowInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-width`}
        >
          Breite (cm)
        </label>
        <ValidatingInput
          id={`${node.id}-width`}
          type="number"
          min="1"
          value={node.data?.width || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { width: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-height`}
        >
          Länge (cm)
        </label>
        <ValidatingInput
          id={`${node.id}-height`}
          type="number"
          min="1"
          value={node.data?.height || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { height: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function RoofSolarInspector({ node, onUpdateNodeData }: BaseNodeInspectorProps) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-width2`}
        >
          Breite (cm)
        </label>
        <ValidatingInput
          id={`${node.id}-width2`}
          type="number"
          min="1"
          value={node.data?.width || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { width: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-height2`}
        >
          Länge (cm)
        </label>
        <ValidatingInput
          id={`${node.id}-height2`}
          type="number"
          min="1"
          value={node.data?.height || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { height: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor={`${node.id}-wattsRoof`}
        >
          Leistung (Wp)
        </label>
        <ValidatingInput
          id={`${node.id}-wattsRoof`}
          type="number"
          min="0"
          value={node.data?.watts || 0}
          rules={[COMMON_RULES.strictlyPositive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { watts: val })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
        />
      </div>
    </>
  );
}

export function ConduitInspector({
  node,
  onUpdateNodeData,
  edges,
}: BaseNodeInspectorProps & { edges?: Edge[] }) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider"
          htmlFor="conduit-type-select"
        >
          Rohrtyp
        </label>
        <select
          id="conduit-type-select"
          value={node.data?.conduitType || 'EN 20'}
          onChange={(e) => onUpdateNodeData?.(node.id, { conduitType: e.target.value })}
          className="border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow bg-card"
        >
          <option value="EN 20">EN 20 (16.9 mm Innen-Ø)</option>
          <option value="EN 25">EN 25 (21.4 mm Innen-Ø)</option>
          <option value="EN 32">EN 32 (28.1 mm Innen-Ø)</option>
          <option value="EN 40">EN 40 (37.7 mm Innen-Ø)</option>
        </select>
      </div>

      <div className="flex flex-col mt-4">
        <label className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
          Zugewiesene Kabel
        </label>
        {edges && edges.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto p-2 border border-rule rounded">
            {(() => {
              const assignedEdges = node.data?.assignedEdges || [];
              const assignedEdgesSet = new Set(assignedEdges);
              return edges.map((edge) => {
                const isAssigned = assignedEdgesSet.has(edge.id);
                const edgeData = edge.data as CableEdgeData | undefined;
                const length = edgeData?.length || 3;
                const crossSection = edgeData?.crossSection || 2.5;

                return (
                  <label
                    key={edge.id}
                    className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-1 hover:bg-paper rounded"
                  >
                    <input
                      type="checkbox"
                      id={`edge-assign-${edge.id}`}
                      checked={isAssigned}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        let newAssignedEdges = [...assignedEdges];
                        if (checked) {
                          newAssignedEdges.push(edge.id);
                        } else {
                          newAssignedEdges = newAssignedEdges.filter((id: string) => id !== edge.id);
                        }
                        onUpdateNodeData?.(node.id, { assignedEdges: newAssignedEdges });
                      }}
                      className="rounded border-rule text-primary focus:ring-ring"
                    />
                    <span className="truncate flex-1">
                      Kabel ({length}m, {crossSection}mm²)
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic p-2 bg-paper rounded border border-rule">
            Keine Kabel im Plan vorhanden.
          </div>
        )}
      </div>
    </>
  );
}
