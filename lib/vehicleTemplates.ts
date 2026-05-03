export interface VehicleTemplate {
  id: string;
  brand: string;
  model: string;
  version: string;
  length: number; // in meters
  width: number;  // in meters
  height: number; // in meters
}

export const vehicleTemplates: VehicleTemplate[] = [
  {
    id: 'ducato-l2h2',
    brand: 'Fiat/Peugeot/Citroen',
    model: 'Ducato/Boxer/Jumper',
    version: 'L2H2',
    length: 3.12,
    width: 1.87,
    height: 1.93,
  },
  {
    id: 'ducato-l3h2',
    brand: 'Fiat/Peugeot/Citroen',
    model: 'Ducato/Boxer/Jumper',
    version: 'L3H2',
    length: 3.70,
    width: 1.87,
    height: 1.93,
  },
  {
    id: 'ducato-l4h2',
    brand: 'Fiat/Peugeot/Citroen',
    model: 'Ducato/Boxer/Jumper',
    version: 'L4H2',
    length: 4.07,
    width: 1.87,
    height: 1.93,
  },
  {
    id: 'sprinter-l2h2',
    brand: 'Mercedes-Benz',
    model: 'Sprinter (906/907)',
    version: 'L2H2',
    length: 3.26,
    width: 1.78,
    height: 1.93,
  },
  {
    id: 'sprinter-l3h2',
    brand: 'Mercedes-Benz',
    model: 'Sprinter (906/907)',
    version: 'L3H2',
    length: 4.30,
    width: 1.78,
    height: 1.93,
  },
  {
    id: 'transit-l2h2',
    brand: 'Ford',
    model: 'Transit',
    version: 'L2H2',
    length: 2.94,
    width: 1.78,
    height: 1.88,
  },
  {
    id: 'transit-l3h3',
    brand: 'Ford',
    model: 'Transit',
    version: 'L3H3',
    length: 3.20,
    width: 1.78,
    height: 2.02,
  },
];
