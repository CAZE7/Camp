'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Battery,
  Cable,
  CheckCircle2,
  Compass,
  Droplets,
  Earth,
  Gauge,
  Info,
  Link2,
  Lightbulb,
  Plug,
  PlugZap,
  RefreshCw,
  Shield,
  Sun,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { usePlannerStore } from '../../store/usePlannerStore';
import { calculateCrossSection, calculateMaxFuse } from '../../lib/electrical';
import {
  VDE_INVERTER_EFFICIENCY,
  VDE_SOLAR_VMP_VOLTAGE,
  dischargeFloorVoltage,
  getSystemVoltage,
} from '../../lib/vde-standards';
import { cn } from '@/lib/utils';
import { type Node, type Edge } from '@xyflow/react';
import type { CableEdgeData } from '../edges/CableEdge';

/* ─── Knowledge Database ─── */

interface ExpertTip {
  title: string;
  /** Lucide statt Emoji: der Planer ist eine Ingenieur-Oberfläche (Werft,
   *  D-2) — Icons bleiben in Farbe/Gewicht kontrollierbar und brauchen kein
   *  Emoji-Font auf dem Gerät. */
  icon: LucideIcon;
  color: string; // tailwind bg color (Token-Klasse)
  tips: {
    heading: string;
    body: string;
    norm?: string;
  }[];
}

const EXPERT_KNOWLEDGE: Record<string, ExpertTip> = {
  battery: {
    title: 'Batterie — Fachwissen',
    icon: Battery,
    color: 'bg-moss',
    tips: [
      {
        heading: 'LiFePO4 vs. AGM',
        body: 'LiFePO4-Akkus dürfen zu ca. 90 % entladen werden (DoD), AGM nur ~50 %. Eine 100-Ah-LiFePO4 ersetzt damit rund 180 Ah AGM (Werte wie im Planer).',
      },
      {
        heading: 'Kabelquerschnitt zur Batterie',
        body: 'Die Zuleitung zur Batterie muss den maximalen Entladestrom tragen. Bei 100 Ah LiFePO4 mit 1C (100 A) dimensioniert der Planer thermisch 70 mm² — liegt der Strom darüber, warnt die App (Leitungen parallel legen oder 24-V-System erwägen).',
        norm: 'DIN VDE 0298-4',
      },
      {
        heading: 'Absicherung',
        body: 'Die Hauptsicherung (ANL/MIDI) muss so nah wie möglich am Plus-Pol sitzen (≤ 20 cm ungeschützt). Sie schützt das KABEL, nicht das Gerät! Maximale Sicherung je Querschnitt nach Planer-Regel (70 % Belastbarkeit): 25 mm² → 63 A, 70 mm² → 100 A.',
        norm: 'DIN VDE 0100-721',
      },
      {
        heading: 'Parallelschaltung',
        body: 'Zellen gleicher Kapazität und Alter verwenden. Gleichlange Kabel zwischen den Batterien (Symmetrische Verdrahtung), sonst fließen Ausgleichsströme.',
      },
    ],
  },
  charger: {
    title: 'Laderegler / Booster — Fachwissen',
    icon: Zap,
    color: 'bg-oak',
    tips: [
      {
        heading: 'Solar-Laderegler: MPPT oder PWM',
        body: 'Solar-Laderegler mit Maximum-Power-Point-Tracking (MPPT) sind ~30% effizienter als einfache Pulsweitenmodulation (PWM). Sie wandeln die höhere Panel-Spannung in mehr Ladestrom um. Ab 100W Solarleistung immer MPPT wählen.',
      },
      {
        heading: 'Dimensionierung',
        body: 'Der Solar-Laderegler mit Maximum-Power-Point-Tracking (MPPT) muss die Leerlaufspannung (Voc) aller Panels in Reihe verkraften. Bei 2× 100W Panels in Reihe: Leerlaufspannung (Voc) ≈ 2 × 22V = 44V → min. 50V Regler.',
      },
      {
        heading: 'Batterie-zu-Batterie-Ladebooster (B2B)',
        body: 'Moderner Euro 6d Lichtmaschinen liefern oft nur 14,0V. Ein Ladebooster (z.B. Victron Orion-Tr Smart 12/12-30) hebt die Spannung auf 14,4V für LiFePO4.',
      },
      {
        heading: 'Kabelquerschnitt',
        body: 'Von Lichtmaschine zum Ladebooster: min. 10mm² bei 30A und ≤3m. Vom Booster zur Batterie: gleicher Querschnitt. Immer beidseitig absichern!',
        norm: 'DIN VDE 0298-4',
      },
    ],
  },
  solar: {
    title: 'Solarpanel — Fachwissen',
    icon: Sun,
    color: 'bg-oxide',
    tips: [
      {
        heading: 'Ausrichtung',
        body: 'Panels flach auf dem Dach montiert verlieren ~30% Ertrag ggü. optimaler Neigung. Trotzdem besser als Falt-Panels, da immer bereit und diebstahlsicher.',
      },
      {
        heading: 'Parallel vs. Reihe',
        body: 'Parallelschaltung: Ströme addieren sich, Spannung bleibt gleich → besser bei Teilverschattung. Reihenschaltung: Spannungen addieren sich → effizienter für MPPT.',
      },
      {
        heading: 'Realistische Erträge',
        body: 'In Deutschland rechnet man mit ~3-4 Sonnenstunden/Tag (Sommer). Ein 200Wp Panel erzeugt real ca. 600-800Wh/Tag ≈ 50-65Ah bei 12V.',
      },
      {
        heading: 'Datenblattwerte Isc & Voc eintragen',
        body: 'Der Planer sichert Solar-Zuleitungen nach der 1,56 × Isc-Regel ab (NEC-Kontext) und prüft die Kalt-Leerlaufspannung Voc(−20 °C) gegen das Eingangsfenster des Ladereglers. Fehlt der Isc-Datenblattwert, schätzt er konservativ 1,25 × Imp — mit echten Werten wird die Absicherung passgenauer.',
      },
    ],
  },
  consumer: {
    title: '12V Verbraucher — Fachwissen',
    icon: Lightbulb,
    color: 'bg-copper',
    tips: [
      {
        heading: 'Querschnittberechnung',
        body: 'Formel: A = (I × L × 2) ÷ (κ × ΔU). Für Kupfer: κ = 58. Bei 5A, 3m und max. 3% Spannungsfall (0,36V): A = (5 × 6) ÷ (58 × 0,36) = 1,44mm² → 1,5mm² wählen.',
        norm: 'DIN VDE 0298-4',
      },
      {
        heading: 'Sicherungsgröße',
        body: 'Die Sicherung muss zwischen Kabelbelastbarkeit und Nennstrom des Geräts liegen. Nach der Planer-Regel (70 % der Tabellen-Belastbarkeit): 1,5 mm² → max. 10 A, 2,5 mm² → max. 16 A, 4 mm² → max. 20 A.',
      },
      {
        heading: 'Standby-Verbrauch beachten',
        body: 'Viele 12V-Geräte ziehen im Standby 10-50mA. Bei 5 Geräten summiert sich das auf 50-250mA → 1,2-6Ah pro Tag. Trennschalter einplanen!',
      },
    ],
  },
  consumer230v: {
    title: '230V Verbraucher — Fachwissen',
    icon: PlugZap,
    color: 'bg-signal',
    tips: [
      {
        heading: 'Wechselrichter-Dimensionierung',
        body: 'Induktionskochfeld (2000W) + Kaffeemaschine (1200W) = 3200W. Dein Wechselrichter muss min. 3500W Dauerleistung und >5000W Spitzenleistung haben.',
      },
      {
        heading: 'Batterie-Belastung',
        body: '2000 W bei 12 V ≈ 185 A Entladestrom (inkl. ~15 % Verluste)! Das liegt über der 70-mm²-Belastbarkeit des Planers — die App warnt. Abhilfe: zwei parallel geführte Leitungen, einen 24-V-Aufbau oder einen kleineren/wechselrichternahen Verbraucher.',
      },
      {
        heading: 'Schutzmaßnahmen',
        body: 'Ein 2-poliger kombinierter Fehlerstrom- und Leitungsschutzschalter (FI/LS, auch RCBO, 30 mA, Typ A) ist Pflicht für die 230V-Anlage im Wohnmobil. Kabel: H07RN-F Gummischlauchleitung.',
        norm: 'DIN VDE 0100-721',
      },
    ],
  },
  fuse: {
    title: 'Sicherungskasten — Fachwissen',
    icon: Shield,
    color: 'bg-copper-deep',
    tips: [
      {
        heading: 'Richtige Reihenfolge',
        body: 'Batterie+ → Hauptsicherung (ANL, ≤20 cm) → Plus-Sammelschiene → Sicherungskasten → Verbraucher. Batterie- → Batteriemonitor (Shunt) → Minus-Sammelschiene. Der Shunt sitzt nur im Minus, die Hauptsicherung nur im Plus.',
      },
      {
        heading: 'Sicherungstypen',
        body: 'ATO/ATC (KFZ-Standard) für ≤30A. MIDI/ANL für Hauptleitungen (40-300A). Verwende Sicherungshalter mit Abdeckung gegen Kurzschluss.',
      },
      {
        heading: 'Selektivität',
        body: 'Einzelsicherungen müssen kleiner sein als die Hauptsicherung. Sonst löst bei Kurzschluss die Hauptsicherung aus, statt nur den betroffenen Zweig abzuschalten.',
      },
    ],
  },
  inverter: {
    title: 'Wechselrichter — Fachwissen',
    icon: RefreshCw,
    color: 'bg-ink',
    tips: [
      {
        heading: 'Reine Sinuswelle',
        body: 'Immer einen reinen Sinus-Wechselrichter verwenden. Modifizierter Sinus kann empfindliche Geräte (Induktionskochfeld, Kompressor-Kühlbox) beschädigen.',
      },
      {
        heading: 'Kabelführung',
        body: 'Die DC-Kabel zum Wechselrichter so kurz wie möglich halten (<1,5m). Bei 3000W Wechselrichter und 1m Kabel: min. 50mm² Querschnitt!',
      },
      {
        heading: 'Eigenverbrauch',
        body: 'Wechselrichter ziehen im Leerlauf 15-30W. Bei 24h: 360-720Wh ≈ 30-60Ah. Schalte ihn nur bei Bedarf ein oder nutze den Energiesparmodus.',
      },
    ],
  },
  shunt: {
    title: 'Batteriemonitor (Shunt) — Fachwissen',
    icon: Gauge,
    color: 'bg-oxide',
    tips: [
      {
        heading: 'Einbauort',
        body: 'Der Shunt kommt IMMER in die Minus-Leitung, direkt am Batterie-Minuspol. ALLE Minus-Leitungen müssen durch den Shunt laufen, sonst misst er falsch.',
      },
      {
        heading: 'Kalibrierung',
        body: 'Stelle die Batteriekapazität exakt ein (nicht den Nennwert!). Bei neuer LiFePO4 100Ah: trage 100Ah ein. Schweifstrom („Tail Current“) auf 4% und Ladeschlussspannung („Charged Voltage“) auf 14,2V.',
      },
    ],
  },
  busbar: {
    title: 'Sammelschiene (Busbar) — Fachwissen',
    icon: Link2,
    color: 'bg-clay',
    tips: [
      {
        heading: 'Warum ein Busbar?',
        body: 'Ein Busbar (Sammelschiene) vereinfacht die Verdrahtung. Statt alles an der Batterie anzuklemmen, geht nur ein dickes Kabel zum Busbar, und von dort verteilt es sich.',
      },
      {
        heading: 'Dimensionierung',
        body: 'Die Busbar muss den Gesamtstrom aller angeschlossenen Verbraucher + Ladequellen tragen können. Typisch: 250A-Busbar mit M8-Bolzen für Kabelschuhe.',
      },
    ],
  },
  shorePower: {
    title: 'Landstromanschluss — Fachwissen',
    icon: Plug,
    color: 'bg-oxide',
    tips: [
      {
        heading: 'CEE-Steckdose',
        body: 'Verwende eine blaue CEE 16A Außendose (IP44). Im Fahrzeuginneren einen 2-poligen FI/LS 30mA Typ A. Kabel: H07RN-F 3G2,5mm².',
        norm: 'DIN VDE 0100-721',
      },
      {
        heading: 'Galvanische Trennung',
        body: 'Ein Trenntrafo schützt vor Korrosion durch Ableitströme auf dem Campingplatz. Besonders wichtig bei Fahrzeugen am Wasser oder mit Aluminiumkarosserie.',
      },
    ],
  },
  ground: {
    title: 'Massepunkt — Fachwissen',
    icon: Earth,
    color: 'bg-clay',
    tips: [
      {
        heading: 'Sternförmige Masseführung',
        body: 'Alle Masse-Kabel an einem zentralen Punkt (Masseschiene) sammeln und von dort mit EINEM dicken Kabel zur Batterie-Minus führen.',
      },
      {
        heading: 'Karosserie-Masse',
        body: 'Im Camper möglichst KEINE Karosserie als Rückleiter nutzen. Übergangwiderstände an korrodierenden Schrauben verursachen Spannungsabfälle und Brand-Risiko.',
      },
    ],
  },
  water: {
    title: 'Wassersystem — Hilfe',
    icon: Droplets,
    color: 'bg-ink',
    tips: [
      {
        heading: 'Flussrichtung beachten',
        body: 'Frischwasser fließt vom Tank über Vorfilter, Pumpe und Druckausgleichsgefäß zu Spüle oder Dusche. Abwasser wird getrennt zum Abwassertank geführt.',
      },
      {
        heading: 'Pumpe schützen',
        body: 'Setze den Vorfilter vor die Pumpe und plane ihn gut erreichbar. Ein Druckausgleichsgefäß hinter der Pumpe reduziert Geräusche und häufiges Schalten.',
      },
      {
        heading: 'Leitungen markieren',
        body: 'Kennzeichne Frisch- und Abwasser auch bei der Montage eindeutig. Prüfe Rohrdurchmesser und Anschlüsse anhand der Herstellerangaben deiner Pumpe und Armaturen.',
      },
    ],
  },
  conduit: {
    title: 'Leerrohr / Kabelkanal — Fachwissen',
    icon: Cable,
    color: 'bg-clay',
    tips: [
      {
        heading: 'Wellrohr verwenden',
        body: 'Kabel im Fahrzeug immer in geschlitztem Wellrohr (NW 10-25) verlegen. Das schützt vor Scheuerstellen durch Vibrationen und erleichtert späteres Nachziehen.',
      },
      {
        heading: 'Füllgrad beachten',
        body: 'Max. 40% des Wellrohr-Querschnitts mit Kabeln füllen. Sonst lassen sich Kabel nicht mehr nachziehen und die Wärmeabfuhr ist eingeschränkt.',
      },
    ],
  },
};

/* Standardwert when nothing is selected */
const DEFAULT_TIP: ExpertTip = {
  title: 'Fachwissen',
  icon: Compass,
  color: 'bg-ink',
  tips: [
    {
      heading: "So funktioniert's",
      body: 'Wähle eine Komponente im Plan aus (klicke auf Batterie, Solar, Verbraucher, etc.) und hier erscheint sofort passendes Fachwissen zu Kabelquerschnitten, Normen und Profi-Tipps.',
    },
    {
      heading: 'Profi-Tipp',
      body: 'Beginne immer mit der Batterie und arbeite dich von dort nach außen vor. So behältst du den Überblick über Ströme und Querschnitte.',
    },
    {
      // AUDIT DOM-001/002: Ehrliche Abgrenzung statt impliziter
      // Vollständigkeits-Anspruch — der Planer dimensioniert, er prüft nicht.
      heading: 'Was der Planer NICHT leistet (Modellgrenzen)',
      body: 'Der Planer ist ein Dimensionierungs-Hilfsmittel und ersetzt keine Elektrofachkraft. 230-V-Mehrleiter: Kanten bleiben Single-Line-Schemata, aber die Aderung ist seit DOM-001 modelliert — PE-Mindestquerschnitt nach IEC 60364-5-54 Tabelle 54.2, LS-Daten (Bauform/Charakteristik/Icn) im Leitungs-Inspektor und eine geschätzte Abschaltbedingung (TN, Zs·Ia ≤ U0 nach IEC 60364-4-41 mit 2/3-Regel; vorgelagerte Netzimpedanz ≈ 0,8 Ω als Annahme — Schleifenimpedanz vor Ort messen lassen). Wechselrichter-Ausgänge bleiben Hersteller-Datenblatt (elektronische Strombegrenzung, kein TN-Schleifenmodell). Nicht modelliert bleiben: N-Leiterführung einzeln, Trenn-/Umschalteinrichtungen, Anlassströme, Selektivität/I²t-Koordination sowie die exakte Sicherungsposition (nur Abstand zur Quelle als Feld). Kurzschlussstrom und Abschaltvermögen (kA) sind seit DOM-002 als Schätzung modelliert (Batterie-Innenwiderstand oder Chemie-Faustformel + Bauform-Datenblattanker nach Littelfuse/Blue Sea — das konkrete Produkt kann abweichen; geprüft wird nur: kann die Sicherung den Bank-Kurzschlussstrom trennen?). Peukert-Lastkorrektur der Autarkie ist seit der Nachpflege als Faustformel aktiv (k = 1,05 LiFePO4 / 1,12 AGM / 1,15 Gel oder Datenblatt). Weiterhin nicht modelliert: Temperatur-/Alterseffekte (Kälte erhöht den Innenwiderstand und senkt den Kurzschlussstrom — wirkt hier entlastend, für die Verfügbarkeit aber relevant), Selbstentladung. Für die endgültige Auslegung gelten die einschlägigen Normen durch eine fachkundige Person.',
    },
  ],
};

/* ─── Component ─── */

function LiveRecommendationCard({
  node,
  nodes,
  edges,
}: {
  node: Node;
  nodes: Node[];
  edges: Edge<CableEdgeData>[];
}) {
  if (!node || !(node.data?.watts || node.data?.amps || node.type === 'inverter' || node.type === 'solar'))
    return null;

  // Dieselbe Systemspannung wie in Kabel-Label und Auto-Wire (12,8 V LiFePO4,
  // 12,0 V Blei, explizite nominalVoltage) — vorher wurde hart mit 12 V
  // gerechnet und die Karte widersprach damit der Kantenbeschriftung.
  const sysVoltage = getSystemVoltage(nodes);
  const isAC = node.type === 'consumer230v';

  let I = 0;
  // AUDIT ELE-006: continuousPower zuerst — dieselbe Priorität wie calculateEdgeCurrent.
  // AUDIT ELE-005: Entladeschlussspannung statt Nennspannung (Strom-Maximum).
  if (node.type === 'inverter')
    I =
      (Number(node.data.continuousPower || node.data.watts) || 1000) /
      dischargeFloorVoltage(sysVoltage) /
      VDE_INVERTER_EFFICIENCY;
  else if (node.type === 'solar') I = (Number(node.data.watts) || 100) / VDE_SOLAR_VMP_VOLTAGE;
  else if (isAC)
    I = (Number(node.data.watts) || 0) / 230; // AC current at 230V
  else if (node.data?.watts) I = Number(node.data.watts) / sysVoltage;
  else if (node.data?.amps) I = Number(node.data.amps);

  const connectedEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
  let length = 2; // Default assumption 2 meters
  let isStandardwert = true;
  if (connectedEdges.length > 0) {
    length = Math.max(...connectedEdges.map((e) => e.data?.length || 2));
    isStandardwert = false;
  }

  // Determine domain for cross-section calculation
  const domain: 'DC_12V' | 'AC_230V' = isAC ? 'AC_230V' : 'DC_12V';
  const crossSection = calculateCrossSection(I, length, undefined, domain);
  // 230-V-Leitungen werden nicht über die DC-FUSE_MAP abgesichert, sondern
  // über einen FI/LS (RCBO) — die DC-Tabelle wäre hier irreführend.
  const fuseLabel = isAC ? '16 A RCBO' : `${calculateMaxFuse(crossSection)} A`;

  if (I > 0) {
    return (
      <div className="relative mx-4 mt-4 overflow-hidden rounded border border-rule bg-surface-panel p-4 shadow-md">
        <h4 className="panel-title mb-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-copper"></span>
          Aktuelle Empfehlung{' '}
          <span className="text-xs font-normal normal-case text-ink-soft">
            {isStandardwert
              ? '(Berechnung basiert auf 2m Standardwert – bitte Kabel verbinden!)'
              : `(bei ${length.toFixed(1)}m Kabel)`}
          </span>
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col rounded border border-border bg-surface-raised p-2.5">
            <span className="text-muted-ink mb-1 text-xs font-semibold">Kabelquerschnitt</span>
            <span className="font-display text-lg font-bold text-ink">
              {crossSection} <span className="text-muted-ink text-xs font-bold">mm²</span>
            </span>
          </div>
          <div className="flex flex-col rounded border border-border bg-surface-raised p-2.5">
            <span className="text-muted-ink mb-1 text-xs font-semibold">Sicherung</span>
            <span className="font-display text-lg font-bold text-ink">{fuseLabel}</span>
          </div>
          <div className="col-span-2 flex items-center justify-between rounded border border-border bg-surface-raised p-2">
            <span className="text-xs font-semibold text-ink-soft">Erwarteter Strom:</span>
            <span className="text-sm font-bold text-ink">{I.toFixed(1)} A</span>
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
  const nodes = usePlannerStore((s) => s.nodes);

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
    const firstSelected = selectedNodes.at(0);
    if (!firstSelected) return DEFAULT_TIP;
    let nodeType = firstSelected.type;
    if (!nodeType) return DEFAULT_TIP;

    // Map new charger types to the general charger knowledge
    if (['mpptController', 'dcdcCharger', 'acBatteryCharger'].includes(nodeType)) {
      nodeType = 'charger';
    }
    if (
      ['freshWaterTank', 'grayWaterTank', 'pump', 'accumulator', 'preFilter', 'sink', 'shower'].includes(
        nodeType
      )
    ) {
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
      data-testid="expert-panel"
      data-open={isOpen ? 'true' : 'false'}
      className={cn(
        'planner-expert-panel pointer-events-auto absolute z-50 transition-all duration-300 ease-out',
        // Geschlossen: FAB unten rechts, ab md über der Statuszeile.
        // Offen: wächst nach oben (kein top+bottom-Stretch), max-h hält
        // MiniMap/Statuszeile/Bottom-Nav frei. Die CSS-Klasse ergänzt auf
        // iPhones zusätzlich die Safe-Area des Home-Indicators.
        isOpen
          ? 'planner-expert-panel--open bottom-28 right-4 w-11/12 max-w-sm md:bottom-20'
          : 'planner-expert-panel--closed bottom-20 right-4 w-auto max-w-xs md:bottom-16'
      )}
    >
      {/* Expanded Panel */}
      {isOpen && (
        <div
          data-testid="expert-panel-open"
          className="flex max-h-[min(28rem,calc(100dvh-8rem))] flex-col overflow-hidden rounded border border-rule bg-bone/95 shadow-xl backdrop-blur-xl duration-300 animate-in fade-in slide-in-from-bottom-4"
        >
          {/* Header — sticky, Token-Farben (bg-ink / text-bone) in hell und dunkel. */}
          <div className="sticky top-0 z-10 flex shrink-0 items-center gap-3 bg-ink px-5 py-4 text-bone">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-bone/25 bg-bone/10">
              <currentKnowledge.icon size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black text-bone">{currentKnowledge.title}</h3>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-bone/80">
                Fachwissen &amp; Normen
              </p>
            </div>
            <button
              type="button"
              data-testid="expert-panel-close"
              onClick={() => setIsOpen(false)}
              className="flex h-11 w-11 min-w-11 shrink-0 items-center justify-center rounded text-bone transition-colors hover:bg-bone/15 hover:text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bone disabled:cursor-not-allowed disabled:opacity-40"
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
                className="h-4 w-4"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {/* Automatische Verbindung Erfolgs-Bestätigung */}
          {autoWireSummary && (
            <div className="mx-4 mt-4 rounded border border-moss bg-moss/10 p-3.5 shadow-sm duration-300 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-moss" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-moss">Automatische Verbindung abgeschlossen</p>
                  <p className="mt-1 text-xs leading-snug text-moss">
                    {autoWireSummary.edgeCount} Kabel verlegt · alle Sicherungen &amp; Querschnitte berechnet
                    (DIN VDE 0298-4 / 0100-721). Klicke auf eine Komponente für Details.
                  </p>
                </div>
                <button
                  onClick={() => setAutoWireSummary(null)}
                  className="rounded p-0.5 text-moss/60 transition-colors hover:bg-moss/10 hover:text-moss"
                  aria-label="Automatische Verbindung Zusammenfassung schließen"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Calculation Card */}
          {(() => {
            const first = selectedNodes.at(0);
            return first ? <LiveRecommendationCard node={first} nodes={nodes} edges={edges} /> : null;
          })()}

          {/* Tip Accordion */}
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {currentKnowledge.tips.map((tip, idx) => {
              const isExpanded = expandedTip === idx;
              return (
                <div key={idx} className="border-b border-rule/40 last:border-b-0">
                  <button
                    onClick={() => setExpandedTip(isExpanded ? null : idx)}
                    className="group flex min-h-11 w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
                    aria-expanded={isExpanded}
                    aria-controls={`tip-content-${idx}`}
                  >
                    {/* Accent dot */}
                    <span
                      className={cn(
                        'h-2 w-2 flex-shrink-0 rounded-full transition-all',
                        isExpanded ? currentKnowledge.color : 'bg-clay group-hover:bg-ink'
                      )}
                    />
                    <span
                      className={cn(
                        'flex-1 text-sm font-bold transition-colors',
                        isExpanded ? 'text-ink' : 'text-ink-soft'
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
                        'h-4 w-4 text-ink-soft transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div
                      id={`tip-content-${idx}`}
                      className="px-5 pb-4 pl-10 duration-200 animate-in fade-in slide-in-from-top-2"
                    >
                      <p className="text-sm leading-relaxed text-ink-soft">{tip.body}</p>
                      {tip.norm && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded border border-oxide/20 bg-oxide/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-oxide">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="h-3 w-3"
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
          <div className="shrink-0 border-t border-rule bg-paper px-5 py-3">
            <p className="text-xs font-medium text-ink-soft">Wähle eine Komponente für passende Tipps.</p>
            <p className="mt-1 text-xs font-semibold text-signal">
              230-V-Anlagen müssen von einer Elektrofachkraft geprüft und angeschlossen werden.
            </p>
          </div>
        </div>
      )}

      {/* FAB Toggle Button — bewusst groß & auffällig („Fachwissen") */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            'group relative flex items-center gap-2.5 rounded border border-copper bg-ink py-3 pl-3 pr-4',
            'text-bone shadow-md',
            'hover:border-copper hover:bg-surface-raised hover:text-ink',
            'transition-colors duration-200'
          )}
          aria-label="Hilfe und Fachwissen öffnen"
          title="Hilfe und Fachwissen öffnen"
        >
          {/* Die Auswahl wird über den Text angekündigt – ohne ablenkende Daueranimation. */}
          <span className="relative flex h-8 w-8 items-center justify-center rounded border border-copper/40 bg-copper/10 transition-colors group-hover:bg-copper/15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </span>
          <span className="relative flex flex-col items-start text-left">
            <span className="text-sm font-black leading-tight">Hilfe &amp; Fachwissen</span>
            <span className="text-xs font-bold leading-tight text-paper/80">
              {selectedNodes.length > 0 ? 'Tipps für deine Auswahl' : 'Details und Normen'}
            </span>
          </span>

          {/* Notification dot */}
          {selectedNodes.length > 0 && (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-bone bg-oxide text-bone shadow-md"
              aria-hidden="true"
            >
              <Info size={12} strokeWidth={2.5} />
            </span>
          )}
        </button>
      )}
    </div>
  );
}
