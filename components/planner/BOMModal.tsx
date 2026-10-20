import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccessibleDialog } from '@/components/ui/AccessibleDialog';
import { usePlannerStore } from '../../store/usePlannerStore';
import { ClipboardCopy, FileSpreadsheet, Printer } from 'lucide-react';
import {
  verificationReportFor,
  verificationSummary,
  type VerificationSummary,
} from './utils/verificationWarnings';
import { assessRelease, type ReleaseAssessment } from './utils/releaseStatus';
import {
  buildBom,
  bomToCsv,
  bomToJson,
  LENGTH_DIVERGENCE_TOLERANCE,
  componentTypeInfo,
  type BomData,
  type LengthAssumption,
} from './utils/bom';
import { downloadTextFile } from './utils/fileIO';
import { buildPrintReportHtml, openPrintReport } from './utils/printReport';
import { subscribeToBomModalOpen } from './utils/bomModalEvents';

/**
 * Stückliste — Dialog. Die Berechnung liegt in `utils/bom.ts` (eine Quelle für
 * Anzeige, JSON und CSV); die Freigabe in `utils/releaseStatus.ts`. Dieser
 * Dialog rechnet nichts selbst.
 *
 * Alle Daten stammen aus EINEM Snapshot beim Öffnen: Stückliste, Prüfbericht
 * und Planstand-Fingerprint beziehen sich auf denselben Plan.
 */

interface BomSnapshot {
  bom: BomData;
  assessment: ReleaseAssessment;
  componentCount: number;
  summary: VerificationSummary | null;
}

const EMPTY_BOM: BomData = { counts: {}, cableLengths: {}, pipeLengths: {}, lengthAssumptions: [] };

export function BOMModal() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<BomSnapshot | null>(null);
  const bomData = snapshot?.bom ?? EMPTY_BOM;
  // AUDIT T1 (react-hooks/immutability): Zustände stehen über dem Effekt.
  const [copied, setCopied] = useState(false);
  // M6-4: Fehlerursache sichtbar machen statt stillem catch.
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    const handleShowBom = () => {
      const { nodes, edges, waterNodes, waterEdges } = usePlannerStore.getState();
      const bom = buildBom({ nodes, edges, waterNodes, waterEdges });
      const report = verificationReportFor(nodes, edges);
      const summary = verificationSummary(report);
      const componentCount = nodes.length + waterNodes.length;
      const assessment = assessRelease(componentCount > 0 ? summary : null, componentCount);
      setSnapshot({ bom, assessment, componentCount, summary: componentCount > 0 ? summary : null });
      setCopied(false);
      setCopyError(null);
      setOpen(true);
    };
    return subscribeToBomModalOpen(handleShowBom);
  }, []);

  const componentEntries = useMemo(() => Object.entries(bomData.counts), [bomData.counts]);
  const cableEntries = useMemo(() => Object.entries(bomData.cableLengths), [bomData.cableLengths]);
  const pipeEntries = useMemo(() => Object.entries(bomData.pipeLengths), [bomData.pipeLengths]);
  const lengthAssumptions: LengthAssumption[] = bomData.lengthAssumptions;
  const inventedLengths = lengthAssumptions.filter((entry) => entry.source === 'fallback');
  const divergingLengths = lengthAssumptions.filter((entry) => entry.source !== 'fallback');
  const empty = componentEntries.length === 0 && cableEntries.length === 0 && pipeEntries.length === 0;
  const assessment = snapshot?.assessment ?? null;
  const planFingerprint = assessment?.planFingerprintHash ?? 'kein-planstand';

  const bomJson = useMemo(() => bomToJson(bomData), [bomData]);

  const exportCsv = () => {
    if (!assessment?.canExportDocument) return;
    const csv = bomToCsv(bomData, {
      planFingerprint,
      documentStatus: assessment.label,
    });
    downloadTextFile(`stueckliste-${planFingerprint.slice(0, 8)}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const printReport = () => {
    if (!snapshot || !assessment?.canExportDocument) return;
    const html = buildPrintReportHtml({
      bom: snapshot.bom,
      summary: snapshot.summary,
      assessment,
      generatedAt: new Date().toISOString(),
      projectName: 'Camper-Elektroplaner',
    });
    if (!openPrintReport(html)) {
      setCopyError(
        'Der Druckbericht konnte nicht geöffnet werden – der Browser blockiert vermutlich Pop-ups. Erlaube Pop-ups für diese Seite und versuche es erneut.'
      );
    }
  };

  // Kopiert die Stückliste als JSON in die Zwischenablage.
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
      description="Das brauchst du für den aktuellen Plan. Verwendet wird deine eingetragene Länge; nur wo keine eingetragen ist, zählt der geroutete Weg (100 px im Plan = 1 m) oder eine ausdrücklich benannte Annahme. Abweichungen und fehlende Längen stehen unten – rechne für die Montage trotzdem eine Reserve hinzu."
      className="min-h-0 min-w-0 max-w-2xl"
    >
      <div
        data-testid="bom-scroll-body"
        className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden p-4 sm:p-5"
      >
        {assessment && (
          <section
            aria-labelledby="bom-status"
            data-testid="bom-release-status"
            data-status={assessment.status}
            className={`min-w-0 break-words rounded-lg border p-3 ${assessment.status === 'gesperrt' ? 'warn-card warn-card-critical flex-col' : 'border-border'}`}
          >
            <h3 id="bom-status" className="font-semibold">
              Dokumentstatus: {assessment.label}
            </h3>
            <p className="mt-1 text-sm">{assessment.explanation}</p>
            {assessment.blockers.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" data-testid="bom-blockers">
                {assessment.blockers.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </section>
        )}
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
                    const info = componentTypeInfo(type);
                    return (
                      <li key={type} className="flex min-w-0 gap-3 p-3">
                        <span className="min-w-10 shrink-0 font-mono font-bold">{count} ×</span>
                        <span className="min-w-0 break-words">
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
              <section
                aria-labelledby="bom-lengths"
                className="warn-card warn-card-warning min-w-0 flex-col p-3"
              >
                <h3 id="bom-lengths" className="mb-1 font-semibold">
                  {inventedLengths.length > 0 && divergingLengths.length > 0
                    ? 'Längen weichen ab oder fehlen'
                    : inventedLengths.length > 0
                      ? 'Längen fehlen im Plan'
                      : divergingLengths.every((entry) => entry.source === 'assumed')
                        ? 'Planungsannahmen und geroutete Länge weichen ab'
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
                    Bei {divergingLengths.length} {divergingLengths.length === 1 ? 'Strecke' : 'Strecken'}{' '}
                    widersprechen sich eingetragene Länge und gerouteter Verlegeweg um mehr als{' '}
                    {Math.round(LENGTH_DIVERGENCE_TOLERANCE * 100)} %. Verwendet wurde deine eingetragene
                    Länge (bei reinen Planungsannahmen die größere, damit nichts zu knapp wird).
                  </p>
                )}
                <ul className="mt-2 min-w-0 space-y-1 break-words text-sm">
                  {lengthAssumptions.slice(0, 8).map((entry) => (
                    <li key={`${entry.label}-${entry.source}`} className="min-w-0 break-words">
                      <span className="font-medium">{entry.label}</span>:{' '}
                      {entry.source === 'fallback' ? (
                        <>
                          {entry.meters.toFixed(1)} m{' '}
                          <em>(Platzhalter — Länge im Leitungs-Inspektor eintragen)</em>
                        </>
                      ) : (
                        <>
                          {entry.meters.toFixed(1)} m verwendet (
                          {entry.source === 'assumed' ? 'Planungsannahme' : 'eingetragen'}{' '}
                          {entry.storedM?.toFixed(1)} m, geroutet {entry.routedM?.toFixed(1)} m)
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
        <div data-testid="bom-actions" className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={empty || !assessment?.canExportDocument}
            data-testid="bom-export-csv"
            title={
              assessment?.canExportDocument
                ? 'Stückliste als CSV-Datei (Planstand und Dokumentstatus in jeder Zeile)'
                : 'Gesperrt: kritische Befunde müssen zuerst behoben werden.'
            }
            className="min-h-11 gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            CSV exportieren
          </Button>
          <Button
            variant="outline"
            onClick={printReport}
            disabled={empty || !assessment?.canExportDocument}
            data-testid="bom-print-report"
            title={
              assessment?.canExportDocument
                ? 'Druckbericht öffnen – im Druckdialog „Als PDF speichern“ wählen'
                : 'Gesperrt: kritische Befunde müssen zuerst behoben werden.'
            }
            className="min-h-11 gap-2"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Druckbericht (PDF)
          </Button>
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
