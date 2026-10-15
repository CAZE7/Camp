'use client';

import { useEffect, useRef, useState } from 'react';

import { useAppStore } from '../../../lib/store';
import { decodeSharePlan } from '../../../store/sharePlan';
import { usePlannerStore } from '../../../store/usePlannerStore';
import type { PlannerFlowNode, PlannerWaterEdge } from '../../../store/slices/types';
import type { Edge } from '@xyflow/react';
import type { CableEdgeData } from '../../../lib/domain/cableEdgeData';
import {
  isStarterPlan,
  shouldLoadStarterPlan,
  STARTER_TEMPLATE_ID,
  templateIdFromSearch,
} from '../templates';

/**
 * components/planner/hooks/usePlannerEntryPlan.ts — was beim Öffnen von
 * `/planer/` auf der Zeichenfläche liegt.
 *
 * Rangfolge (erste passende Stufe gewinnt, danach ist der Einstieg erledigt):
 *   1. Geteilter Plan (`#plan=…`) — der Foren-Helfer sieht exakt den Plan,
 *      um den es im Beitrag geht.
 *   2. Vorlage aus dem Ratgeber (`?template=ladebooster-solar`) — der im Text
 *      erklärte Aufbau steht fertig gezeichnet da.
 *   3. Beispiel-Setup beim allerersten Besuch — keine leere Zeichenfläche,
 *      die Erstbesucher ratlos zurücklässt.
 *
 * Ein eigener, gespeicherter Plan wird von keiner Stufe still überschrieben:
 * Stufen 1–2 fragen nach, wenn auf der Fläche schon ein eigener Plan liegt
 * (das unveränderte Beispiel-Setup zählt nicht als eigener Plan).
 */

export type EntryPlanNotice = { type: 'success' | 'error' | 'info'; message: string } | null;

const PLANNER_STORAGE_KEY = 'werft-planner-v1';

function hasPersistedPlan(): boolean {
  try {
    return window.localStorage.getItem(PLANNER_STORAGE_KEY) !== null;
  } catch {
    // Blockierter Speicher (z. B. Privatmodus): Dann gibt es keinen
    // gespeicherten Plan, den man schützen müsste — das Beispiel darf laden.
    return false;
  }
}

function fitViewSoon() {
  window.setTimeout(() => window.dispatchEvent(new CustomEvent('planner-fit-view')), 50);
}

export function usePlannerEntryPlan(): { notice: EntryPlanNotice; dismissNotice: () => void } {
  const [notice, setNotice] = useState<EntryPlanNotice>(null);
  const handled = useRef(false);
  const setHasOnboarded = useAppStore((state) => state.setHasOnboarded);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const state = usePlannerStore.getState();
    if (typeof state.applyTemplate !== 'function' || typeof state.importProject !== 'function') return;

    const hasOwnPlan = () =>
      (state.nodes.length > 0 || state.waterNodes.length > 0) && !isStarterPlan(state.nodes, state.edges);

    const confirmReplace = (was: string) =>
      !hasOwnPlan() ||
      window.confirm(
        `${was} ersetzt den aktuellen Plan auf der Zeichenfläche. Du kannst das anschließend rückgängig machen. Fortfahren?`
      );

    const clearEntryFromUrl = () => {
      window.history.replaceState(null, '', `${window.location.pathname}`);
    };

    const loadSharedPlan = async (): Promise<boolean> => {
      if (!window.location.hash.includes('plan=')) return false;
      const result = await decodeSharePlan(window.location.hash);
      if (!result.ok) {
        setNotice({
          type: 'error',
          message: `Geteilter Plan konnte nicht geladen werden: ${result.errors.join(' ')} Dein aktueller Plan bleibt unverändert.`,
        });
        clearEntryFromUrl();
        return true;
      }
      if (!confirmReplace('Der geteilte Plan')) {
        clearEntryFromUrl();
        return true;
      }
      const applied = usePlannerStore.getState().importProject({
        season: result.plan.season,
        nodes: result.plan.nodes as PlannerFlowNode[],
        edges: result.plan.edges as Edge<CableEdgeData>[],
        waterNodes: result.plan.waterNodes as PlannerFlowNode[],
        waterEdges: result.plan.waterEdges as PlannerWaterEdge[],
      });
      clearEntryFromUrl();
      if (!applied) {
        setNotice({
          type: 'error',
          message:
            'Geteilter Plan nicht geladen: Der aktuelle Plan enthält fest verdrahtete Leitungen. Siehe Warnungen.',
        });
        return true;
      }
      setHasOnboarded(true);
      fitViewSoon();
      setNotice({
        type: 'success',
        message:
          result.warnings.length > 0
            ? `Geteilter Plan geladen. ${result.warnings.length} Hinweis(e) zur Bereinigung stehen im Plan.`
            : 'Geteilter Plan geladen — du kannst ihn direkt anpassen und den neuen Link zurückschicken.',
      });
      return true;
    };

    void (async () => {
      if (await loadSharedPlan()) return;

      const templateId = templateIdFromSearch(window.location.search);
      if (templateId) {
        if (confirmReplace('Die Vorlage')) {
          usePlannerStore.getState().applyTemplate(templateId);
          setHasOnboarded(true);
          fitViewSoon();
          setNotice({
            type: 'success',
            message: 'Vorlage geladen — alle Werte lassen sich direkt anpassen.',
          });
        }
        clearEntryFromUrl();
        return;
      }

      if (
        shouldLoadStarterPlan({
          hasPersistedPlan: hasPersistedPlan(),
          nodeCount: state.nodes.length,
          waterNodeCount: state.waterNodes.length,
          hasEntryPlan: false,
        })
      ) {
        usePlannerStore.getState().applyTemplate(STARTER_TEMPLATE_ID);
        fitViewSoon();
        setNotice({
          type: 'info',
          message:
            'Beispiel geladen: klassisches Kastenwagen-Setup (100 Ah LiFePO4, 200 W Solar, 30 A Ladebooster). Werte anklicken und anpassen — oder oben über „Vorlage laden“ neu starten.',
        });
      }
    })();
  }, [setHasOnboarded]);

  return { notice, dismissNotice: () => setNotice(null) };
}
