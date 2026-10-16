import { describe, expect, it } from 'vitest';

import { sizeBattery } from '@/lib/batterySizing';
import { calculateCrossSection, designAmpacity, selectFuseSize } from '@/lib/electrical';
import { sizeSolarArray } from '@/lib/solarSizing';
import { CONTENT_PAGES } from '@/lib/seo/content';
import { VORLAGE_AUTARK } from '@/lib/seo/content/autark';
import { VORLAGE_GROSSRAUM } from '@/lib/seo/content/grossraum';
import { VORLAGE_WOCHENEND } from '@/lib/seo/content/wochenend';
import { pageByPath } from '@/lib/seo/inventory';

import { fmt, kreisRechnung } from './vorlagen';

/**
 * Die Vorlagenseiten behaupten Zahlen. Dieser Test rechnet sie nach — mit
 * denselben Modellen, mit denen sie erzeugt wurden. Stimmt eine Zahl auf der
 * Seite nicht mehr zum Modell, fällt es hier auf und nicht erst im Bau.
 */

const VORLAGEN = [VORLAGE_WOCHENEND, VORLAGE_AUTARK, VORLAGE_GROSSRAUM];

describe('Ausbau-Vorlagen', () => {
  it('liefert drei Vorlagen unter eigener Adresse', () => {
    expect(VORLAGEN.map((vorlage) => vorlage.path)).toEqual([
      '/vorlagen/wochenend/',
      '/vorlagen/autark/',
      '/vorlagen/grossraum/',
    ]);
    for (const vorlage of VORLAGEN) {
      expect(vorlage.slug).toMatch(/^(wochenend|autark|grossraum)$/);
      expect(vorlage.kind).toBe('cluster');
      expect(vorlage.topicId).toBe('vorlagen');
      expect(vorlage.contentRevision).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    }
  });

  it('ist im Inventar indexierbar und mit Kopfdaten vertreten', () => {
    for (const vorlage of VORLAGEN) {
      const eintrag = pageByPath(vorlage.path);
      expect(eintrag, `Fehlt im Inventar: ${vorlage.path}`).toBeDefined();
      expect(eintrag?.indexability).toBe('index');
      expect(eintrag?.h1).toBe(vorlage.h1);
      expect(eintrag?.title).toBe(vorlage.title);
      expect(eintrag?.description).toBe(vorlage.description);
      expect(eintrag?.sitemap).toBeDefined();
    }
    expect(CONTENT_PAGES.filter((seite) => seite.path.startsWith('/vorlagen/'))).toHaveLength(3);
  });

  it('führt auf jeder Vorlage eine Stückliste mit Begründung', () => {
    for (const vorlage of VORLAGEN) {
      const stueckliste = vorlage.sections.find((abschnitt) => abschnitt.id === 'stueckliste');
      expect(stueckliste, `Keine Stückliste: ${vorlage.path}`).toBeDefined();
      expect(stueckliste?.table).toBeDefined();
      expect(stueckliste?.table?.head).toEqual(['Position', 'Bauteil', 'Menge', 'Begründung']);
      expect(stueckliste?.table?.rows.length ?? 0).toBeGreaterThanOrEqual(8);
      for (const zeile of stueckliste?.table?.rows ?? []) {
        expect(zeile).toHaveLength(4);
        // Jede Zeile trägt ihren Grund — eine Stückliste ohne Begründung ist
        // nur eine Einkaufsliste.
        expect(zeile[3]!.length, `Zeile ohne Begründung: ${zeile[0]}`).toBeGreaterThan(20);
      }
    }
  });

  it('nennt in jeder Vorlage Annahmen und Grenzen', () => {
    for (const vorlage of VORLAGEN) {
      expect(vorlage.assumptions?.length ?? 0).toBeGreaterThan(0);
      expect(vorlage.limits?.length ?? 0).toBeGreaterThan(0);
      expect(vorlage.sources?.length ?? 0).toBeGreaterThan(0);
      expect(vorlage.faq?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('rechnet die Batterie mit dem Modell der Auslieferung nach', () => {
    // Wochenend: 1 074 Wh/Tag, 2 Tage, 12 V.
    const wochenend = sizeBattery({
      dailyEnergyWh: 1074,
      autonomyDays: 2,
      systemVoltageV: 12,
      chemistry: 'LiFePO4',
      referenceCurrentA: 25,
    });
    expect(VORLAGE_WOCHENEND.title).toContain('Wochenend');
    const text = VORLAGE_WOCHENEND.sections.map((abschnitt) => JSON.stringify(abschnitt)).join(' ');
    expect(text).toContain(`${fmt(wochenend.requiredNominalAh, 1)} Ah`);
    expect(text).toContain(`${wochenend.recommendedNominalAh} Ah`);
    expect(text).toContain(fmt(wochenend.peukertFactor, 3));

    // Autark: 1 474 Wh/Tag, 3 Tage, 12 V.
    const autark = sizeBattery({
      dailyEnergyWh: 1474,
      autonomyDays: 3,
      systemVoltageV: 12,
      chemistry: 'LiFePO4',
      referenceCurrentA: 25,
    });
    const autarkText = VORLAGE_AUTARK.sections.map((abschnitt) => JSON.stringify(abschnitt)).join(' ');
    expect(autarkText).toContain(`${fmt(autark.requiredNominalAh, 1)} Ah`);
    expect(autarkText).toContain(`${autark.recommendedNominalAh} Ah`);

    // Groß: 1 858 Wh/Tag, 2 Tage, 24 V.
    const gross = sizeBattery({
      dailyEnergyWh: 1858,
      autonomyDays: 2,
      systemVoltageV: 24,
      chemistry: 'LiFePO4',
      referenceCurrentA: 25,
    });
    const grossText = VORLAGE_GROSSRAUM.sections.map((abschnitt) => JSON.stringify(abschnitt)).join(' ');
    expect(grossText).toContain(`${fmt(gross.requiredNominalAh, 1)} Ah`);
    expect(grossText).toContain(`${gross.recommendedNominalAh} Ah`);
  });

  it('rechnet die Solarleistung mit dem Modell der Auslieferung nach', () => {
    const sommer = sizeSolarArray({
      dailyEnergyWh: 1074,
      systemVoltageV: 12,
      panelWatts: 100,
      winterDesign: false,
    });
    const text = VORLAGE_WOCHENEND.sections.map((abschnitt) => JSON.stringify(abschnitt)).join(' ');
    expect(text).toContain(`${fmt(sommer.requiredPeakWatts, 0)} Wp`);
    expect(text).toContain(`${sommer.recommendedPeakWatts} Wp`);
    expect(text).toContain(fmt(sommer.coverageFactor, 2));
  });

  it('rechnet die Stromkreise mit dem Modell der Auslieferung nach', () => {
    // Wasserpumpe: 60 W an 12 V, 5 m Leitung.
    const kreis = kreisRechnung('Wasserpumpe', 60, 5, 12);
    expect(kreis.querschnittMm2).toBe(calculateCrossSection(5, 5));
    expect(kreis.belastbarkeitA).toBeCloseTo(designAmpacity(kreis.querschnittMm2), 5);
    expect(kreis.sicherungA).toBe(selectFuseSize(5, kreis.querschnittMm2));

    const text = VORLAGE_WOCHENEND.sections.map((abschnitt) => JSON.stringify(abschnitt)).join(' ');
    expect(text).toContain(`${fmt(kreis.querschnittMm2, 1)} mm²`);
    expect(text).toContain(`${fmt(kreis.sicherungA, 1)} A`);
  });

  it('verlinkt die Vorlagen untereinander und mit dem Planer', () => {
    for (const vorlage of VORLAGEN) {
      const ziele = vorlage.related.map((link) => link.href);
      expect(ziele, `Kein Verweis auf den Planer: ${vorlage.path}`).toContain('/planer/');
      for (const ziel of ziele) {
        expect(ziel.startsWith('/'), `Ungültiges Ziel: ${ziel}`).toBe(true);
        expect(ziel.endsWith('/'), `Ziel ohne Schrägstrich: ${ziel}`).toBe(true);
      }
      // Jede Vorlage verweist auf die beiden anderen — der Weg zwischen ihnen
      // darf nicht nur über die Startseite laufen.
      const schwester = VORLAGEN.filter((andere) => andere.path !== vorlage.path).map(
        (andere) => andere.path
      );
      for (const pfad of schwester) {
        expect(ziele, `Kein Verweis auf ${pfad} von ${vorlage.path}`).toContain(pfad);
      }
    }
  });
});
