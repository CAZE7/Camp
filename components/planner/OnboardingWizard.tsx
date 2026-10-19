'use client';

import React, { useCallback, useState } from 'react';
import { useAppStore } from '../../lib/store';
import { usePlannerStore } from '../../store/usePlannerStore';
import { Button } from '@/components/ui/button';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { requestConfirm } from '@/components/ui/ConfirmDialog';
import { isStarterPlan, PLANNER_TEMPLATES } from './templates';

const STROMQUELLEN = [
  { id: 'solar', label: 'Solar' },
  { id: 'booster', label: 'Lichtmaschine mit Ladebooster' },
  { id: 'landstrom', label: 'Landstrom vom Campingplatz' },
];

const VERBRAUCHER = [
  { id: 'kuehlschrank', label: 'Kompressorkühlschrank' },
  { id: 'licht', label: 'LED-Beleuchtung' },
  { id: 'heizung', label: 'Standheizung' },
  { id: 'wasser', label: 'Wasserpumpe' },
  { id: 'laptop', label: 'Laptop-Ladegerät' },
];

// Die drei Ausbaustufen kommen aus derselben Liste wie Toolbar-Auswahl und
// Deep-Links (`PLANNER_TEMPLATES`) — ein Name hier, der dort fehlt, wäre ein
// toter Knopf im ersten Dialog, den ein Besucher sieht.
const TEMPLATES = PLANNER_TEMPLATES.map((template) => ({
  id: template.id,
  label: template.label,
  desc: template.description,
}));

/**
 * Welche Vorlage passt zur Auswahl? (Nachtest 2026-10-16: Der Assistent
 * empfahl „Minimal“ auch dann, wenn der Nutzer Solar angekreuzt hatte —
 * diese Vorlage hat aber gar kein Solarmodul.)
 *
 * Regel: Die Empfehlung muss jedes angekreuzte Merkmal enthalten.
 * Landstrom gibt es nur in „Autark“, Solar und Ladebooster ab
 * „Allround“. Erst danach entscheidet der Umfang der Auswahl.
 */
export function recommendedTemplateId(
  sources: Record<string, boolean>,
  consumers: Record<string, boolean>
): string {
  const totalSelected =
    Object.values(sources).filter(Boolean).length + Object.values(consumers).filter(Boolean).length;
  if (sources.landstrom) return 'autark';
  if (totalSelected >= 5) return 'autark';
  // „allrounder“ ist auf main der Alias von „kastenwagen“ (die mittlere Vorlage).
  if (sources.solar || sources.booster || totalSelected >= 3) return 'kastenwagen';
  return 'minimalist';
}

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [sources, setSources] = useState<Record<string, boolean>>({});
  const [consumers, setConsumers] = useState<Record<string, boolean>>({});

  const recommendedId = recommendedTemplateId(sources, consumers);
  const sourceCount = Object.values(sources).filter(Boolean).length;
  const consumerCount = Object.values(consumers).filter(Boolean).length;

  const setHasOnboarded = useAppStore((state) => state.setHasOnboarded);
  const applyTemplate = usePlannerStore((state) => state.applyTemplate);
  const clearPlan = usePlannerStore((state) => state.clearPlan);

  /**
   * Schließen (✕, Esc, Klick daneben) ändert nichts am Plan
   * (Nachtest 2026-10-16: Vorher löste genau das „Plan wird geleert“ aus).
   */
  const dismiss = useCallback(() => setHasOnboarded(true), [setHasOnboarded]);

  // Das beim ersten Besuch vorgeladene Beispiel-Setup ist kein eigener Plan:
  // Es zu ersetzen braucht keine Rückfrage.
  const hasOwnPlan = () => {
    const state = usePlannerStore.getState();
    return (
      (state.nodes.length > 0 || state.waterNodes.length > 0) && !isStarterPlan(state.nodes, state.edges)
    );
  };

  const startEmpty = async () => {
    if (
      hasOwnPlan() &&
      !(await requestConfirm(
        'Der aktuelle Plan wird geleert. Du kannst das anschließend rückgängig machen. Fortfahren?'
      ))
    )
      return;
    clearPlan();
    setHasOnboarded(true);
    window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('planner-fit-view')));
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (
      hasOwnPlan() &&
      !(await requestConfirm(
        'Die Vorlage ersetzt den aktuellen Plan. Du kannst das anschließend rückgängig machen. Fortfahren?'
      ))
    )
      return;
    applyTemplate(templateId);
    setHasOnboarded(true);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('planner-fit-view')), 50);
  };

  return (
    <AccessibleDialog
      open
      onClose={dismiss}
      title="Dein Camper-Energieplan"
      description="In drei kurzen Schritten findest du eine passende Basis. Oder schließe diesen Assistenten und starte direkt mit deinem Plan."
      showClose
      closeOnBackdrop
    >
      {/* Fortschrittsanzeige mit role=img, damit das aria-label auf einem
          <div> erlaubt ist (Lighthouse aria-prohibited-attr). */}
      <div className="flex items-center gap-2 px-5 pt-4" role="img" aria-label={`Schritt ${step} von 3`}>
        {[1, 2, 3].map((value) => (
          <span
            key={value}
            className={`h-2 flex-1 rounded-full ${value <= step ? 'bg-primary' : 'bg-muted'}`}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {step === 1 && (
          <section aria-labelledby="onboarding-source-title" className="space-y-4">
            <h3 id="onboarding-source-title" className="text-lg font-semibold">
              1. Woher kommt dein Strom?
            </h3>
            <p className="text-sm text-muted-foreground">
              Kein Pflichtprogramm: Mit dem ✕ oben rechts oder der Esc-Taste schließt du den Assistenten
              jederzeit — dein Plan bleibt dabei unverändert.
            </p>
            <div className="space-y-2">
              {STROMQUELLEN.map((source) => (
                <label
                  key={source.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary"
                    checked={sources[source.id] || false}
                    onChange={(event) => setSources({ ...sources, [source.id]: event.target.checked })}
                  />
                  <span>{source.label}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="onboarding-consumer-title" className="space-y-4">
            <h3 id="onboarding-consumer-title" className="text-lg font-semibold">
              2. Welche Geräte planst du?
            </h3>
            <p className="text-sm text-muted-foreground">
              Nichts ist vorausgewählt. Deine Auswahl bestimmt die Empfehlung in Schritt 3.
            </p>
            <div className="space-y-2">
              {VERBRAUCHER.map((consumer) => (
                <label
                  key={consumer.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary"
                    checked={consumers[consumer.id] || false}
                    onChange={(event) => setConsumers({ ...consumers, [consumer.id]: event.target.checked })}
                  />
                  <span>{consumer.label}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="onboarding-template-title" className="space-y-4">
            <div>
              <h3 id="onboarding-template-title" className="text-lg font-semibold">
                3. Wähle deine Basis
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Die Empfehlung richtet sich nach dem Umfang deiner Auswahl ({sourceCount} Stromquelle
                {sourceCount === 1 ? '' : 'n'}, {consumerCount} Gerät{consumerCount === 1 ? '' : 'e'}). Alle
                Werte lassen sich später anpassen.
              </p>
            </div>
            <div className="space-y-3">
              {[...TEMPLATES]
                .sort((a, b) => (a.id === recommendedId ? -1 : b.id === recommendedId ? 1 : 0))
                .map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => void handleApplyTemplate(template.id)}
                    className={`flex min-h-11 w-full flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      template.id === recommendedId
                        ? 'border-moss bg-moss/10 ring-1 ring-moss'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <span className="font-semibold text-foreground">
                      {template.label}
                      {template.id === recommendedId && (
                        <span className="ml-2 rounded-full bg-moss px-2 py-1 text-xs font-bold uppercase text-on-signal">
                          Empfohlen
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">{template.desc}</span>
                  </button>
                ))}
            </div>
          </section>
        )}
      </div>
      <div
        data-testid="onboarding-actions"
        className="sticky bottom-0 flex shrink-0 flex-wrap justify-between gap-3 border-t border-border bg-card px-5 py-3"
      >
        {step === 1 && (
          <>
            <Button variant="ghost" onClick={() => void startEmpty()} className="min-h-11">
              Mit leerem Plan beginnen
            </Button>
            <Button onClick={() => setStep(2)} className="min-h-11 px-6">
              Weiter
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button variant="outline" onClick={() => setStep(1)} className="min-h-11 px-6">
              Zurück
            </Button>
            <Button onClick={() => setStep(3)} className="min-h-11 px-6">
              Weiter
            </Button>
          </>
        )}
        {step === 3 && (
          <>
            <Button variant="outline" onClick={() => setStep(2)} className="min-h-11 px-6">
              Zurück
            </Button>
            <Button variant="ghost" onClick={() => void startEmpty()} className="min-h-11">
              Mit leerem Plan beginnen
            </Button>
          </>
        )}
      </div>
    </AccessibleDialog>
  );
}
