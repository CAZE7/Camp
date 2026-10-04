import { describe, expect, it } from 'vitest';
import {
  EDGE_INTENTS,
  EDGE_INTENT_PRIORITY,
  compareIntentPriority,
  edgeIntentOf,
  isEdgeIntent,
  isIntentPinned,
  isRouteLocked,
  mayOverride,
  strongerIntent,
  type EdgeIntent,
  type IntentCarrier,
} from './intent';
import { AUTO_EDGE_PREFIX, isAutoWiredEdge } from '../autoWire/primitives';

const edge = (id: string, data?: Record<string, unknown>): IntentCarrier => ({ id, data });

describe('V2-INTENT — Absichtsmodell einer Verbindung', () => {
  it('Rangfolge ist locked > user > required > auto > suggested', () => {
    const sorted = [...EDGE_INTENTS].sort(compareIntentPriority);
    expect(sorted).toEqual(['locked', 'user', 'required', 'auto', 'suggested']);
  });

  it('Prioritätstabelle und Werteliste bleiben synchron (kein Wert ohne Rang)', () => {
    expect(Object.keys(EDGE_INTENT_PRIORITY).sort()).toEqual([...EDGE_INTENTS].sort());
    // Ränge sind eindeutig — zwei gleich starke Absichten wären nicht entscheidbar.
    const ranks = Object.values(EDGE_INTENT_PRIORITY);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('isEdgeIntent weist alles zurück, was nicht in der Liste steht', () => {
    for (const value of EDGE_INTENTS) expect(isEdgeIntent(value)).toBe(true);
    for (const value of ['USER', 'pinned', '', 42, null, undefined, {}]) {
      expect(isEdgeIntent(value)).toBe(false);
    }
  });

  describe('edgeIntentOf — eine Ableitung, feste Rangfolge', () => {
    it('locked schlägt ein widersprüchliches intent-Feld', () => {
      expect(edgeIntentOf(edge('e1', { locked: true, intent: 'auto' }))).toBe('locked');
    });

    it('gültiges intent schlägt das Herkunftsflag', () => {
      expect(edgeIntentOf(edge('e1', { intent: 'required', autoWired: true }))).toBe('required');
    });

    it('ungültiges intent fällt auf die Herkunft zurück (kein stiller „user“)', () => {
      expect(edgeIntentOf(edge('e1', { intent: 'irgendwas', autoWired: true }))).toBe('auto');
    });

    it('autoWired true/false ergibt auto/user', () => {
      expect(edgeIntentOf(edge('e1', { autoWired: true }))).toBe('auto');
      expect(edgeIntentOf(edge('e1', { autoWired: false }))).toBe('user');
    });

    it('ID-Präfix bleibt Migrationspfad für Pläne ohne Flag', () => {
      expect(edgeIntentOf(edge(`${AUTO_EDGE_PREFIX}7`))).toBe('auto');
      // Dieselbe Rangfolge wie der bestehende Herkunftstest — keine zweite Wahrheit.
      expect(isAutoWiredEdge({ id: `${AUTO_EDGE_PREFIX}7` })).toBe(true);
    });

    it('Kante unbekannter Herkunft gehört im Zweifel dem Nutzer', () => {
      expect(edgeIntentOf(edge('import-42'))).toBe('user');
      expect(edgeIntentOf({ id: 'import-42', data: null })).toBe('user');
    });
  });

  describe('isIntentPinned — nur Ausdrückliches ist unantastbar', () => {
    it('locked und ausdrücklich gesetzte Absichten sind gepinnt', () => {
      expect(isIntentPinned(edge('e1', { locked: true }))).toBe(true);
      for (const intent of ['locked', 'user', 'required'] satisfies EdgeIntent[]) {
        expect(isIntentPinned(edge('e1', { intent }))).toBe(true);
      }
    });

    it('abgeleitetes „user“ ist NICHT gepinnt — sonst bliebe ein Altplan ungeheilt', () => {
      // Sicherheitskritisch: AUDIT ELE-001/ELE-002 heilen importierte Pläne.
      expect(edgeIntentOf(edge('import-1'))).toBe('user');
      expect(isIntentPinned(edge('import-1'))).toBe(false);
      expect(isIntentPinned(edge('e1', { autoWired: false }))).toBe(false);
    });

    it('auto und suggested sind nie gepinnt', () => {
      expect(isIntentPinned(edge('e1', { intent: 'auto' }))).toBe(false);
      expect(isIntentPinned(edge('e1', { intent: 'suggested' }))).toBe(false);
      expect(isIntentPinned(edge('e1', { locked: 'ja' }))).toBe(false);
    });
  });

  describe('isRouteLocked — Topologie ≠ Geometrie (ADR 0008)', () => {
    it('nur locked bindet den Kabelweg', () => {
      expect(isRouteLocked(edge('e1', { locked: true }))).toBe(true);
      expect(isRouteLocked(edge('e1', { intent: 'locked' }))).toBe(true);
    });

    it('eine erklärte Nutzerabsicht bindet die Topologie, nicht die Route', () => {
      expect(isIntentPinned(edge('e1', { intent: 'user' }))).toBe(true);
      expect(isRouteLocked(edge('e1', { intent: 'user' }))).toBe(false);
      expect(isRouteLocked(edge('e1', { intent: 'required' }))).toBe(false);
    });
  });

  describe('mayOverride / strongerIntent', () => {
    it('nur eine streng stärkere Absicht darf ersetzen', () => {
      expect(mayOverride('user', 'auto')).toBe(true);
      expect(mayOverride('locked', 'user')).toBe(true);
      expect(mayOverride('auto', 'user')).toBe(false);
      expect(mayOverride('suggested', 'auto')).toBe(false);
    });

    it('Gleichstand ist ein Konflikt, keine stille Überschreibung', () => {
      for (const intent of EDGE_INTENTS) expect(mayOverride(intent, intent)).toBe(false);
    });

    it('strongerIntent liefert die stärkere, bei Gleichstand die linke', () => {
      expect(strongerIntent('auto', 'user')).toBe('user');
      expect(strongerIntent('locked', 'suggested')).toBe('locked');
      expect(strongerIntent('user', 'user')).toBe('user');
    });

    it('Transitivität: wer A schlägt und von B geschlagen wird, verliert gegen B', () => {
      for (const a of EDGE_INTENTS) {
        for (const b of EDGE_INTENTS) {
          for (const c of EDGE_INTENTS) {
            if (mayOverride(a, b) && mayOverride(b, c)) expect(mayOverride(a, c)).toBe(true);
          }
        }
      }
    });
  });
});
