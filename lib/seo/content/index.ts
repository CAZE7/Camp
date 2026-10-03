/**
 * lib/seo/content/index.ts — Sammelstelle aller inhaltsgetriebenen Seiten.
 *
 * Die Reihenfolge ist die Reihenfolge, in der die Seiten im Inventar und im
 * Pillar-Raster erscheinen: erst das Einstiegstor, dann die Elektrik-Themen in
 * Planungsreihenfolge, dann Rechner und Vertrauensseite.
 */

import { AC_230V_CONTENT } from './230v';
import { AGM_CONTENT } from './agm';
import { BATTERIE_CONTENT } from './batterie';
import { BATTERIEKAPAZITAET_CONTENT } from './batteriekapazitaet';
import { KABELQUERSCHNITT_CONTENT } from './kabelquerschnitt';
import { LIFEPO4_CONTENT } from './lifepo4';
import { MPPT_CONTENT } from './mppt';
import { CAMPER_ELEKTRIK_PILLAR } from './pillar';
import { RECHNER_HUB_CONTENT } from './rechner-hub';
import { SCHALTPLAN_CONTENT } from './schaltplan';
import { SICHERUNGEN_CONTENT } from './sicherungen';
import { SOLARANLAGE_CONTENT } from './solaranlage';
import { SOLAR_CONTENT } from './solar';
import { SPANNUNGSABFALL_CONTENT } from './spannungsabfall';
import { SPANNUNGSABFALL_12V_CONTENT } from './spannungsabfall-12v';
import { UEBER_WERFT_CONTENT } from './ueber-werft';
import { WECHSELRICHTER_CONTENT } from './wechselrichter';
import type { SeoPageContent } from '../types';

export const CONTENT_PAGES: readonly SeoPageContent[] = [
  CAMPER_ELEKTRIK_PILLAR,
  KABELQUERSCHNITT_CONTENT,
  SPANNUNGSABFALL_CONTENT,
  SICHERUNGEN_CONTENT,
  BATTERIE_CONTENT,
  LIFEPO4_CONTENT,
  AGM_CONTENT,
  SOLAR_CONTENT,
  MPPT_CONTENT,
  WECHSELRICHTER_CONTENT,
  AC_230V_CONTENT,
  SCHALTPLAN_CONTENT,
  RECHNER_HUB_CONTENT,
  SPANNUNGSABFALL_12V_CONTENT,
  BATTERIEKAPAZITAET_CONTENT,
  SOLARANLAGE_CONTENT,
  UEBER_WERFT_CONTENT,
];
