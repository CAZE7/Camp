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
 *
 * Fehlen Struktur-Komponenten, weil der Nutzer sie entfernt hat, wird sauber
 * darum herum verdrahtet:
 *   - Ohne Shunt: Batterie direkt an die Versorgungsschiene.
 *   - Ohne Sammelschiene: Batterie dient als Einspeisepunkt.
 *   - Ohne Sicherungskasten: Verbraucher direkt an der Versorgungsschiene.
 */

import { VDE_INVERTER_EFFICIENCY } from '../electrical';
import type { Analysis, ConnectionIntent, Topology } from './types';
import { consumerAmps, inverterWatts, readNumber } from './analyse';

/** Versorgungs-Schiene: Sammelschiene oder (falls entfernt) die Batterie. */
function feedBusId(topology: Topology): string {
  return topology.busbar?.id ?? topology.battery.id;
}

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
  const feed = feedBusId(topology);
  const batteryId = analysis.battery.id;

  const batteryCapacity = readNumber(analysis.battery.data?.capacity, 100);
  const maxDischargeA = batteryCapacity;

  const push = (
    sourceId: string,
    targetId: string,
    currentA: number,
    length: number
  ): void => {
    if (sourceId === targetId) return;
    intents.push({ sourceId, targetId, currentA, length });
  };

  // Versorgungs-Hauptpfad. Shunt entfernt → Batterie direkt an die Schiene.
  if (topology.shunt) {
    push(batteryId, topology.shunt.id, maxDischargeA, 0.5);
    push(topology.shunt.id, feed, maxDischargeA, 0.5);
  } else if (feed !== batteryId) {
    push(batteryId, feed, maxDischargeA, 0.5);
  }

  // Sicherungskasten wird von der Versorgungsschiene gespeist.
  if (topology.fuseBox) {
    push(feed, topology.fuseBox.id, readNumber(topology.fuseBox.data?.rating, 100), 1);
  }

  // Wechselrichter
  for (const inverter of analysis.inverters) {
    const inverterAmps = inverterWatts(inverter) / 12 / VDE_INVERTER_EFFICIENCY;
    push(feed, inverter.id, inverterAmps, 1);
  }

  // Solar → MPPT → Busbar
  if (topology.mppt) {
    for (const solar of analysis.solars) {
      const solarWatts = readNumber(solar.data?.watts, 100);
      push(solar.id, topology.mppt.id, solarWatts / 12, 5);
    }
    push(topology.mppt.id, feed, readNumber(topology.mppt.data?.amps, 30), 2);
  }

  // Ladequellen
  for (const booster of analysis.boosters) {
    push(booster.id, feed, readNumber(booster.data?.amps, 30), 3);
  }

  // "Echte" Ladegeräte
  for (const charger of analysis.plainChargers) {
    push(charger.id, feed, readNumber(charger.data?.amps, 30), 3);
  }

  // Verbraucher: über den Sicherungskasten oder (falls entfernt) direkt an
  // der Versorgungsschiene.
  const consumerSource = topology.fuseBox?.id ?? feed;
  for (const consumer of analysis.consumers) {
    push(consumerSource, consumer.id, consumerAmps(consumer), 3);
  }

  return intents;
}
