'use client';

import dynamic from 'next/dynamic';

/**
 * Lädt die GSAP-Reiseanimation erst im Browser nach.
 *
 * Warum das hier steht: Die Animation ist reine Dekoration (der Container ist
 * `aria-hidden`, die Strecke dient als Hintergrund). GSAP und seine Plugins
 * wiegen rund 136 KB — sie gehören nicht in den Erstaufbau einer Textseite,
 * die ohne sie vollständig lesbar ist. Der Wrapper ist ein Client-Baustein,
 * weil `ssr: false` in einer Server-Komponente nicht erlaubt ist; das
 * Platzhalter-Element hält dieselbe feste Fläche, damit beim Nachladen nichts
 * springt (CLS = 0).
 */
const RoadTripAnimation = dynamic(() => import('./RoadTripAnimation'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-10 h-screen w-24 md:w-32 lg:w-48"
    />
  ),
});

export default function RoadTripAnimationLazy() {
  return <RoadTripAnimation />;
}
