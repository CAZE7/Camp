'use client';

import { createContext } from 'react';

/**
 * Canvas-Kontext für die laufenden Bezeichnungen.
 *
 * Die Zählung selbst steht in `designatorModel.ts` (ohne React), weil Vorlagen
 * auch von Server-Komponenten gelesen werden. Hier kommt nur der Provider.
 *
 * Es ist eine eindeutige Anlagenkennung im Plan, keine Normvorgabe.
 */

export {
  NODE_TYPE_DESIGNATOR_BASE,
  designatorForIndex,
  designatorMapFor,
  nodesWithUniqueDesignators,
  resolvedDesignator,
} from './designatorModel';

/** Knoten-ID → Bezeichnung. Ohne Provider (z. B. Einzeltests) gilt die Basis der Art. */
export const DesignatorContext = createContext<ReadonlyMap<string, string>>(new Map());
