import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_LEGAL, type SiteLegal } from '@/lib/siteLegal';

import DatenschutzPage from './page';

/**
 * Datenschutz-Seite.
 *
 * Der Reichweitenmessdienst, den die Seite selbst lädt, muss in der
 * Erklärung stehen — sonst erklärt die Seite etwas anderes als das, was sie
 * tut. Dieser Test hält fest, dass der Abschnitt nicht verschwindet.
 */

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const original: SiteLegal = { ...SITE_LEGAL };

afterEach(() => {
  Object.assign(SITE_LEGAL, original);
});

describe('Datenschutz', () => {
  it('nennt den eingebundenen Reichweitenmessdienst', () => {
    render(<DatenschutzPage />);
    expect(screen.getByRole('heading', { name: 'Reichweitenmessung' })).toBeInTheDocument();
    expect(screen.getByText(/Google Analytics 4/)).toBeInTheDocument();
    expect(screen.getByText(/G-Q7E3XL4T34/)).toBeInTheDocument();
  });

  it('nennt den Assistenten und seine Datenübertragung', () => {
    render(<DatenschutzPage />);
    expect(screen.getByRole('heading', { name: 'Camper-Assistent' })).toBeInTheDocument();
    expect(screen.getByText(/externe.*Endpunkt|externen Assistenten-Endpunkt/)).toBeInTheDocument();
  });

  it('verweist auf das Impressum, solange keine Anbieterangaben eingetragen sind', () => {
    render(<DatenschutzPage />);
    expect(screen.getAllByRole('link', { name: 'Impressum' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Werft Ausbau GmbH/)).toBeNull();
  });

  it('nennt den Anbieter, sobald die Impressumsangaben eingetragen sind', () => {
    Object.assign(SITE_LEGAL, {
      ...original,
      providerName: 'Werft Ausbau GmbH',
      street: 'Hafenstraße 12',
      postalCodeAndCity: '28217 Bremen',
      email: 'kontakt@werft.example',
    });
    render(<DatenschutzPage />);
    expect(screen.getByText('Werft Ausbau GmbH')).toBeInTheDocument();
    expect(screen.getByText('E-Mail: kontakt@werft.example')).toBeInTheDocument();
  });
});
