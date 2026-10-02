import { describe, expect, it } from 'vitest';

import { siteUrl } from '@/lib/site';

import robots from './robots';

describe('robots', () => {
  const rules = robots().rules;
  const first = Array.isArray(rules) ? rules[0] : rules;

  it('erlaubt allen Crawlern das Abrufen der Seite', () => {
    expect(first?.userAgent).toBe('*');
    expect(first?.allow).toBe('/');
  });

  it('verweist auf die Sitemap unter demselben Basis-Pfad', () => {
    expect(robots().sitemap).toBe(siteUrl('/sitemap.xml'));
  });

  it('sperrt keine Verzeichnisse aus', () => {
    expect(first?.disallow).toBeUndefined();
  });
});
