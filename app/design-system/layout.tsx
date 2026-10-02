import type { ReactNode } from 'react';

import { pageMetadata } from '@/lib/seo/pages';

/** Interne Übersichtsseite der UI-Bausteine — `pageMetadata` setzt noindex. */
export const metadata = pageMetadata('/design-system');

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
