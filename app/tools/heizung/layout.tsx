import type { ReactNode } from 'react';

import { JsonLd } from '@/components/seo/JsonLd';
import { jsonLdGraph, pageMetadata } from '@/lib/seo/pages';

/** Siehe `app/tools/dach/layout.tsx` — gleiches Muster, gleiche Begründung. */
export const metadata = pageMetadata('/tools/heizung');

export default function HeizlastLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <JsonLd graph={jsonLdGraph('/tools/heizung')} />
    </>
  );
}
