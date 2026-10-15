'use client';

import React, { useState } from 'react';
import { useAppStore } from '../../lib/store';
import { usePlannerStore } from '../../store/usePlannerStore';
import { Button } from '@/components/ui/button';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
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

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [sources, setSources] = useState<Record<string, boolean>>({});
  const [consumers, setConsumers] = useState<Record<string, boolean>>({});

  const totalSelected =
    Object.values(sources).filter(Boolean).length + Object.values(consumers).filter(Boolean).length;
  const recommendedId = totalSelected >= 5 ? 'autark' : totalSelected >= 3 ? 'kastenwagen' : 'minimalist';

  const setHasOnboarded = useAppStore((state) => state.setHasOnboarded);
  const applyTemplate = usePlannerStore((state) => state.applyTemplate);
  const clearPlan = usePlannerStore((state) => state.clearPlan);

  // Das beim ersten Besuch vorgeladene Beispiel-Setup ist kein eigener Plan:
  // Es zu ersetzen oder zu leeren braucht keine Rückfrage — sonst begrüßt der
  // erste Dialog jeden Erstbesucher mit einem Bestätigungs-Popup.
  const hasOwnPlan = (state: ReturnType<typeof usePlannerStore.getState>) =>
    (state.nodes.length > 0 || state.waterNodes.length > 0) && !isStarterPlan(state.nodes, state.edges);

  const startEmpty = () => {
    const state = usePlannerStore.getState();
    if (
      hasOwnPlan(state) &&
      !window.confirm(
        'Der aktuelle Plan wird geleert. Du kannst das anschließend rückgängig machen. Fortfahren?'
      )
    )
      return;
    clearPlan();
    setHasOnboarded(true);
    window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('planner-fit-view')));
  };

  const handleApplyTemplate = (templateId: string) => {
    const state = usePlannerStore.getState();
    if (
      hasOwnPlan(state) &&
      !window.confirm(
        'Die Vorlage ersetzt den aktuellen Plan. Du kannst das anschließend rückgängig machen. Fortfahren?'
      )
    )
      return;
    applyTemplate(templateId);
    setHasOnboarded(true);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('planner-fit-view')), 50);
  };

  return (
    <AccessibleDialog
      open
      onClose={startEmpty}
      title="Dein Camper-Energieplan"
      description="In drei kurzen Schritten findest du eine passende Basis. Oder starte direkt mit einem leeren Plan."
      showClose={false}
      closeOnBackdrop={false}
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

      <div className="flex-1 overflow-y-auto p-5">
        {step === 1 && (
          <section aria-labelledby="onboarding-source-title" className="space-y-4">
            <h3 id="onboarding-source-title" className="text-lg font-semibold">
              1. Woher kommt dein Strom?
            </h3>
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
            <div className="flex flex-wrap justify-between gap-3 pt-3">
              <Button variant="ghost" onClick={startEmpty} className="min-h-11">
                Leeren Plan starten
              </Button>
              <Button onClick={() => setStep(2)} className="min-h-11 px-6">
                Weiter
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="onboarding-consumer-title" className="space-y-4">
            <h3 id="onboarding-consumer-title" className="text-lg font-semibold">
              2. Welche Geräte planst du?
            </h3>
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
            <div className="flex justify-between gap-3 pt-3">
              <Button variant="outline" onClick={() => setStep(1)} className="min-h-11 px-6">
                Zurück
              </Button>
              <Button onClick={() => setStep(3)} className="min-h-11 px-6">
                Weiter
              </Button>
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
                Die Empfehlung richtet sich nach dem Umfang deiner Auswahl. Alle Werte lassen sich später
                anpassen.
              </p>
            </div>
            <div className="space-y-3">
              {[...TEMPLATES]
                .sort((a, b) => (a.id === recommendedId ? -1 : b.id === recommendedId ? 1 : 0))
                .map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => handleApplyTemplate(template.id)}
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
            <div className="flex flex-wrap justify-between gap-3 pt-3">
              <Button variant="outline" onClick={() => setStep(2)} className="min-h-11 px-6">
                Zurück
              </Button>
              <Button variant="ghost" onClick={startEmpty} className="min-h-11">
                Ohne Vorlage starten
              </Button>
            </div>
          </section>
        )}
      </div>
    </AccessibleDialog>
  );
}
