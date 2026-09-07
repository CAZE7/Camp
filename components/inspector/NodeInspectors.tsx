import React from 'react';
import { type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../edges/CableEdge';
import { ValidatingInput, COMMON_RULES } from '../ui/ValidatingInput';
import { isStarterBatteryLabel } from '../../lib/vde-standards'; // AUTO-003: Rollen-Fallback
import {
  type NodeDataPatch,
  type PlannerFlowNode,
  type PlannerNodeType,
  type TypedNode,
} from '../nodes/types';

/**
 * Die Inspectors lesen/schreiben Node-Daten typisiert über die Registry
 * (`TypedNode<K>`, AGENTS.md M6-3): `node.data.capacity` ist eine Zahl oder
 * undefined, nicht `any`. Die Zuweisung des konkreten `type`-Literals passiert
 * zentral im `Inspector` (single boundary cast nach dem type-Switch).
 */
export type InspectorNode<K extends PlannerNodeType> = TypedNode<K>;
export type InspectorUpdate = (id: string, patch: NodeDataPatch) => void;

export interface BaseNodeInspectorProps {
  node: PlannerFlowNode;
  onUpdateNodeData?: InspectorUpdate;
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
    // Engstelle wie im Inspector-Switch: das `type`-Literal garantiert die
    // Datenform, erst danach ist `rating` eine Zahl statt `unknown`.
    const busbar = node as unknown as TypedNode<'busbar'>;
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
            value={busbar.data?.rating || 250}
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
}: {
  node: InspectorNode<'battery'>;
  onUpdateNodeData?: InspectorUpdate;
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
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          htmlFor={`${node.id}-chemistry`}
        >
          Zellchemie
        </label>
        <select
          id={`${node.id}-chemistry`}
          value={node.data?.chemistry || 'LiFePO4'}
          onChange={(e) => onUpdateNodeData?.(node.id, { chemistry: e.target.value })}
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="LiFePO4">LiFePO4</option>
          <option value="AGM">AGM</option>
          <option value="Gel">Gel</option>
        </select>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Verschiedene Blei-Varianten (AGM/Gel) dürfen nicht parallel geschaltet werden — ihre
          Ladeschlussspannungen unterscheiden sich (Gel ~14,1–14,4 V, AGM ~14,4–14,7 V).
        </p>
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          htmlFor={`${node.id}-role`}
        >
          Rolle im Verbund
        </label>
        <select
          id={`${node.id}-role`}
          value={node.data?.role || (isStarterBatteryLabel(node.data?.label) ? 'starter' : 'house')}
          onChange={(e) =>
            onUpdateNodeData?.(node.id, {
              role: e.target.value === 'starter' ? 'starter' : 'house',
            })
          }
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="house">Aufbaubatterie</option>
          <option value="starter">Starterbatterie</option>
        </select>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Explizite Angabe gewinnt über die Namens-Heuristik („Starter…") — umbenannte Batterien wechseln so
          nicht mehr still ihre Rolle.
        </p>
      </div>
    </>
  );
}

export function ConsumerInspector({
  node,
  onUpdateNodeData,
}: {
  node: InspectorNode<'consumer'>;
  onUpdateNodeData?: InspectorUpdate;
}) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </>
  );
}

export function ChargerInspector({
  node,
  onUpdateNodeData,
}: {
  node: InspectorNode<'charger' | 'mpptController' | 'dcdcCharger' | 'acBatteryCharger'>;
  onUpdateNodeData?: InspectorUpdate;
}) {
  return (
    <>
      {node.type === 'mpptController' && (
        <div className="flex flex-col">
          <label
            className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            htmlFor={`${node.id}-maxPvVoltage`}
          >
            Max. PV-Eingangsspannung (V)
          </label>
          {/* ELE-007: Basis der Kalt-Voc-Fensterprüfung — 0/leer = Prüfung aus. */}
          <ValidatingInput
            id={`${node.id}-maxPvVoltage`}
            type="number"
            min="0"
            step="0.1"
            isFloat={true}
            value={node.data?.maxPvVoltage || 0}
            rules={[COMMON_RULES.positive]}
            onValidChange={(val) => onUpdateNodeData?.(node.id, { maxPvVoltage: val })}
            className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Der Regler muss die Kalt-Leerlaufspannung des Strings verkraften — der Planer prüft Voc(−20 °C)
            gegen diesen Wert, sobald die Panels ihr Datenblatt-Voc tragen.
          </p>
        </div>
      )}
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </>
  );
}

export function FuseInspector({
  node,
  onUpdateNodeData,
}: {
  node: InspectorNode<'fuse'>;
  onUpdateNodeData?: InspectorUpdate;
}) {
  return (
    <div className="flex flex-col">
      <label
        className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
        className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

export function ShorePowerInspector({
  node,
  onUpdateNodeData,
}: {
  node: InspectorNode<'shorePower'>;
  onUpdateNodeData?: InspectorUpdate;
}) {
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
        <div className="warn-card warn-card-critical p-2 text-xs">
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
}: {
  node: InspectorNode<'inverter'>;
  onUpdateNodeData?: InspectorUpdate;
  nodes?: PlannerFlowNode[];
}) {
  const consumerNodes = React.useMemo(() => {
    return nodes?.filter((n) => n.type === 'consumer230v') || [];
  }, [nodes]);

  return (
    <>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {/* AUDIT AC-001: FI-Schutz am AC-Ausgangskreis pflegbar (30 mA Typ A),
          sonst war die neue Live-Regel „Inverter-Kreis ohne RCD“ nicht behebbar. */}
      <div className="mt-4 flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={node.data?.hasRcd || false}
            onChange={(e) => onUpdateNodeData?.(node.id, { hasRcd: e.target.checked })}
            className="rounded border-rule text-primary focus:ring-ring"
          />
          FI/LS (RCBO) im AC-Ausgang installiert
        </label>
        {!node.data?.hasRcd && (
          <div className="warn-card warn-card-critical p-2 text-xs">
            Speist der Wechselrichter 230-V-Geräte, muss der Ausgangskreis einen FI-Schutzschalter (max. 30
            mA, Typ A) haben — sonst droht Stromschlaggefahr auch ohne Landstrom.
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-col">
        {/* Gruppenüberschrift, kein Steuerelement-Label (a11y: label bräuchte ein Control) */}
        <span className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Gleichzeitige 230V Geräte
        </span>
        <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded border border-rule p-1">
          {consumerNodes.map((consumer) => {
            const isChecked = (node.data?.concurrentDevices || []).includes(consumer.id);
            return (
              <label
                key={consumer.id}
                className="flex cursor-pointer items-center gap-2 rounded p-1 text-sm text-foreground hover:bg-paper"
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
                <span className="flex-1 truncate">
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

export function Consumer230VInspector({
  node,
  onUpdateNodeData,
}: {
  node: InspectorNode<'consumer230v'>;
  onUpdateNodeData?: InspectorUpdate;
}) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </>
  );
}

export function SolarInspector({
  node,
  onUpdateNodeData,
}: {
  node: InspectorNode<'solar'>;
  onUpdateNodeData?: InspectorUpdate;
}) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {/* ELE-007: Datenblattwerte für Isc/Voc — ohne sie schätzt/kappt der Planer
          konservativ bzw. fordert den Wert für die Voc-Fensterprüfung an. */}
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          htmlFor={`${node.id}-isc`}
        >
          Kurzschlussstrom Isc (A)
        </label>
        <ValidatingInput
          id={`${node.id}-isc`}
          type="number"
          min="0"
          step="0.1"
          isFloat={true}
          value={node.data?.isc || 0}
          rules={[COMMON_RULES.positive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { isc: val })}
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Fehlt der Wert, schätzt der Planer Isc = 1,25 × Imp (konservativ) und sichert die Zuleitung nach der
          1,56 × Isc-Regel ab.
        </p>
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          htmlFor={`${node.id}-voc`}
        >
          Leerlaufspannung Voc, STC (V)
        </label>
        <ValidatingInput
          id={`${node.id}-voc`}
          type="number"
          min="0"
          step="0.1"
          isFloat={true}
          value={node.data?.voc || 0}
          rules={[COMMON_RULES.positive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { voc: val })}
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          htmlFor={`${node.id}-tempCoefficient`}
        >
          Temp.-Koeffizient Voc (%/K, negativ)
        </label>
        <ValidatingInput
          id={`${node.id}-tempCoefficient`}
          type="number"
          step="0.01"
          isFloat={true}
          value={node.data?.tempCoefficient ?? -0.35}
          rules={[COMMON_RULES.positive]}
          onValidChange={(val) => onUpdateNodeData?.(node.id, { tempCoefficient: -Math.abs(val) })}
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Typisch c-Si: −0,25 bis −0,35 %/K. Der Planer rechnet Voc kalt bei −20 °C hoch und prüft es gegen
          das Regler-Fenster (falls dort ein Maximalwert steht).
        </p>
      </div>
    </>
  );
}

export function RoofWindowInspector({
  node,
  onUpdateNodeData,
}: {
  node: InspectorNode<'roofWindow'>;
  onUpdateNodeData?: InspectorUpdate;
}) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </>
  );
}

export function RoofSolarInspector({
  node,
  onUpdateNodeData,
}: {
  node: InspectorNode<'roofSolar'>;
  onUpdateNodeData?: InspectorUpdate;
}) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
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
          className="rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </>
  );
}

export function ConduitInspector({
  node,
  onUpdateNodeData,
  edges,
}: {
  node: InspectorNode<'conduit'>;
  onUpdateNodeData?: InspectorUpdate;
  edges?: Edge[];
}) {
  return (
    <>
      <div className="flex flex-col">
        <label
          className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground"
          htmlFor="conduit-type-select"
        >
          Rohrtyp
        </label>
        <select
          id="conduit-type-select"
          value={node.data?.conduitType || 'EN 20'}
          onChange={(e) => onUpdateNodeData?.(node.id, { conduitType: e.target.value })}
          className="rounded border border-border bg-card px-3 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="EN 20">EN 20 (16.9 mm Innen-Ø)</option>
          <option value="EN 25">EN 25 (21.4 mm Innen-Ø)</option>
          <option value="EN 32">EN 32 (28.1 mm Innen-Ø)</option>
          <option value="EN 40">EN 40 (37.7 mm Innen-Ø)</option>
        </select>
      </div>

      <div className="mt-4 flex flex-col">
        {/* Gruppenüberschrift, kein Steuerelement-Label (a11y: label bräuchte ein Control) */}
        <span className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Zugewiesene Kabel
        </span>
        {edges && edges.length > 0 ? (
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded border border-rule p-2">
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
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-foreground hover:bg-paper"
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
                    <span className="flex-1 truncate">
                      Kabel ({length}m, {crossSection}mm²)
                    </span>
                  </label>
                );
              });
            })()}
          </div>
        ) : (
          <div className="rounded border border-rule bg-paper p-2 text-xs italic text-muted-foreground">
            Keine Kabel im Plan vorhanden.
          </div>
        )}
      </div>
    </>
  );
}
