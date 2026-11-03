import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContentImage } from './ContentImage';

/**
 * Bildvertrag des Designkonzepts 2026-11 (P1). Ohne Browser prüfbar, deshalb
 * hier statt in einer Pixel-Baseline: Maße gegen CLS, Alt-Text gegen
 * Screenreader und Bildindex, Bildunterschrift gegen indexierbaren Text,
 * Ladeverhalten gegen LCP.
 */
describe('ContentImage', () => {
  const basis = {
    name: '/bilder/a-01-kabelverlegung',
    alt: 'Hände verlegen rot-schwarze 12-V-Leitungen entlang einer Holzleiste.',
    width: 1200,
    height: 805,
    caption: '12-V-Leitungen werden geführt, bevor die Verkleidung geschlossen wird.',
  } as const;

  it('liefert Bild, Alt-Text, feste Maße und eine sichtbare Bildunterschrift', () => {
    const { container } = render(<ContentImage {...basis} />);

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('alt', basis.alt);
    expect(img).toHaveAttribute('width', '1200');
    expect(img).toHaveAttribute('height', '805');
    expect(img).toHaveAttribute('src', '/bilder/a-01-kabelverlegung.jpg');
    expect(container.querySelector('figcaption')).toHaveTextContent(basis.caption);
    expect(container.querySelector('figure')).not.toBeNull();
  });

  it('liefert AVIF-Varianten mit srcset und sizes, plus JPEG-Fallback', () => {
    const { container } = render(<ContentImage {...basis} />);

    const source = container.querySelector('source');
    expect(source).toHaveAttribute('type', 'image/avif');
    expect(source).toHaveAttribute(
      'srcset',
      '/bilder/a-01-kabelverlegung-640.avif 640w, /bilder/a-01-kabelverlegung-1200.avif 1200w'
    );
    expect(source).toHaveAttribute('sizes', '(max-width: 768px) 100vw, 42rem');
  });

  it('lädt unterhalb des Folds lazy und ohne hohe Priorität', () => {
    const { container } = render(<ContentImage {...basis} />);

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('fetchpriority', 'auto');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('lädt das Hero-Bild sofort und mit hoher Priorität (LCP)', () => {
    const { container } = render(
      <ContentImage {...basis} priority sizes="(max-width: 900px) 100vw, 560px" />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(container.querySelector('source')).toHaveAttribute('sizes', '(max-width: 900px) 100vw, 560px');
  });

  it('nimmt ein leeres alt für dekorative Bilder und zusätzliche Klassen an', () => {
    const { container } = render(
      <ContentImage {...basis} alt="" className="my-figure" imageClassName="my-image" />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveClass('content-image', 'my-image');
    expect(container.querySelector('figure')).toHaveClass('content-figure', 'my-figure');
  });

  it('rendert Links in der Bildunterschrift als echten Text', () => {
    render(<ContentImage {...basis} caption={<a href="/camper-elektrik/schaltplan/">Zum Schaltplan</a>} />);

    expect(screen.getByRole('link', { name: 'Zum Schaltplan' })).toHaveAttribute(
      'href',
      '/camper-elektrik/schaltplan/'
    );
  });
});

/**
 * Eine Quelle für Inhaltsbilder: rohe `<img>`-Tags in Seiten oder Komponenten
 * würden AVIF-Varianten, Maße, Alt-Text und Bildunterschrift umgehen. Der
 * Guard erlaubt genau die Komponente, die diesen Vertrag herstellt.
 */
describe('Bildgrenze (Designkonzept 2026-11)', () => {
  const ROOTS = ['app', 'components'] as const;
  const IGNORED = /\.(test|spec|stories)\.[jt]sx?$/;
  const ERLAUBT = 'components/brand/ContentImage.tsx';

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...sourceFiles(full));
      } else if (/\.tsx$/.test(entry) && !IGNORED.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  it('enthält rohe img-Tags nur in ContentImage.tsx', () => {
    const offenders = ROOTS.flatMap(sourceFiles)
      .filter((file) => file !== ERLAUBT)
      .filter((file) => /<img\b/.test(readFileSync(file, 'utf8')));
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
