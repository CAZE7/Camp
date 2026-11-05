'use client';

import React, { useId, useMemo } from 'react';
import { InspectorSection } from './InspectorSection';
// Typen direkt aus der Registry, nicht aus NodeInspectors: diese Sektion wird
// von BatteryInspector gerendert — ein Import zurück wäre ein Zyklus.
import { type NodeDataPatch, type PlannerFlowNode, type TypedNode } from '../nodes/types';
import { deriveBatteryBanks } from '../../lib/electricalGraph/batteryBank';
import { getSystemVoltage, isStarterBatteryLabel } from '../../lib/vde-standards';

/**
 * AUD-001 — DIE ERKLÄRUNG DER BATTERIEBANK IN DER OBERFLÄCHE.
 *
 * Befund des Product-Readiness-Audits: Das Domänenmodell
 * (`lib/electricalGraph/batteryBank.ts`) verlangt eine ERKLÄRTE Verschaltung,
 * sobald mehr als eine Aufbaubatterie im Plan liegt. AutoWire verweigert
 * sonst die Verdrahtung (`AUTO-BANK-001`) und verlangt `bankId`/`bankTopology`
 * — Felder, die es bis dahin in keiner Oberfläche gab. Der Normalfall
 * „zwei Aufbaubatterien" war über die UI damit nicht abschließbar; die einzige
 * Auflösung war das Editieren der Projektdatei.
 *
 * Diese Sektion schließt genau diese Lücke. Sie ERFINDET keine Verschaltung
 * und rät nicht: Sie schreibt dieselben Felder, die das Modell liest, und
 * zeigt die daraus abgeleiteten Kennwerte sofort an (Anzeige folgt der
 * Rechnung, nie umgekehrt — AGENTS.md §4).
 *
 * Fachliche Grenze (bewusst, nicht halb): `series` und `series-parallel`
 * werden hier NICHT zur Wahl angeboten. Der Planer hat kein verdrahtbares
 * Serienmodell — `lib/connectionRules.ts` sperrt Batterie×Batterie plus↔minus,
 * AutoWire verdrahtet nur `parallel`, und `getSystemVoltage`/`shortCircuit`
 * rechnen nicht mit einer Serien-Bankspannung. Ein 24-V-/48-V-System wird
 * deshalb als EINE Batterie mit passender `nominalVoltage` erfasst. Aus einer
 * Projektdatei importierte Serien-Deklarationen werden deshalb sichtbar als
 * „nicht unterstützt" ausgewiesen statt stillschweigend falsch gerechnet.
 */

/** Vom UI angebotene Verschaltungen — nur die, die der Planer durchträgt. */
const SELECTABLE_TOPOLOGIES = [
  { value: 'single', label: 'Einzeln — eigener Kreis, keine Bank' },
  { value: 'parallel', label: 'Parallel — gleiche Spannung, mehr Kapazität' },
] as const;

const isStarterNode = (node: PlannerFlowNode): boolean =>
  node.data?.role === 'starter' || (node.data?.role !== 'house' && isStarterBatteryLabel(node.data?.label));

const isHouseBattery = (node: PlannerFlowNode): boolean => node.type === 'battery' && !isStarterNode(node);

const labelOf = (node: PlannerFlowNode): string => {
  const label = typeof node.data?.label === 'string' ? node.data.label.trim() : '';
  return label !== '' ? label : node.id;
};

export function BatteryBankSection({
  node,
  nodes,
  onUpdateNodeData,
}: {
  node: TypedNode<'battery'>;
  nodes?: PlannerFlowNode[];
  onUpdateNodeData?: (id: string, patch: NodeDataPatch) => void;
}) {
  const bankIdListId = useId();
  const allNodes = useMemo(() => nodes ?? [node], [nodes, node]);
  const houseBatteries = useMemo(() => allNodes.filter(isHouseBattery), [allNodes]);

  // Dieselbe Ableitung wie AutoWire, Warn-Zentrale und Bericht — keine
  // zweite Rechnung in der Anzeige.
  const bankModel = useMemo(() => deriveBatteryBanks(allNodes, getSystemVoltage(allNodes)), [allNodes]);
  const ownBankId = bankModel.bankOfBattery.get(node.id);
  const ownBank = bankModel.banks.find((bank) => bank.id === ownBankId);

  // Bestehende ERKLÄRTE Aufbau-Bank-IDs als Vorschläge: Der Nutzer soll eine
  // vorhandene Bank treffen können, ohne sich einen Schlüssel auszudenken.
  const existingBankIds = useMemo(() => {
    const ids = new Set<string>();
    for (const candidate of allNodes) {
      if (!isHouseBattery(candidate)) continue;
      const declared = candidate.data?.bankId;
      if (typeof declared === 'string' && declared.trim() !== '') ids.add(declared.trim());
    }
    return [...ids].sort();
  }, [allNodes]);

  const topology = node.data?.bankTopology;
  const declaredBankId = typeof node.data?.bankId === 'string' ? node.data.bankId : '';
  const openQuestion = bankModel.questions.find((question) => question.batteryIds.includes(node.id));
  const importedSeries = topology === 'series' || topology === 'series-parallel';

  // Starterbatterien gehören nie zur Aufbaubank — die Sektion erklärt das,
  // statt Felder anzubieten, die das Modell später verwirft.
  if (isStarterNode(node)) {
    return (
      <InspectorSection title="Batteriebank">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Diese Batterie ist als Starterbatterie geführt und damit nicht Teil der Aufbaubank. Sie wird über
          den Ladebooster vom Aufbaukreis getrennt geladen.
        </p>
      </InspectorSection>
    );
  }

  const setTopology = (next: string) => {
    if (next === 'parallel') {
      // Parallel braucht eine gemeinsame Bank. Gibt es bereits eine erklärte
      // Aufbaubank, wird sie vorgeschlagen — sonst ein sprechender Standardname.
      const suggested = declaredBankId.trim() !== '' ? declaredBankId : (existingBankIds[0] ?? 'Aufbau');
      onUpdateNodeData?.(node.id, {
        bankTopology: 'parallel',
        bankId: suggested,
        bankSeries: undefined,
        bankParallel: undefined,
      });
      return;
    }
    if (next === 'single') {
      // Eine einzelne Batterie ist ihre eigene Bank. Eine geteilte bankId
      // würde sonst weiter eine Parallelbank behaupten.
      onUpdateNodeData?.(node.id, {
        bankTopology: 'single',
        bankId: undefined,
        bankSeries: undefined,
        bankParallel: undefined,
      });
      return;
    }
    // Zurück auf „nicht erklärt": keine stille Annahme, das Modell fragt wieder.
    onUpdateNodeData?.(node.id, {
      bankTopology: undefined,
      bankId: undefined,
      bankSeries: undefined,
      bankParallel: undefined,
    });
  };

  return (
    <InspectorSection title="Batteriebank" defaultOpen={houseBatteries.length > 1 || importedSeries}>
      <div className="flex flex-col gap-3">
        {houseBatteries.length > 1 && !importedSeries && (
          <p className="rounded-lg bg-accent p-3 text-xs leading-relaxed text-foreground">
            In diesem Plan liegen {houseBatteries.length} Aufbaubatterien. Der Planer rät ihre Verschaltung
            nicht — er verdrahtet nur, was hier erklärt ist. Ohne Erklärung bleibt eine weitere Batterie
            sichtbar unverbunden.
          </p>
        )}

        {importedSeries ? (
          <div
            className="warn-card warn-card-warning flex-col gap-2 p-3"
            data-testid="battery-bank-series-unsupported"
          >
            <p className="text-xs leading-relaxed text-foreground">
              Diese Batterie ist aus einer Projektdatei als{' '}
              {topology === 'series' ? 'Reihenschaltung' : 'Reihe-Parallel-Schaltung'} deklariert. Der Planer
              verdrahtet und bewertet eine Serienbank nicht — die Anzeige der Systemspannung und die
              Kurzschluss-Schätzung würden sonst von der Deklaration abweichen.
            </p>
            <p className="text-xs leading-relaxed text-foreground">
              Erfasse das System stattdessen als eine Batterie mit der Nennspannung des Gesamtsystems (z. B.
              24 V) und der Kapazität eines Strangs.
            </p>
            <button
              type="button"
              onClick={() => setTopology('')}
              className="min-h-11 self-start rounded border border-border px-3 text-sm font-medium text-foreground hover:bg-paper"
            >
              Deklaration zurücksetzen
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <label
              className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
              htmlFor={`${node.id}-bankTopology`}
            >
              Verschaltung
            </label>
            <select
              id={`${node.id}-bankTopology`}
              value={topology ?? ''}
              onChange={(event) => setTopology(event.target.value)}
              className="min-h-11 rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
            >
              <option value="">— noch nicht erklärt —</option>
              {SELECTABLE_TOPOLOGIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Parallel erhöht die Kapazität bei gleicher Spannung. Eine Reihenschaltung (z. B. zwei 12-V-Akkus
              auf 24 V) verdrahtet dieser Planer nicht: Erfasse dafür eine Batterie mit der Nennspannung des
              Gesamtsystems (24 V bzw. 48 V).
            </p>
          </div>
        )}

        {topology === 'parallel' && (
          <div className="flex flex-col">
            <label
              className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase"
              htmlFor={`${node.id}-bankId`}
            >
              Bank (gemeinsamer Name)
            </label>
            <input
              id={`${node.id}-bankId`}
              list={bankIdListId}
              type="text"
              value={declaredBankId}
              placeholder="z. B. Aufbau"
              onChange={(event) => onUpdateNodeData?.(node.id, { bankId: event.target.value })}
              className="min-h-11 rounded border border-border px-3 py-2 text-sm transition-shadow focus:border-transparent focus:ring-2 focus:ring-ring focus:outline-none"
            />
            <datalist id={bankIdListId}>
              {existingBankIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Alle Batterien derselben Bank tragen denselben Namen. Nur so weiß der Planer, welche Akkus
              zusammengehören.
            </p>
            {houseBatteries.filter((battery) => battery.id !== node.id).length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                {houseBatteries
                  .filter((battery) => battery.id !== node.id)
                  .map((battery) => {
                    const otherBank = bankModel.bankOfBattery.get(battery.id);
                    const joined = ownBankId !== undefined && otherBank === ownBankId;
                    return (
                      <li key={battery.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{labelOf(battery)}</span>
                        <span className={joined ? 'text-moss' : undefined}>
                          {joined ? 'in dieser Bank' : 'eigene Bank'}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        )}

        {/* Anzeige folgt der Rechnung: die Kennwerte kommen aus derselben
            Ableitung, die AutoWire und Bericht benutzen. */}
        {ownBank && (
          <div className="rounded-lg border border-rule p-3 text-xs" data-testid="battery-bank-summary">
            <p className="mb-1 font-medium text-foreground">
              Bank „{ownBank.id}“ · {ownBank.batteryIds.length}{' '}
              {ownBank.batteryIds.length === 1 ? 'Batterie' : 'Batterien'}
            </p>
            <dl className="flex flex-col gap-0.5 text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>Spannung</dt>
                <dd className="font-medium text-foreground">{ownBank.nominalVoltage} V</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Kapazität</dt>
                <dd className="font-medium text-foreground">{ownBank.capacityAh} Ah</dd>
              </div>
              {ownBank.maxDischargeCurrent !== undefined && (
                <div className="flex justify-between gap-2">
                  <dt>BMS Dauerentladung</dt>
                  <dd className="font-medium text-foreground">{ownBank.maxDischargeCurrent} A</dd>
                </div>
              )}
            </dl>
            {ownBank.topology === 'unassigned' && (
              <p className="mt-2 text-warn-warning">
                Noch nicht erklärt — die Bank zählt bis dahin wie ihre schwächste Einzelbatterie.
              </p>
            )}
          </div>
        )}

        {openQuestion && (
          <p className="text-xs leading-relaxed text-warn-warning" role="status">
            {openQuestion.question}
          </p>
        )}
      </div>
    </InspectorSection>
  );
}
