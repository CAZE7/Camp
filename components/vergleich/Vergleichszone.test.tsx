import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SeoPage } from '@/components/seo/SeoPage';
import { LADEBOOSTER_VERGLEICH } from '@/lib/seo/comparisons/ladebooster';
import { LADEBOOSTER_CONTENT } from '@/lib/seo/content/ladebooster';
import type { SeoPageContent } from '@/lib/seo/types';

import { Vergleichszone } from './Vergleichszone';

/**
 * Die Zusagen der Vergleichszone. Zwei davon sind Gates aus der Spec:
 * G4 (Reihenfolge — Rangliste vor dem Ratgebertext) und G6 (ein Filter wirkt auf
 * Tabelle UND Karten). G6 ist die Regel, die der Vorgänger nicht hielt: Sein
 * Filter blendete nur die Karten aus, und die Komponente trug einen
 * Hinweissatz, der das erklärte.
 */

/** Zeile und Karte eines Geräts — beide tragen dieselbe Produktkennung. */
const darstellungen = (produktId: string): Element[] =>
  Array.from(document.querySelectorAll(`[data-vergleich-produkt="${produktId}"]`));

/** Dieselbe Seite ohne Vergleich — der Slot muss dann spurlos bleiben. */
const OHNE_VERGLEICH: SeoPageContent = { ...LADEBOOSTER_CONTENT, comparison: undefined };

describe('G4 — der Vergleich steht vor dem Ratgebertext', () => {
  it('rendert die Rangliste vor dem ersten Ratgeber-Abschnitt', () => {
    const { container } = render(<SeoPage page={LADEBOOSTER_CONTENT} />);

    const titel = Array.from(container.querySelectorAll('h2')).map((element) => element.id);
    const rangliste = titel.indexOf('ladebooster-rangliste-titel');
    const ratgeber = titel.indexOf('relais-oder-booster-titel');

    expect(rangliste).toBeGreaterThanOrEqual(0);
    expect(ratgeber).toBeGreaterThanOrEqual(0);
    expect(rangliste).toBeLessThan(ratgeber);
  });

  it('lässt eine Seite ohne Vergleich unverändert', () => {
    const { container } = render(<SeoPage page={OHNE_VERGLEICH} />);
    expect(container.querySelector('[data-vergleich]')).toBeNull();
    // Der Ratgeber steht trotzdem da — der Slot ist eine Ergänzung, kein Ersatz.
    expect(container.querySelector('#relais-oder-booster')).not.toBeNull();
  });
});

describe('Vergleichszone', () => {
  it('zeigt alle neun Geräte in Tabelle und Karten', () => {
    render(<Vergleichszone spec={LADEBOOSTER_VERGLEICH} />);

    expect(screen.getByRole('table', { name: /Geräteüberblick/ })).toBeDefined();
    expect(document.querySelectorAll('[data-vergleich-liste="zeilen"] tr')).toHaveLength(9);
    expect(document.querySelectorAll('[data-vergleich-liste="karten"] > article')).toHaveLength(9);
    expect(darstellungen('votronic-vcc-1212-90')).toHaveLength(2);
  });

  it('nennt jeden Einsatzfall und verweist auf ein Gerät', () => {
    render(<Vergleichszone spec={LADEBOOSTER_VERGLEICH} />);
    const faelle = screen.getAllByRole('listitem');
    expect(faelle.length).toBeGreaterThanOrEqual(LADEBOOSTER_VERGLEICH.useCases.length);
    expect(screen.getByRole('link', { name: /Votronic VCC 1212-90/ })).toBeDefined();
  });

  it('liefert ohne JavaScript alle Inhalte, aber keine Steuerknöpfe zum Anfassen', () => {
    const html = renderToString(<Vergleichszone spec={LADEBOOSTER_VERGLEICH} />);

    // Inhalt ist da: Crawler und Antwortsysteme sehen die Geräte ohne Skript.
    expect(html).toContain('VCC 1212-90');
    expect(html).toContain('Geräteüberblick');

    // Steuerung ist ausgeblendet, bis das Skript sie einschaltet. Ein Knopf, der
    // ohne JavaScript nichts tut, wäre schlechter als keiner.
    const beginn = html.indexOf('data-vergleich-steuerung="');
    expect(beginn).toBeGreaterThan(0);
    expect(html.slice(beginn, beginn + 200)).toContain('hidden');
  });
});

describe('G6 — ein Filter wirkt auf Tabelle und Karten', () => {
  it('blendet Zeile und Karte desselben Geräts aus', () => {
    render(<Vergleichszone spec={LADEBOOSTER_VERGLEICH} />);

    const knopf = screen.getByRole('button', { name: '90 A und mehr' });
    fireEvent.click(knopf);

    expect(knopf.getAttribute('aria-pressed')).toBe('true');
    expect(darstellungen('orion-tr-smart-12-12-30').every((el) => el.classList.contains('hidden'))).toBe(
      true
    );
    expect(darstellungen('votronic-vcc-1212-90').some((el) => el.classList.contains('hidden'))).toBe(false);
  });

  it('schaltet den Filter zurück auf alle', () => {
    render(<Vergleichszone spec={LADEBOOSTER_VERGLEICH} />);

    fireEvent.click(screen.getByRole('button', { name: '90 A und mehr' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));

    const versteckt = Array.from(document.querySelectorAll('[data-vergleich-klasse]')).filter((el) =>
      el.classList.contains('hidden')
    );
    expect(versteckt).toHaveLength(0);
  });
});

describe('Sortierung', () => {
  it('sortiert Tabelle und Karten nach Preis und sagt es der Tabelle', () => {
    render(<Vergleichszone spec={LADEBOOSTER_VERGLEICH} />);

    fireEvent.click(screen.getByRole('button', { name: /Preis/ }));

    const ersteZeile = document.querySelector('[data-vergleich-liste="zeilen"] tr');
    const ersteKarte = document.querySelector('[data-vergleich-liste="karten"] > article');
    expect(ersteZeile?.getAttribute('data-vergleich-produkt')).toBe('orion-tr-smart-12-12-30');
    expect(ersteKarte?.getAttribute('data-vergleich-produkt')).toBe('orion-tr-smart-12-12-30');
    expect(document.querySelector('[data-vergleich-spalte="preis"]')?.getAttribute('aria-sort')).toBe(
      'ascending'
    );
  });

  it('kehrt die Richtung beim zweiten Klick um', () => {
    render(<Vergleichszone spec={LADEBOOSTER_VERGLEICH} />);

    const knopf = screen.getByRole('button', { name: /Preis/ });
    fireEvent.click(knopf);
    fireEvent.click(knopf);

    // Absteigend steht das teuerste Gerät zuerst. Die Erwartung wird aus den
    // Daten abgeleitet: Preise sind Momentaufnahmen und werden korrigiert
    // (Upstream #581); eine fest verdrahtete Kennung würde beim nächsten
    // Preisstand rot, ohne dass die Sortierung falsch wäre.
    const teuerstes = LADEBOOSTER_VERGLEICH.products.reduce((a, b) =>
      (b.priceEur ?? 0) > (a.priceEur ?? 0) ? b : a
    );
    const ersteZeile = document.querySelector('[data-vergleich-liste="zeilen"] tr');
    expect(ersteZeile?.getAttribute('data-vergleich-produkt')).toBe(teuerstes.id);
    expect(document.querySelector('[data-vergleich-spalte="preis"]')?.getAttribute('aria-sort')).toBe(
      'descending'
    );
  });

  it('stellt Geräte ohne belegten Strom ans Ende, nicht an den Anfang', () => {
    render(<Vergleichszone spec={LADEBOOSTER_VERGLEICH} />);

    fireEvent.click(screen.getByRole('button', { name: /Ladestrom/ }));

    const zeilen = Array.from(document.querySelectorAll('[data-vergleich-liste="zeilen"] tr'));
    expect(zeilen.at(-1)?.getAttribute('data-vergleich-produkt')).toBe('import-ungebrandet');
    expect(zeilen[0]?.getAttribute('data-vergleich-produkt')).toBe('orion-tr-smart-12-12-30');
  });
});
