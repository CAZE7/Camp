'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppStore } from '../../../lib/store';
import { decodeSharePlan } from '../../../store/sharePlan';
import { usePlannerStore } from '../../../store/usePlannerStore';
import type { PlannerFlowNode, PlannerWaterEdge } from '../../../store/slices/types';
import type { Edge } from '@xyflow/react';
import type { CableEdgeData } from '../../../lib/domain/cableEdgeData';
import { LEGACY_PLANNER_STORAGE_KEY, PLANNER_STORAGE_KEY } from '@/lib/storageKeys';
import {
  isStarterPlan,
  planFingerprint,
  shouldLoadStarterPlan,
  STARTER_TEMPLATE_ID,
  templateIdFromSearch,
  TEMPLATES_DICT,
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
 * (das unveränderte Beispiel-Setup zählt nicht als eigener Plan; ein
 * bearbeitetes Beispiel-Setup — z. B. Batterie auf 300 Ah, H5 — dagegen schon).
 */

export type EntryPlanNotice = { type: 'success' | 'error' | 'info'; message: string } | null;

function hasPersistedPlan(): boolean {
  try {
    return (
      window.localStorage.getItem(PLANNER_STORAGE_KEY) !== null ||
      window.localStorage.getItem(LEGACY_PLANNER_STORAGE_KEY) !== null
    );
  } catch {
    return false;
  }
}

/**
 * Entfernt nur die Einstiegs-Parameter (`?template=…` und `#plan=…`) aus der
 * Adresszeile, lässt aber Kampagnen-/Tracking-Parameter (`utm_*` usw.) und
 * fremde Anker unangetastet (N7).
 */
export function buildCleanEntryUrl(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const searchParams = new URLSearchParams(location.search);
  searchParams.delete('template');
  const nextSearch = searchParams.toString();

  let nextHash = location.hash;
  if (nextHash.includes('plan=')) {
    const hashParams = new URLSearchParams(nextHash.startsWith('#') ? nextHash.slice(1) : nextHash);
    hashParams.delete('plan');
    const rest = hashParams.toString();
    nextHash = rest ? `#${rest}` : '';
  }

  return `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`;
}

let fitViewTimer: ReturnType<typeof setTimeout> | undefined;

function fitViewSoon() {
  if (typeof window === 'undefined') return;
  if (fitViewTimer !== undefined) clearTimeout(fitViewTimer);
  fitViewTimer = setTimeout(() => {
    fitViewTimer = undefined;
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('planner-fit-view'));
  }, 50);
}

function cancelFitViewSoon() {
  if (fitViewTimer === undefined) return;
  clearTimeout(fitViewTimer);
  fitViewTimer = undefined;
}

export function usePlannerEntryPlan(): { notice: EntryPlanNotice; dismissNotice: () => void } {
  const [notice, setNotice] = useState<EntryPlanNotice>(null);
  const handled = useRef(false);
  const setHasOnboarded = useAppStore((state) => state.setHasOnboarded);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    let alive = true;
    const scheduleFit = () => {
      if (alive) fitViewSoon();
    };

    const initialState = usePlannerStore.getState();
    if (typeof initialState.applyTemplate !== 'function' || typeof initialState.importProject !== 'function')
      return;

    const hasOwnPlan = () => {
      const current = usePlannerStore.getState();
      if (current.waterNodes.length > 0) return true;
      return current.nodes.length > 0 && !isStarterPlan(current.nodes, current.edges);
    };

    const isSameAsCurrentPlan = (
      nextNodes: readonly {
        id: string;
        type?: string;
        position?: { x: number; y: number };
        data?: unknown;
      }[],
      nextEdges: readonly {
        id: string;
        source?: string;
        target?: string;
        sourceHandle?: string | null;
        targetHandle?: string | null;
        data?: unknown;
      }[],
      nextWaterNodes: readonly {
        id: string;
        type?: string;
        position?: { x: number; y: number };
        data?: unknown;
      }[] = [],
      nextWaterEdges: readonly {
        id: string;
        source?: string;
        target?: string;
        sourceHandle?: string | null;
        targetHandle?: string | null;
        data?: unknown;
      }[] = []
    ): boolean => {
      const current = usePlannerStore.getState();
      return (
        planFingerprint(current.nodes, current.edges) === planFingerprint(nextNodes, nextEdges) &&
        planFingerprint(current.waterNodes, current.waterEdges) ===
          planFingerprint(nextWaterNodes, nextWaterEdges)
      );
    };

    const confirmReplace = (was: string) =>
      !hasOwnPlan() ||
      window.confirm(
        `${was} ersetzt den aktuellen Plan auf der Zeichenfläche. Du kannst das anschließend rückgängig machen. Fortfahren?`
      );

    const clearEntryFromUrl = () => {
      window.history.replaceState(null, '', buildCleanEntryUrl(window.location));
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
      if (
        !isSameAsCurrentPlan(
          result.plan.nodes,
          result.plan.edges,
          result.plan.waterNodes,
          result.plan.waterEdges
        ) &&
        !confirmReplace('Der geteilte Plan')
      ) {
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
      scheduleFit();
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

      const rawTemplateParam = new URLSearchParams(window.location.search).get('template');
      const templateId = templateIdFromSearch(window.location.search);
      if (templateId) {
        const targetTemplate = TEMPLATES_DICT[templateId];
        const alreadyLoaded =
          targetTemplate !== undefined && isSameAsCurrentPlan(targetTemplate.nodes, targetTemplate.edges);
        if (alreadyLoaded || confirmReplace('Die Vorlage')) {
          usePlannerStore.getState().applyTemplate(templateId);
          setHasOnboarded(true);
          scheduleFit();
          setNotice({
            type: 'success',
            message: 'Vorlage geladen — alle Werte lassen sich direkt anpassen.',
          });
        }
        clearEntryFromUrl();
        return;
      }

      if (rawTemplateParam !== null && rawTemplateParam.trim() !== '') {
        clearEntryFromUrl();
        const current = usePlannerStore.getState();
        if (
          shouldLoadStarterPlan({
            hasPersistedPlan: hasPersistedPlan(),
            nodeCount: current.nodes.length,
            waterNodeCount: current.waterNodes.length,
            hasEntryPlan: false,
          })
        ) {
          current.applyTemplate(STARTER_TEMPLATE_ID);
          scheduleFit();
          setNotice({
            type: 'info',
            message: `Unbekannte Vorlage „${rawTemplateParam.trim()}“ — stattdessen wurde das Standard-Beispiel geladen. Über „Vorlage laden“ kannst du wählen.`,
          });
        } else {
          setNotice({
            type: 'error',
            message: `Vorlage „${rawTemplateParam.trim()}“ wurde nicht gefunden. Dein aktueller Plan bleibt unverändert.`,
          });
        }
        return;
      }

      const current = usePlannerStore.getState();
      if (
        shouldLoadStarterPlan({
          hasPersistedPlan: hasPersistedPlan(),
          nodeCount: current.nodes.length,
          waterNodeCount: current.waterNodes.length,
          hasEntryPlan: false,
        })
      ) {
        current.applyTemplate(STARTER_TEMPLATE_ID);
        scheduleFit();
        setNotice({
          type: 'info',
          message:
            'Beispiel geladen: klassisches Kastenwagen-Setup (100 Ah LiFePO4, 200 W Solar, 30 A Ladebooster). Werte anklicken und anpassen — oder oben über „Vorlage laden“ neu starten.',
        });
      }
    })();
    return () => {
      alive = false;
      cancelFitViewSoon();
    };
  }, [setHasOnboarded]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { notice, dismissNotice };
}
