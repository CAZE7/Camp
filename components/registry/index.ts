/**
 * components/registry/index.ts
 *
 * Öffentlicher Zugang zur Bauteil-Registry. Der Import dieses Moduls
 * registriert die eingebauten Bauteile genau einmal (ES-Module-Semantik).
 *
 * Konsumenten:
 *   - components/Sidebar.tsx                    Kachel-Katalog
 *   - components/planner/constants.ts           NODE_TYPES für React Flow
 *   - components/planner/BOMModal.tsx           Label + Zweck
 *   - components/planner/utils/domainFilter.ts  Domänen + Minimap-Farbe
 */
import { BUILTIN_COMPONENT_SPECS } from './builtinComponents';
import { componentCount, registerComponents } from './componentRegistry';

if (componentCount() === 0) {
  registerComponents(BUILTIN_COMPONENT_SPECS);
}

export { BUILTIN_COMPONENT_SPECS };
export * from './componentRegistry';
