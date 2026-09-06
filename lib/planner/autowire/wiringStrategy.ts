/**
 * lib/planner/autowire/wiringStrategy.ts
 *
 * Stufe 3 der AutoWire-Pipeline: Wiring Strategy.
 *
 * Entscheidet fachlich, WELCHE Verbindungen gebaut werden müssen
 * (Batterie→Shunt, Shunt→Sammelschiene, MPPT, Wechselrichter, Verbraucher…).
 *
 * Diese Stufe macht keine Dimensionierung (Sizing) und erzeugt keine Edge-
 * Objekte (Routing). Sie liefert nur eine geordnete Liste von Verbindungs-
 * Absichten — das ist der Kern der "Entkopplung".
 */

import { VDE_INVERTER_EFFICIENCY } from '../electrical';
import type { Analysis, ConnectionIntent, Topology } from './types';
import { consumerAmps, inverterWatts, readNumber } from './analyse';

/**
 * Baut die Liste der Verbindungs-Absichten aus Analyse + Topologie.
 *
 * Die Reihenfolge ist deterministisch (Batterie → Shunt → Busbar → Inverter →
 * Fuse-Box → Solarmodule/MPPT → Ladequellen → Ladegeräte → Verbraucher).
 */
export function planConnections(
  analysis: Analysis,
  topology: Topology
): ConnectionIntent[] {
  const intents: ConnectionIntent[] = [];

  const batteryCapacity = readNumber(analysis.battery.data?.capacity, 100);
  const maxDischargeA = batteryCapacity;

  // Versorgungs-Hauptpfad
  intents.push({ sourceId: analysis.battery.id, targetId: topology.shunt.id, currentA: maxDischargeA, length: 0.5 });
  intents.push({ sourceId: topology.shunt.id, targetId: topology.busbar.id, currentA: maxDischargeA, length: 0.5 });
  intents.push({ sourceId: topology.busbar.id, targetId: topology.fuseBox.id, currentA: readNumber(topology.fuseBox.data?.rating, 100), length: 1 });

  // Wechselrichter
  for (const inverter of analysis.inverters) {
    const inverterAmps = inverterWatts(inverter) / 12 / VDE_INVERTER_EFFICIENCY;
    intents.push({ sourceId: topology.busbar.id, targetId: inverter.id, currentA: inverterAmps, length: 1 });
  }

  // Solar → MPPT → Busbar
  if (topology.mppt) {
    for (const solar of analysis.solars) {
      const solarWatts = readNumber(solar.data?.watts, 100);
      intents.push({ sourceId: solar.id, targetId: topology.mppt.id, currentA: solarWatts / 12, length: 5 });
    }
    intents.push({ sourceId: topology.mppt.id, targetId: topology.busbar.id, currentA: readNumber(topology.mppt.data?.amps, 30), length: 2 });
  }

  // Ladequellen
  for (const booster of analysis.boosters) {
    intents.push({ sourceId: booster.id, targetId: topology.busbar.id, currentA: readNumber(booster.data?.amps, 30), length: 3 });
  }

  // "Echte" Ladegeräte
  for (const charger of analysis.plainChargers) {
    intents.push({ sourceId: charger.id, targetId: topology.busbar.id, currentA: readNumber(charger.data?.amps, 30), length: 3 });
  }

  // Verbraucher
  for (const consumer of analysis.consumers) {
    intents.push({ sourceId: topology.fuseBox.id, targetId: consumer.id, currentA: consumerAmps(consumer), length: 3 });
  }

  return intents;
}
