import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { usePlannerStore } from '../../store/usePlannerStore';
import { ClipboardCopy } from 'lucide-react';
import { getComponentSpec } from '../registry';
import { calculateCrossSection } from '../../lib/electrical';
import { calculateEdgeCurrent, getSystemVoltage } from '../../lib/vde-standards';
import { getCableRoute } from '../edges/utils/cableRouteStore';
import { PX_PER_METER } from '../../lib/units';

/** Woher eine Stücklisten-Länge kommt (AUDIT L1). */
type LengthSource = 'stored' | 'routed' | 'fallback';

type EdgeLength = {
  /** Für den Materialbedarf verwendete Länge in Metern. */
  meters: number;
  /** Quelle dieser Länge — die Stückliste muss sie nennen können. */
  source: LengthSource;
  /** Eingetragene Länge, falls eine vorhanden ist. */
  storedM?: number;
  /** Geroutete Verlegelänge, falls für die Kante eine Route vorliegt. */
  routedM?: number;
};

/**
 * Ab welcher relativen Abweichung zwei Längenquellen als widersprüchlich
 * gelten. 10 % deckt Rundung und kleine Maßunterschiede ab; darüber ist es
 * ein echter Widerspruch zwischen Planzeichnung und Eintrag.
 */
const LENGTH_DIVERGENCE_TOLERANCE = 0.1;

/**
 * R1/L1: Kabellänge einer Kante für die Stückliste.
 *
 * Vorher galt „eingetragener Wert zuerst, sonst geroutete Länge" — und genau
 * diese Reihenfolge unterschätzte den Materialbedarf systematisch:
 * AutoWire trägt als Länge die **Luftlinie** aus der Knotengeometrie ein
 * (Issue 6), der Router kennt dagegen den tatsächlichen Verlegeweg inklusive
 * aller Umwege. Im Referenzplan `camper` standen 22,10 m eingetragen gegen
 * 38,05 m geroutet — Faktor 1,72. Die Stückliste nannte die kleinere Zahl und
 * schwieg darüber, dass eine zweite, größere bekannt war (AUDIT L1).
 *
 * Jetzt: liegen BEIDE Quellen vor, zählt die größere (Material wird zu kurz
 * bestellt, nicht zu lang), und die Abweichung wird als Widerspruch gemeldet.
 * Fehlt beides, bleibt die Platzhalterlänge — aber ausdrücklich als das, was
 * sie ist: erfunden. Wasserstrecken haben nur dann eine Route, wenn der
 * Wasser-Plan zuletzt im Vordergrund geroutet wurde (geteilter Route-Store).
 */
function edgeLengthOf(edgeId: string, stored: number | undefined, fallback: number): EdgeLength {
  const storedM = typeof stored === 'number' && Number.isFinite(stored) && stored >= 0 ? stored : undefined;
  const route = getCableRoute(edgeId);
  const routedM = route ? route.length / PX_PER_METER : undefined;

  if (storedM !== undefined && routedM !== undefined) {
    return {
      meters: Math.max(storedM, routedM),
      source: storedM >= routedM ? 'stored' : 'routed',
      storedM,
      routedM,
    };
  }
  if (storedM !== undefined) return { meters: storedM, source: 'stored', storedM };
  if (routedM !== undefined) return { meters: routedM, source: 'routed', routedM };
  return { meters: fallback, source: 'fallback' };
}

/** Zwei Längenquellen widersprechen sich messbar? */
function diverges(length: EdgeLength): boolean {
  if (length.storedM === undefined || length.routedM === undefined) return false;
  const larger = Math.max(length.storedM, length.routedM);
  if (larger === 0) return false;
  const smaller = Math.min(length.storedM, length.routedM);
  return (larger - smaller) / larger > LENGTH_DIVERGENCE_TOLERANCE;
}

/** Eine Längen-Annahme, die die Stückliste dem Nutzer schuldet. */
type LengthAssumption = {
  /** Betroffene Strecke (Klartext, z. B. „Batterie → Sicherungskasten"). */
  label: string;
  /** Verwendete Länge in Metern. */
  meters: number;
  source: LengthSource;
  /** Eingetragen, falls abweichend vom verwendeten Wert. */
  storedM?: number;
  /** Geroutet, falls abweichend vom verwendeten Wert. */
  routedM?: number;
};

type BomData = {
  counts: Record<string, number>;
  cableLengths: Record<string, number>;
  pipeLengths: Record<string, number>;
  /** Längen, die nicht aus dem Plan selbst stammen oder sich widersprechen. */
  lengthAssumptions: LengthAssumption[];
};

/**
 * Bauteil-Bezeichnungen kommen aus der Registry (K4).
 *
 * Vorher stand hier eine zweite Label-Tabelle — sie war bereits von der
 * Sidebar abgewichen („Batteriemonitor mit Shunt“ vs. „Batteriemonitor
 * (Shunt)“). Unbekannte Typen (z. B. aus einem alten gespeicherten Plan)
 * bekommen einen ehrlichen Platzhalter statt `undefined`.
 */
function typeInfo(type: string): { label: string; purpose: string } {
  const spec = getComponentSpec(type);
  if (spec) return { label: spec.label, purpose: spec.purpose };
  return { label: type, purpose: 'Unbekannter Bauteiltyp aus einem älteren Plan.' };
}

export function BOMModal() {
  const [open, setOpen] = useState(false);
  const [bomData, setBomData] = useState<BomData>({
    counts: {},
    cableLengths: {},
    pipeLengths: {},
    lengthAssumptions: [],
  });
  // AUDIT T1 (react-hooks/immutability): Beide Zustände stehen über dem Effekt,
  // der sie liest und schreibt — vorher stand der Effekt vor den Deklarationen.
  const [copied, setCopied] = useState(false);
  // M6-4: Ein stiller catch warf den Fehler weg; Nutzer sahen nur "kein Effekt".
  // Die Fehlerursache bleibt erhalten (console.warn für Diagnose), sichtbar
  // gemacht wird eine handlungsorientierte Meldung im Dialog selbst.
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    const handleShowBom = () => {
      const { nodes, edges, waterNodes, waterEdges } = usePlannerStore.getState();
      const counts: Record<string, number> = {};
      [...nodes, ...waterNodes].forEach((node) => {
        if (node.type) counts[node.type] = (counts[node.type] || 0) + 1;
      });
      const cableLengths: Record<string, number> = {};
      const nodesMap = new Map(nodes.map((n) => [n.id, n]));
      const sysVoltage = getSystemVoltage(nodes);
      // AUDIT L1: Längen, die erfunden sind oder sich widersprechen, werden
      // gesammelt und angezeigt — eine Stückliste, die eine Zahl nennt, ohne
      // ihre Quelle zu kennen, ist eine Bestellvorlage für zu kurzes Kabel.
      const lengthAssumptions: LengthAssumption[] = [];
      const labelOf = (id: string): string => {
        const data = nodesMap.get(id)?.data;
        return typeof data?.label === 'string' && data.label !== '' ? data.label : id;
      };

      edges.forEach((edge) => {
        const s = nodesMap.get(edge.source);
        const t = nodesMap.get(edge.target);
        const isAc = edge.data?.edgeDomain === 'AC_230V';
        let cs = edge.data?.crossSection;
        const length = edgeLengthOf(edge.id, edge.data?.length, 1);
        if (!cs) {
          if (isAc) {
            cs = 2.5;
          } else {
            const I = calculateEdgeCurrent(s, t, nodes, sysVoltage, edges); // ELE-005: Insel-BFS
            cs = calculateCrossSection(I, length.meters, undefined, 'DC_12V');
          }
        }
        const crossSection = String(cs || 2.5);
        cableLengths[crossSection] = (cableLengths[crossSection] || 0) + length.meters;
        if (length.source === 'fallback' || diverges(length)) {
          lengthAssumptions.push({
            label: `${labelOf(edge.source)} → ${labelOf(edge.target)}`,
            meters: length.meters,
            source: length.source,
            storedM: length.storedM,
            routedM: length.routedM,
          });
        }
      });
      const pipeLengths: Record<string, number> = {};
      waterEdges.forEach((edge) => {
        const type = String(edge.data?.pipeType || 'fresh');
        const length = edgeLengthOf(edge.id, edge.data?.length, 2);
        pipeLengths[type] = (pipeLengths[type] || 0) + length.meters;
        if (length.source === 'fallback' || diverges(length)) {
          lengthAssumptions.push({
            label: `${type === 'gray' ? 'Abwasser' : 'Frischwasser'} ${edge.source} → ${edge.target}`,
            meters: length.meters,
            source: length.source,
            storedM: length.storedM,
            routedM: length.routedM,
          });
        }
      });
      setBomData({ counts, cableLengths, pipeLengths, lengthAssumptions });
      setCopied(false);
      setCopyError(null);
      setOpen(true);
    };
    window.addEventListener('show-bom-modal', handleShowBom);
    return () => window.removeEventListener('show-bom-modal', handleShowBom);
  }, []);

  const componentEntries = useMemo(() => Object.entries(bomData.counts), [bomData.counts]);
  const cableEntries = useMemo(() => Object.entries(bomData.cableLengths), [bomData.cableLengths]);
  const pipeEntries = useMemo(() => Object.entries(bomData.pipeLengths), [bomData.pipeLengths]);
  const lengthAssumptions = bomData.lengthAssumptions;
  const inventedLengths = lengthAssumptions.filter((entry) => entry.source === 'fallback');
  const divergingLengths = lengthAssumptions.filter((entry) => entry.source !== 'fallback');
  const empty = componentEntries.length === 0 && cableEntries.length === 0 && pipeEntries.length === 0;

  // BOM als JSON für die Zwischenablage.
  const bomJson = useMemo(() => {
    const cables = cableEntries.map(([crossSection, length]) => ({
      crossSection: Number(crossSection),
      length: Number(length.toFixed(1)),
    }));
    const components = componentEntries.map(([type, count]) => ({ type, count }));
    // Die Längen-Annahmen reisen mit: Wer die Liste weiterverarbeitet (Shop,
    // Excel, Kollege), sieht dieselbe Einschränkung wie im Dialog.
    const assumptions = bomData.lengthAssumptions.map((entry) => ({
      route: entry.label,
      usedMeters: Number(entry.meters.toFixed(1)),
      source: entry.source,
      ...(entry.storedM !== undefined ? { storedMeters: Number(entry.storedM.toFixed(1)) } : {}),
      ...(entry.routedM !== undefined ? { routedMeters: Number(entry.routedM.toFixed(1)) } : {}),
    }));
    return JSON.stringify(
      { cables, components, ...(assumptions.length > 0 ? { lengthAssumptions: assumptions } : {}) },
      null,
      2
    );
  }, [cableEntries, componentEntries, bomData.lengthAssumptions]);

  // Kopiert die Stückliste als JSON in die Zwischenablage — ohne jeden Bezug
  // zu einem entfernten KI-Chat (der im Static-Export nicht existiert, R1).
  const copyBomToClipboard = async () => {
    const message = `Stückliste aus dem Schaltplan:\n\n\`\`\`json\n${bomJson}\n\`\`\``;
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API steht in diesem Browser/Kontext nicht zur Verfügung.');
      }
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setCopyError(null);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      setCopied(false);
      setCopyError(
        'Kopieren nicht möglich – der Browser hat den Zugriff abgelehnt oder die Seite ist unsicher.'
      );
      console.warn('[BOMModal] Zwischenablage-Zugriff fehlgeschlagen:', error);
    }
  };

  return (
    <AccessibleDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Stückliste"
      description="Das brauchst du für den aktuellen Plan. Verwendet wird je Strecke die größere aus eingetragener und gerouteter Länge (der Router kennt Umwege, eine Luftlinie unterschätzt). Abweichungen und fehlende Längen stehen unten ausdrücklich – rechne für die Montage trotzdem eine Reserve hinzu."
      className="max-w-2xl"
    >
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {empty ? (
          <div className="rounded-lg border border-border bg-accent p-6 text-center">
            <p className="font-semibold">Dein Plan ist noch leer.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Füge zuerst Komponenten hinzu; danach entsteht hier deine Einkaufsliste.
            </p>
          </div>
        ) : (
          <>
            {componentEntries.length > 0 && (
              <section aria-labelledby="bom-components">
                <h3 id="bom-components" className="mb-2 font-semibold">
                  Bauteile
                </h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {componentEntries.map(([type, count]) => {
                    const info = typeInfo(type);
                    return (
                      <li key={type} className="flex gap-3 p-3">
                        <span className="min-w-10 font-mono font-bold">{count} ×</span>
                        <span>
                          <strong>{info.label}</strong>
                          <span className="block text-sm text-muted-foreground">{info.purpose}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {cableEntries.length > 0 && (
              <section aria-labelledby="bom-cables">
                <h3 id="bom-cables" className="mb-2 font-semibold">
                  Elektrische Leitungen
                </h3>
                <ul className="space-y-2 rounded-lg border border-border p-3">
                  {cableEntries.map(([crossSection, length]) => (
                    <li key={crossSection}>
                      <strong>
                        {length.toFixed(1)} m Kabel mit {crossSection} mm²
                      </strong>
                      <span className="block text-sm text-muted-foreground">
                        Für die im Plan verbundenen Stromkreise; Montageweg und Reserve vor Kauf prüfen.
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {pipeEntries.length > 0 && (
              <section aria-labelledby="bom-pipes">
                <h3 id="bom-pipes" className="mb-2 font-semibold">
                  Wasserleitungen
                </h3>
                <ul className="space-y-2 rounded-lg border border-border p-3">
                  {pipeEntries.map(([type, length]) => (
                    <li key={type}>
                      <strong>
                        {length.toFixed(1)} m {type === 'gray' ? 'Abwasserrohr' : 'Frischwasserrohr'}
                      </strong>
                      <span className="block text-sm text-muted-foreground">
                        Durchmesser, Anschlüsse und Reserve passend zu deinen Bauteilen ergänzen.
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* AUDIT L1: Längen, deren Quelle nicht der Plan selbst ist. */}
            {lengthAssumptions.length > 0 && (
              <section aria-labelledby="bom-lengths" className="warn-card warn-card-warning p-3">
                <h3 id="bom-lengths" className="mb-1 font-semibold">
                  {inventedLengths.length > 0 && divergingLengths.length > 0
                    ? 'Längen weichen ab oder fehlen'
                    : inventedLengths.length > 0
                      ? 'Längen fehlen im Plan'
                      : 'Eingetragene und geroutete Länge weichen ab'}
                </h3>
                {inventedLengths.length > 0 && (
                  <p className="text-sm">
                    Für {inventedLengths.length} {inventedLengths.length === 1 ? 'Strecke' : 'Strecken'} liegt
                    weder ein Längeneintrag noch eine Route vor. Gerechnet wurde mit einer Platzhalterlänge —
                    das ist eine Annahme, keine Messung:
                  </p>
                )}
                {divergingLengths.length > 0 && (
                  <p className="mt-1 text-sm">
                    Bei {divergingLengths.length} {divergingLengths.length === 1 ? 'Strecke' : 'Strecken'}
                    widersprechen sich eingetragene Länge und gerouteter Verlegeweg um mehr als{' '}
                    {Math.round(LENGTH_DIVERGENCE_TOLERANCE * 100)} %. Verwendet wurde jeweils die größere
                    Länge, damit das Material nicht zu knapp bestellt wird.
                  </p>
                )}
                <ul className="mt-2 space-y-1 text-sm">
                  {lengthAssumptions.slice(0, 8).map((entry) => (
                    <li key={`${entry.label}-${entry.source}`}>
                      <span className="font-medium">{entry.label}</span>:{' '}
                      {entry.source === 'fallback' ? (
                        <>
                          {entry.meters.toFixed(1)} m{' '}
                          <em>(Platzhalter — Länge im Leitungs-Inspektor eintragen)</em>
                        </>
                      ) : (
                        <>
                          {entry.meters.toFixed(1)} m verwendet (eingetragen {entry.storedM?.toFixed(1)} m,
                          geroutet {entry.routedM?.toFixed(1)} m)
                        </>
                      )}
                    </li>
                  ))}
                  {lengthAssumptions.length > 8 && (
                    <li className="text-muted-foreground">
                      … und {lengthAssumptions.length - 8} weitere (vollständig in der kopierten JSON-Liste).
                    </li>
                  )}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-4">
        {copyError && (
          <div role="alert" className="warn-card warn-card-warning p-3 text-sm">
            <p className="font-semibold">{copyError}</p>
            <label htmlFor="bom-json-fallback" className="mt-2 block text-xs text-muted-foreground">
              Alternativ zum manuellen Kopieren (bereits vorausgewählt):
            </label>
            <textarea
              id="bom-json-fallback"
              readOnly
              value={`Stückliste aus dem Schaltplan:\n${bomJson}`}
              rows={4}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 w-full rounded border border-border bg-card p-2 font-mono text-xs"
            />
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            // AUDIT T1: copyBomToClipboard meldet Fehlschläge selbst über
            // `copyError` im Dialog; `void` markiert das bewusste
            // Nicht-Abwarten (no-misused-promises).
            onClick={() => {
              void copyBomToClipboard();
            }}
            disabled={empty}
            className="min-h-11 gap-2"
          >
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
            {copied ? 'Kopiert!' : 'Stückliste kopieren'}
          </Button>
          <Button onClick={() => setOpen(false)} className="min-h-11 flex-1">
            Schließen
          </Button>
        </div>
      </div>
    </AccessibleDialog>
  );
}
