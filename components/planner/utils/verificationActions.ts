/**
 * components/planner/utils/verificationActions.ts — AUS „NICHT BEWERTBAR" WIRD
 * EIN NÄCHSTER SCHRITT.
 *
 * Das Problem
 * ===========
 * Die Engine meldet ehrlich, was sie **nicht** entscheiden konnte
 * (`UNPROVABLE`). Für den Nutzer ist das eine Wand: ein typischer Einsteigerplan
 * erzeugt elf solcher Zeilen und null Verstöße. Elfjaml „ich kann das nicht
 * beurteilen" ist keine Auskunft, sondern eine Sackgasse — und die Erfahrung
 * aus jedem Prüfwerkzeug sagt: wer die Sackgasse nicht auflöst, bekommt
 * weggeklickte Warnungen.
 *
 * Diese Datei rechnet **nichts** (ARCH-Regel D). Sie ordnet jedem Befund eine
 * Handlung zu, die aus dem Befund selbst stammt:
 *
 *   - Was fehlt (`missing`-Feld des Ereignisses bzw. das Symbol in `details`),
 *   - wo es einzutragen ist (Bauteil- oder Leitungs-Inspektor),
 *   - ob der Nutzer es überhaupt liefern kann oder ob es eine Modellgrenze ist.
 *
 * Die letzte Unterscheidung ist die wichtigste: „Modellgrenze" heißt, der
 * Nutzer kann nichts tun — die Aussage bleibt für immer `UNPROVABLE`, und das
 * muss anders aussehen als „trag bitte die Länge ein".
 *
 * Warum keine eigene Regel-Logik
 * ==============================
 * Die Zuordnung ist eine **Tabelle über Regel-IDs**, kein Nachrechnen. Fehlt
 * eine Regel in der Tabelle, fällt der Ratgeber auf einen generischen Text
 * zurück und meldet das über `kind: 'unknown'` — eine neue Regel soll sichtbar
 * unversorgt sein, nicht stillschweigend einen falschen Rat bekommen.
 */
import { isCoverageEvent, type AuditEvent, type VerificationReport } from '../../../lib/verify';

/** Was den Befund auflöst — oder warum es nichts zu tun gibt. */
export type ActionKind =
  /** Der Nutzer kann die fehlende Angabe eintragen. */
  | 'fill-input'
  /** Nur ein Datenblatt/Herstellerangabe hilft weiter. */
  | 'datasheet'
  /** Modellgrenze: nicht durch Eingaben auflösbar, bleibt offen. */
  | 'model-limit'
  /** Verstoß mit bekanntem Reparaturvorschlag. */
  | 'fix-violation'
  /** Keine Zuordnung bekannt — sichtbar unversorgt. */
  | 'unknown';

export interface VerificationAction {
  ruleId: string;
  kind: ActionKind;
  /** Ein Satz, was zu tun ist. Imperativ, ohne Fachjargon. */
  instruction: string;
  /** Wo im Plan (für den Sprung aus der Warn-Zentrale). */
  target: 'node' | 'edge' | 'none';
  /** Kurzform für die Gruppen-Überschrift. */
  group: string;
}

const INPUT_TABLE: Readonly<Record<string, Omit<VerificationAction, 'ruleId'>>> = {
  'AMP-001-ib-in-iz': {
    kind: 'fill-input',
    instruction:
      'Leistung des Verbrauchers (W) oder den Betriebsstrom eintragen — ohne ihn ist die Belastbarkeit nicht prüfbar.',
    target: 'node',
    group: 'Fehlende Leistungsangabe',
  },
  'AMP-002-i2-vs-iz': {
    kind: 'fill-input',
    instruction:
      'Nennstrom der Sicherung und Querschnitt der Leitung eintragen, damit der Abschaltstrom gegen die Belastbarkeit geprüft werden kann.',
    target: 'edge',
    group: 'Fehlende Sicherungsangabe',
  },
  'AMP-004-breaking-capacity': {
    kind: 'datasheet',
    instruction:
      'Abschaltvermögen der Sicherung aus dem Datenblatt eintragen (z. B. 6 kA) — der prospektive Kurzschlussstrom ist nur gegen einen echten Gerätewert prüfbar.',
    target: 'edge',
    group: 'Datenblattangabe nötig',
  },
  'VDR-001-voltage-drop-edge': {
    kind: 'fill-input',
    instruction:
      'Länge und Querschnitt der Leitung eintragen — ohne beide ist der Spannungsfall nicht berechenbar.',
    target: 'edge',
    group: 'Fehlende Leitungsdaten',
  },
  'VDR-002-voltage-drop-path': {
    kind: 'fill-input',
    instruction:
      'Auf allen Leitungen des Pfads Länge und Querschnitt eintragen — der Pfad-Spannungsfall summiert sich über alle Kanten.',
    target: 'edge',
    group: 'Fehlende Leitungsdaten',
  },
  'PWR-001-energy-balance': {
    kind: 'fill-input',
    instruction:
      'Nutzungsdauer je Verbraucher (h/Tag) oder den Tagesbedarf eintragen — sonst ist die Kapazität nicht gegen den Bedarf prüfbar.',
    target: 'node',
    group: 'Fehlende Verbrauchsdaten',
  },
  'AMP-005-selectivity': {
    kind: 'datasheet',
    instruction:
      'Bauform und Charakteristik beider Schutzorgane eintragen — Selektivität ist ohne Gerätedaten nicht beurteilbar.',
    target: 'edge',
    group: 'Datenblattangabe nötig',
  },
  'SYN-002-unmodeled-component': {
    kind: 'model-limit',
    instruction:
      'Dieses Bauteil ist im Modell nicht abgebildet. Es wird angezeigt, aber nicht geprüft — bitte fachlich selbst bewerten.',
    target: 'node',
    group: 'Nicht modelliertes Bauteil',
  },
  'SYN-003-unknown-port': {
    kind: 'fill-input',
    instruction:
      'Anschluss (Port) der Leitung am Bauteil ist unbekannt — im Leitungs-Inspektor den richtigen Anschluss wählen.',
    target: 'edge',
    group: 'Unklarer Anschluss',
  },
  'NET-003-ac-model-scope': {
    kind: 'model-limit',
    instruction:
      'Die 230-V-Prüfung ist einseitig (L/N/PE, Umschaltung und Rückspeiseschutz sind nicht modelliert). Die Anlage muss fachlich abgenommen werden — der Planer kann das nicht bestätigen.',
    target: 'none',
    group: 'Modellgrenze 230 V',
  },
  'RCD-004-residual-current-type': {
    kind: 'datasheet',
    instruction:
      'Typ des FI-Schutzschalters (AC/A/F/B) eintragen — ohne Typ ist der Schutz für Gleichfehlerströme nicht beurteilbar.',
    target: 'node',
    group: 'Datenblattangabe nötig',
  },
  'RCD-005-loop-impedance': {
    kind: 'fill-input',
    instruction: 'Leitungslänge der 230-V-Kante eintragen — die Schleifenimpedanz hängt direkt daran.',
    target: 'edge',
    group: 'Fehlende Leitungsdaten',
  },
};

/**
 * Zuordnung eines Ereignisses — `null` für reine Abdeckungs-Ereignisse (die
 * melden nichts über ein Bauteil und brauchen keine Handlung).
 */
export function actionFor(event: AuditEvent): VerificationAction | null {
  if (isCoverageEvent(event)) return null;

  if (event.kind === 'VIOLATION') {
    return {
      ruleId: event.ruleId,
      kind: 'fix-violation',
      instruction: event.autoFixRemedy || event.message,
      target: event.entity.kind === 'node' ? 'node' : 'edge',
      group: 'Zu beheben',
    };
  }

  const known = INPUT_TABLE[event.ruleId];
  if (known) return { ruleId: event.ruleId, ...known };

  return {
    ruleId: event.ruleId,
    kind: 'unknown',
    instruction:
      'Für diese Regel ist kein Handlungshinweis hinterlegt. Das ist eine Lücke im Ratgeber, nicht im Plan — bitte den Befund fachlich prüfen.',
    target: 'none',
    group: 'Ohne Handlungshinweis',
  };
}

/** Gruppierte Handlungsliste, in der Reihenfolge „tun → Datenblatt → Modellgrenze". */
export interface ActionGroup {
  group: string;
  kind: ActionKind;
  actions: readonly VerificationAction[];
}

const GROUP_ORDER: readonly ActionKind[] = [
  'fix-violation',
  'fill-input',
  'datasheet',
  'model-limit',
  'unknown',
];

/**
 * Alle Handlungen des Berichts, gruppiert.
 *
 * Die Sortierung ist Absicht: was der Nutzer **jetzt** tun kann, steht oben;
 * Modellgrenzen stehen unten, weil sie sich nicht beheben lassen. Eine
 * Modellgrenze als erste Zeile wäre die Aufforderung, das Werkzeug zu
 * schließen.
 */
export function verificationActions(report: VerificationReport): ActionGroup[] {
  const actions = report.events
    .map(actionFor)
    .filter((action): action is VerificationAction => action !== null);

  const groups: ActionGroup[] = [];
  for (const kind of GROUP_ORDER) {
    const ofKind = actions.filter((action) => action.kind === kind);
    if (ofKind.length === 0) continue;
    // Innerhalb der Gruppe nach Gruppenname, damit gleichartige Schritte
    // zusammenstehen (z. B. drei „Länge eintragen" werden eine Aufgabe).
    const byGroup = new Map<string, VerificationAction[]>();
    for (const action of ofKind) {
      const bucket = byGroup.get(action.group);
      if (bucket) bucket.push(action);
      else byGroup.set(action.group, [action]);
    }
    for (const [group, entries] of [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b, 'de'))) {
      groups.push({ group, kind, actions: entries });
    }
  }
  return groups;
}

/**
 * Ein Satz für das Prüfsiegel: was als Nächstes zu tun ist — oder dass es
 * nichts zu tun gibt, weil die Grenze im Modell liegt.
 */
export function nextStepSummary(report: VerificationReport): string {
  const groups = verificationActions(report);
  if (groups.length === 0) {
    return report.verdict === 'COMPLIANT'
      ? 'Alle anwendbaren Prüfungen sind erfüllt.'
      : 'Keine Handlung offen — das Verdikt stammt aus der Abdeckung, nicht aus einem Befund.';
  }
  const actionable = groups.filter((group) => group.kind !== 'model-limit' && group.kind !== 'unknown');
  const count = actionable.reduce((total, group) => total + group.actions.length, 0);
  if (count > 0) {
    const first = actionable[0]!;
    return `${count} Angabe(n) fehlen oder sind zu korrigieren. Erster Schritt: ${first.actions[0]!.instruction}`;
  }
  const limit = groups.find((group) => group.kind === 'model-limit');
  if (limit) return `Keine Eingabe kann das ändern: ${limit.actions[0]!.instruction}`;
  return 'Kein Handlungshinweis hinterlegt — bitte fachlich prüfen.';
}
