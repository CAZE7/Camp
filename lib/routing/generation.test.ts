import { describe, expect, it } from 'vitest';
import { MAX_ROUTE_REVISIONS_PER_GRAPH, createRouteGenerationTracker, routingInputHash } from './generation';

describe('V2-ROUTE — Eingabe-Hash und Generationen', () => {
  describe('routingInputHash', () => {
    it('ist stabil und kurz', () => {
      expect(routingInputHash('a', 'b')).toBe(routingInputHash('a', 'b'));
      expect(routingInputHash('a', 'b')).toHaveLength(8);
    });

    it('trennt Knoten- und Kantenanteil (keine Verwechslung durch Verkettung)', () => {
      expect(routingInputHash('ab', 'c')).not.toBe(routingInputHash('a', 'bc'));
    });

    it('jede Änderung an Knoten ODER Kanten ändert den Hash', () => {
      const base = routingInputHash('nodes', 'edges');
      expect(routingInputHash('nodes!', 'edges')).not.toBe(base);
      expect(routingInputHash('nodes', 'edges!')).not.toBe(base);
    });
  });

  describe('createRouteGenerationTracker', () => {
    it('vergibt für jede neue Eingabe eine neue Generation', () => {
      const tracker = createRouteGenerationTracker();
      const first = tracker.begin('aaa');
      const second = tracker.begin('bbb');
      expect(first.generation).toBe(1);
      expect(first.revision).toBe(1);
      expect(second.generation).toBe(2);
      expect(second.revision).toBe(1);
      expect(second.allowed).toBe(true);
    });

    it('zählt Wiederholungen derselben Eingabe als Revisionen', () => {
      const tracker = createRouteGenerationTracker();
      tracker.begin('aaa');
      const again = tracker.begin('aaa');
      expect(again.generation).toBe(1);
      expect(again.revision).toBe(2);
      expect(again.allowed).toBe(true);
    });

    it('bricht nach der Revisionsschranke ab statt endlos zu wiederholen', () => {
      const tracker = createRouteGenerationTracker();
      for (let index = 0; index < MAX_ROUTE_REVISIONS_PER_GRAPH; index += 1) {
        expect(tracker.begin('aaa').allowed).toBe(true);
      }
      const blocked = tracker.begin('aaa');
      expect(blocked.allowed).toBe(false);
      expect(blocked.converged).toBe(false);
      expect(blocked.reason).toContain('Rückkopplung');
      // Und bleibt blockiert — keine stille Erholung.
      expect(tracker.begin('aaa').allowed).toBe(false);
    });

    it('eine echte Eingabeänderung setzt die Revisionen zurück (Nutzer wird nie geblockt)', () => {
      const tracker = createRouteGenerationTracker(2);
      tracker.begin('aaa');
      tracker.begin('aaa');
      expect(tracker.begin('aaa').allowed).toBe(false);
      const fresh = tracker.begin('bbb');
      expect(fresh.allowed).toBe(true);
      expect(fresh.revision).toBe(1);
      expect(fresh.converged).toBe(true);
    });

    it('A → B → A ist zweimal „neu“ und nie ein Zyklusabbruch', () => {
      const tracker = createRouteGenerationTracker(1);
      expect(tracker.begin('aaa').allowed).toBe(true);
      expect(tracker.begin('bbb').allowed).toBe(true);
      expect(tracker.begin('aaa').allowed).toBe(true);
    });

    it('peek zeigt den letzten Stand, ohne ihn zu verändern', () => {
      const tracker = createRouteGenerationTracker();
      expect(tracker.peek()).toBeUndefined();
      tracker.begin('aaa');
      expect(tracker.peek()?.revision).toBe(1);
      expect(tracker.peek()?.revision).toBe(1);
    });

    it('reset stellt den Ausgangszustand her', () => {
      const tracker = createRouteGenerationTracker(1);
      tracker.begin('aaa');
      expect(tracker.begin('aaa').allowed).toBe(false);
      tracker.reset();
      expect(tracker.peek()).toBeUndefined();
      const after = tracker.begin('aaa');
      expect(after.allowed).toBe(true);
      expect(after.generation).toBe(1);
    });
  });
});
