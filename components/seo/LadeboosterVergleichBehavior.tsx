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
    const devices = Array.from(root.querySelectorAll<HTMLElement>('[data-lb-class]'));

    const applyFilter = (value: string) => {
      devices.forEach((card) => {
        const match = value === 'all' || card.dataset.lbClass === value;
        card.classList.toggle('is-hidden', !match);
      });
      filterButtons.forEach((button) => {
        const active = button.dataset.lbFilter === value;
        button.setAttribute('aria-pressed', String(active));
      });
    };

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => applyFilter(button.dataset.lbFilter ?? 'all'), { signal });
    });

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
      return () => controller.abort();
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

    return () => controller.abort();
  }, []);

  return null;
}
