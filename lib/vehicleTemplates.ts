export interface VehicleTemplate {
  id: string;
  brand: string;
  model: string;
  version: string;
  length: number; // in meters (total interior length)
  width: number; // in meters (interior width)
  height: number; // in meters
  roofLength: number; // usable roof length in meters
  roofWidth: number; // usable roof width in meters
}

export const vehicleTemplates: VehicleTemplate[] = [
  // --- FIAT DUCATO / PEUGEOT BOXER / CITROEN JUMPER ---
  {
    id: 'ducato-l1h1',
    brand: 'Fiat/PSA',
    model: 'Ducato/Boxer/Jumper',
    version: 'L1H1',
    length: 2.67,
    width: 1.87,
    height: 1.66,
    roofLength: 2.67,
    roofWidth: 1.4,
  },
  {
    id: 'ducato-l2h2',
    brand: 'Fiat/PSA',
    model: 'Ducato/Boxer/Jumper',
    version: 'L2H2',
    length: 3.12,
    width: 1.87,
    height: 1.93,
    roofLength: 3.12,
    roofWidth: 1.4,
  },
  {
    id: 'ducato-l3h2',
    brand: 'Fiat/PSA',
    model: 'Ducato/Boxer/Jumper',
    version: 'L3H2',
    length: 3.7,
    width: 1.87,
    height: 1.93,
    roofLength: 3.7,
    roofWidth: 1.4,
  },
  {
    id: 'ducato-l4h2',
    brand: 'Fiat/PSA',
    model: 'Ducato/Boxer/Jumper',
    version: 'L4H2',
    length: 4.07,
    width: 1.87,
    height: 1.93,
    roofLength: 4.07,
    roofWidth: 1.4,
  },

  // --- MERCEDES SPRINTER ---
  {
    id: 'sprinter-l1',
    brand: 'Mercedes-Benz',
    model: 'Sprinter (906/907)',
    version: 'L1 (Compact)',
    length: 2.6,
    width: 1.78,
    height: 1.7,
    roofLength: 2.6,
    roofWidth: 1.35,
  },
  {
    id: 'sprinter-l2',
    brand: 'Mercedes-Benz',
    model: 'Sprinter (906/907)',
    version: 'L2 (Standard)',
    length: 3.37,
    width: 1.78,
    height: 1.93,
    roofLength: 3.37,
    roofWidth: 1.35,
  },
  {
    id: 'sprinter-l3',
    brand: 'Mercedes-Benz',
    model: 'Sprinter (906/907)',
    version: 'L3 (Long)',
    length: 4.41,
    width: 1.78,
    height: 1.93,
    roofLength: 4.41,
    roofWidth: 1.35,
  },
  {
    id: 'sprinter-l4',
    brand: 'Mercedes-Benz',
    model: 'Sprinter (906/907)',
    version: 'L4 (Extra Long)',
    length: 4.9,
    width: 1.78,
    height: 1.93,
    roofLength: 4.9,
    roofWidth: 1.35,
  },

  // --- FORD TRANSIT ---
  {
    id: 'transit-l2h2',
    brand: 'Ford',
    model: 'Transit',
    version: 'L2H2',
    length: 2.94,
    width: 1.78,
    height: 1.88,
    roofLength: 2.94,
    roofWidth: 1.38,
  },
  {
    id: 'transit-l3h3',
    brand: 'Ford',
    model: 'Transit',
    version: 'L3H3',
    length: 3.2,
    width: 1.78,
    height: 2.02,
    roofLength: 3.2,
    roofWidth: 1.38,
  },
];

/** Vorrang-Fahrzeug ('ducato-l1h1'); das Literal oben beginnt damit — hier
 *  einmal bewiesen, statt an jeder UI-Defaultstelle zu kaschieren. */
export const DEFAULT_VEHICLE_TEMPLATE: VehicleTemplate = (() => {
  const first = vehicleTemplates[0];
  if (!first) throw new Error('vehicleTemplates ist leer — Default-Fahrzeug ungültig');
  return first;
})();
