"use client";

import React, { useState, useMemo, useEffect } from "react";
import { usePlannerStore } from "../../store/usePlannerStore";
import { calculateCrossSection, calculateMaxFuse } from "../../lib/electrical";
import {
  VDE_INVERTER_EFFICIENCY,
  VDE_SOLAR_VMP_VOLTAGE,
} from "../../lib/vde-standards";
import { getSystemVoltage } from "./utils/voltage";
import { cn } from "@/lib/utils";
import { Node, Edge } from 'reactflow';


/* ─── Knowledge Database ─── */

interface ExpertTip {
  title: string;
  icon: string;
  color: string; // tailwind bg color
  tips: {
    heading: string;
    body: string;
    norm?: string;
  }[];
}

const EXPERT_KNOWLEDGE: Record<string, ExpertTip> = {
  battery: {
    title: "Batterie — Experten-Wissen",
    icon: "🔋",
    color: "bg-emerald-500",
    tips: [
      {
        heading: "LiFePO4 vs. AGM",
        body: "LiFePO4-Akkus haben eine nutzbare Kapazität von ca. 95% (DoD), AGM nur ~50%. Eine 100Ah LiFePO4 ersetzt also eine 200Ah AGM.",
      },
      {
        heading: "Kabelquerschnitt zur Batterie",
        body: "Die Zuleitung zur Batterie muss den maximalen Entladestrom tragen. Bei 100Ah LiFePO4 (1C) sind das 100A → mindestens 35mm² bei <1m Kabellänge.",
        norm: "DIN VDE 0298-4",
      },
      {
        heading: "Absicherung",
        body: "Die Hauptsicherung (ANL/MIDI) muss so nah wie möglich am Plus-Pol sitzen. Sie schützt das KABEL, nicht das Gerät! Bei 35mm² → max. 150A Sicherung.",
        norm: "DIN VDE 0100-721",
      },
      {
        heading: "Parallelschaltung",
        body: "Zellen gleicher Kapazität und Alter verwenden. Gleichlange Kabel zwischen den Batterien (Symmetrische Verdrahtung), sonst fließen Ausgleichsströme.",
      },
    ],
  },
  charger: {
    title: "Laderegler / Booster — Experten-Wissen",
    icon: "⚡",
    color: "bg-amber-500",
    tips: [
      {
        heading: "MPPT vs. PWM",
        body: "MPPT-Regler sind ~30% effizienter als PWM. Sie wandeln die höhere Panel-Spannung in mehr Ladestrom um. Ab 100W Solarleistung immer MPPT wählen.",
      },
      {
        heading: "Dimensionierung",
        body: "Der MPPT-Regler muss die Leerlaufspannung (Voc) aller Panels in Reihe verkraften. Bei 2× 100W Panels in Reihe: Voc ≈ 2 × 22V = 44V → min. 50V Regler.",
      },
      {
        heading: "Ladebooster (B2B)",
        body: "Moderner Euro 6d Lichtmaschinen liefern oft nur 14,0V. Ein Ladebooster (z.B. Victron Orion-Tr Smart 12/12-30) hebt die Spannung auf 14,4V für LiFePO4.",
      },
      {
        heading: "Kabelquerschnitt",
        body: "Von Lichtmaschine zum Ladebooster: min. 10mm² bei 30A und ≤3m. Vom Booster zur Batterie: gleicher Querschnitt. Immer beidseitig absichern!",
        norm: "DIN VDE 0298-4",
      },
    ],
  },
  solar: {
    title: "Solarpanel — Experten-Wissen",
    icon: "☀️",
    color: "bg-sky-500",
    tips: [
      {
        heading: "Ausrichtung",
        body: "Panels flach auf dem Dach montiert verlieren ~30% Ertrag ggü. optimaler Neigung. Trotzdem besser als Falt-Panels, da immer bereit und diebstahlsicher.",
      },
      {
        heading: "Parallel vs. Reihe",
        body: "Parallelschaltung: Ströme addieren sich, Spannung bleibt gleich → besser bei Teilverschattung. Reihenschaltung: Spannungen addieren sich → effizienter für MPPT.",
      },
      {
        heading: "Realistische Erträge",
        body: "In Deutschland rechnet man mit ~3-4 Sonnenstunden/Tag (Sommer). Ein 200Wp Panel erzeugt real ca. 600-800Wh/Tag ≈ 50-65Ah bei 12V.",
      },
    ],
  },
  consumer: {
    title: "12V Verbraucher — Experten-Wissen",
    icon: "💡",
    color: "bg-violet-500",
    tips: [
      {
        heading: "Querschnittberechnung",
        body: "Formel: A = (I × L × 2) ÷ (κ × ΔU). Für Kupfer: κ = 58. Bei 5A, 3m und max. 3% Spannungsfall (0,36V): A = (5 × 6) ÷ (58 × 0,36) = 1,44mm² → 1,5mm² wählen.",
        norm: "DIN VDE 0298-4",
      },
      {
        heading: "Sicherungsgröße",
        body: "Die Sicherung muss zwischen Kabelbelastbarkeit und Nennstrom des Geräts liegen. Für 1,5mm² Kabel: max. 15A Sicherung. Für 2,5mm²: max. 20A.",
      },
      {
        heading: "Standby-Verbrauch beachten",
        body: "Viele 12V-Geräte ziehen im Standby 10-50mA. Bei 5 Geräten summiert sich das auf 50-250mA → 1,2-6Ah pro Tag. Trennschalter einplanen!",
      },
    ],
  },
  consumer230v: {
    title: "230V Verbraucher — Experten-Wissen",
    icon: "🔌",
    color: "bg-rose-500",
    tips: [
      {
        heading: "Wechselrichter-Dimensionierung",
        body: "Induktionskochfeld (2000W) + Kaffeemaschine (1200W) = 3200W. Dein Wechselrichter muss min. 3500W Dauerleistung und >5000W Peak haben.",
      },
      {
        heading: "Batterie-Belastung",
        body: "2000W bei 12V = ~185A Entladestrom! Das erfordert 50mm² Kabel zum Wechselrichter und eine 200A Sicherung. LiFePO4 ist Pflicht.",
      },
      {
        heading: "Schutzmaßnahmen",
        body: "Ein 2-poliger FI/LS-Schutzschalter (RCBO, 30mA, Typ A) ist Pflicht für die 230V-Anlage im Wohnmobil. Kabel: H07RN-F Gummischlauchleitung.",
        norm: "DIN VDE 0100-721",
      },
    ],
  },
  fuse: {
    title: "Sicherungskasten — Experten-Wissen",
    icon: "🛡️",
    color: "bg-orange-500",
    tips: [
      {
        heading: "Richtige Reihenfolge",
        body: "Batterie → Hauptsicherung (ANL) → Shunt → Busbar → Sicherungskasten (Einzelsicherungen) → Verbraucher. Die Hauptsicherung kommt VOR dem Shunt!",
      },
      {
        heading: "Sicherungstypen",
        body: "ATO/ATC (KFZ-Standard) für ≤30A. MIDI/ANL für Hauptleitungen (40-300A). Verwende Sicherungshalter mit Abdeckung gegen Kurzschluss.",
      },
      {
        heading: "Selektivität",
        body: "Einzelsicherungen müssen kleiner sein als die Hauptsicherung. Sonst löst bei Kurzschluss die Hauptsicherung aus, statt nur den betroffenen Zweig abzuschalten.",
      },
    ],
  },
  inverter: {
    title: "Wechselrichter — Experten-Wissen",
    icon: "🔄",
    color: "bg-indigo-500",
    tips: [
      {
        heading: "Reine Sinuswelle",
        body: "Immer einen reinen Sinus-Wechselrichter verwenden. Modifizierter Sinus kann empfindliche Geräte (Induktionskochfeld, Kompressor-Kühlbox) beschädigen.",
      },
      {
        heading: "Kabelführung",
        body: "Die DC-Kabel zum Wechselrichter so kurz wie möglich halten (<1,5m). Bei 3000W Wechselrichter und 1m Kabel: min. 50mm² Querschnitt!",
      },
      {
        heading: "Eigenverbrauch",
        body: "Wechselrichter ziehen im Leerlauf 15-30W. Bei 24h: 360-720Wh ≈ 30-60Ah. Schalte ihn nur bei Bedarf ein oder nutze die Eco-Mode Funktion.",
      },
    ],
  },
  shunt: {
    title: "Smart Shunt — Experten-Wissen",
    icon: "📊",
    color: "bg-teal-500",
    tips: [
      {
        heading: "Einbauort",
        body: "Der Shunt kommt IMMER in die Minus-Leitung, direkt am Batterie-Minuspol. ALLE Minus-Leitungen müssen durch den Shunt laufen, sonst misst er falsch.",
      },
      {
        heading: "Kalibrierung",
        body: "Stelle die Batteriekapazität exakt ein (nicht den Nennwert!). Bei neuer LiFePO4 100Ah: trage 100Ah ein. Tail Current auf 4% und Charged Voltage auf 14,2V.",
      },
    ],
  },
  busbar: {
    title: "Sammelschiene (Busbar) — Experten-Wissen",
    icon: "🔗",
    color: "bg-zinc-600",
    tips: [
      {
        heading: "Warum ein Busbar?",
        body: "Ein Busbar (Sammelschiene) vereinfacht die Verdrahtung. Statt alles an der Batterie anzuklemmen, geht nur ein dickes Kabel zum Busbar, und von dort verteilt es sich.",
      },
      {
        heading: "Dimensionierung",
        body: "Die Busbar muss den Gesamtstrom aller angeschlossenen Verbraucher + Ladequellen tragen können. Typisch: 250A-Busbar mit M8-Bolzen für Kabelschuhe.",
      },
    ],
  },
  shorePower: {
    title: "Landstromanschluss — Experten-Wissen",
    icon: "🏕️",
    color: "bg-blue-600",
    tips: [
      {
        heading: "CEE-Steckdose",
        body: "Verwende eine blaue CEE 16A Außendose (IP44). Im Fahrzeuginneren einen 2-poligen FI/LS 30mA Typ A. Kabel: H07RN-F 3G2,5mm².",
        norm: "DIN VDE 0100-721",
      },
      {
        heading: "Galvanische Trennung",
        body: "Ein Trenntrafo schützt vor Korrosion durch Ableitströme auf dem Campingplatz. Besonders wichtig bei Fahrzeugen am Wasser oder mit Aluminiumkarosserie.",
      },
    ],
  },
  ground: {
    title: "Massepunkt — Experten-Wissen",
    icon: "⏚",
    color: "bg-stone-600",
    tips: [
      {
        heading: "Sternförmige Masseführung",
        body: "Alle Masse-Kabel an einem zentralen Punkt (Masseschiene) sammeln und von dort mit EINEM dicken Kabel zur Batterie-Minus führen.",
      },
      {
        heading: "Karosserie-Masse",
        body: "Im Camper möglichst KEINE Karosserie als Rückleiter nutzen. Übergangwiderstände an korrodierenden Schrauben verursachen Spannungsabfälle und Brand-Risiko.",
      },
    ],
  },
  conduit: {
    title: "Leerrohr / Kabelkanal — Experten-Wissen",
    icon: "🔧",
    color: "bg-gray-500",
    tips: [
      {
        heading: "Wellrohr verwenden",
        body: "Kabel im Fahrzeug immer in geschlitztem Wellrohr (NW 10-25) verlegen. Das schützt vor Scheuerstellen durch Vibrationen und erleichtert späteres Nachziehen.",
      },
      {
        heading: "Füllgrad beachten",
        body: "Max. 40% des Wellrohr-Querschnitts mit Kabeln füllen. Sonst lassen sich Kabel nicht mehr nachziehen und die Wärmeabfuhr ist eingeschränkt.",
      },
    ],
  },
};

/* Fallback when nothing is selected */
const DEFAULT_TIP: ExpertTip = {
  title: "Experten-Wissen",
  icon: "🧭",
  color: "bg-stone-700",
  tips: [
    {
      heading: "So funktioniert's",
      body: "Wähle eine Komponente auf dem Canvas aus (klicke auf Batterie, Solar, Verbraucher, etc.) und hier erscheint sofort passendes Fachwissen zu Kabelquerschnitten, Normen und Profi-Tipps.",
    },
    {
      heading: "Profi-Tipp",
      body: "Beginne immer mit der Batterie und arbeite dich von dort nach außen vor. So behältst du den Überblick über Ströme und Querschnitte.",
    },
  ],
};

/* ─── Component ─── */

function LiveRecommendationCard({ node, edges }: { node: Node; edges: Edge[] }) {
  const nodes = usePlannerStore((s) => s.nodes);
  const sysVoltage = getSystemVoltage(nodes);

  if (!node || !(node.data?.watts || node.data?.amps || node.type === 'inverter' || node.type === 'solar')) return null;

            let I = 0;
            if (node.type === 'inverter')
              I = (Number(node.data.watts) || 1000) / sysVoltage / VDE_INVERTER_EFFICIENCY;
            else if (node.type === 'solar')
              I = (Number(node.data.watts) || 100) / VDE_SOLAR_VMP_VOLTAGE;
            else if (node.type === 'consumer230v')
              I = (Number(node.data.watts) || 0) / 230; // AC current at 230V
            else if (node.data?.watts) I = Number(node.data.watts) / sysVoltage;
            else if (node.data?.amps) I = Number(node.data.amps);

            const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
            let length = 2; // Default assumption 2 meters
            let isFallback = true;
            if (connectedEdges.length > 0) {
              length = Math.max(...connectedEdges.map(e => (e.data as any)?.length || 2));
              isFallback = false;
            }

            // Determine domain for cross-section calculation
            const domain: 'DC_12V' | 'AC_230V' = node.type === 'consumer230v' ? 'AC_230V' : 'DC_12V';
            const crossSection = calculateCrossSection(I, length, undefined, domain);
            const fuseSize = calculateMaxFuse(crossSection);

            if (I > 0) {
              return (
                <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-br from-white/60 to-white/30 border border-white/50 shadow-[0_8px_32px_rgba(31,38,135,0.07)] backdrop-blur-md relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                  <div className="absolute -left-4 -bottom-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    Live-Empfehlung <span className="text-[10px] font-normal text-stone-400 normal-case">{isFallback ? "(Berechnung basiert auf 2m Fallback – bitte Kabel verbinden!)" : `(bei ${length.toFixed(1)}m Kabel)`}</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="flex flex-col bg-white/60 rounded-lg p-2.5 border border-white">
                      <span className="text-[10px] text-stone-500 font-semibold mb-1">Kabelquerschnitt</span>
                      <span className="text-lg font-black text-stone-800">{crossSection} <span className="text-xs font-bold text-stone-500">mm²</span></span>
                    </div>
                    <div className="flex flex-col bg-white/60 rounded-lg p-2.5 border border-white">
                      <span className="text-[10px] text-stone-500 font-semibold mb-1">Max. Sicherung</span>
                      <span className="text-lg font-black text-stone-800">{fuseSize} <span className="text-xs font-bold text-stone-500">A</span></span>
                    </div>
                    <div className="col-span-2 flex justify-between items-center bg-white/40 rounded-lg p-2 border border-white/50">
                      <span className="text-[10px] text-stone-600 font-semibold">Erwarteter Strom:</span>
                      <span className="text-sm font-bold text-stone-800">{I.toFixed(1)} A</span>
                    </div>
                  </div>
                </div>
              );
            }
  return null;
}

export function ExpertPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedTip, setExpandedTip] = useState<number | null>(0);

  // Read-only subscription to selection state
  const selectedNodes = usePlannerStore((s) => s.selectedNodes);
  const edges = usePlannerStore((s) => s.edges);

  const currentKnowledge = useMemo(() => {
    if (selectedNodes.length === 0) return DEFAULT_TIP;
    let nodeType = selectedNodes[0].type;
    if (!nodeType) return DEFAULT_TIP;
    
    // Map new charger types to the general charger knowledge
    if (['mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(nodeType)) {
      nodeType = 'charger';
    }

    return EXPERT_KNOWLEDGE[nodeType] || DEFAULT_TIP;
  }, [selectedNodes]);

  // Reset expanded tip when the knowledge context changes
  useEffect(() => {
    setExpandedTip(0);
  }, [currentKnowledge]);

  return (
    <div
      className={cn(
        "absolute bottom-20 md:bottom-4 right-4 z-50 transition-all duration-400 ease-out",
        "pointer-events-auto"
      )}
      style={{ maxWidth: isOpen ? 380 : 56 }}
    >
      {/* Expanded Panel */}
      {isOpen && (
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] border border-stone-200/80 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          {/* Header */}
          <div
            className={cn(
              "flex items-center gap-3 px-5 py-4",
              "bg-gradient-to-r from-stone-800 to-stone-700"
            )}
          >
            <span className="text-xl">{currentKnowledge.icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                {currentKnowledge.title}
              </h3>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">
                Kontextuelles Lernen
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-stone-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label="Panel schließen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {/* Dynamic Calculation Card */}
          {selectedNodes.length > 0 && <LiveRecommendationCard node={selectedNodes[0]} edges={edges} />}

          {/* Tip Accordion */}
          <div className="max-h-[40vh] overflow-y-auto overscroll-contain mt-2">
            {currentKnowledge.tips.map((tip, idx) => {
              const isExpanded = expandedTip === idx;
              return (
                <div key={idx} className="border-b border-stone-100 last:border-b-0">
                  <button
                    onClick={() =>
                      setExpandedTip(isExpanded ? null : idx)
                    }
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-stone-50 transition-colors group"
                    aria-expanded={isExpanded}
                    aria-controls={`tip-content-${idx}`}
                  >
                    {/* Accent dot */}
                    <span
                      className={cn(
                        "flex-shrink-0 w-2 h-2 rounded-full transition-all",
                        isExpanded
                          ? currentKnowledge.color
                          : "bg-stone-300 group-hover:bg-stone-400"
                      )}
                    />
                    <span
                      className={cn(
                        "flex-1 text-sm font-bold transition-colors",
                        isExpanded ? "text-stone-900" : "text-stone-600"
                      )}
                    >
                      {tip.heading}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        "w-4 h-4 text-stone-400 transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div
                      id={`tip-content-${idx}`}
                      className="px-5 pb-4 pl-10 animate-in slide-in-from-top-2 fade-in duration-200"
                    >
                      <p className="text-sm text-stone-600 leading-relaxed">
                        {tip.body}
                      </p>
                      {tip.norm && (
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="w-3 h-3"
                          >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          {tip.norm}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-stone-50 border-t border-stone-100">
            <p className="text-[10px] text-stone-400 font-medium">
              💡 Klicke auf verschiedene Komponenten für kontextspezifische Tipps
            </p>
          </div>
        </div>
      )}

      {/* FAB Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            "bg-gradient-to-br from-stone-800 to-stone-700",
            "text-white shadow-[0_8px_25px_rgba(0,0,0,0.25)]",
            "hover:shadow-[0_12px_35px_rgba(0,0,0,0.35)] hover:scale-105",
            "transition-all duration-200",
            "border border-stone-600/50",
            "relative group"
          )}
          aria-label="Experten-Wissen öffnen"
          title="Experten-Wissen"
        >
          {/* Pulse ring when a component is selected */}
          {selectedNodes.length > 0 && (
            <span className="absolute inset-0 rounded-2xl animate-ping bg-emerald-400/20 pointer-events-none" />
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>

          {/* Notification dot */}
          {selectedNodes.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <span className="text-[8px] font-black text-white">!</span>
            </span>
          )}
        </button>
      )}
    </div>
  );
}
