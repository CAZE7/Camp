import { useEffect, useState } from 'react';

import { VDE_GROUP_FACTORS_MAX_N } from '../../../lib/electrical';
import { installConditionsError, type RunConditions } from '../../../lib/verify';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { AccessibleDialog } from '../../ui/AccessibleDialog';
import { ValidatingInput } from '../../ui/ValidatingInput';
import { DEFAULT_INSTALL_CONDITIONS } from '../utils/verificationWarnings';

/**
 * components/planner/ui/InstallConditionsDialog.tsx — die Verlegung, mit der
 * der Plan geprüft wird.
 *
 * Die Engine konnte Umgebungstemperatur, Isolierstoff und Häufung schon immer
 * annehmen (sie wirft bei unplausiblen Werten einen RangeError und schreibt ihre
 * Annahmen in den Bericht). Bis hierher fehlte nur der Weg dahin: Der Planer
 * rief sie ausschließlich mit der Tabellenreferenz auf 30 °C Luft, PVC und einem
 * einzelnen Stromkreis. Ein Urteil über einen heißen Kabelkanal wurde also als
 * Urteil über Luft verkauft.
 *
 * Zwei Zusagen trägt dieser Dialog:
 *
 *   1. **Nur gültige Werte erreichen den Store.** `verifyPlan` wirft bei
 *      Umgebung ≥ Grenzleitertemperatur — über eine Zahl im Eingabefeld dürfte
 *      die Live-Validierung nicht sterben. Was die Engine ablehnt, bleibt im
 *      Feld stehen und wird daneben begründet.
 *   2. **Was nicht modelliert ist, steht im Dialog.** Der Verlege-Faktor f₃ ist
 *      hart 1,0, weil es nur eine Tabellenbasis gibt (Verlegeart B2). Ein
 *      Menüpunkt, der das suggeriert, wäre eine erfundene Aussage — deshalb ist
 *      es Text, kein Schalter.
 */

const INSULATION_CHOICES: { value: RunConditions['insulation']; label: string }[] = [
  { value: 'PVC', label: 'PVC (70 °C Grenzleitertemperatur)' },
  { value: 'XLPE', label: 'XLPE (90 °C Grenzleitertemperatur)' },
];

export function InstallConditionsDialog() {
  const [open, setOpen] = useState(false);
  const installConditions = usePlannerStore((state) => state.installConditions);
  const setInstallConditions = usePlannerStore((state) => state.setInstallConditions);

  /**
   * Der Dialog schreibt den Store nur, wenn die Engine mit dem Wert rechnet.
   * `draft` ist deshalb die Anzeige (was der Nutzer tippte), `installConditions`
   * ist die Rechnung (der letzte Zustand, den die Engine verantwortet).
   *
   * Nachziehen, wenn der Plan woanders geändert wurde (Reload, Projektimport),
   * läuft zur Render-Zeit statt in einem zweiten Commit — derselbe Grund, aus
   * dem `ValidatingInput` und `CanvasDisplayOptions` es so halten
   * (react-hooks/set-state-in-effect).
   */
  const [draft, setDraft] = useState<RunConditions>(installConditions);
  const [gespiegelt, setGespiegelt] = useState<RunConditions>(installConditions);
  if (gespiegelt !== installConditions) {
    setGespiegelt(installConditions);
    setDraft(installConditions);
  }

  useEffect(() => {
    const openDialog = () => setOpen(true);
    window.addEventListener('planner-open-install-conditions', openDialog);
    return () => window.removeEventListener('planner-open-install-conditions', openDialog);
  }, []);

  const ablehnen = installConditionsError(draft);

  const weiterreichen = (next: RunConditions) => {
    setDraft(next);
    if (installConditionsError(next) === null) setInstallConditions(next);
  };

  const zurueckAufReferenz = () => weiterreichen(DEFAULT_INSTALL_CONDITIONS);

  return (
    <AccessibleDialog
      open={open}
      onClose={() => setOpen(false)}
      title="Verlegebedingungen der Prüfung"
      description="Diese Angaben benutzt die Prüfung. Was hier nicht steht, wird nicht angenommen."
      className="min-h-0 min-w-0 max-w-lg"
    >
      {/* `AccessibleDialog` polstert nur seinen Kopf; der Inhaltsträger trägt die
          Innenpolster selbst (dasselbe Muster wie `BOMModal`). */}
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <p className="panel-title">Bedingungen dieses Plans</p>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="install-ambient-c"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Umgebungstemperatur (°C)
          </label>
          <ValidatingInput
            id="install-ambient-c"
            isFloat
            inputMode="decimal"
            value={String(draft.ambientC)}
            onValidChange={(ambientC) => weiterreichen({ ...draft, ambientC })}
            className="rounded border border-border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="install-insulation"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Isolierstoff der Leitungen
          </label>
          <select
            id="install-insulation"
            value={draft.insulation}
            onChange={(event) =>
              weiterreichen({
                ...draft,
                insulation: event.target.value as RunConditions['insulation'],
              })
            }
            className="rounded border border-border px-3 py-2 text-sm"
          >
            {INSULATION_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="install-bundled-circuits"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Häufung im Plan (belastete Stromkreise je Trasse)
          </label>
          <ValidatingInput
            id="install-bundled-circuits"
            min="1"
            max={String(VDE_GROUP_FACTORS_MAX_N)}
            step="1"
            inputMode="numeric"
            value={String(draft.bundledCircuits)}
            rules={[
              {
                validate: (val) => Number.isInteger(val) && val >= 1 && val <= VDE_GROUP_FACTORS_MAX_N,
                message: `Ganze Zahl von 1 bis ${VDE_GROUP_FACTORS_MAX_N} Stromkreisen — weiter trägt die Häufungstabelle nicht.`,
              },
            ]}
            onValidChange={(bundledCircuits) => weiterreichen({ ...draft, bundledCircuits })}
            className="rounded border border-border px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Einzelne Leitungen können davon abweichen — das stellt der Inspektor an der Leitung ein.
          </p>
        </div>

        <div role="status" className="flex flex-col gap-2 border-t border-border pt-3 text-sm">
          {ablehnen !== null && (
            <p className="text-signal">
              Noch nicht übernommen — die Prüfung rechnet weiter mit dem letzten gültigen Wert. Grund:{' '}
              {ablehnen}
            </p>
          )}
          <p className="text-muted-foreground">
            Die Belastbarkeitswerte stammen aus einer Tabellenbasis (Verlegeart B2, 30 °C Luft, PVC). Eine
            andere Verlegeart — Kanal, Rohr, gebündelt im Fach — ist nicht modelliert: der Verlege-Faktor f₃
            steht fest auf 1,0 und wird nicht erhöht. Ein Urteil gilt also für die oben genannten Bedingungen
            und nicht für jede denkbare Verlegung.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={zurueckAufReferenz} className="cad-btn cad-btn--line min-h-11 px-3">
            Zurück auf Tabellenreferenz
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cad-btn cad-btn--primary min-h-11 px-4"
          >
            Fertig
          </button>
        </div>
      </div>
    </AccessibleDialog>
  );
}
