/**
 * Schriftdateien als Modul-Import, damit der Build-Loader die ausgelieferte,
 * gehashte Adresse auflöst. `app/layout.tsx` lädt damit die lateinischen
 * Schnitte von IBM Plex Mono vor, ohne eine Hash-Adresse zu pflegen.
 */
declare module '*.woff2' {
  const href: string;
  export default href;
}
