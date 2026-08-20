"use client";

import React, { useState, useMemo, useEffect } from "react";
import { usePlannerStore } from "../../store/usePlannerStore";
import { useAppStore } from "../../lib/store";
import { calculateCrossSection, calculateMaxFuse } from "../../lib/electrical";
import { VDE_INVERTER_EFFICIENCY, VDE_SOLAR_VMP_VOLTAGE } from "../../lib/vde-standards";
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
    title: "Batterie — Fachwissen",
    icon: "🔋",
    color: "bg-emerald-500",
    tips: [
      {
        heading: "LiFePO4 vs. AGM",
        body: "LiFePO4-Akkus haben eine nutzbare Kapazität von ca. 95 % Entladetiefe (DoD), AGM nur ~50%. Eine 100Ah LiFePO4 ersetzt also eine 200Ah AGM.",
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
    title: "Laderegler / Booster — Fachwissen",
    icon: "⚡",
    color: "bg-amber-500",
    tips: [
      {
        heading: "Solar-Laderegler: MPPT oder PWM",
        body: "Solar-Laderegler mit Maximum-Power-Point-Tracking (MPPT) sind ~30% effizienter als einfache Pulsweitenmodulation (PWM). Sie wandeln die höhere Panel-Spannung in mehr Ladestrom um. Ab 100W Solarleistung immer MPPT wählen.",
      },
      {
        heading: "Dimensionierung",
        body: "Der Solar-Laderegler mit Maximum-Power-Point-Tracking (MPPT) muss die Leerlaufspannung (Voc) aller Panels in Reihe verkraften. Bei 2× 100W Panels in Reihe: Leerlaufspannung (Voc) ≈ 2 × 22V = 44V → min. 50V Regler.",
      },
      {
        heading: "Batterie-zu-Batterie-Ladebooster (B2B)",
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
    title: "Solarpanel — Fachwissen",
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
    title: "12V Verbraucher — Fachwissen",
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
    title: "230V Verbraucher — Fachwissen",
    icon: "🔌",
    color: "bg-rose-500",
    tips: [
      {
        heading: "Wechselrichter-Dimensionierung",
        body: "Induktionskochfeld (2000W) + Kaffeemaschine (1200W) = 3200W. Dein Wechselrichter muss min. 3500W Dauerleistung und >5000W Spitzenleistung haben.",
      },
      {
        heading: "Batterie-Belastung",
        body: "2000W bei 12V = ~185A Entladestrom! Das erfordert 50mm² Kabel zum Wechselrichter und eine 200A Sicherung. LiFePO4 ist Pflicht.",
      },
      {
        heading: "Schutzmaßnahmen",
        body: "Ein 2-poliger kombinierter Fehlerstrom- und Leitungsschutzschalter (FI/LS, auch RCBO, 30 mA, Typ A) ist Pflicht für die 230V-Anlage im Wohnmobil. Kabel: H07RN-F Gummischlauchleitung.",
        norm: "DIN VDE 0100-721",
      },
    ],
  },
  fuse: {
    title: "Sicherungskasten — Fachwissen",
    icon: "🛡️",
    color: "bg-orange-500",
    tips: [
      {
        heading: "Richtige Reihenfolge",
        body: "Batterie+ → Hauptsicherung (ANL, ≤20 cm) → Plus-Sammelschiene → Sicherungskasten → Verbraucher. Batterie- → Batteriemonitor (Shunt) → Minus-Sammelschiene. Der Shunt sitzt nur im Minus, die Hauptsicherung nur im Plus.",
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
    title: "Wechselrichter — Fachwissen",
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
        body: "Wechselrichter ziehen im Leerlauf 15-30W. Bei 24h: 360-720Wh ≈ 30-60Ah. Schalte ihn nur bei Bedarf ein oder nutze den Energiesparmodus.",
      },
    ],
  },
  shunt: {
    title: "Batteriemonitor (Shunt) — Fachwissen",
    icon: "📊",
    color: "bg-teal-500",
    tips: [
      {
        heading: "Einbauort",
        body: "Der Shunt kommt IMMER in die Minus-Leitung, direkt am Batterie-Minuspol. ALLE Minus-Leitungen müssen durch den Shunt laufen, sonst misst er falsch.",
      },
      {
        heading: "Kalibrierung",
        body: "Stelle die Batteriekapazität exakt ein (nicht den Nennwert!). Bei neuer LiFePO4 100Ah: trage 100Ah ein. Schweifstrom („Tail Current“) auf 4% und Ladeschlussspannung („Charged Voltage“) auf 14,2V.",
      },
    ],
  },
  busbar: {
    title: "Sammelschiene (Busbar) — Fachwissen",
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
    title: "Landstromanschluss — Fachwissen",
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
    title: "Massepunkt — Fachwissen",
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
  water: {
    title: "Wassersystem — Hilfe",
    icon: "💧",
    color: "bg-blue-700",
    tips: [
      {
        heading: "Flussrichtung beachten",
        body: "Frischwasser fließt vom Tank über Vorfilter, Pumpe und Druckausgleichsgefäß zu Spüle oder Dusche. Abwasser wird getrennt zum Abwassertank geführt.",
      },
      {
        heading: "Pumpe schützen",
        body: "Setze den Vorfilter vor die Pumpe und plane ihn gut erreichbar. Ein Druckausgleichsgefäß hinter der Pumpe reduziert Geräusche und häufiges Schalten.",
      },
      {
        heading: "Leitungen markieren",
        body: "Kennzeichne Frisch- und Abwasser auch bei der Montage eindeutig. Prüfe Rohrdurchmesser und Anschlüsse anhand der Herstellerangaben deiner Pumpe und Armaturen.",
      },
    ],
  },
  conduit: {
    title: "Leerrohr / Kabelkanal — Fachwissen",
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

/* Standardwert when nothing is selected */
const DEFAULT_TIP: ExpertTip = {
  title: "Fachwissen",
  icon: "🧭",
  color: "bg-stone-700",
  tips: [
    {
      heading: "So funktioniert's",
      body: "Wähle eine Komponente im Plan aus (klicke auf Batterie, Solar, Verbraucher, etc.) und hier erscheint sofort passendes Fachwissen zu Kabelquerschnitten, Normen und Profi-Tipps.",
    },
    {
      heading: "Profi-Tipp",
      body: "Beginne immer mit der Batterie und arbeite dich von dort nach außen vor. So behältst du den Überblick über Ströme und Querschnitte.",
    },
  ],
};

/* ─── Component ─── */

function LiveRecommendationCard({ node, edges }: { node: Node; edges: Edge[] }) {
  if (!node || !(node.data?.watts || node.data?.amps || node.type === 'inverter' || node.type === 'solar')) return null;

            let I = 0;
            if (node.type === 'inverter') I = (Number(node.data.watts) || 1000) / 12 / VDE_INVERTER_EFFICIENCY;
            else if (node.type === 'solar') I = (Number(node.data.watts) || 100) / VDE_SOLAR_VMP_VOLTAGE;
            else if (node.type === 'consumer230v') I = (Number(node.data.watts) || 0) / 230; // AC current at 230V
            else if (node.data?.watts) I = Number(node.data.watts) / 12;
            else if (node.data?.amps) I = Number(node.data.amps);

            const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
            let length = 2; // Default assumption 2 meters
            let isStandardwert = true;
            if (connectedEdges.length > 0) {
              length = Math.max(...connectedEdges.map(e => (e.data as any)?.length || 2));
              isStandardwert = false;
            }

            // Determine domain for cross-section calculation
            const domain: 'DC_12V' | 'AC_230V' = node.type === 'consumer230v' ? 'AC_230V' : 'DC_12V';
            const crossSection = calculateCrossSection(I, length, undefined, domain);
            const fuseSize = calculateMaxFuse(crossSection);

            if (I > 0) {
              return (
                <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-br from-white/60 to-white/30 border border-white/50 shadow-lg backdrop-blur-md relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
                  <div className="absolute -left-4 -bottom-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                  <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    Aktuelle Empfehlung <span className="text-xs font-normal text-stone-700 normal-case">{isStandardwert ? "(Berechnung basiert auf 2m Standardwert – bitte Kabel verbinden!)" : `(bei ${length.toFixed(1)}m Kabel)`}</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="flex flex-col bg-white/60 rounded-lg p-2.5 border border-white">
                      <span className="text-xs text-stone-500 font-semibold mb-1">Kabelquerschnitt</span>
                      <span className="text-lg font-black text-stone-800">{crossSection} <span className="text-xs font-bold text-stone-500">mm²</span></span>
                    </div>
                    <div className="flex flex-col bg-white/60 rounded-lg p-2.5 border border-white">
                      <span className="text-xs text-stone-500 font-semibold mb-1">Max. Sicherung</span>
                      <span className="text-lg font-black text-stone-800">{fuseSize} <span className="text-xs font-bold text-stone-500">A</span></span>
                    </div>
                    <div className="col-span-2 flex justify-between items-center bg-white/40 rounded-lg p-2 border border-white/50">
                      <span className="text-xs text-stone-600 font-semibold">Erwarteter Strom:</span>
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
  const [autoWireSummary, setAutoWireSummary] = useState<{ edgeCount: number } | null>(null);

  // Read-only subscription to selection state
  const selectedNodes = usePlannerStore((s) => s.selectedNodes);
  const edges = usePlannerStore((s) => s.edges);
  const isProMode = useAppStore((s) => s.isProMode);

  // Öffnet das Panel automatisch, sobald Automatische Verbindung abgeschlossen wurde,
  // und bestätigt das Ergebnis sichtbar („nach Automatische Verbindung ist alles perfekt").
  useEffect(() => {
    const onAutoWired = (event: Event) => {
      const detail = (event as CustomEvent<{ edgeCount?: number }>).detail;
      setIsOpen(true);
      setAutoWireSummary({ edgeCount: Number(detail?.edgeCount) || 0 });
    };
    window.addEventListener('planner-auto-wired', onAutoWired);
    return () => window.removeEventListener('planner-auto-wired', onAutoWired);
  }, []);

  const currentKnowledge = useMemo(() => {
    if (selectedNodes.length === 0) return DEFAULT_TIP;
    let nodeType = selectedNodes[0].type;
    if (!nodeType) return DEFAULT_TIP;
    
    // Map new charger types to the general charger knowledge
    if (['mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(nodeType)) {
      nodeType = 'charger';
    }
    if (['freshWaterTank', 'grayWaterTank', 'pump', 'accumulator', 'preFilter', 'sink', 'shower'].includes(nodeType)) {
      nodeType = 'water';
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
        "absolute bottom-20 right-4 z-50 transition-all duration-300 ease-out md:bottom-4",
        "pointer-events-auto",
        isOpen ? "w-11/12 max-w-sm" : "w-auto max-w-xs"
      )}
    >
      {/* Expanded Panel */}
      {isOpen && (
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-stone-200/80 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
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
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
                {isProMode ? 'Profi-Details aktiv' : 'Einsteiger-Hilfe'}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-stone-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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

          {/* Automatische Verbindung Erfolgs-Bestätigung */}
          {autoWireSummary && (
            <div className="mx-4 mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-lg animate-in slide-in-from-top-2 fade-in duration-300">
              <div className="flex items-start gap-2.5">
                <span className="text-lg leading-none mt-0.5">✅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-emerald-900">Automatische Verbindung abgeschlossen</p>
                  <p className="text-xs text-emerald-800 leading-snug mt-1">
                    {autoWireSummary.edgeCount} Kabel verlegt · alle Sicherungen &amp; Querschnitte berechnet
                    (DIN VDE 0298-4 / 0100-721). Klicke auf eine Komponente für Details.
                  </p>
                </div>
                <button
                  onClick={() => setAutoWireSummary(null)}
                  className="text-emerald-400 hover:text-emerald-700 transition-colors p-0.5 rounded-md hover:bg-emerald-100"
                  aria-label="Automatische Verbindung Zusammenfassung schließen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Calculation Card */}
          {isProMode && selectedNodes.length > 0 && <LiveRecommendationCard node={selectedNodes[0]} edges={edges} />}

          {/* Tip Accordion */}
          <div className="max-h-96 overflow-y-auto overscroll-contain mt-2">
            {(isProMode ? currentKnowledge.tips : currentKnowledge.tips.slice(0, 2)).map((tip, idx) => {
              const isExpanded = expandedTip === idx;
              return (
                <div key={idx} className="border-b border-stone-100 last:border-b-0">
                  <button
                    onClick={() =>
                      setExpandedTip(isExpanded ? null : idx)
                    }
                    className="group flex min-h-11 w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-800"
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
                        "w-4 h-4 text-stone-600 transition-transform duration-200",
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
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-100">
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
          <div className="border-t border-stone-200 bg-stone-50 px-5 py-3">
            <p className="text-xs font-medium text-stone-700">Wähle eine Komponente für passende Tipps.</p>
            <p className="mt-1 text-xs font-semibold text-red-800">230-V-Anlagen müssen von einer Elektrofachkraft geprüft und angeschlossen werden.</p>
          </div>
        </div>
      )}

      {/* FAB Toggle Button — bewusst groß & auffällig („Fachwissen") */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "group flex items-center gap-2.5 pl-3 pr-4 py-3 rounded-2xl",
            "bg-gradient-to-br from-emerald-800 via-emerald-900 to-stone-900",
            "text-white shadow-xl",
            "hover:shadow-2xl",
            "transition-all duration-200",
            "border border-emerald-300/40",
            "relative"
          )}
          aria-label="Hilfe und Fachwissen öffnen"
          title="Hilfe und Fachwissen öffnen"
        >
          {/* Die Auswahl wird über den Text angekündigt – ohne ablenkende Daueranimation. */}
          <span className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-white/15 border border-white/20 group-hover:bg-white/25 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </span>
          <span className="relative flex flex-col items-start text-left">
            <span className="text-sm font-black leading-tight">Hilfe &amp; Fachwissen</span>
            <span className="text-xs font-bold leading-tight text-emerald-100">
              {selectedNodes.length > 0 ? 'Tipps für deine Auswahl' : isProMode ? 'Details und Normen' : 'Einfach erklärt'}
            </span>
          </span>

          {/* Notification dot */}
          {selectedNodes.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-400 shadow-md">
              <span className="text-xs font-black text-emerald-950">i</span>
            </span>
          )}
        </button>
      )}
    </div>
  );
}
