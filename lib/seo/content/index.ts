/**
 * lib/seo/content/index.ts — Sammelstelle aller inhaltsgetriebenen Seiten.
 *
 * Die Reihenfolge ist die Reihenfolge, in der die Seiten im Inventar und im
 * Pillar-Raster erscheinen: erst das Einstiegstor, dann die Elektrik-Themen in
 * Planungsreihenfolge, dann Rechner und Vertrauensseite.
 */

import { AC_230V_CONTENT } from './230v';
import { AGM_CONTENT } from './agm';
import { AUSAUS_DOKUMENTATION_CONTENT } from './ausbau-dokumentation';
import { BATTERIE_CONTENT } from './batterie';
import { BATTERIEKAPAZITAET_CONTENT } from './batteriekapazitaet';
import { DIESEL_STANDHEIZUNG_CONTENT } from './diesel-standheizung';
import { ELEKTRIK_FEHLER_CONTENT } from './elektrik-fehler';
import { HEIZUNG_CONTENT } from './heizung';
import { KABELQUERSCHNITT_CONTENT } from './kabelquerschnitt';
import { LADEN_CONTENT } from './laden';
import { LADEBOOSTER_CONTENT } from './ladebooster';
import { LADEBOOSTER_VERGLEICH_CONTENT } from './ladebooster-vergleich';
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
import { STROMVERBRAUCH_CONTENT } from './stromverbrauch';
import { UEBER_ELEKTROPLANER_CONTENT } from './ueber-elektroplaner';
import { WECHSELRICHTER_CONTENT } from './wechselrichter';
import { WOHNMOBILZULASSUNG_CONTENT } from './wohnmobilzulassung';
import type { SeoPageContent } from '../types';

export const CONTENT_PAGES: readonly SeoPageContent[] = [
  CAMPER_ELEKTRIK_PILLAR,
  AUSAUS_DOKUMENTATION_CONTENT,
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
  STROMVERBRAUCH_CONTENT,
  ELEKTRIK_FEHLER_CONTENT,
  LADEN_CONTENT,
  LADEBOOSTER_CONTENT,
  LADEBOOSTER_VERGLEICH_CONTENT,
  UEBER_ELEKTROPLANER_CONTENT,
  HEIZUNG_CONTENT,
  DIESEL_STANDHEIZUNG_CONTENT,
  WOHNMOBILZULASSUNG_CONTENT,
];
