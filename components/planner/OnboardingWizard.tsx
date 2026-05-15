"use client";

import React, { useState } from 'react';
import { useAppStore } from '../../lib/store';
import { usePlannerStore } from '../../store/usePlannerStore';
import { Button } from '@/components/ui/button';

const STROMQUELLEN = [
  { id: 'solar', label: 'Solar' },
  { id: 'booster', label: 'Lichtmaschine / Ladebooster' },
  { id: 'landstrom', label: 'Landstrom' },
];

const VERBRAUCHER = [
  { id: 'kuehlschrank', label: 'Kompressorkühlschrank' },
  { id: 'licht', label: 'LED-Beleuchtung' },
  { id: 'heizung', label: 'Standheizung' },
  { id: 'wasser', label: 'Wasserpumpe' },
  { id: 'laptop', label: 'Laptop-Ladegerät' },
];

const TEMPLATES = [
  { id: 'minimalist', label: 'Der Minimalist (12V Basic)', desc: '12V Battery, Fuse Box, USB Outlets, LED Lights, small Coolbox' },
  { id: 'allrounder', label: 'Der Allrounder (Standard Setup)', desc: '100Ah Lithium Battery, 150W Solar, Ladebooster, 500W Inverter, Fridge, etc.' },
  { id: 'autark', label: 'Der Autarke (Heavy-Duty Setup)', desc: '200Ah Lithium, 400W Solar, 2000W Inverter, Induction Cooktop, Water Heater' },
];

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [sources, setSources] = useState<Record<string, boolean>>({});
  const [consumers, setConsumers] = useState<Record<string, boolean>>({});

  const setHasOnboarded = useAppStore((state) => state.setHasOnboarded);
  const applyTemplate = usePlannerStore((state) => (state as any).applyTemplate);

  const handleSkip = () => {
    setHasOnboarded(true);
  };

  const handleApplyTemplate = (templateId: string) => {
    if (applyTemplate) {
      applyTemplate(templateId);
    }
    setHasOnboarded(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Camper Elektrik Planer</h2>
          <Button variant="ghost" onClick={handleSkip} className="text-gray-500 hover:text-gray-800 p-0 h-auto">
            Überspringen
          </Button>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-lg font-semibold">Schritt 1: Woher kommt dein Strom?</h3>
            <div className="flex flex-col gap-3">
              {STROMQUELLEN.map((src) => (
                <label key={src.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 touch-manipulation">
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={sources[src.id] || false}
                    onChange={(e) => setSources({ ...sources, [src.id]: e.target.checked })}
                  />
                  <span className="text-base">{src.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => setStep(2)} className="min-h-[44px] px-6">Weiter</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-lg font-semibold">Schritt 2: Welche Verbraucher planst du?</h3>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2">
              {VERBRAUCHER.map((cons) => (
                <label key={cons.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 touch-manipulation">
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={consumers[cons.id] || false}
                    onChange={(e) => setConsumers({ ...consumers, [cons.id]: e.target.checked })}
                  />
                  <span className="text-base">{cons.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="min-h-[44px] px-6">Zurück</Button>
              <Button onClick={() => setStep(3)} className="min-h-[44px] px-6">Weiter</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-lg font-semibold">Schritt 3: Wähle deine Basis-Vorlage</h3>
            <p className="text-sm text-gray-500">Basierend auf deinen Angaben empfehlen wir dir eine dieser Vorlagen. Du kannst später alles anpassen.</p>
            <div className="flex flex-col gap-3">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleApplyTemplate(tmpl.id)}
                  className="flex flex-col items-start gap-1 p-4 border rounded-lg text-left hover:border-emerald-500 hover:bg-emerald-50 transition-colors touch-manipulation"
                >
                  <span className="font-semibold text-gray-800">{tmpl.label}</span>
                  <span className="text-sm text-gray-600">{tmpl.desc}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(2)} className="min-h-[44px] px-6">Zurück</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
