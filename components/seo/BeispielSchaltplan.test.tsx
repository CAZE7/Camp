import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TEMPLATE_AUTARK } from '@/components/planner/templates';
import { SCHALTPLAN_BEISPIEL_CONTENT } from '@/lib/seo/content/schaltplan-beispiel';

import { BeispielSchaltplan } from './BeispielSchaltplan';

/**
 * Vertrag der Beispiel-Schaltplan-Skizze: Sie zeigt DIE Vorlage, die der
 * „im Planer öffnen"-Verweis lädt — keine Zahl auf der Skizze, die der
 * geöffnete Plan nicht enthält. Deshalb hält dieser Test die sichtbaren
 * Werte an `TEMPLATE_AUTARK` fest statt an einer zweiten Liste.
 */
describe('BeispielSchaltplan', () => {
  it('rendert die Skizze als beschriebenes Bild mit ehrlicher Bildunterschrift', () => {
    render(<BeispielSchaltplan />);

    const bild = screen.getByRole('img', { name: /Beispiel-Schaltplan eines Campers/ });
    expect(bild).toBeInTheDocument();
    expect(screen.getByText(/Prinzipskizze des Beispielplans/)).toBeInTheDocument();
    expect(screen.getByText(/ersetzt keine Einbauanleitung/)).toBeInTheDocument();
  });

  it('öffnet genau die Vorlage, deren Werte die Skizze zeigt', () => {
    render(<BeispielSchaltplan />);

    const link = screen.getByRole('link', { name: 'Diesen Plan im Planer öffnen' });
    expect(link).toHaveAttribute('href', '/planer?template=autark');
  });

  it('zeigt die Bauteil-Werte der Autark-Vorlage (keine erfundenen Zahlen)', () => {
    const { container } = render(<BeispielSchaltplan />);
    const text = container.textContent ?? '';

    const batterie = TEMPLATE_AUTARK.nodes.find((node) => node.id === 'battery-1');
    const solar = TEMPLATE_AUTARK.nodes.find((node) => node.id === 'solar-1');
    const wechselrichter = TEMPLATE_AUTARK.nodes.find((node) => node.id === 'inverter-1');

    expect(text).toContain(`${String(batterie?.data.capacity)} Ah LiFePO4`);
    expect(text).toContain(`Solar ${String(solar?.data.watts)} W`);
    expect(text).toContain(`${String(wechselrichter?.data.watts)} W`);

    // Jede Verbraucher-Beschriftung der Vorlage erscheint auf der Skizze.
    for (const node of TEMPLATE_AUTARK.nodes) {
      if (node.type === 'consumer' || node.type === 'consumer230v') {
        expect(text, `Verbraucher fehlt auf der Skizze: ${node.id}`).toContain(
          `${String(node.data.watts)} W`
        );
      }
    }
  });

  it('füllt die Bauteil-Kästen mit der echten Flächenvariable (kein wirkungsloses var)', () => {
    const { container } = render(<BeispielSchaltplan />);

    // `--color-paper` existiert im Token-System nicht — die Füllung wäre
    // wirkungslos und Leitungen schienen durch die Kästen. Quelle der
    // Wahrheit ist `--paper` (app/globals.css, tailwind `bg-paper`).
    const fuellGruppen = container.querySelectorAll('g[fill="var(--paper)"]');
    expect(fuellGruppen.length).toBe(2);
    for (const gruppe of fuellGruppen) {
      expect(gruppe.querySelectorAll('rect').length).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll('[fill*="--color-paper"]').length).toBe(0);
  });

  it('widerspricht der 0,2-m-Regel nicht: 0,5 m ist die Leitungslänge, nicht der Sicherungsabstand', () => {
    const text = JSON.stringify(SCHALTPLAN_BEISPIEL_CONTENT);

    expect(text).not.toContain('0,5 m hinter dem');
    expect(text).toContain('höchstens 0,2 m ungeschützte Strecke');
  });

  it('beschriftet jede Leitung mit dem Querschnitt und der Sicherung der Vorlage', () => {
    const { container } = render(<BeispielSchaltplan />);
    const text = container.textContent ?? '';

    for (const edge of TEMPLATE_AUTARK.edges) {
      const querschnitt = edge.data?.crossSection;
      if (typeof querschnitt === 'number') {
        expect(text, `Querschnitt der Leitung ${edge.id} fehlt`).toContain(
          `${querschnitt.toLocaleString('de-DE')} mm²`
        );
      }
    }

    const hauptleitung = TEMPLATE_AUTARK.edges.find((edge) => edge.id === 'e-batt-plus');
    expect(text).toContain(`${String(hauptleitung?.data?.fuseSize)} A Class T`);
  });
});
