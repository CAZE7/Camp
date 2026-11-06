/**
 * test/reference/rm4-ac-protection.ts — REFERENZMODELL 4: AC-Schutzkette
 * (Abschaltbedingung, Schleifenimpedanz, PE-Querschnitt).
 *
 * Zweck
 * =====
 * Unabhängige Nachrechnung der 230-V-Abschaltbedingung:
 * Auslösestrom, zulässige Schleifenimpedanz, geschätzter Schleifenwiderstand
 * der Leitung und PE-Querschnitt nach Tabelle 54.2.
 *
 * Kein Import aus `lib/acProtection.ts`.
 *
 * Mathematische Definition
 * ------------------------
 *     I_a   = k · I_n                              k = 5 (B) / 10 (C)
 *     Z_s,max = (2/3) · U₀ / I_a                   (2/3-Regel, DIN VDE 0100-600)
 *     R_Schleife,Leitung = ρ_Cu(20 °C) · L · (1/S_L + 1/S_PE)
 *     Z_s,geschaetzt     = Z_vorgelagert + R_Schleife,Leitung
 *     Bedingung:  Z_s,geschaetzt ≤ Z_s,max     ⇒  Abschaltung im Fehlerfall
 *
 * PE-Querschnitt (IEC 60364-5-54, Tabelle 54.2, Kupfer):
 *     S ≤ 16 mm²      ⇒ S_PE = S
 *     16 < S ≤ 35 mm² ⇒ S_PE = 16 mm²
 *     S > 35 mm²      ⇒ S_PE = S / 2
 *
 * Einheiten
 * ---------
 * I [A], U [V], Z [Ω], S [mm²], L [m], ρ [Ω·mm²/m].
 *
 * Gültigkeitsbereich
 * ------------------
 * - TN-System mit definierter Schleife über den Schutzleiter.
 * - Einphasige Betrachtung, U₀ = 230 V.
 * - Leitungslänge > 0. Eine 0-m-AC-Leitung ist keine Leitung (die
 *   Produktivfunktion meldet das als `missing-length`, dieses Modell wirft).
 *
 * Bekannte Grenzen — die entscheidenden
 * -------------------------------------
 * - `Z_vorgelagert` ist **UNVERIFIED**. CAMP setzt 0,8 Ω als typischen
 *   Campingplatz-Anschluss und 0,15 Ω als Niederimpedanz-Seite derselben
 *   Einspeisung. Beides sind Annahmen, keine Messwerte. Ein Messwert vor Ort
 *   schlägt beide.
 * - Die 2/3-Regel deckt Messunsicherheit und Leitererwärmung pauschal ab; sie
 *   ist eine Regel der Praxis (0100-600), keine physikalische Herleitung.
 * - Wechselrichter-Ausgänge sind elektronisch strombegrenzt — für sie gilt
 *   dieses Modell NICHT (kein TN-Schleifenmodell). Das ist eine
 *   Geräteeigenschaft, keine Rechenvereinfachung.
 * - Ein 30-mA-FI deckt den Fehlerschutz auch außerhalb der magnetischen
 *   Auslösung. Dieses Modell prüft nur die Abschaltbedingung des
 *   Leitungsschutzschalters; es ersetzt keine FI-Bewertung.
 *
 * Quellen
 * -------
 * - k = 5 (B) / 10 (C): IEC 60898-1, Auslösebereich 3–5× bzw. 5–10×.
 *   **Normbeleg.** CAMP rechnet mit der **oberen** Kante (5 bzw. 10) — das ist
 *   die konservative Seite für die Abschaltbedingung.
 * - 2/3-Regel: DIN VDE 0100-600. **Normbeleg.**
 * - PE-Tabelle: IEC 60364-5-54 Tab. 54.2. **Normbeleg.**
 * - U₀ = 230 V: Nennspannung des Modells. **Modellwert** (kein Messwert).
 *
 * Abweichungstoleranz
 * -------------------
 * Exakt (≤ 1e-9 relativ) gegenüber `evaluateAcEdgeProtection` bei gleichen
 * Eingaben und gleicher Vorimpedanz-Annahme.
 */

/** Garantierter Auslösefaktor je Charakteristik — IEC 60898-1, obere Kante. */
export const REF_TRIP_MULTIPLE: Readonly<Record<'B' | 'C', number>> = { B: 5, C: 10 };

/** Modell-Nennspannung [V]. */
export const REF_U0 = 230;

/** 2/3-Regel der Abschaltbedingung. */
export const REF_LOOP_SAFETY_FACTOR = 2 / 3;

/** Vorimpedanz-Annahmen [Ω] — beide UNVERIFIED (s. Kopf). */
export const REF_UPSTREAM_TYPICAL_OHM = 0.8;
export const REF_UPSTREAM_MIN_OHM = 0.15;

/** Materialwert Kupfer [Ω·mm²/m] bei 20 °C. */
export const REF_RHO_CU = 0.0175;

/** Garantierter Auslösestrom I_a = k · I_n [A]. */
export function refGuaranteedTripCurrent(ratedCurrentA: number, characteristic: 'B' | 'C'): number {
  return ratedCurrentA * REF_TRIP_MULTIPLE[characteristic];
}

/** Zulässige Schleifenimpedanz Z_s,max = (2/3) · U₀ / I_a [Ω]. */
export function refMaxLoopImpedance(ratedCurrentA: number, characteristic: 'B' | 'C'): number {
  const ia = refGuaranteedTripCurrent(ratedCurrentA, characteristic);
  if (!(ia > 0)) return 0;
  return REF_LOOP_SAFETY_FACTOR * (REF_U0 / ia);
}

/**
 * PE-Querschnitt nach Tabelle 54.2 [mm²].
 * `0` bei nicht-positivem Phasenquerschnitt (kein Leiter, keine Aussage).
 */
export function refProtectiveEarthCrossSection(phaseCrossSectionMm2: number): number {
  if (!(phaseCrossSectionMm2 > 0)) return 0;
  if (phaseCrossSectionMm2 <= 16) return phaseCrossSectionMm2;
  if (phaseCrossSectionMm2 <= 35) return 16;
  return phaseCrossSectionMm2 / 2;
}

/** Schleifenanteil einer AC-Leitung [Ω]: Hinweg Phase, Rückweg PE. */
export function refCableLoopOhm(
  lengthM: number,
  phaseCrossSectionMm2: number,
  peCrossSectionMm2: number = refProtectiveEarthCrossSection(phaseCrossSectionMm2)
): number {
  if (!(lengthM > 0) || !(phaseCrossSectionMm2 > 0) || !(peCrossSectionMm2 > 0)) {
    throw new RangeError(
      `refCableLoopOhm: Länge, Phasen- und PE-Querschnitt müssen > 0 sein (${lengthM}, ${phaseCrossSectionMm2}, ${peCrossSectionMm2})`
    );
  }
  return REF_RHO_CU * lengthM * (1 / phaseCrossSectionMm2 + 1 / peCrossSectionMm2);
}

export type RefAcVerdict =
  | 'ok'
  | 'fails' // Z_s überschreitet Z_s,max ⇒ Abschaltbedingung nicht erfüllt
  | 'not-assessable'; // Datenlage reicht nicht (nie „ok“)

export interface RefAcResult {
  verdict: RefAcVerdict;
  iaA: number | null;
  zsMaxOhm: number | null;
  cableLoopOhm: number;
  zsOhm: number | null;
  /** Erster fehlender Eingang — für die Meldung. */
  missing?: 'length' | 'cross-section' | 'rated-current' | 'characteristic';
}

/**
 * Abschaltbedingung einer AC-Kante.
 *
 * Wichtig für die Aussagekraft: `not-assessable` ist ein **eigenes** Verdikt
 * und wird niemals zu `ok` hochgestuft. Fehlt die Länge, wäre Z_s = 0 Ω und
 * die Bedingung immer erfüllt — genau dieser stille Fallback ist der Fehler,
 * den RM-4 sichtbar macht.
 */
export function refAcDisconnection(input: {
  ratedCurrentA?: number;
  characteristic?: 'B' | 'C';
  lengthM?: number;
  phaseCrossSectionMm2?: number;
  peCrossSectionMm2?: number;
  upstreamOhm?: number;
}): RefAcResult {
  const upstream = input.upstreamOhm ?? REF_UPSTREAM_TYPICAL_OHM;
  const cableLoopOhm =
    typeof input.lengthM === 'number' &&
    input.lengthM > 0 &&
    typeof input.phaseCrossSectionMm2 === 'number' &&
    input.phaseCrossSectionMm2 > 0
      ? refCableLoopOhm(input.lengthM, input.phaseCrossSectionMm2, input.peCrossSectionMm2)
      : 0;

  if (!(typeof input.lengthM === 'number' && input.lengthM > 0)) {
    return {
      verdict: 'not-assessable',
      iaA: null,
      zsMaxOhm: null,
      cableLoopOhm,
      zsOhm: null,
      missing: 'length',
    };
  }
  if (!(typeof input.phaseCrossSectionMm2 === 'number' && input.phaseCrossSectionMm2 > 0)) {
    return {
      verdict: 'not-assessable',
      iaA: null,
      zsMaxOhm: null,
      cableLoopOhm,
      zsOhm: null,
      missing: 'cross-section',
    };
  }
  if (!(typeof input.ratedCurrentA === 'number' && input.ratedCurrentA > 0)) {
    return {
      verdict: 'not-assessable',
      iaA: null,
      zsMaxOhm: null,
      cableLoopOhm,
      zsOhm: null,
      missing: 'rated-current',
    };
  }
  if (input.characteristic === undefined) {
    return {
      verdict: 'not-assessable',
      iaA: null,
      zsMaxOhm: null,
      cableLoopOhm,
      zsOhm: null,
      missing: 'characteristic',
    };
  }

  const iaA = refGuaranteedTripCurrent(input.ratedCurrentA, input.characteristic);
  const zsMaxOhm = refMaxLoopImpedance(input.ratedCurrentA, input.characteristic);
  const zsOhm = upstream + cableLoopOhm;
  return { verdict: zsOhm <= zsMaxOhm ? 'ok' : 'fails', iaA, zsMaxOhm, cableLoopOhm, zsOhm };
}
