import { describe, expect, it } from 'vitest';

import { siteUrl } from '@/lib/site';

import { breadcrumbNode, pageNodeId } from './jsonLd';

describe('breadcrumbNode', () => {
  it('names the BreadcrumbList from the same visible trail used for its entries', () => {
    const items = [
      { name: 'Startseite', path: '/' },
      { name: 'Camper-Elektrik', path: '/camper-elektrik/' },
      { name: 'Sicherung berechnen', path: '/camper-elektrik/sicherungen/' },
    ] as const;

    expect(breadcrumbNode({ path: '/camper-elektrik/sicherungen/', items })).toEqual({
      '@type': 'BreadcrumbList',
      '@id': pageNodeId('/camper-elektrik/sicherungen/', 'breadcrumb'),
      name: 'Navigationspfad: Startseite › Camper-Elektrik › Sicherung berechnen',
      inLanguage: 'de-DE',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: siteUrl(item.path),
      })),
    });
  });
});
