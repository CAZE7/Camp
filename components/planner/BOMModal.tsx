import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { usePlannerStore } from '../../store/usePlannerStore';
import { ClipboardCopy } from 'lucide-react';
import { getComponentSpec } from '../registry';
import { calculateCrossSection } from '../../lib/electrical';
import { calculateEdgeCurrent, getSystemVoltage } from '../../lib/vde-standards';

type BomData = {
  counts: Record<string, number>;
  cableLengths: Record<string, number>;
  pipeLengths: Record<string, number>;
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
  const [bomData, setBomData] = useState<BomData>({ counts: {}, cableLengths: {}, pipeLengths: {} });

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
      edges.forEach((edge) => {
        const s = nodesMap.get(edge.source);
        const t = nodesMap.get(edge.target);
        const isAc = edge.data?.edgeDomain === 'AC_230V';
        let cs = edge.data?.crossSection;
        if (!cs) {
          if (isAc) {
            cs = 2.5;
          } else {
            const I = calculateEdgeCurrent(s, t, nodes, sysVoltage);
            const len = edge.data?.length || 1;
            cs = calculateCrossSection(I, len, undefined, 'DC_12V');
          }
        }
        const crossSection = String(cs || 2.5);
        cableLengths[crossSection] = (cableLengths[crossSection] || 0) + (edge.data?.length || 1);
      });
      const pipeLengths: Record<string, number> = {};
      waterEdges.forEach((edge) => {
        const type = String(edge.data?.pipeType || 'fresh');
        pipeLengths[type] = (pipeLengths[type] || 0) + (edge.data?.length || 2);
      });
      setBomData({ counts, cableLengths, pipeLengths });
      setOpen(true);
    };
    window.addEventListener('show-bom-modal', handleShowBom);
    return () => window.removeEventListener('show-bom-modal', handleShowBom);
  }, []);

  const componentEntries = useMemo(() => Object.entries(bomData.counts), [bomData.counts]);
  const cableEntries = useMemo(() => Object.entries(bomData.cableLengths), [bomData.cableLengths]);
  const pipeEntries = useMemo(() => Object.entries(bomData.pipeLengths), [bomData.pipeLengths]);
  const empty = componentEntries.length === 0 && cableEntries.length === 0 && pipeEntries.length === 0;

  // BOM als JSON für die Zwischenablage.
  const bomJson = useMemo(() => {
    const cables = cableEntries.map(([crossSection, length]) => ({
      crossSection: Number(crossSection),
      length: Number(length.toFixed(1)),
    }));
    const components = componentEntries.map(([type, count]) => ({ type, count }));
    return JSON.stringify({ cables, components }, null, 2);
  }, [cableEntries, componentEntries]);

  const [copied, setCopied] = useState(false);
  // Kopiert die Stückliste als JSON in die Zwischenablage — ohne jeden Bezug
  // zu einem entfernten KI-Chat (der im Static-Export nicht existiert, R1).
  const copyBomToClipboard = async () => {
    const message = `Stückliste aus dem Schaltplan:\n\n\`\`\`json\n${bomJson}\n\`\`\``;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AccessibleDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Stückliste"
      description="Das brauchst du für den aktuellen Plan. Längen sind Planwerte – rechne für die Montage eine Reserve hinzu."
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
          </>
        )}
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row">
        <Button variant="outline" onClick={copyBomToClipboard} disabled={empty} className="min-h-11 gap-2">
          <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
          {copied ? 'Kopiert!' : 'Stückliste kopieren'}
        </Button>
        <Button onClick={() => setOpen(false)} className="min-h-11 flex-1">
          Schließen
        </Button>
      </div>
    </AccessibleDialog>
  );
}
