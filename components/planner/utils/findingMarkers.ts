import type { PlannerError } from '../../../lib/planner/plannerError';

/**
 * QA B-21: Welche Bauteile tragen im Prüfmodus eine Befund-Markierung?
 * Nur im Modus „Prüfung“, und nur für Befunde mit Handlungsbedarf (Info-Hinweise
 * markieren nichts). Dieselbe Befundliste wie Kopf- und Fußzeile.
 */
export function findingNodeIdSet(
  plannerMode: string,
  errors: readonly Pick<PlannerError, 'severity' | 'nodeIds'>[]
): Set<string> {
  if (plannerMode !== 'pruefung') return new Set<string>();
  return new Set(errors.filter((error) => error.severity !== 'info').flatMap((error) => error.nodeIds));
}
