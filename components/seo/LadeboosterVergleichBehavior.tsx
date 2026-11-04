'use client';

import { useEffect } from 'react';

/**
 * Interaktionen des Ladebooster-Vergleichs: Klassenfilter und Ladestrom-Rechner.
 *
 * Bewusst DOM-nah statt als kontrolliertes React-Formular: Der Abschnitt ist
 * serverseitig gerendertes redaktionelles Markup. Die wenigen Interaktionen
 * dürfen die Inhalte nicht in einen Client-Bundle-Zustand ziehen. Der
 * Rechner bleibt eine Faustregel; die Ergebnisse sind keine Messung.
 */
export function LadeboosterVergleichBehavior() {
  useEffect(() => {
    const root = document.getElementById('vergleich');
    if (!root) return;

    const controller = new AbortController();
    const { signal } = controller;

    const filterButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-lb-filter]'));
    const sortButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-lb-sort]'));
    const devices = Array.from(root.querySelectorAll<HTMLElement>('[data-lb-class]'));
    const tbody = root.querySelector<HTMLTableSectionElement>('[data-lb-tbody]');
    const grid = root.querySelector<HTMLElement>('#geraete-karten');
    const rows = tbody ? Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr[data-lb-class]')) : [];
    const cards = grid ? Array.from(grid.querySelectorAll<HTMLElement>('article[data-lb-class]')) : [];
    const originalRows = [...rows];
    const originalCards = [...cards];
    const countEl = root.querySelector<HTMLElement>('[data-lb-count]');
    const cleanups: Array<() => void> = [() => controller.abort()];

    const updateCount = () => {
      const visible = cards.filter((card) => !card.classList.contains('is-hidden')).length;
      if (countEl && cards.length > 0) countEl.textContent = `${visible} von ${cards.length} Geräten`;
    };

    /** Der Filter wirkt auf Tabelle UND Karten — nicht nur auf eine von beiden. */
    const applyFilter = (value: string) => {
      devices.forEach((element) => {
        const match = value === 'all' || element.dataset.lbClass === value;
        element.classList.toggle('is-hidden', !match);
      });
      filterButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.lbFilter === value));
      });
      updateCount();
    };

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => applyFilter(button.dataset.lbFilter ?? 'all'), { signal });
    });

    /** `null` (nicht belegt) sortiert immer ans Ende, nie an den Anfang. */
    const numericSort = <T extends HTMLElement>(
      elements: readonly T[],
      attr: string,
      descending: boolean
    ): T[] =>
      [...elements].sort((a, b) => {
        const av = a.getAttribute(attr);
        const bv = b.getAttribute(attr);
        if (!av) return 1;
        if (!bv) return -1;
        return descending ? Number(bv) - Number(av) : Number(av) - Number(bv);
      });

    const applySort = (mode: string) => {
      let nextRows = originalRows;
      let nextCards = originalCards;
      if (mode === 'strom') {
        nextRows = numericSort(originalRows, 'data-lb-strom', true);
        nextCards = numericSort(originalCards, 'data-lb-strom', true);
      } else if (mode === 'preis') {
        nextRows = numericSort(originalRows, 'data-lb-preis', false);
        nextCards = numericSort(originalCards, 'data-lb-preis', false);
      }
      nextRows.forEach((row) => tbody?.appendChild(row));
      nextCards.forEach((card) => grid?.appendChild(card));
      sortButtons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.lbSort === mode));
      });
    };

    sortButtons.forEach((button) => {
      button.addEventListener('click', () => applySort(button.dataset.lbSort ?? 'rang'), { signal });
    });
    updateCount();

    /**
     * Ein Sprungziel innerhalb eines <details> wird vor dem Scrollen geöffnet.
     * <details> ist natives HTML: Ohne JavaScript bleibt es per Klick bedienbar,
     * die Anker zeigen dann auf die sichtbare Zusammenfassung.
     */
    const navLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-lb-nav] a[href^="#"]'));
    const openTarget = (hash: string) => {
      if (!hash.startsWith('#')) return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      const details = target.closest<HTMLDetailsElement>('details');
      if (details) details.open = true;
    };

    navLinks.forEach((link) => {
      link.addEventListener(
        'click',
        () => {
          openTarget(link.getAttribute('href') ?? '');
          navLinks.forEach((other) => other.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'true');
        },
        { signal }
      );
    });
    if (window.location.hash) openTarget(window.location.hash);

    const sections = navLinks
      .map((link) => document.getElementById((link.getAttribute('href') ?? '').slice(1)))
      .filter((element): element is HTMLElement => element !== null);
    if ('IntersectionObserver' in window && sections.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          const top = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!top) return;
          navLinks.forEach((link) => {
            const id = (link.getAttribute('href') ?? '').slice(1);
            if (id === top.target.id) link.setAttribute('aria-current', 'true');
            else link.removeAttribute('aria-current');
          });
        },
        { rootMargin: '-90px 0px -70% 0px' }
      );
      sections.forEach((section) => observer.observe(section));
      cleanups.push(() => observer.disconnect());
    }

    const form = root.querySelector<HTMLFormElement>('#lb-calc-form');
    const ahInput = root.querySelector<HTMLInputElement>('#lb-ah');
    const chemistryInput = root.querySelector<HTMLSelectElement>('#lb-chem');
    const hoursInput = root.querySelector<HTMLInputElement>('#lb-hours');
    const alternatorInput = root.querySelector<HTMLInputElement>('#lb-alt');
    const currentOut = root.querySelector<HTMLElement>('#lb-out-current');
    const classOut = root.querySelector<HTMLElement>('#lb-out-class');
    const loadOut = root.querySelector<HTMLElement>('#lb-out-load');
    const noteBox = root.querySelector<HTMLElement>('#lb-result-note');

    if (
      !form ||
      !ahInput ||
      !chemistryInput ||
      !hoursInput ||
      !alternatorInput ||
      !currentOut ||
      !classOut ||
      !loadOut ||
      !noteBox
    ) {
      return () => cleanups.forEach((fn) => fn());
    }

    const toNumber = (value: string) => Number(value.replace(',', '.'));

    const de = (value: number, digits: number) =>
      new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const deviceClass = (current: number) => {
      if (current <= 35) return '30-A-Klasse';
      if (current <= 75) return '60–70-A-Klasse';
      if (current <= 100) return '90-A-Klasse';
      if (current <= 130) return '100–120-A-Klasse';
      return 'über 120 A – Einzelfall prüfen';
    };

    const loadCard = loadOut.closest<HTMLElement>('.lb-result');

    const setLoadState = (state: 'ok' | 'warn' | 'bad') => {
      if (!loadCard) return;
      loadCard.classList.toggle('is-warn', state === 'warn');
      loadCard.classList.toggle('is-bad', state === 'bad');
    };

    const calculate = () => {
      const ah = toNumber(ahInput.value);
      const hours = toNumber(hoursInput.value);
      const alternator = toNumber(alternatorInput.value);
      const chemistry = chemistryInput.value;

      if (
        !ah ||
        ah < 50 ||
        ah > 1200 ||
        !hours ||
        hours < 1 ||
        hours > 24 ||
        !alternator ||
        alternator < 40 ||
        alternator > 400
      ) {
        noteBox.textContent =
          'Bitte Werte innerhalb der angegebenen Grenzen eingeben (50–1200 Ah, 1–24 h, 40–400 A).';
        setLoadState('ok');
        return;
      }

      const cMin = chemistry === 'lifepo4' ? 0.3 : 0.2;
      const cMax = chemistry === 'lifepo4' ? 0.5 : 0.3;
      const minCurrent = ah * cMin;
      const maxCurrent = ah * cMax;
      const targetCurrent = (ah / hours) * 1.2;
      const sizedCurrent = clamp(targetCurrent, minCurrent, maxCurrent);
      const cRate = targetCurrent / ah;
      const inputCurrent = sizedCurrent / 0.9 + 20;
      const utilization = (inputCurrent / alternator) * 100;
      const windowName = chemistry === 'lifepo4' ? 'LiFePO4-Fenster' : 'Blei-Fenster';

      currentOut.textContent = `${de(targetCurrent, 0)} A · ${de(cRate, 2)} C`;
      classOut.textContent = deviceClass(targetCurrent);
      loadOut.textContent = `${de(inputCurrent, 0)} A · ${de(utilization, 0)} %`;

      const state = utilization > 100 ? 'bad' : utilization > 80 ? 'warn' : 'ok';
      setLoadState(state);

      let targetText: string;
      if (targetCurrent > maxCurrent) {
        targetText =
          ` Für ${de(hours, 1)} Stunden wären ${de(targetCurrent, 0)} A nötig. ` +
          `Das obere ${windowName} endet bei ${de(maxCurrent, 0)} A (${de(cMax, 2)} C); ` +
          `die ${deviceClass(targetCurrent)} ist die passende Bedarfsklasse. ` +
          'Prüfe Batterie und BMS, bevor du mehr Strom zulässt.';
      } else if (targetCurrent < minCurrent) {
        targetText =
          ` Für ${de(hours, 1)} Stunden brauchst du ${de(targetCurrent, 0)} A (${de(cRate, 2)} C). ` +
          `Das untere ${windowName} beginnt bei ${de(minCurrent, 0)} A (${de(cMin, 2)} C); ` +
          `die ${deviceClass(targetCurrent)} deckt beides ab. Ein kleineres Gerät kann für die ` +
          'Fahrzeit genügen, liegt aber unter dem unteren C-Fenster.';
      } else {
        targetText =
          ` Für ${de(hours, 1)} Stunden brauchst du ${de(targetCurrent, 0)} A (${de(cRate, 2)} C). ` +
          `Das liegt im ${windowName}; die ${deviceClass(targetCurrent)} passt.`;
      }

      const loadText =
        state === 'bad'
          ? ' Die Lichtmaschine wäre rechnerisch überlastet. Prüfe Nennstrom, Leerlaufdrehzahl und ' +
            'Fahrzeuglast; dimensioniere kleiner oder drossele den Booster.'
          : state === 'warn'
            ? ' Die Lichtmaschine arbeitet nahe ihrer Nennleistung. Reserve für Licht, Lüftung und ' +
              'Steuergeräte einplanen.'
            : ' Die Lichtmaschine hätte rechnerisch Reserve.';

      noteBox.textContent =
        'Faustregel, keine Messung: 90 % Wirkungsgrad, 20 A Fahrzeuglast und 20 % Zuschlag für die ' +
        'Konstantspannungsphase. ' +
        targetText +
        loadText +
        ' Maßgeblich sind Datenblatt, BMS und die tatsächliche Verkabelung.';
    };

    form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        calculate();
      },
      { signal }
    );

    [ahInput, hoursInput, alternatorInput].forEach((input) => {
      input.addEventListener('input', calculate, { signal });
    });
    chemistryInput.addEventListener('change', calculate, { signal });

    calculate();

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
