import { describe, expect, it } from 'vitest';

import { checkPublicationOrigin } from './verifyPublicationOrigin';

/**
 * Die Veröffentlichungsadresse ist eine Zusage an Suchmaschinen und Nutzer:
 * Canonical, Sitemap und Asset-Pfade müssen auf dieselbe Adresse zeigen. Der
 * Wächter prüft die Kombination aus Herkunft, Basis-Pfad und CNAME-Datei —
 * die drei Angaben, aus denen die ausgelieferten Adressen entstehen.
 */
const GUELTIG = {
  origin: 'https://elektroplaner-camper.de',
  basePath: '',
  cname: 'elektroplaner-camper.de\n',
};

describe('checkPublicationOrigin', () => {
  it('akzeptiert die Custom Domain an der Wurzel', () => {
    const result = checkPublicationOrigin(GUELTIG);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it('meldet einen Basis-Pfad, der nicht zur Wurzel passt', () => {
    const result = checkPublicationOrigin({ ...GUELTIG, basePath: '/Camp' });
    expect(result.ok).toBe(false);
    expect(result.problems.map((problem) => problem.rule)).toContain('basis-pfad');
  });

  it('meldet eine fehlende CNAME-Datei', () => {
    const result = checkPublicationOrigin({ ...GUELTIG, cname: null });
    expect(result.ok).toBe(false);
    expect(result.problems.map((problem) => problem.rule)).toContain('cname-fehlt');
  });

  it('meldet eine CNAME-Datei, die nicht zur Herkunft passt', () => {
    const result = checkPublicationOrigin({ ...GUELTIG, cname: 'beispiel.de' });
    expect(result.ok).toBe(false);
    expect(result.problems.map((problem) => problem.rule)).toContain('cname-abweichung');
  });

  it('meldet eine Herkunft mit Pfad und eine ohne HTTPS', () => {
    const result = checkPublicationOrigin({
      origin: 'http://elektroplaner-camper.de/unterpfad',
      basePath: '',
      cname: 'elektroplaner-camper.de',
    });
    expect(result.ok).toBe(false);
    const rules = result.problems.map((problem) => problem.rule);
    expect(rules).toContain('origin-https');
    expect(rules).toContain('origin-wurzel');
  });

  it('meldet eine unlesbare Herkunft, statt sie zu übergehen', () => {
    const result = checkPublicationOrigin({ ...GUELTIG, origin: 'nicht-eine-adresse' });
    expect(result.ok).toBe(false);
    expect(result.problems.map((problem) => problem.rule)).toContain('origin-ungueltig');
  });

  it('nennt bei jedem Befund den nächsten Schritt', () => {
    const result = checkPublicationOrigin({ ...GUELTIG, basePath: '/Camp', cname: null });
    expect(result.message).toContain('Custom Domain');
    expect(result.problems.every((problem) => problem.message.length > 20)).toBe(true);
  });
});
