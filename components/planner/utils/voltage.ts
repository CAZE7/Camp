import { getSystemVoltage } from '../../../lib/vde-standards';

/**
 * Dynamically calculates the nominal system voltage based on the batteries present in the graph.
 * Defaults to 12.8V (typical LiFePO4) if no explicit voltage or battery is found.
 *
 * Implementierung zentral in lib/vde-standards.ts (einzige Quelle).
 */
export { getSystemVoltage };
