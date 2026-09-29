'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  OctagonAlert,
  Info,
  ChevronDown,
  Check,
  Crosshair,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ValidationWarning, SEVERITY_ORDER } from '../hooks/useLiveValidation';

interface WarningCenterProps {
  warnings: ValidationWarning[];
  onFix?: (warning: ValidationWarning) => void;
}

const TYPE_STYLES: Record<
  ValidationWarning['type'],
  { badge: string; card: string; icon: React.ReactNode; label: string }
> = {
  critical: {
    badge: 'bg-warn-critical text-on-signal',
    card: 'bg-warn-critical-bg border-warn-critical',
    icon: <AlertTriangle className="h-5 w-5 shrink-0 text-warn-critical" />,
    label: 'Kritisch',
  },
  warning: {
    badge: 'bg-warn-warning text-on-signal',
    card: 'bg-warn-warning-bg border-warn-warning',
    icon: <AlertCircle className="h-5 w-5 shrink-0 text-warn-warning" />,
    label: 'Warnung',
  },
  info: {
    badge: 'bg-warn-info text-on-signal',
    card: 'bg-warn-info-bg border-warn-info',
    icon: <Info className="h-5 w-5 shrink-0 text-warn-info" />,
    label: 'Hinweis',
  },
};

// \p{Extended_Pictographic} erfasst alle Emoji inkl. Surrogate-Paare; die
// Separat-Bereiche der alten Klasse waren bei /g ohne /u fehleranfällig.
const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F]/gu;
function toPlainExplanation(message: string) {
  return message
    .replace(EMOJI_PATTERN, '')
    .replace(/^\s*(Kritisch|Hinweis|Warnung|Tipp)\s*:\s*/i, '')
    .trim();
}

/**
 * Befunde, die keine Verletzung melden, sondern eine **Lücke**: Sie sagen
 * „nicht geprüft“, nicht „kaputt“. Für sie ist die Folge-Zeile der Kategorie
 * falsch — der Prüfbericht zeigte bei „AC-Schutzorgan ohne Datenblatt“ und
 * „MPPT-Eingangsspannung nicht angegeben“ die Zeile „Folge: Reichweite,
 * Ladezeit oder Leistung können schlechter sein als erwartet.“ (Kategorie
 * `estimation`). Das ist die Folge eines falsch geschätzten Verbrauchs, nicht
 * die einer fehlenden Eingabe; die echte Folge ist, dass der Plan den Punkt
 * nicht bewertet hat — und das darf er nicht als „in Ordnung“ aussehen lassen
 * (Regel M: fehlende Eingabe ⇒ UNKNOWN, niemals PASS).
 *
 * Bewusst eine benannte Liste statt einer Muster-Heuristik: „missing-“
 * (Sicherung/FI fehlt) ist ein DEFEKT und behält seine Sicherheits-Folge,
 * „…-missing-…“ (Datenblattwert fehlt) dagegen ist eine Lücke.
 */
const UNVERIFIED_WARNING_PREFIXES = [
  'mixed-voltage-unknown',
  'solar-voc-window-unknown',
  'solar-voc-missing',
  'solar-voc-uncomputable',
  'ac-descriptor-assumed',
  'ac-protection-not-modeled',
  'ac-breaking-capacity-reach',
  'ac-missing-input-',
  'sc-bank-unknown',
  'sc-fuse-type-unknown',
];

export function isUnverifiedFinding(warning: ValidationWarning): boolean {
  // Engine-Befunde tragen die Aussage »nicht entscheidbar« ausdrücklich mit
  // sich (`unverified`); die Präfixliste bleibt für die Altbefunde, deren
  // Semantik an ihrer ID hing.
  return (
    warning.unverified === true || UNVERIFIED_WARNING_PREFIXES.some((prefix) => warning.id.startsWith(prefix))
  );
}

export function consequence(warning: ValidationWarning) {
  if (isUnverifiedFinding(warning))
    return 'Folge: Dieser Punkt ist ungeprüft — der Plan weist ihn weder als erfüllt noch als verletzt aus.';
  if (warning.category === 'safety')
    return 'Folge: Leitung oder Gerät kann überhitzen; bei 230 V besteht zusätzlich Stromschlaggefahr.';
  if (warning.category === 'topology')
    return 'Folge: Das System kann unvollständig sein oder nicht wie geplant funktionieren.';
  if (warning.category === 'monitoring')
    return 'Folge: Der Batteriestand wird falsch berechnet und ist nicht verlässlich.';
  return 'Folge: Reichweite, Ladezeit oder Leistung können schlechter sein als erwartet.';
}

/**
 * Messwert-Zeile ohne doppelte Einheit.
 *
 * Bis hierher hing die Warn-Zentrale `warning.unit` unbedingt an `measuredValue`
 * an. Die Melder schreiben die Einheit aber längst in den Wert selbst
 * („306 A“, „≈ 0,83 kA“, „70 mm²“) — auf dem Bildschirm stand dann
 * **„Ist: 306 A A“**, „Ist: LS C, 6 kA (Annahme) Ω“ oder „Ist: maxPvVoltage
 * fehlt V“. Dieselbe Doppelung betraf den Soll-Wert.
 *
 * `unit` bleibt damit, was die Dokumentation (UX-001) verspricht: das
 * maschinenlesbare Feld. Angehängt wird es in der Anzeige nur dann, wenn der
 * Wert wirklich eine nackte Zahl ist (optional mit „≈/≤/<“-Präfix) — bei
 * jedem beschreibenden Text („Voc fehlt“, „kein FI“) hätte ein Suffix keine
 * Bedeutung und war schlicht falsch.
 */
const MEASURED_NUMBER = /^[≈≤<>~+-]?\s*\d+(?:[.,]\d+)?\s*$/;

export function valueWithUnit(value: string | undefined, unit: string | undefined): string {
  if (value === undefined) return '—';
  if (!unit) return value;
  return MEASURED_NUMBER.test(value) ? `${value} ${unit}` : value;
}

export function nextStep(warning: ValidationWarning) {
  // Befunde der Verifikations-Engine bringen ihre Abhilfe mit: Sie kennen die
  // Zahlen (Querschnittsstufe, Nennstrom, Einbauort) und dürfen nicht von
  // einer zweiten, ID-basierten Textzuordnung überschrieben werden.
  if (warning.remedy) return `So löst du es: ${warning.remedy}`;
  if (warning.id.startsWith('missing-fuse'))
    return 'So löst du es: Füge am Anfang der Plusleitung eine passende Sicherung oder einen Sicherungskasten ein.';
  if (warning.id.startsWith('reversed-polarity'))
    return 'So löst du es: Trenne die Kante und verbinde Plus mit Plus sowie Minus mit Minus (Plus↔Minus ist nur zwischen verschiedenen Polaritäten zulässig).';
  if (warning.id.startsWith('inverter-missing-rcd'))
    return 'So löst du es: Setze am Wechselrichter-Ausgang einen FI/LS (RCD, ≤ 30 mA) — im Inspektor des Wechselrichters als vorhanden markieren, sobald verbaut.';
  if (warning.id.startsWith('battery-parallel-chemistry'))
    return 'So löst du es: Trenne die Parallelschaltung und verwende Batterien derselben Chemie (z. B. nur AGM oder nur Gel).';
  // Reihenfolge ist Semantik: Der UNBEKANNT-Fall (`…-window-unknown-…`) darf
  // nicht in den Ratschlag des Überschreitungsfalls fallen. Vorher tat er es
  // (`startsWith('solar-voc-window')` trifft beide) — die Warnung „maximale
  // PV-Eingangsspannung fehlt“ bekam damit die Anleitung „weniger Panels in
  // Serie“, obwohl dem Nutzer ein einziges Eingabefeld fehlte.
  // Der einzige Hinweis ohne eigene Vorgabe fiel in den Auffangtext
  // „Zeige die betroffene Stelle im Plan und ergänze die dort beschriebene
  // Komponente." — die Karte nannte das Feld (`battery.nominalVoltage`) und den
  // Inspektor bereits im Problemtext, die Abhilfe-Zeile wiederholte davon
  // nichts und blieb damit ohne Anweisung.
  if (warning.id.startsWith('mixed-voltage-unknown'))
    return 'So löst du es: Trage die Nennspannung (z. B. 12 V oder 24 V) im Inspektor jeder Batterie ein — ohne sie kann der Plan 12-V- und 24-V-Batterien nicht gegeneinander prüfen.';
  // Reihenfolge ist Semantik: `mixed-voltage-batteries` ist der DEFEKT
  // (kritisch), `mixed-voltage-unknown` die LÜCKE davor (info).
  if (warning.id.startsWith('mixed-voltage-batteries'))
    return 'So löst du es: Führe den Plan auf EINE Nennspannung — ist die Starterbatterie bewusst 12 V und die Aufbaubank 24 V, müssen beide galvanisch getrennt sein (z. B. über einen DC-DC-Ladebooster); diese Trennung gehört als Verbindung in den Plan.';
  if (warning.id.startsWith('solar-voc-window-unknown'))
    return 'So löst du es: Trage im Inspektor des Ladereglers die maximale PV-Eingangsspannung aus dem Datenblatt ein — erst dann wird das Kalt-Voc-Fenster bewertet.';
  if (warning.id.startsWith('solar-voc-window'))
    return 'So löst du es: Reduziere die Anzahl der Panels in Serie oder wähle einen Laderegler mit höherer maximaler PV-Eingangsspannung.';
  if (warning.id.startsWith('solar-voc-uncomputable'))
    return 'So löst du es: Korrigiere den Temperaturkoeffizienten Voc im Panel-Inspektor (für c-Si üblich: −0,20 bis −0,50 %/K).';
  // Die Dimensionierungsgrenze des Modells ist 70 mm² (VDE_SIZES) mit 100 A.
  // Der frühere Text („den nächsten Normquerschnitt über 70 mm² wählen“)
  // verwies auf eine Stufe, die es hier nicht gibt — der Nutzer suchte sie.
  if (warning.id.startsWith('thermal-overload'))
    return 'So löst du es: Last reduzieren, die Leitung parallel verlegen (gleiche Länge, gleicher Querschnitt) oder die Systemspannung erhöhen — oberhalb von 70 mm² kennt der Planer keinen Normquerschnitt.';
  if (warning.id.startsWith('fuse-not-possible'))
    return 'So löst du es: Last aufteilen (eigene Leitung je Großverbraucher), Parallelverlegung oder Sammelschiene planen oder die Systemspannung erhöhen (12 V → 24/48 V).';
  if (warning.id.startsWith('cross-section-undersized'))
    return 'So löst du es: Querschnitt im Leitungs-Inspektor auf den geforderten Wert anheben oder die Leitung kürzen (der Spannungsfall hängt an der Länge).';
  if (warning.id.startsWith('drop-not-solvable'))
    return 'So löst du es: Weg kürzen oder Last aufteilen — bei 12 V ist der Spannungsfall-Bedarf hier größer als die Normreihe bis 70 mm² hergibt (24/48 V planen).';
  if (warning.id.startsWith('ac-descriptor-assumed') || warning.id.startsWith('ac-protection-not-modeled'))
    return 'So löst du es: Bauform (LS oder FI/LS), Charakteristik (B/C) und Abschaltvermögen des Schutzorgans im Leitungs-Inspektor eintragen — dann prüft der Plan gegen das echte Gerät statt gegen eine Annahme.';
  if (warning.id.startsWith('solar-voc-missing'))
    return 'So löst du es: Trage im Panel-Inspektor die Leerlaufspannung (Voc) aus dem Datenblatt ein — erst dann kann das Regler-Fenster geprüft werden.';
  if (warning.id === 'solar-overload')
    return 'So löst du es: Wähle einen Solar-Laderegler mit höherem zulässigem Ladestrom oder reduziere die Solarleistung.';
  if (warning.id === 'battery-capacity')
    return 'So löst du es: Reduziere tägliche Nutzungszeiten, ergänze Solarleistung oder plane mehr nutzbare Batteriekapazität.';
  if (warning.id.includes('inverter-no-minus'))
    return 'So löst du es: Verbinde den Minusanschluss des Wechselrichters mit der Minus-Sammelschiene.';
  if (warning.id.includes('inverter-unprotected'))
    return 'So löst du es: Setze eine eigene passende Sicherung in die Plusleitung zum Wechselrichter.';
  if (warning.id.includes('dcdc-unconnected'))
    return 'So löst du es: Verbinde Eingang mit der Starterseite und Ausgang mit dem abgesicherten Pfad zur Aufbaubatterie.';
  if (warning.id.includes('shunt-bypass'))
    return 'So löst du es: Führe alle Minusleitungen der Aufbaubatterie über den Shunt.';
  if (warning.id.includes('rcd-'))
    return 'So löst du es: Lass einen zweipoligen FI/LS-Schutz durch eine Elektrofachkraft einplanen.';
  return 'So löst du es: Zeige die betroffene Stelle im Plan und ergänze die dort beschriebene Komponente.';
}

export function WarningCenter({ warnings, onFix }: WarningCenterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sorted = useMemo(
    () => [...warnings].sort((a, b) => SEVERITY_ORDER[a.type] - SEVERITY_ORDER[b.type]),
    [warnings]
  );
  const counts = useMemo(() => {
    const value = { critical: 0, warning: 0, info: 0 };
    warnings.forEach((warning) => value[warning.type]++);
    return value;
  }, [warnings]);

  useEffect(() => {
    const openPanel = () => setOpen(true);
    window.addEventListener('open-warning-center', openPanel);
    return () => window.removeEventListener('open-warning-center', openPanel);
  }, []);

  // AUDIT T1 (react-hooks/set-state-in-effect): „Keine Warnungen -> Popover zu“
  // zur Render-Zeit statt in einem zweiten Commit.
  const [syncedWarningCount, setSyncedWarningCount] = useState(warnings.length);
  if (syncedWarningCount !== warnings.length) {
    setSyncedWarningCount(warnings.length);
    if (warnings.length === 0) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // A6 (Screenreader): Die Live-Region steht VOR den Verzweigungen. Vorher
  // mountete sie erst hinter dem Early-Return für „keine Hinweise“ — ein neu
  // hinzugekommener kritischer Warnhinweis wurde dadurch nie angesagt, weil
  // der Knoten mit seinem Inhalt zusammen erschien statt seinen Inhalt zu
  // wechseln.
  const liveRegion = (
    <span className="sr-only" role="status" aria-live="polite">
      {warnings.length === 0
        ? 'Keine Prüfhinweise im Plan.'
        : `${warnings.length} Prüfhinweise im Plan${
            counts.critical > 0 ? `, davon ${counts.critical} kritisch` : ''
          }.`}
    </span>
  );

  if (warnings.length === 0) {
    return (
      <>
        {liveRegion}
        <span className="hidden min-h-11 items-center gap-1 rounded border border-moss bg-moss/10 px-3 text-xs font-semibold text-moss md:inline-flex">
          <Check className="h-4 w-4" />
          Keine Hinweise
        </span>
      </>
    );
  }

  const topType: ValidationWarning['type'] =
    counts.critical > 0 ? 'critical' : counts.warning > 0 ? 'warning' : 'info';

  /**
   * A5 (Schwere ohne Farbe) bleibt: Die Schwere steht als Wort da.
   *
   * Neu ist, dass die Zahl davor nicht mehr lügt. Vorher stand im Abzeichen
   * `warnings.length` mit dem Wort der schwersten Stufe — bei 18 Hinweisen und
   * 14 kritischen las man **„18 Kritisch“**, während die Leiste darunter
   * „14 kritische Probleme offen“ sagte. Zwei Zahlen für dieselbe Eigenschaft,
   * beide als „kritisch“ beschriftet. Jetzt nennt das Abzeichen die kritische
   * Zahl und dahinter die Gesamtzahl, und nur wenn nichts kritisch ist, steht
   * dort die Gesamtzahl mit der Schwere-Wortwahl der schwersten Stufe.
   */
  const badgeLabel =
    counts.critical > 0
      ? warnings.length > counts.critical
        ? `${counts.critical} von ${warnings.length} kritisch`
        : `${counts.critical} kritisch`
      : topType === 'warning'
        ? warnings.length === 1
          ? '1 Warnung'
          : `${warnings.length} Warnungen`
        : warnings.length === 1
          ? '1 Hinweis'
          : `${warnings.length} Hinweise`;

  return (
    <div className="relative" ref={containerRef}>
      {liveRegion}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${warnings.length} Prüfhinweise anzeigen${
          counts.critical > 0 ? `, davon ${counts.critical} kritisch` : ''
        }`}
        className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${TYPE_STYLES[topType].badge}`}
      >
        {topType === 'critical' ? (
          <OctagonAlert className="h-4 w-4" aria-hidden="true" />
        ) : topType === 'warning' ? (
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Info className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="whitespace-nowrap">{badgeLabel}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="absolute right-0 top-full z-50 mt-2 max-h-96 w-11/12 min-w-80 max-w-md overflow-y-auto rounded border border-border bg-card shadow-2xl focus:outline-none sm:w-96"
          role="dialog"
          aria-label="Prüfhinweise für deine Anlage"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Prüfung deiner Anlage</h3>
              <p className="text-xs text-muted-foreground">Kritische Punkte stehen zuerst.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Prüfhinweise schließen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ul className="flex flex-col gap-3 p-3">
            {sorted.map((warning) => {
              const style = TYPE_STYLES[warning.type];
              return (
                <li key={warning.id} className={`rounded-lg border-l-4 p-3 ${style.card}`}>
                  <div className="flex items-start gap-2">
                    {style.icon}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{warning.title || style.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                        <strong>Problem:</strong> {toPlainExplanation(warning.message)}
                      </p>
                      {(warning.measuredValue !== undefined || warning.expectedValue !== undefined) && (
                        <p className="mt-1 font-mono text-xs leading-relaxed text-ink-soft">
                          Ist: {valueWithUnit(warning.measuredValue, warning.unit)}
                          {' · Soll: '}
                          {valueWithUnit(warning.expectedValue, warning.unit)}
                          {warning.source ? ` · Regel: ${warning.source}` : ''}
                        </p>
                      )}
                      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{consequence(warning)}</p>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-foreground">
                        {nextStep(warning)}
                      </p>
                      {warning.focusId && onFix && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            onFix(warning);
                            setOpen(false);
                          }}
                          className="mt-3 min-h-11 gap-1.5 bg-card text-sm"
                        >
                          <Crosshair className="h-4 w-4" />
                          Im Plan zeigen
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
