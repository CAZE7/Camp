import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WarningCenter, consequence, nextStep, valueWithUnit } from './WarningCenter';
import type { ValidationWarning } from '../hooks/useLiveValidation';

/**
 * AUDIT A5/A6 — die Warn-Zentrale muss auch ohne Sehen und ohne Maus lesbar sein.
 *
 * Der Audit hat zwei konkrete Ausfälle gemessen:
 *
 *  · **A6 (Screenreader):** Die Live-Region (`role="status"`,
 *    `aria-live="polite"`) stand HINTER dem frühen `return` für „keine
 *    Hinweise“. Ein neu hinzugekommener kritischer Hinweis wurde dadurch nie
 *    angesagt: Der Knoten erschien mit seinem Inhalt zusammen, statt seinen
 *    Inhalt zu wechseln — Screenreader lesen live-Regionen aber nur vor, wenn
 *    sich der Text IN einem bereits vorhandenen Knoten ändert.
 *  · **A5 (Schwere ohne Farbe):** Die Schwere hing unter 1280 px allein am
 *    Hintergrund (rot/gelb/blau). Wer Rot nicht unterscheiden kann, sah die
 *    Zahl, aber nicht, dass es kritisch ist.
 */

const warning = (over: Partial<ValidationWarning> = {}): ValidationWarning => ({
  id: 'w1',
  category: 'safety',
  type: 'critical',
  title: 'Leitung thermisch überlastet',
  message: 'Kritisch: Die Leitung führt zu viel Strom.',
  ...over,
});

/** Panel öffnen — die Wert-/Lösungszeilen existieren nur im aufgeklappten Zustand. */
function openPanel(warnings: ValidationWarning[]) {
  render(<WarningCenter warnings={warnings} />);
  fireEvent.click(screen.getByRole('button', { name: /Prüfhinweise anzeigen/ }));
}

describe('WarningCenter — Barrierefreiheit (AUDIT A5/A6)', () => {
  it('A6: die Live-Region existiert AUCH im Zustand „keine Hinweise“', () => {
    render(<WarningCenter warnings={[]} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Keine Prüfhinweise im Plan.');
  });

  it('A6: dieselbe Live-Region meldet Anzahl und kritische Treffer', () => {
    const { rerender } = render(<WarningCenter warnings={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Keine Prüfhinweise im Plan.');

    rerender(
      <WarningCenter warnings={[warning(), warning({ id: 'w2', type: 'info', category: 'estimation' })]} />
    );

    // Der Knoten bleibt bestehen, nur sein Inhalt wechselt — genau das löst die
    // Ansage aus. Zusätzlich wird die kritische Zahl genannt, nicht nur „2“.
    expect(screen.getByRole('status')).toHaveTextContent('2 Prüfhinweise im Plan, davon 1 kritisch.');
  });

  it('A5: die Schwere steht als Wort im Abzeichen, nicht nur als Rotton', () => {
    render(<WarningCenter warnings={[warning()]} />);

    expect(screen.getByRole('button', { name: /1 Prüfhinweise anzeigen/ })).toHaveTextContent('1 kritisch');
  });

  it('A5: bei bloßen Hinweisen steht die Schwere ebenfalls als Wort da', () => {
    render(<WarningCenter warnings={[warning({ type: 'info', category: 'estimation' })]} />);

    const badge = screen.getByRole('button', { name: /1 Prüfhinweise anzeigen/ });
    expect(badge).toHaveTextContent('1 Hinweis');
    expect(badge).not.toHaveTextContent('kritisch');
  });

  it('die Zahl im Abzeichen ist die Zahl der KRITISCHEN Hinweise, nicht die Gesamtzahl', () => {
    // Vorher stand hier `warnings.length` mit dem Wort der schwersten Stufe:
    // 3 Hinweise (2 kritisch) lasen sich als „3 Kritisch“, während die
    // Leiste darunter „2 kritische Probleme offen“ meldete.
    render(
      <WarningCenter
        warnings={[
          warning(),
          warning({ id: 'w2' }),
          warning({ id: 'w3', type: 'info', category: 'estimation' }),
        ]}
      />
    );

    const badge = screen.getByRole('button', { name: /3 Prüfhinweise anzeigen/ });
    // Genau diese Zeile war vorher „3 Kritisch“ — die Gesamtzahl mit dem
    // Wort der schwersten Stufe.
    expect(badge).toHaveTextContent(/^2 von 3 kritisch$/);
  });

  it('zeigt einen Routing-Lock-Konflikt anklickbar im Plan', () => {
    const warningForLockedEdge = warning({
      id: 'route-lock-I1-locked-wire-obstacle',
      category: 'routing',
      type: 'critical',
      title: 'Fixierte Leitung kollidiert mit einem Bauteil',
      focusId: 'locked-wire',
      focusType: 'edge',
      ruleId: 'ROUTE-LOCK-I1',
      remedy: 'Leitung entsperren und die Bauteile anpassen.',
      message: 'Segment trifft das Bauteil obstacle.',
    });
    const fixed: ValidationWarning[] = [];
    render(<WarningCenter warnings={[warningForLockedEdge]} onFix={(value) => fixed.push(value)} />);
    fireEvent.click(screen.getByRole('button', { name: /Prüfhinweise anzeigen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Im Plan zeigen' }));

    expect(fixed).toEqual([warningForLockedEdge]);
  });

  it('Warnstufe ohne kritische Hinweise nennt sich „Warnung“, nicht „Hinweis“', () => {
    render(
      <WarningCenter
        warnings={[
          warning({ type: 'warning', category: 'estimation' }),
          warning({ id: 'w2', type: 'warning' }),
        ]}
      />
    );

    expect(screen.getByRole('button', { name: /2 Prüfhinweise anzeigen/ })).toHaveTextContent('2 Warnungen');
  });
});

describe('WarningCenter — Wert/Einheit und Lösungshinweis (AUDIT UX-001)', () => {
  it('hängt die Einheit NICHT doppelt an, wenn der Wert sie schon trägt', () => {
    // „Ist: 306 A A“ aus dem Prüfbericht: der Melder schreibt die Einheit in
    // `measuredValue`, `unit` wiederholte sie.
    openPanel([
      warning({
        measuredValue: '306 A',
        expectedValue: '≤ 120 A',
        unit: 'A',
      }),
    ]);

    expect(screen.getByText(/Ist:/)).toHaveTextContent('Ist: 306 A · Soll: ≤ 120 A');
    expect(screen.getByText(/Ist:/).textContent).not.toContain('306 A A');
  });

  it('ergänzt die Einheit bei einem nackten Zahlenwert weiterhin', () => {
    openPanel([warning({ measuredValue: '306', unit: 'A' })]);

    expect(screen.getByText(/Ist:/)).toHaveTextContent('Ist: 306 A');
  });

  it('hängt die Einheit nicht an beschreibende Texte („maxPvVoltage fehlt V“)', () => {
    openPanel([warning({ measuredValue: 'maxPvVoltage fehlt', unit: 'V' })]);

    const line = screen.getByText(/Ist:/);
    expect(line).toHaveTextContent('Ist: maxPvVoltage fehlt');
    expect(line.textContent).not.toContain('fehlt V');
  });
});

describe('nextStep — der Lösungshinweis muss zum Befund passen', () => {
  it('UNBEKANNTES MPPT-Fenster → Eingabe anfordern (nicht: Panels reduzieren)', () => {
    // Vorher traf `startsWith('solar-voc-window')` beide Fälle: Die Warnung
    // „maximale PV-Eingangsspannung nicht eingetragen“ bekam die Anleitung
    // „weniger Panels in Serie“ — ein Ratschlag zum falschen Problem.
    const unknown = nextStep(warning({ id: 'solar-voc-window-unknown-mppt-1' }));
    expect(unknown).toContain('maximale PV-Eingangsspannung');
    expect(unknown).not.toContain('Anzahl der Panels');

    const exceeded = nextStep(warning({ id: 'solar-voc-window-mppt-1' }));
    expect(exceeded).toContain('Anzahl der Panels');
  });

  it('thermische Überlast → nennt keine Normstufe über 70 mm²', () => {
    const text = nextStep(warning({ id: 'thermal-overload-e-1' }));

    expect(text).not.toContain('über 70 mm² wählen');
    expect(text).toContain('oberhalb von 70 mm² kennt der Planer keinen Normquerschnitt');
    expect(text).toContain('parallel');
  });

  it('nicht absicherbare Leitung, Querschnitt und Spannungsfall haben eigene Hinweise', () => {
    expect(nextStep(warning({ id: 'fuse-not-possible-e-1' }))).toContain('Last aufteilen');
    expect(nextStep(warning({ id: 'cross-section-undersized-e-1' }))).toContain('Querschnitt');
    expect(nextStep(warning({ id: 'drop-not-solvable-e-1' }))).toContain('24/48 V');
  });

  it('AC-Schutzorgan ohne Datenblatt → Datenblattwerte eintragen', () => {
    for (const id of ['ac-descriptor-assumed', 'ac-protection-not-modeled']) {
      expect(nextStep(warning({ id }))).toContain('Leitungs-Inspektor');
    }
  });

  it('fehlende Batterie-Nennspannung → nennt Feld und Inspektor statt des Auffangtextes', () => {
    // Der Hinweis trug keine eigene Vorgabe und fiel in „Zeige die betroffene
    // Stelle im Plan und ergänze die dort beschriebene Komponente." — die Karte
    // nannte Feld (`battery.nominalVoltage`) und Inspektor längst im Problemtext,
    // die Lösungszeile wiederholte davon nichts.
    const text = nextStep(warning({ id: 'mixed-voltage-unknown' }));
    expect(text).toContain('Nennspannung');
    expect(text).toContain('Inspektor jeder Batterie');
    expect(text).not.toContain('Zeige die betroffene Stelle im Plan');
  });

  it('jeder Altbefund hat eine eigene Vorgabe — der Auffangtext bleibt die Ausnahme', () => {
    const legacyIds = ['mixed-voltage-unknown', 'mixed-voltage-batteries', 'solar-overload'];
    for (const id of legacyIds) {
      expect(nextStep(warning({ id })), id).not.toContain('Zeige die betroffene Stelle im Plan');
    }
  });
});

describe('valueWithUnit', () => {
  it('liefert den Platzhalter für einen fehlenden Wert', () => {
    expect(valueWithUnit(undefined, 'A')).toBe('—');
  });

  it('ergänzt nur nackte Zahlen (auch mit ≈/≤)', () => {
    expect(valueWithUnit('12', 'A')).toBe('12 A');
    expect(valueWithUnit('≈ 12', 'A')).toBe('≈ 12 A');
    expect(valueWithUnit('12 A', 'A')).toBe('12 A');
    expect(valueWithUnit('Voc fehlt', 'V')).toBe('Voc fehlt');
    expect(valueWithUnit('2 × ohne Angabe', 'V')).toBe('2 × ohne Angabe');
  });
});

describe('consequence — Folge-Zeile passt zum Befund', () => {
  const gaps = [
    'mixed-voltage-unknown',
    'solar-voc-window-unknown-charger-1',
    'solar-voc-missing-solar-1',
    'solar-voc-uncomputable-solar-1',
    'ac-descriptor-assumed',
    'ac-protection-not-modeled',
    'ac-breaking-capacity-reach',
    'ac-missing-input-missing-length',
    'sc-bank-unknown',
    'sc-fuse-type-unknown',
  ];

  it('Datenlücken melden „ungeprüft“ statt einer falschen Schätzfolge', () => {
    for (const id of gaps) {
      const text = consequence(warning({ id, category: 'estimation' }));
      expect(text, id).toContain('ungeprüft');
      expect(text, id).not.toContain('Reichweite');
    }
  });

  it('echte Defekte behalten die Kategorie-Folge', () => {
    // „missing-fuse“/„missing-rcd“ klingen wie die Lücken, sind aber Defekte:
    // Ihre Folge ist die Sicherheitsfolge, nicht „ungeprüft“.
    for (const id of ['missing-fuse-e1', 'missing-rcd-shore-1', 'inverter-missing-rcd-inv-1']) {
      const text = consequence(warning({ id }));
      expect(text, id).toContain('Stromschlaggefahr');
    }
    expect(consequence(warning({ id: 'battery-capacity', category: 'estimation' }))).toContain('Reichweite');
  });
});
