import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import {
  APP_PREFERENCES_STORAGE_KEY,
  LEGACY_APP_PREFERENCES_STORAGE_KEY,
  LEGACY_PLANNER_STORAGE_KEY,
  PLANNER_STORAGE_KEY,
} from '@/lib/storageKeys';
import { SITE_LEGAL } from '@/lib/siteLegal';

import DatenschutzPage from './page';

/**
 * Datenschutzerklärung — geprüft gegen Art. 13 DSGVO und gegen den Code.
 *
 * Der Anlass: Die Seite war bis 2026-10-28 eine Kurzfassung mit 134 Wörtern und
 * einem Satz, der zur Rechtsberatung aufforderte — also eine Notiz an den
 * Betreiber, die im Internet stand. Ein Test, der nur „die Seite rendert" prüft,
 * hätte das nicht bemerkt. Deshalb prüft dieser Test drei Dinge:
 *
 *   1. Die Pflichtangaben nach Art. 13 DSGVO sind vorhanden und vollständig
 *      (Verantwortlicher, Zwecke, Rechtsgrundlagen, Empfänger, Dauer, Rechte,
 *      Aufsichtsbehörde). Fehlt eine, ist die Erklärung unvollständig.
 *   2. Die Angaben stimmen mit der Quelle überein: Der Verantwortliche kommt
 *      aus `SITE_LEGAL` (dieselbe Quelle wie das Impressum), die genannten
 *      Speicherschlüssel aus `lib/storageKeys.ts`. Eine abgetippte Kopie würde
 *      hier auffallen, sobald sich dort etwas ändert.
 *   3. Die Behauptungen der Seite sind am Baum nachweisbar: „keine Cookies,
 *      keine Analyse, keine fremden Server". Dafür durchsucht der Test den
 *      Quelltext nach den Aufrufen, die das widerlegen würden — die Aussage im
 *      Rechtstext und der Code, auf den sie sich beruft, können so nicht
 *      auseinanderlaufen.
 *
 * Was dieser Test NICHT prüft: ob die rechtliche Bewertung stimmt. Das kann
 * kein Unit-Test; er prüft Vollständigkeit und Übereinstimmung mit dem Code.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/datenschutz',
}));

/** Der gerenderte Text ohne Auszeichnung — für Wort- und Satzprüfungen. */
const textOf = (container: HTMLElement) => container.textContent ?? '';

describe('Datenschutz — Pflichtangaben nach Art. 13 DSGVO', () => {
  it('nennt den Verantwortlichen mit Anschrift und Kontakt aus der gemeinsamen Quelle', () => {
    const { container } = render(<DatenschutzPage />);
    const text = textOf(container);
    expect(text).toContain(SITE_LEGAL.providerName);
    expect(text).toContain(SITE_LEGAL.street);
    expect(text).toContain(SITE_LEGAL.postalCodeAndCity);
    expect(screen.getAllByRole('link', { name: SITE_LEGAL.email }).length).toBeGreaterThan(0);
    // Die Links müssen als mailto: ausgeführt sein, nicht als Text ohne Ziel.
    for (const link of screen.getAllByRole('link', { name: SITE_LEGAL.email })) {
      expect(link.getAttribute('href')).toBe(`mailto:${SITE_LEGAL.email}`);
    }
  });

  it('ist keine Kurzfassung mehr: mehrere Abschnitte mit Überschriften und Inhaltsverzeichnis', () => {
    const { container } = render(<DatenschutzPage />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.length).toBeGreaterThanOrEqual(10);

    // Jeder Abschnitt muss im Inhaltsverzeichnis verlinkt sein — sonst ist die
    // lange Seite für Sprungmarken-Nutzer unbrauchbar. Geprüft wird über die id
    // des Abschnitts: Das Sprungziel ist der `<section>` (dort sitzt auch
    // `scroll-mt`), nicht die Überschrift.
    const nav = screen.getByRole('navigation', { name: /auf dieser seite/i });
    const abschnitte = Array.from(container.querySelectorAll('section[id]'));
    expect(abschnitte.length).toBe(headings.length);
    for (const abschnitt of abschnitte) {
      const ueberschrift = within(abschnitt as HTMLElement).getByRole('heading', { level: 2 });
      // Die Überschrift nummeriert („1. Wer verantwortlich ist"), der Link
      // nicht — der Text muss trotzdem derselbe sein, sonst führt der Eintrag
      // an eine andere Stelle als sein Name verspricht.
      const titel = (ueberschrift.textContent ?? '').replace(/^\d+\.\s*/, '');
      const link = within(nav)
        .getAllByRole('link')
        .find((kandidat) => kandidat.getAttribute('href') === `#${abschnitt.getAttribute('id')}`);
      expect(link).toBeDefined();
      // `textContent` enthält auch die ausgeblendete Nummerierung („01").
      expect(link?.textContent?.replace(/^\d+/, '').trim()).toBe(titel);
    }

    // Früher 134 Wörter; ein Rechtstext dieser Tiefe liegt deutlich darüber.
    const woerter = textOf(container).split(/\s+/).filter(Boolean).length;
    expect(woerter).toBeGreaterThan(600);
  });

  it('nennt Zwecke, Rechtsgrundlagen und Empfänger der Verarbeitung', () => {
    const text = textOf(render(<DatenschutzPage />).container).replace(/\s+/g, ' ');
    expect(text).toMatch(/Hosting und Server-Logs/i);
    expect(text).toContain('Art. 6 Abs. 1 lit. f DSGVO');
    expect(text).toContain('Art. 6 Abs. 1 lit. b DSGVO');
    expect(text).toContain('§ 25 Abs. 2 Nr. 2 TDDDG');
    expect(text).toContain('GitHub Pages');
    expect(text).toContain('GitHub, Inc.');
    expect(text).toContain('IP-Adresse');
    expect(text).toContain('localStorage');
  });

  it('nennt Speicherdauer, Rechte nach Art. 15–21 und das Beschwerderecht nach Art. 77', () => {
    const text = textOf(render(<DatenschutzPage />).container).replace(/\s+/g, ' ');
    for (const artikel of ['Art. 15', 'Art. 16', 'Art. 17', 'Art. 18', 'Art. 20', 'Art. 21']) {
      expect(text).toContain(artikel);
    }
    expect(text).toContain('Art. 77');
    expect(text).toContain('Wie lange Daten bleiben');
  });

  it('benennt die zuständige Aufsichtsbehörde mit vollständiger Anschrift', () => {
    // Adresse verifiziert am 2026-10-28 über datenschutz-hamburg.de und die
    // Adressliste des BfDI. Eine falsche Behörde wäre eine Falschangabe im
    // Rechtstext — deshalb steht sie hier ausgeschrieben und nicht als Variable.
    const { container } = render(<DatenschutzPage />);
    const text = textOf(container).replace(/\s+/g, ' ');
    expect(text).toContain('Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit');
    expect(text).toContain('Ludwig-Erhard-Str. 22, 20459 Hamburg');
    expect(text).toContain('mailbox@datenschutz.hamburg.de');
    const link = screen.getByRole('link', { name: 'datenschutz-hamburg.de' });
    expect(link.getAttribute('href')).toBe('https://datenschutz-hamburg.de');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('enthält keine Platzhalter oder Aufforderungen an den Betreiber', () => {
    const text = textOf(render(<DatenschutzPage />).container);
    // Genau diese beiden Formulierungen standen vorher auf der Seite und
    // richteten sich an den Betreiber statt an den Besucher.
    expect(text.toLowerCase()).not.toContain('rechtsberatung');
    expect(text.toLowerCase()).not.toContain('finalen text');
    expect(text).not.toMatch(/Platzhalter|TODO|XXX|\[.*eintragen.*\]/i);
  });
});

describe('Datenschutz — Aussagen decken sich mit dem Code', () => {
  it('nennt genau die Speicherschlüssel, die der Code verwendet', () => {
    const { container } = render(<DatenschutzPage />);
    const text = textOf(container);
    for (const schluessel of [
      PLANNER_STORAGE_KEY,
      APP_PREFERENCES_STORAGE_KEY,
      LEGACY_PLANNER_STORAGE_KEY,
      LEGACY_APP_PREFERENCES_STORAGE_KEY,
    ]) {
      expect(text).toContain(schluessel);
    }
    // Kein Schlüssel wird abgetippt: Die Seite importiert die Konstanten, also
    // stehen sie exakt so da, wie der Planer sie schreibt.
    expect(text).not.toContain('werft-planner-v2');
  });

  it('verspricht keine Dienste, die der Quelltext nicht enthält', async () => {
    // Gegenprobe zur Aussage „keine Cookies, keine Analyse, keine fremden
    // Server": Wenn je ein Analyse-Client dazukommt, muss diese Erklärung
    // geändert werden — der Test macht das sichtbar.
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    const verdaechtig = [
      'gtag(',
      'googletagmanager',
      'google-analytics',
      'plausible.io',
      'matomo',
      'posthog',
      'document.cookie',
      'hotjar',
      'clarity.ms',
      'facebook.net',
      'segment.com',
    ];

    const quellen: string[] = [];
    const sammeln = (verzeichnis: string) => {
      for (const eintrag of readdirSync(join(process.cwd(), verzeichnis))) {
        const relativ = `${verzeichnis}/${eintrag}`;
        const pfad = join(process.cwd(), relativ);
        if (statSync(pfad).isDirectory()) {
          sammeln(relativ);
          continue;
        }
        if (/\.(ts|tsx)$/.test(eintrag) && !/\.test\.(ts|tsx)$/.test(eintrag)) quellen.push(relativ);
      }
    };
    for (const wurzel of ['app', 'components', 'lib', 'store']) sammeln(wurzel);

    // Ausnahme: Diese Erklärung selbst nennt die Dienste, die sie ausschließt
    // („kein Matomo") — sie ist der Beleg, nicht der Verstoß.
    const ausnahmen = new Set(['app/datenschutz/page.tsx']);

    const treffer = quellen.filter((datei) => {
      if (ausnahmen.has(datei)) return false;
      const inhalt = readFileSync(join(process.cwd(), datei), 'utf8').toLowerCase();
      return verdaechtig.some((muster) => inhalt.includes(muster));
    });

    expect(treffer).toEqual([]);
  });

  it('spricht nicht mehr von einem Assistenten, der Eingaben an ein Modell sendet', () => {
    const text = textOf(render(<DatenschutzPage />).container);
    // Der Assistent ist am 2026-10-28 entfernt worden (ADR 0021); die
    // Erklärung sagt genau das und darf ihn nicht als vorhandene Funktion
    // beschreiben.
    expect(text).toMatch(/Assistent ist entfernt|frühere Assistent/i);
    expect(text.toLowerCase()).not.toContain('openai');
  });
});
