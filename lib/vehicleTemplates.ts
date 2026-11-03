/**
 * Fahrzeugvorlagen für die Planer (Dach, Heizung).
 *
 * Alle Längen in Metern. `length`, `width` und `height` sind Innenmaße des
 * Laderaums (Laderaumlänge ab Trennwand, größte Innenbreite, Laderaumhöhe).
 * `roofLength` und `roofWidth` beschreiben die Fläche, die auf dem Dach belegt
 * werden darf.
 *
 * Die nutzbare Dachbreite ist eine Planungsgröße: Innenbreite abzüglich 0,45 m
 * Reserve für Dachwölbung, Holme und Dachträgeraufnahmen, auf 5 cm gerundet.
 * Die Dachlänge entspricht der Laderaumlänge, damit der Planer nie mehr Fläche
 * anbietet, als im Fahrzeug belegt werden kann. Beide Werte sind damit bewusst
 * konservativ.
 *
 * Quellen je Baureihe stehen als Kommentar über der jeweiligen Familie.
 * Maßgeblich sind Herstellerangaben (Preislisten, technische Daten) und, wo
 * diese nicht öffentlich zugänglich sind, Aufbauunterlagen von Ausbauern.
 */

export interface VehicleTemplate {
  id: string;
  brand: string;
  model: string;
  version: string;
  length: number; // Laderaumlänge in m
  width: number; // größte Innenbreite in m
  height: number; // Laderaumhöhe in m
  roofLength: number; // nutzbare Dachlänge in m
  roofWidth: number; // nutzbare Dachbreite in m
  exteriorLength: number; // Fahrzeuglänge in m
  exteriorWidth: number; // Fahrzeugbreite ohne Spiegel in m
  exteriorHeight: number; // Fahrzeughöhe in m
}

/** Reserve für Dachwölbung, Holme und Dachträgeraufnahmen. */
const ROOF_WIDTH_RESERVE = 0.45;

/** Auf 5 cm gerundet, damit die Dachfläche nicht genauer wirkt, als sie ist. */
function roundTo5cm(meters: number): number {
  return Number((Math.round(meters / 0.05) * 0.05).toFixed(2));
}

interface Variant {
  /** Kürzel des Herstellers, zugleich Namensbestandteil der ID. */
  code: string;
  /** Abweichende Anzeige, wenn das Kürzel allein nicht reicht. */
  label?: string;
  length: number;
  height: number;
  exteriorLength: number;
  exteriorHeight: number;
}

interface Family {
  /** Präfix der IDs, z. B. `sprinter907` → `sprinter907-l2h2`. */
  idPrefix: string;
  brand: string;
  model: string;
  width: number;
  exteriorWidth: number;
  variants: Variant[];
}

const families: Family[] = [
  // Fiat Ducato (X290), Citroën Jumper, Peugeot Boxer, Frontantrieb.
  // Quelle: Fiat-Preisliste Ducato Kastenwagen (Stand 11/2023) und
  // loodys.com; Laderaum 1.870 mm breit, 1.422 mm zwischen den Radkästen.
  // Fiat hat die Kürzel 2024 verschoben (der alte L3H2 heißt jetzt L4H2);
  // die Zeilen folgen der bis 2024 gültigen Zuordnung. Opel Movano (ab 2021)
  // und Toyota ProAce Max nutzen dieselbe Karosserie.
  {
    idPrefix: 'ducato',
    brand: 'Fiat/Citroën/Peugeot',
    model: 'Ducato/Jumper/Boxer',
    width: 1.87,
    exteriorWidth: 2.05,
    variants: [
      { code: 'L1H1', length: 2.67, height: 1.66, exteriorLength: 4.96, exteriorHeight: 2.25 },
      { code: 'L1H2', length: 2.67, height: 1.93, exteriorLength: 4.96, exteriorHeight: 2.52 },
      { code: 'L2H1', length: 3.12, height: 1.66, exteriorLength: 5.41, exteriorHeight: 2.25 },
      { code: 'L2H2', length: 3.12, height: 1.93, exteriorLength: 5.41, exteriorHeight: 2.52 },
      { code: 'L3H2', length: 3.7, height: 1.93, exteriorLength: 6.0, exteriorHeight: 2.52 },
      { code: 'L3H3', length: 3.7, height: 2.17, exteriorLength: 6.0, exteriorHeight: 2.76 },
      { code: 'L4H2', length: 4.07, height: 1.93, exteriorLength: 6.36, exteriorHeight: 2.52 },
      { code: 'L4H3', length: 4.07, height: 2.17, exteriorLength: 6.36, exteriorHeight: 2.76 },
    ],
  },

  // Mercedes-Benz Sprinter (Baureihe 907, ab 2018), Hinterradantrieb.
  // Quelle: Mercedes-Benz-Aufbaurichtlinie, zusammengefasst bei vanme.de und
  // expresslogistik-reinwald.de; Laderaum 1.787 mm breit, 1.350 mm zwischen
  // den Radkästen. Frontantrieb ist rund 125 mm länger (L1 2.732 mm,
  // L2 3.397 mm). Die Baureihe 906 (2006–2018) hat andere Maße
  // (Laderaumlänge 2.600/3.265/4.300/4.700 mm, Höhe 1.650/1.940/2.140 mm).
  {
    idPrefix: 'sprinter907',
    brand: 'Mercedes-Benz',
    model: 'Sprinter (907)',
    width: 1.79,
    exteriorWidth: 2.02,
    variants: [
      { code: 'L1H1', length: 2.61, height: 1.79, exteriorLength: 5.27, exteriorHeight: 2.36 },
      { code: 'L1H2', length: 2.61, height: 2.01, exteriorLength: 5.27, exteriorHeight: 2.64 },
      { code: 'L2H1', length: 3.27, height: 1.79, exteriorLength: 5.93, exteriorHeight: 2.36 },
      { code: 'L2H2', length: 3.27, height: 2.01, exteriorLength: 5.93, exteriorHeight: 2.64 },
      { code: 'L2H3', length: 3.27, height: 2.24, exteriorLength: 5.93, exteriorHeight: 2.83 },
      { code: 'L3H2', length: 4.31, height: 2.01, exteriorLength: 6.97, exteriorHeight: 2.62 },
      { code: 'L3H3', length: 4.31, height: 2.24, exteriorLength: 6.97, exteriorHeight: 2.84 },
      { code: 'L4H2', length: 4.71, height: 2.01, exteriorLength: 7.37, exteriorHeight: 2.62 },
      { code: 'L4H3', length: 4.71, height: 2.24, exteriorLength: 7.37, exteriorHeight: 2.84 },
    ],
  },

  // VW Crafter (Baureihe SY/SZ, ab 2017) und MAN TGE, Frontantrieb.
  // Quelle: VW-Nutzfahrzeuge-Preisliste Crafter Kastenwagen (Aufbaurichtlinie
  // 07/2025) über fahrzeugeinrichtungschweiz.ch und svab-fahrzeugeinrichtung.de;
  // Laderaum 1.832 mm breit, 1.380 mm zwischen den Radkästen. VW zählt die
  // Längen ab L3; ein L1/L2 gibt es bei dieser Baureihe nicht. Allrad und
  // Heckantrieb liegen 100 mm tiefer.
  {
    idPrefix: 'crafter',
    brand: 'VW/MAN',
    model: 'Crafter/TGE',
    width: 1.83,
    exteriorWidth: 2.04,
    variants: [
      { code: 'L3H2', length: 3.45, height: 1.73, exteriorLength: 5.99, exteriorHeight: 2.39 },
      { code: 'L3H3', length: 3.45, height: 1.96, exteriorLength: 5.99, exteriorHeight: 2.63 },
      { code: 'L4H3', length: 4.3, height: 1.96, exteriorLength: 6.84, exteriorHeight: 2.63 },
      { code: 'L4H4', length: 4.3, height: 2.19, exteriorLength: 6.84, exteriorHeight: 2.83 },
      { code: 'L5H3', length: 4.86, height: 1.96, exteriorLength: 7.39, exteriorHeight: 2.63 },
      { code: 'L5H4', length: 4.86, height: 2.2, exteriorLength: 7.39, exteriorHeight: 2.84 },
    ],
  },

  // VW Transporter T5, T6 und T6.1 (Kastenwagen).
  // Quelle: VW-Nutzfahrzeuge-Katalog Transporter 6.1 und vanify.co.uk;
  // Laderaum 1.700 mm breit, 1.244 mm zwischen den Radkästen. Das Hochdach
  // gab es nur mit langem Radstand. VW nennt für den langen Radstand im T6.1
  // 2.938 mm, in der Umbau-Praxis sind 2.975 mm üblich.
  {
    idPrefix: 'transporter',
    brand: 'VW',
    model: 'Transporter (T5/T6/T6.1)',
    width: 1.7,
    exteriorWidth: 1.9,
    variants: [
      { code: 'L1H1', length: 2.57, height: 1.41, exteriorLength: 4.9, exteriorHeight: 1.99 },
      { code: 'L2H1', length: 2.98, height: 1.41, exteriorLength: 5.3, exteriorHeight: 1.99 },
      { code: 'L2H2', length: 2.98, height: 1.94, exteriorLength: 5.3, exteriorHeight: 2.48 },
    ],
  },

  // Ford Transit (ab 2014), Frontantrieb außer L4.
  // Quelle: Ford-Preisliste „Transit Kastenwagen – Technische Daten“ und
  // Parkers; Laderaum 1.784 mm breit, 1.392 mm zwischen den Radkästen.
  // Der L4 gibt es nur mit Heckantrieb, dort 100 mm weniger Ladehöhe.
  {
    idPrefix: 'transit',
    brand: 'Ford',
    model: 'Transit',
    width: 1.78,
    exteriorWidth: 2.06,
    variants: [
      { code: 'L2H2', length: 3.04, height: 1.89, exteriorLength: 5.53, exteriorHeight: 2.55 },
      { code: 'L2H3', length: 3.04, height: 2.13, exteriorLength: 5.53, exteriorHeight: 2.79 },
      { code: 'L3H2', length: 3.49, height: 1.89, exteriorLength: 5.98, exteriorHeight: 2.55 },
      { code: 'L3H3', length: 3.49, height: 2.13, exteriorLength: 5.98, exteriorHeight: 2.79 },
      { code: 'L4H3', length: 4.22, height: 2.03, exteriorLength: 6.7, exteriorHeight: 2.78 },
    ],
  },

  // Ford Transit Custom (2012–2023).
  // Quelle: Ford-Transit-Custom-Preisliste und europe-vans.eu; Laderaum
  // 1.775 mm breit, 1.392 mm zwischen den Radkästen. Die Baureihe ab 2023 ist
  // etwas länger (Laderaum 2.602/3.002 mm) und niedriger (1.314 mm).
  {
    idPrefix: 'transitcustom',
    brand: 'Ford',
    model: 'Transit Custom',
    width: 1.78,
    exteriorWidth: 1.99,
    variants: [
      { code: 'L1H1', length: 2.55, height: 1.41, exteriorLength: 4.97, exteriorHeight: 2.0 },
      { code: 'L1H2', length: 2.55, height: 1.78, exteriorLength: 4.97, exteriorHeight: 2.37 },
      { code: 'L2H1', length: 2.92, height: 1.41, exteriorLength: 5.34, exteriorHeight: 1.98 },
      { code: 'L2H2', length: 2.92, height: 1.78, exteriorLength: 5.34, exteriorHeight: 2.34 },
    ],
  },

  // Renault Trafic, Opel Vivaro, Nissan NV300, Fiat Talento (ab 2014).
  // Quelle: Renault-Nutzfahrzeug-Abmessungen (renault.co.uk, business.renault.ch)
  // und Parkers; Laderaum 1.662 mm breit, 1.268 mm zwischen den Radkästen.
  // Mit Durchladeklappe in der Trennwand steigt die nutzbare Länge auf
  // 3.750 beziehungsweise 4.150 mm.
  {
    idPrefix: 'trafic',
    brand: 'Renault/Opel/Nissan/Fiat',
    model: 'Trafic/Vivaro/NV300/Talento',
    width: 1.66,
    exteriorWidth: 1.96,
    variants: [
      { code: 'L1H1', length: 2.54, height: 1.39, exteriorLength: 5.08, exteriorHeight: 1.97 },
      { code: 'L1H2', length: 2.54, height: 1.9, exteriorLength: 5.08, exteriorHeight: 2.49 },
      { code: 'L2H1', length: 2.94, height: 1.39, exteriorLength: 5.48, exteriorHeight: 1.97 },
      { code: 'L2H2', length: 2.94, height: 1.9, exteriorLength: 5.48, exteriorHeight: 2.49 },
    ],
  },

  // Renault Master, Opel Movano, Nissan NV400 (2010–2024).
  // Quelle: Renault-Master-Preisliste (CH, 01/2024) und renault.ps; Laderaum
  // 1.765 mm breit, 1.380 mm zwischen den Radkästen (Zwillingsbereifung
  // 1.080 mm). L4 gibt es nur mit Heckantrieb und 100 mm weniger Höhe.
  {
    idPrefix: 'master',
    brand: 'Renault/Opel/Nissan',
    model: 'Master/Movano/NV400',
    width: 1.77,
    exteriorWidth: 2.07,
    variants: [
      { code: 'L1H1', length: 2.58, height: 1.7, exteriorLength: 5.08, exteriorHeight: 2.3 },
      { code: 'L1H2', length: 2.58, height: 1.89, exteriorLength: 5.08, exteriorHeight: 2.49 },
      { code: 'L2H2', length: 3.08, height: 1.89, exteriorLength: 5.58, exteriorHeight: 2.49 },
      { code: 'L2H3', length: 3.08, height: 2.14, exteriorLength: 5.58, exteriorHeight: 2.74 },
      { code: 'L3H2', length: 3.73, height: 1.89, exteriorLength: 6.23, exteriorHeight: 2.48 },
      { code: 'L3H3', length: 3.73, height: 2.14, exteriorLength: 6.23, exteriorHeight: 2.74 },
      {
        code: 'L4H2',
        label: 'L4H2 (Heckantrieb)',
        length: 4.38,
        height: 1.8,
        exteriorLength: 6.69,
        exteriorHeight: 2.48,
      },
      {
        code: 'L4H3',
        label: 'L4H3 (Heckantrieb)',
        length: 4.38,
        height: 2.05,
        exteriorLength: 6.69,
        exteriorHeight: 2.74,
      },
    ],
  },

  // Mercedes-Benz Vito (Baureihe 447, ab 2014).
  // Quelle: Mercedes-Benz-Preisliste und ADAC-Autokatalog; Laderaum
  // 1.680 mm breit, 1.270 mm zwischen den Radkästen. Der Vito hat nur ein
  // Dach, deshalb gibt es keine H-Varianten.
  {
    idPrefix: 'vito',
    brand: 'Mercedes-Benz',
    model: 'Vito (447)',
    width: 1.68,
    exteriorWidth: 1.93,
    variants: [
      { code: 'L1H1', length: 2.59, height: 1.39, exteriorLength: 4.9, exteriorHeight: 1.91 },
      { code: 'L2H1', length: 2.83, height: 1.39, exteriorLength: 5.14, exteriorHeight: 1.91 },
      { code: 'L3H1', length: 3.06, height: 1.39, exteriorLength: 5.37, exteriorHeight: 1.91 },
    ],
  },

  // Iveco Daily 35S, Hinterradantrieb.
  // Quelle: Iveco-Aufbaurichtlinie, wiedergegeben bei vanreviewer.co.uk und im
  // kfz-anzeiger-Fahrbericht; Laderaum 1.740 mm breit, 1.317 mm zwischen den
  // Radkästen. Das Superhochdach (1.900 → 2.100 mm) gibt es erst ab 35C, für
  // den 35S ist die Außenhöhe nicht belegt und die Variante fehlt deshalb.
  {
    idPrefix: 'daily',
    brand: 'Iveco',
    model: 'Daily (35S)',
    width: 1.74,
    exteriorWidth: 2.01,
    variants: [
      { code: 'L1H1', length: 2.61, height: 1.55, exteriorLength: 5.48, exteriorHeight: 2.32 },
      { code: 'L2H1', length: 3.13, height: 1.55, exteriorLength: 5.69, exteriorHeight: 2.32 },
      { code: 'L2H2', length: 3.13, height: 1.9, exteriorLength: 5.69, exteriorHeight: 2.66 },
      { code: 'L3H2', length: 3.54, height: 1.9, exteriorLength: 6.01, exteriorHeight: 2.66 },
      { code: 'L4H2', length: 4.68, height: 1.9, exteriorLength: 7.25, exteriorHeight: 2.66 },
    ],
  },

  // VW Caddy Cargo und Caddy Cargo Maxi (ab 2020).
  // Quelle: VW-Nutzfahrzeuge-Preisliste Caddy Cargo, zusammengefasst bei
  // vanguide.co.uk und maxmove.com; Laderaum 1.614 mm breit, 1.230 mm
  // zwischen den Radkästen, ein Dach.
  {
    idPrefix: 'caddy',
    brand: 'VW',
    model: 'Caddy Cargo',
    width: 1.61,
    exteriorWidth: 1.86,
    variants: [
      { code: 'L1H1', length: 1.8, height: 1.27, exteriorLength: 4.5, exteriorHeight: 1.86 },
      {
        code: 'L2H1',
        label: 'L2H1 (Maxi)',
        length: 2.15,
        height: 1.27,
        exteriorLength: 4.85,
        exteriorHeight: 1.86,
      },
    ],
  },

  // Citroën Berlingo, Peugeot Partner/Rifter, Opel Combo, Toyota ProAce City
  // (ab 2018). Quelle: Citroën-Preisliste Berlingo Kastenwagen (07/2023) und
  // carwow; Laderaum 1.733 mm breit (1.630 mm mit einer Schiebetür),
  // 1.229 mm zwischen den Radkästen, ein Dach.
  {
    idPrefix: 'berlingo',
    brand: 'Citroën/Peugeot/Opel/Toyota',
    model: 'Berlingo/Partner/Combo',
    width: 1.73,
    exteriorWidth: 1.85,
    variants: [
      { code: 'L1H1', length: 1.82, height: 1.27, exteriorLength: 4.4, exteriorHeight: 1.8 },
      {
        code: 'L2H1',
        label: 'L2H1 (XL)',
        length: 2.17,
        height: 1.27,
        exteriorLength: 4.75,
        exteriorHeight: 1.82,
      },
    ],
  },
];

export const vehicleTemplates: VehicleTemplate[] = families.flatMap((family) =>
  family.variants.map((variant) => ({
    id: `${family.idPrefix}-${variant.code.toLowerCase()}`,
    brand: family.brand,
    model: family.model,
    version: variant.label ?? variant.code,
    length: variant.length,
    width: family.width,
    height: variant.height,
    roofLength: variant.length,
    roofWidth: roundTo5cm(family.width - ROOF_WIDTH_RESERVE),
    exteriorLength: variant.exteriorLength,
    exteriorWidth: family.exteriorWidth,
    exteriorHeight: variant.exteriorHeight,
  }))
);

/** Vorrang-Fahrzeug ('ducato-l1h1'); das Literal oben beginnt damit — hier
 *  einmal bewiesen, statt an jeder UI-Defaultstelle zu kaschieren. */
export const DEFAULT_VEHICLE_TEMPLATE: VehicleTemplate = (() => {
  const first = vehicleTemplates[0];
  if (!first) throw new Error('vehicleTemplates ist leer — Default-Fahrzeug ungültig');
  return first;
})();
