/**
 * scripts/dev/bereche-vorlagen.ts — Rechenwege der drei Vorlagen.
 *
 * Auslegungsskript: Nimmt die Annahmen der drei Vorlagen (Verbrauch,
 * Autarkietage, Solarertrag, Leitungslängen) und rechnet sie mit DENSELBEN
 * Modellen durch, die auch die Rechner im Auftritt benutzen
 * (`lib/batterySizing.ts`, `lib/solarSizing.ts`, `lib/electrical.ts`).
 * Die Zahlen der Vorlagenseiten stammen damit nicht aus dem Kopf, sondern
 * aus dem Modell.
 *
 * Aufruf: npx tsx scripts/dev/bereche-vorlagen.ts
 */

import { sizeBattery } from '../../lib/batterySizing';
import {
  calculateCrossSection,
  calculateMaxFuse,
  designAmpacity,
  selectFuseSize,
} from '../../lib/electrical';
import { sizeSolarArray } from '../../lib/solarSizing';

const fmt = (value: number, digits = 1): string => value.toFixed(digits).replace('.', ',');

type Verbraucher = { geraet: string; watt: number; stunden: number; laengeM: number };

type Vorlage = {
  label: string;
  systemspannung: number;
  tage: number;
  verbraucher: Verbraucher[];
  /** Zusätzliche 12-V-Leistung, die über einen Wechselrichter läuft (W). */
  wechselrichterWatt?: number;
  wechselrichterLaengeM?: number;
  panelWatt: number;
};

const VORLAGEN: Vorlage[] = [
  {
    label: 'Wochenend-Camper (12 V, 2 Tage)',
    systemspannung: 12,
    tage: 2,
    verbraucher: [
      { geraet: 'Kompressor-Kühlbox', watt: 45, stunden: 10, laengeM: 3 },
      { geraet: 'Standheizung (Diesel)', watt: 35, stunden: 8, laengeM: 3 },
      { geraet: 'Wasserpumpe', watt: 60, stunden: 0.4, laengeM: 5 },
      { geraet: 'LED-Beleuchtung', watt: 12, stunden: 5, laengeM: 4 },
      { geraet: 'Laptop über 12-V-Netzteil', watt: 65, stunden: 4, laengeM: 2 },
    ],
    panelWatt: 100,
  },
  {
    label: 'Autark-Camper (12 V, 3 Tage)',
    systemspannung: 12,
    tage: 3,
    verbraucher: [
      { geraet: 'Kompressor-Kühlbox', watt: 45, stunden: 10, laengeM: 3 },
      { geraet: 'Standheizung (Diesel)', watt: 35, stunden: 8, laengeM: 3 },
      { geraet: 'Wasserpumpe', watt: 60, stunden: 0.4, laengeM: 5 },
      { geraet: 'LED-Beleuchtung', watt: 12, stunden: 5, laengeM: 4 },
      { geraet: 'Laptop über 12-V-Netzteil', watt: 65, stunden: 4, laengeM: 2 },
      { geraet: 'Kaffeemaschine (230 V, über Wechselrichter)', watt: 800, stunden: 0.5, laengeM: 1.5 },
    ],
    wechselrichterWatt: 1200,
    wechselrichterLaengeM: 1.5,
    panelWatt: 100,
  },
  {
    label: 'Großraum-Camper (24 V, 2 Tage)',
    systemspannung: 24,
    tage: 2,
    verbraucher: [
      { geraet: 'Kompressor-Kühlbox', watt: 45, stunden: 10, laengeM: 3 },
      { geraet: 'Tiefkühlgerät', watt: 60, stunden: 8, laengeM: 3 },
      { geraet: 'Wasserpumpe', watt: 60, stunden: 0.4, laengeM: 5 },
      { geraet: 'LED-Beleuchtung', watt: 24, stunden: 6, laengeM: 4 },
      { geraet: 'Laptop über 12-V-Netzteil', watt: 65, stunden: 4, laengeM: 2 },
      { geraet: 'Waschmaschine (230 V, über Wechselrichter)', watt: 500, stunden: 1, laengeM: 1.5 },
    ],
    wechselrichterWatt: 2000,
    wechselrichterLaengeM: 1.5,
    panelWatt: 100,
  },
];

for (const vorlage of VORLAGEN) {
  console.log(`\n=== ${vorlage.label} ===`);
  const u = vorlage.systemspannung;
  let bedarf = 0;
  for (const eintrag of vorlage.verbraucher) {
    const wh = eintrag.watt * eintrag.stunden;
    bedarf += wh;
    const strom = eintrag.watt / u;
    const querschnitt = calculateCrossSection(strom, eintrag.laengeM);
    const sicherung = selectFuseSize(strom, querschnitt);
    console.log(
      `  ${eintrag.geraet}: ${eintrag.watt} W × ${fmt(eintrag.stunden, 2)} h = ${fmt(wh, 0)} Wh | ${fmt(strom, 2)} A, ${eintrag.laengeM} m → ${fmt(querschnitt, 1)} mm², I_z ${fmt(designAmpacity(querschnitt), 1)} A, Sicherung ${sicherung} A (max. ${calculateMaxFuse(querschnitt)} A)`
    );
  }
  console.log(`  Tagesbedarf: ${fmt(bedarf, 0)} Wh`);

  const batterie = sizeBattery({
    dailyEnergyWh: bedarf,
    autonomyDays: vorlage.tage,
    systemVoltageV: u,
    chemistry: 'LiFePO4',
    referenceCurrentA: 25,
  });
  console.log(
    `  Batterie: ${fmt(batterie.requiredUsableWh, 0)} Wh → ${fmt(batterie.requiredNominalAh, 1)} Ah → ${batterie.recommendedNominalAh} Ah (Peukert ${fmt(batterie.peukertFactor, 3)}, nutzbar ${fmt(batterie.usableAhOfRecommendation, 1)} Ah)`
  );
  console.log(
    `  Nennenergie: ${fmt((batterie.recommendedNominalAh * u) / 1000, 2)} kWh; Nachladen im Ladefenster: ${fmt(batterie.chargeCurrentA, 1)} A`
  );

  for (const winter of [false, true]) {
    const solar = sizeSolarArray({
      dailyEnergyWh: bedarf,
      systemVoltageV: u,
      panelWatts: vorlage.panelWatt,
      winterDesign: winter,
    });
    console.log(
      `  Solar ${winter ? 'Winter' : 'Sommer'}: ${fmt(solar.requiredPeakWatts, 0)} Wp → ${solar.panelCount} × ${vorlage.panelWatt} Wp = ${solar.recommendedPeakWatts} Wp, Ertrag ${fmt(solar.effectiveYieldKwhPerKwpDay, 2)} kWh/kWp/Tag, Deckung ${fmt(solar.coverageFactor, 2)}, Modulstrom ${fmt(solar.expectedChargeCurrentA, 1)} A`
    );
  }

  // Auslegung der Solarleistung mit weniger Dachfläche (Teilmengen)
  for (const anzahl of [2, 4, 6]) {
    const peak = anzahl * vorlage.panelWatt;
    const sommer = sizeSolarArray({
      dailyEnergyWh: bedarf,
      systemVoltageV: u,
      panelWatts: vorlage.panelWatt,
      winterDesign: false,
    });
    const ertragWh = (peak / 1000) * sommer.effectiveYieldKwhPerKwpDay * 1000;
    console.log(
      `    Alternative ${anzahl} × ${vorlage.panelWatt} Wp = ${peak} Wp: Sommerertrag ${fmt(ertragWh, 0)} Wh/Tag, Deckung ${fmt(ertragWh / bedarf, 2)}`
    );
  }

  if (vorlage.wechselrichterWatt) {
    const strom = vorlage.wechselrichterWatt / u;
    const laenge = vorlage.wechselrichterLaengeM ?? 1.5;
    const querschnitt = calculateCrossSection(strom, laenge);
    const sicherung = selectFuseSize(strom, querschnitt);
    console.log(
      `  Wechselrichter ${vorlage.wechselrichterWatt} W: ${fmt(strom, 1)} A am 12-V-Bordnetz, ${laenge} m → ${fmt(querschnitt, 1)} mm² (I_z ${fmt(designAmpacity(querschnitt), 1)} A), Sicherung ${sicherung} A`
    );
    const laenge2 = 3;
    const querschnitt2 = calculateCrossSection(strom, laenge2);
    console.log(
      `    dieselbe Leistung auf ${laenge2} m: ${fmt(querschnitt2, 1)} mm² (I_z ${fmt(designAmpacity(querschnitt2), 1)} A)`
    );
  }
}
