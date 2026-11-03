/**
 * lib/seo/comparisons/schema.ts — Vergleichsdaten → Produkte für das Schema.
 *
 * Eine Zuordnung, keine zweite Wahrheit: Namen, Marken und Merkmale kommen aus
 * demselben Datensatz wie die Rangliste, und die Reihenfolge ist dieselbe
 * (`rangfolge`). Das Markup kann damit nicht beschreiben, was die Seite nicht
 * zeigt — derselbe Grund, aus dem Brotkrumen und FAQ aus dem Inhalt abgeleitet
 * werden und nicht noch einmal getippt stehen.
 *
 * Was bewusst fehlt, steht im Dateikopf von `lib/seo/jsonLd.ts`: keine Preise,
 * keine Händler- oder Herstelleradressen, keine Bewertungen.
 *
 * Merkmale ohne Wert (`null` = nachgesehen, aber nicht belegt) werden
 * ausgelassen. Ein leerer `PropertyValue` wäre die maschinelle Form einer
 * Behauptung, die die Seite nicht aufstellt.
 */

import type { JsonLdProduct } from '../jsonLd';
import { rangfolge } from './rangfolge';
import type { ComparisonSpec } from './types';

export function vergleichsProdukte(spec: ComparisonSpec): JsonLdProduct[] {
  return rangfolge(spec.products).map((product) => ({
    anchor: `p-${product.id}`,
    name: `${product.brand} ${product.name}`.trim(),
    brand: product.brand,
    properties: spec.attributes.flatMap((attribute) => {
      const value = product.specs[attribute.id];
      if (value === null || value === undefined) return [];
      return [{ name: attribute.label, value, ...(attribute.unit ? { unitText: attribute.unit } : {}) }];
    }),
  }));
}
