'use client';

import { useEffect } from 'react';

import type { Sortierschluessel } from '@/lib/seo/comparisons/types';

/**
 * components/vergleich/Vergleichssteuerung.tsx — Filter und Sortierung.
 *
 * Legt sich über das fertige HTML statt es neu zu rendern: Die Seite ist ein
 * Server Component, und ein Client-Status für neun Zeilen wäre eine zweite
 * Wahrheit über dieselben Daten — dazu ein Hydration-Risiko, das die
 * No-JavaScript-Prüfung (`tests/e2e/seo-nojs.spec.ts`) nicht sehen kann.
 *
 * Zwei Zusagen, die Gate G6 prüft:
 *   1. Der Filter wirkt auf Tabellenzeilen UND Produktkarten. Beim Vorgänger
 *      wirkte er nur auf die Karten, und die Komponente musste das mit einem
 *      Hinweissatz entschuldigen. Beide tragen dasselbe
 *      `data-vergleich-klasse`, deshalb gibt es nichts mehr zu entschuldigen.
 *   2. Ohne JavaScript gibt es keine Steuerknöpfe. Sie werden serverseitig mit
 *      `hidden` ausgeliefert und erst hier eingeblendet — ein Knopf, der nichts
 *      tut, ist schlechter als keiner.
 */
export function Vergleichssteuerung({ zone }: { zone: string }) {
  useEffect(() => {
    // Kennung statt Attribut-Selektor: `document.getElementById` braucht keine
    // Maskierung und steht in jeder Umgebung zur Verfügung, `CSS.escape` nicht.
    const gefunden = document.getElementById(`vergleich-${zone}`);
    if (!gefunden) return;
    // Eigene Zuweisung mit festem Typ: TypeScript verengt eine `const` nicht
    // innerhalb von Funktions-Deklarationen, weil die durch Hoisting theoretisch
    // vor der Prüfung laufen könnten.
    const wurzel: HTMLElement = gefunden;

    const richtungen = new Map<string, 'auf' | 'ab'>();

    const zeilenUndKarten = (): HTMLElement[] =>
      Array.from(wurzel.querySelectorAll<HTMLElement>('[data-vergleich-klasse]'));

    function filterAnwenden(klasse: string): void {
      for (const element of zeilenUndKarten()) {
        const passt = klasse === 'alle' || element.dataset.vergleichKlasse === klasse;
        element.classList.toggle('hidden', !passt);
      }
    }

    function knopfDruck(gewaehlt: string): void {
      for (const knopf of Array.from(wurzel.querySelectorAll<HTMLButtonElement>('[data-vergleich-filter]'))) {
        knopf.setAttribute('aria-pressed', String(knopf.dataset.vergleichFilter === gewaehlt));
      }
    }

    /** Zahl aus dem Sortierattribut; leer heißt „nicht belegt" und bleibt am Ende. */
    function achse(element: Element, schluessel: Sortierschluessel): number | null {
      const roh = element.getAttribute(`data-sort-${schluessel}`);
      if (roh === null || roh === '') return null;
      const zahl = Number(roh);
      return Number.isNaN(zahl) ? null : zahl;
    }

    function sortieren(schluessel: Sortierschluessel): void {
      const richtung = richtungen.get(schluessel) === 'auf' ? 'ab' : 'auf';
      richtungen.set(schluessel, richtung);
      const vorzeichen = richtung === 'auf' ? 1 : -1;

      for (const liste of Array.from(wurzel.querySelectorAll<HTMLElement>('[data-vergleich-liste]'))) {
        const kinder = Array.from(liste.children).filter((kind) =>
          kind.hasAttribute('data-vergleich-klasse')
        );
        kinder.sort((a, b) => {
          const x = achse(a, schluessel);
          const y = achse(b, schluessel);
          if (x === null && y === null) return 0;
          if (x === null) return 1;
          if (y === null) return -1;
          return (x - y) * vorzeichen;
        });
        for (const kind of kinder) liste.appendChild(kind);
      }

      for (const spalte of Array.from(wurzel.querySelectorAll<HTMLElement>('[data-vergleich-spalte]'))) {
        if (spalte.dataset.vergleichSpalte === schluessel)
          spalte.setAttribute('aria-sort', richtung === 'auf' ? 'ascending' : 'descending');
        else spalte.removeAttribute('aria-sort');
      }

      for (const knopf of Array.from(wurzel.querySelectorAll<HTMLButtonElement>('[data-vergleich-sort]'))) {
        const pfeil = knopf.querySelector<HTMLElement>('[data-vergleich-pfeil]');
        if (!pfeil) continue;
        const aktiv = knopf.dataset.vergleichSort === schluessel;
        pfeil.textContent = aktiv ? (richtung === 'auf' ? '↑' : '↓') : '↕';
      }
    }

    // Die Knopfleiste kommt mit `hidden` vom Server; `flex` muss nachgesetzt
    // werden, weil `hidden` die Anzeige-Klasse überschreibt und nicht nur
    // ergänzt.
    for (const element of Array.from(wurzel.querySelectorAll<HTMLElement>('[data-vergleich-steuerung]'))) {
      element.classList.remove('hidden');
      element.classList.add('flex');
    }
    for (const element of Array.from(
      wurzel.querySelectorAll<HTMLElement>('[data-vergleich-steuerung-hinweis]')
    )) {
      element.classList.remove('hidden');
    }

    function klicken(ereignis: MouseEvent): void {
      const ziel = ereignis.target instanceof Element ? ereignis.target.closest('button') : null;
      if (!ziel || !wurzel.contains(ziel)) return;

      const filter = ziel.getAttribute('data-vergleich-filter');
      if (filter !== null) {
        filterAnwenden(filter);
        knopfDruck(filter);
        return;
      }

      const sort = ziel.getAttribute('data-vergleich-sort');
      if (sort === 'strom' || sort === 'preis') sortieren(sort);
    }

    wurzel.addEventListener('click', klicken);
    return () => wurzel.removeEventListener('click', klicken);
  }, [zone]);

  return null;
}
