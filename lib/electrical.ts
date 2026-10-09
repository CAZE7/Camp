import { COPPER_CONDUCTIVITY_MS_PER_MM2, COPPER_RESISTIVITY_OHM_MM2_PER_M } from './materials';
import { edgeDomainOf, handleDomain, type HandleDomainValue } from './domain/handleDomains';

export const VDE_SIZES = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0, 70.0, 95.0, 120.0];

/**
 * Strombelastbarkeit (A) je Querschnitt — Kupfer, PVC.
 *
 * Werte-Referenz: veröffentlichte Belastbarkeitstabellen nach DIN VDE 0298-4,
 * Verlegeart B2 (im Rohr auf Wand), 2 belastete Adern, 30 °C — die Werte
 * {16.5, 23, 30, 38, 52, 69, 90, 111} decken sich mit den veröffentlichten
 * B2-Reihen; 50/70 mm² (136/172) weichen von einer verbreiteten Referenz
 * (133/168) leicht ab und sind unverändert übernommen (bestehende Pläne
 * und Golden Master). KEINE Klausel-Referenz — der Fahrzeugkontext
 * (FLRY, DIN EN 1648-2 / ISO 6722) ist NICHT modelliert; das ist eine
 * dokumentierte, konservative Annahme (AUDIT NORM-003).
 */
export const VDE_AMPACITY: Record<number, number> = {
  1.5: 16.5,
  2.5: 23.0,
  4.0: 30.0,
  6.0: 38.0,
  10.0: 52.0,
  16.0: 69.0,
  25.0: 90.0,
  35.0: 111.0,
  50.0: 136.0,
  70.0: 172.0,
  /** Erweiterte Querschnitte (DIN VDE 0298-4 B2 / Verlegeart Rohr auf Wand, 2 belastete Adern, 30 °C).
   * 95 mm² = 207 A, 120 mm² = 242 A — konservativ an bestehende Modellreihe angepasst
   * (Verhältnis zu Standard-B2-Werten ≈ 0,88, konsistent mit 50/70 mm²). Quelle: veröffentlichte
   * Belastbarkeitstabellen (elektrical-installation.org, voltflow.net, bayka.de), Transkription.
   * Erweiterung ermöglicht auto-valid Kabeldimensionierung für Ströme > 120 A (Auftrag Phase 5). */
  95.0: 207.0,
  120.0: 242.0,
};

/**
 * Häufungsfaktoren $k_B(n)$ (f_H) für gebündelte Stromkreise — Mission
 * Stufe 2, L1 aus `docs/ROUTING-MULTIPHYSICS.md` §3.2/§6.2.
 *
 * ZITATPRÜFUNG 2026-09-28 — Transkription der Zeile „Gebündelt, direkt auf
 * der Wand, dem Fußboden, im Elektroinstallationsrohr/-kanal, auf oder in
 * der Wand" (Referenzverlegearten B/C, 100 % Nennlast im Dauerbetrieb,
 * einlagige Gruppe, gleiche Querschnitte) aus zwei unabhängigen, sich für
 * n = 1…9 deckenden Publikationen:
 *
 *   [Q1] electrical-installation.org, „Bestimmung des Leiterquerschnittes
 *        von Kabeln und Leitungen nach ihrer Verlegeart", Abschnitt
 *        „Häufung von Leitern und Kabeln" (G16 = VDE 0298-4 Tabelle 22
 *        nach IEC 60364-5-52); Seite Stand 2020-12-29, abgerufen 2026-09-28.
 *   [Q2] elekrechner.com, „Strombelastbarkeit Tabelle nach DIN VDE 0298-4",
 *        Abschnitt „Häufung gebündelter Leitungen" (DIN VDE 0298-4:2017);
 *        Seite Stand 2026-03-07, abgerufen 2026-09-28.
 *
 * Gemeinsame Werte n = 1…9: 1,00 · 0,80 · 0,70 · 0,65 · 0,60 · 0,57 ·
 * 0,54 · 0,52 · 0,50.
 *
 * BEWUSST NICHT GEMISCHT / VERWORFEN: DIN VDE 0298-4:2003 (Ältere Ausgabe,
 * zitiert u. a. in der ABB-Unterlage 2CDC400027D0104) nennt für n = 7…9
 * 0,52 / 0,48 / 0,45; Grob-Tabellen mit „6–8: 0,55" u. ä. sind vereinfachte
 * Nachbildungen. Es wird EINE Tabelle transkribiert (Hausregel, wie
 * `VDE_AMPACITY`) — keine Auswahl nach Wunschrichtung.
 *
 * KEINE Klausel-Referenz: Der Normtext ist nicht lizenziert; die Werte sind
 * eine dokumentierte Sekundärquellen-Transkription (vgl. AUDIT NORM-003).
 *
 * Mission-Vorgabe: n > 9 ist in der Tabelle NICHT definiert — `groupFactor`
 * wirft (Fehler statt Schätzung, Regel M). Der PRODUKTIVWERT bleibt bis zu
 * einem begründeten Recapture der pauschale `DERATE_FACTOR` 0,7 —
 * „nie optimistischer als 0,7 ohne Recapture": f_H(2) = 0,80 läge darüber,
 * dürfte also den Ist-Wert nicht still ersetzen.
 */
export const VDE_GROUP_FACTORS: Record<number, number> = Object.freeze({
  1: 1.0,
  2: 0.8,
  3: 0.7,
  4: 0.65,
  5: 0.6,
  6: 0.57,
  7: 0.54,
  8: 0.52,
  9: 0.5,
});

/** Höchste in der Tabelle definierte Anzahl belasteter Stromkreise (größeres n ⇒ Fehler). */
export const VDE_GROUP_FACTORS_MAX_N = 9;

/**
 * Häufungsfaktor $k_B(n)$ — ganzzahlig 1…`VDE_GROUP_FACTORS_MAX_N`.
 *
 * @throws RangeError bei n > 9 (Tabelle endet — Mission: „n>9 error"),
 *   Nicht-Ganzzahl oder n < 1. Kein stiller Default (Regel M).
 */
export function groupFactor(bundleCircuits: number): number {
  if (!Number.isInteger(bundleCircuits) || bundleCircuits < 1) {
    throw new RangeError(
      `groupFactor: Anzahl belasteter Stromkreise muss ganze Zahl ≥ 1 sein (erhielt ${bundleCircuits})`
    );
  }
  if (bundleCircuits > VDE_GROUP_FACTORS_MAX_N) {
    throw new RangeError(
      `groupFactor: n = ${bundleCircuits} überschreitet ${VDE_GROUP_FACTORS_MAX_N} — Häufungsfaktor laut VDE-0298-4-Tabelle nicht definiert (Mission Stufe 2: Fehler statt Schätzung)`
    );
  }
  const factor = VDE_GROUP_FACTORS[bundleCircuits];
  if (factor === undefined) {
    // Unerreichbar bei obigen Guards — trotzdem kein `?? …`-Fallback.
    throw new RangeError(`groupFactor: kein Eintrag für n = ${bundleCircuits}`);
  }
  return factor;
}

/**
 * Einheitlicher Korrekturfaktor (Derating), der Umgebungstemperatur > 30 °C und
 * Bündelung pauschal abdeckt, weil individuelle Korrekturfaktoren (DIN VDE
 * 0298-4 Tab. 3/4) nicht modelliert sind. Bewusst konservativ (0.7).
 *
 * EINZIGE Iz-Wahrheit (AUDIT ELE-001): Sowohl die thermische Dimensionierung
 * (`lookupThermalCrossSection`: benötigt Tabellenwert ≥ I / DERATE_FACTOR,
 * d. h. Iz_design = 0.7 · Tabelle) als auch die Sicherungsgrenze (FUSE_MAP,
 * abgeleitet) nutzen denselben Wert — die Koordination
 * I_B ≤ I_n ≤ I_z ist damit im Modell durch Konstruktion erfüllt.
 */
export const DERATE_FACTOR = 0.7;

/**
 * Maximale ungeschützte Leitungslänge ab Batteriepol bis zum Schutzorgan
 * (AUDIT ELE-004 — Normverankerung NACHGEZOGEN 2026-09-08, vorher UNVERIFIED).
 *
 * Die „20-cm-Regel" ist KEINE Faustregel ohne Quelle, sondern der wörtliche
 * Wert aus **ISO 10133:2000, §8.1** (small craft, extra-low-voltage DC):
 * „A manually reset trip-free circuit-breaker, or a fuse, shall be installed
 * within 200 mm of the source of power for each circuit or conductor of the
 * system or, if impractical, each conductor shall be contained within a
 * protective covering […] for its entire length from the source of power to
 * the circuit-breaker or fuse." — VERIFIED (Wortlaut).
 *
 * Verwandte Referenz (nicht widersprechend, leicht strenger):
 * **ABYC E-11 §11.10.1.1.1**: Schutzorgan innerhalb von 7 in = **178 mm**
 * (entlang des Leiters gemessen); Ausnahmen: 40 in (102 cm), wenn der Leiter
 * durchgehend in Schutzschlauch/Verkleidung liegt und NICHT direkt am
 * Batteriepol anschließt; ≤ 72 in (183 cm) bei direktem Batterieanschluss
 * im Schutzschlauch; Anlasser-Stromkreis ausgenommen. VERIFIED (Wortlaut-
 * Exzerpt 2010).
 * ISO 10133:2012 (Nachfolgeedition, von REC/COM/Bootspraxis referenziert)
 * nennt die 200 mm nicht mehr explizit und fordert Schutz „at the source of
 * power" — die konkrete Zahl stammt aus der 2000er-Edition.
 *
 * Für den Fahrzeug-/Camper-Kontext nennt DIN VDE 0100-721 KEINE konkrete
 * Länge (Verweis auf allgemeinen Schutz bei Überlast/Kurzschluss) — die
 * 0,2 m sind damit eine bewusste, dokumentierte Planungsvorgabe: exakt der
 * ISO-10133:2000-Wert und nahe am ABYC-178-mm-Wert. Starter-/Anlasser-
 * Stromkreise (Starterbatterie → Anlasser) sind fachlich ein anderer Fall
 * (ABYC-Ausnahme); CAMP modelliert keinen Anlasser-Kreis.
 */
export const FUSE_MAX_UNPROTECTED_LENGTH_M = 0.2;

/** Maschinenlesbare Quellenzeile für strukturierte Fehler (UX-001). */
export const FUSE_MAX_UNPROTECTED_SOURCE =
  'ISO 10133:2000 §8.1 (200 mm); ABYC E-11 §11.10.1.1.1 (7 in = 178 mm)';

/**
 * Übliche Norm-Sicherungsgrößen in Ampere (Blade ATO/ATC, MIDI, ANL).
 * Wird von Auto-Wire und der Live-Validierung verwendet, damit die gewählte
 * Sicherung immer einem real verfügbaren Sicherungswert entspricht.
 */
export const STANDARD_FUSE_SIZES = [
  5, 7.5, 10, 15, 16, 20, 25, 30, 32, 40, 50, 60, 63, 80, 100, 125, 160, 200, 250, 300, 350, 400,
];

/**
 * Maximal zulässige Sicherung je Querschnitt — ABGELEITET (AUDIT ELE-001):
 * größte Norm-Sicherung, die noch unter der design-Belastbarkeit
 * VDE_AMPACITY × DERATE_FACTOR liegt. Vorher war FUSE_MAP eine hand-
 * gepflegte Tabelle OHNE Normquelle, die für jeden Querschnitt ÜBER der
 * eigenen Dimensionierungs-Belastbarkeit lag (z. B. 25 mm²: Iz_design 63 A,
 * maxFuse 80 A) — die Sicherung schützte den Leiter nach dem eigenen Modell
 * nicht. Die Koordinationsregel I_B ≤ I_n ≤ I_z ist DIN VDE 0100-430
 * (bzw. DIN EN 60364-4-43) entlehnt; die Werte selbst sind Modellwerte,
 * KEINE Zitatwerte aus 0298-4 (dort gibt es keine Sicherungstabelle).
 */
export const FUSE_MAP: Record<number, number> = (() => {
  const map: Record<number, number> = {};
  for (const size of VDE_SIZES) {
    const designIz = (VDE_AMPACITY[size] ?? 0) * DERATE_FACTOR;
    // Größte Norm-Sicherung ≤ design-Iz (absteigend suchen, EPS gegen Float-Rand).
    const fuse = [...STANDARD_FUSE_SIZES].reverse().find((rating) => rating <= designIz + 1e-9);
    map[size] = fuse ?? 5;
  }
  return Object.freeze(map);
})();

export const calculateMaxFuse = (crossSection: number): number => {
  const maxFuse = FUSE_MAP[crossSection];
  if (maxFuse === undefined) {
    throw new RangeError(`Unbekannter Querschnitt: ${crossSection}mm²`);
  }
  return maxFuse;
};

/**
 * Kabel-Maximalsicherung für ANZEWECKE (Edge-Label, Metrics): klemmt
 * Nicht-Normquerschnitte auf die größte Normstufe ≤ Querschnitt ein, statt
 * zu werfen. calculateCrossSection gibt bewusst >70 mm² (z. B. importierte
 * 95 mm²) unverändert durch — würde das direkt an calculateMaxFuse,
 * crashte die gesamte Canvas-Render-Pipeline mit RangeError.
 * Für Validierer/Dimensionierung bleibt calculateMaxFuse die strikte
 * Variante (Werfen = expliziter Fehler statt stillschweigender Duldung).
 */
export const maxFuseForDisplay = (crossSection: number): number => {
  const sizes = Object.keys(FUSE_MAP)
    .map(Number)
    .sort((a, b) => a - b);
  let largestAtOrBelow = sizes[0] ?? 1.5;
  for (const size of sizes) {
    if (size <= crossSection) largestAtOrBelow = size;
    else break;
  }
  return FUSE_MAP[largestAtOrBelow] ?? 0;
};

/**
 * Kleinste Norm-Sicherung — Listenerste Element, einmal bewiesen (noUncheckedIndexedAccess).
 */
export const MIN_STANDARD_FUSE: number = (() => {
  const first = STANDARD_FUSE_SIZES[0];
  if (first === undefined) throw new Error('STANDARD_FUSE_SIZES ist leer — MIN_STANDARD_FUSE ungültig');
  return first;
})();

/**
 * Berechnet die passende Sicherungsgröße für eine Leitung:
 *
 *   Verbraucher-Nennstrom ≤ Sicherungsnennstrom ≤ Kabel-Maximalsicherung
 *
 * Es wird die kleinste Norm-Sicherung gewählt, die den Nennstrom trägt und
 * den durch den Kabelquerschnitt erlaubten Maximalwert (FUSE_MAP, abgeleitet
 * aus Iz_design = 0,7 × Tabellenwert — ein MODELLWERT, keine Normtabelle; die
 * DIN VDE 0298-4 enthält keine Sicherungstabelle, AUDIT ELE-010) nicht
 * überschreitet. Dadurch schützt die Sicherung das
 * Kabel und löst bei Überlast zuverlässig aus, ohne im Normalbetrieb
 * ungewollt auszulösen.
 *
 * WICHTIG: Wenn selbst die größte zulässige Sicherung für das Kabel den
 * Nennstrom nicht tragen kann, wird `maxFuse` zurückgegeben (niemals ein
 * Wert darüber). So kann die Funktion nie eine überdimensionierte Sicherung
 * empfehlen, die das Kabel im Kurzschlussfall nicht schützt. In diesem Fall
 * ist der Rückgabewert kleiner als der Nennstrom — ein Signal, dass der
 * Querschnitt vergrößert werden muss.
 *
 * @param currentA      Nennstrom der Leitung in Ampere
 * @param crossSection  Kabelquerschnitt in mm²
 * @returns             Sicherungsgröße in Ampere (≤ FUSE_MAP[crossSection])
 */
export const selectFuseSize = (currentA: number, crossSection: number): number => {
  const maxFuse = calculateMaxFuse(crossSection);
  const minFuse = Math.max(1, Math.ceil(currentA));
  for (const size of STANDARD_FUSE_SIZES) {
    if (size >= minFuse && size <= maxFuse) {
      return size;
    }
  }
  // Keine Norm-Sicherung erfüllt minFuse ≤ size ≤ maxFuse. Statt eine
  // zu große Sicherung über dem Kabel-Maximum zu wählen, wird der
  // Kabel-Höchstwert zurückgegeben — der Querschnitt ist zu klein.
  return maxFuse || MIN_STANDARD_FUSE;
};

/**
 * Prüft, ob ein Kabelquerschnitt für den Nennstrom ausreicht, also
 * eine zulässige Sicherung gefunden werden kann, die ≥ Nennstrom und
 * ≤ Kabel-Maximalsicherung ist.
 */
export const isFuseFeasible = (currentA: number, crossSection: number): boolean => {
  const maxFuse = calculateMaxFuse(crossSection);
  const minFuse = Math.max(1, Math.ceil(currentA));
  return minFuse <= maxFuse;
};

/** Größter Querschnitt, für den eine Belastbarkeitstabelle hinterlegt ist. */
export const MAX_MODELED_CROSS_SECTION_MM2: number = (() => {
  const last = VDE_SIZES[VDE_SIZES.length - 1];
  if (last === undefined) throw new Error('VDE_SIZES ist leer — Modellgrenze nicht bestimmbar');
  return last;
})();

/** Größter Tabellenstrom, den das Modell kennt (A) — Belastbarkeit bei `MAX_MODELED_CROSS_SECTION_MM2`. */
export const MAX_MODELED_AMPACITY_A: number = (() => {
  const value = VDE_AMPACITY[MAX_MODELED_CROSS_SECTION_MM2];
  if (value === undefined) {
    throw new Error(`VDE_AMPACITY kennt ${MAX_MODELED_CROSS_SECTION_MM2} mm² nicht — Modellgrenze unbekannt`);
  }
  return value;
})();

/**
 * Ergebnis der thermischen Querschnittssuche — AUSDRÜCKLICH ZWEIWERTIG.
 *
 * Warum eine Union statt einer Zahl (AUDIT ELE-002, Auftrag Phase 5): Die
 * frühere Funktion lieferte oberhalb der größten Normstufe **still** 70 mm²
 * zurück. Jeder Aufrufer durfte das als „ausreichend“ lesen — eine
 * Unterdimensionierung ohne Signal. Jetzt gibt es für „innerhalb des
 * Modells“ einen Querschnitt und für „außerhalb“ die zwei Randzahlen
 * (`requiredCurrentA`, `maximumModeledCurrentA`). Wer eine Eignungsaussage
 * trifft, MUSS den Status prüfen; eine 70-mm²-Empfehlung für 400 A kann so
 * nicht mehr entstehen.
 */
export type AmpacityModelBoundary =
  | { status: 'within-model'; crossSectionMm2: number }
  | { status: 'outside-model'; requiredCurrentA: number; maximumModeledCurrentA: number };

/**
 * Kleinster Normquerschnitt, dessen Tabellenwert den Strom inklusive Derating
 * trägt — oder der dokumentierte Modellrand.
 *
 * @throws RangeError bei nicht-endlichem oder negativem Strom (Regel M).
 */
export function thermalCrossSectionFor(currentA: number): AmpacityModelBoundary {
  if (!Number.isFinite(currentA) || currentA < 0) {
    throw new RangeError(`thermalCrossSectionFor: Strom muss endlich und ≥ 0 sein (erhielt ${currentA})`);
  }
  const requiredAmpacity = currentA * (1 / DERATE_FACTOR);
  const size = VDE_SIZES.find((s) => (VDE_AMPACITY[s] ?? 0) >= requiredAmpacity);
  if (size === undefined) {
    return {
      status: 'outside-model',
      requiredCurrentA: currentA,
      maximumModeledCurrentA: MAX_MODELED_AMPACITY_A * DERATE_FACTOR,
    };
  }
  return { status: 'within-model', crossSectionMm2: size };
}

/**
 * Größter Normquerschnitt, den die Tabelle für diesen Strom hergibt.
 *
 * **Diese Zahl ist NICHT die Aussage „reicht“.** Oberhalb der Modellgrenze
 * liefert sie die größte bekannte Stufe — der Aufrufer, der daraus eine
 * Eignung ableiten will, prüft vorher `thermalCrossSectionFor(I).status`
 * (dann steht dort `outside-model`). Genau diese Trennung verhindert, dass
 * „70 mm² genügt“ für Ströme behauptet wird, für die es keine Tabelle gibt.
 */
export const lookupThermalCrossSection = (I: number): number => {
  const boundary = thermalCrossSectionFor(I);
  return boundary.status === 'within-model' ? boundary.crossSectionMm2 : MAX_MODELED_CROSS_SECTION_MM2;
};

/**
 * EMPFEHLUNG: der kleinste Normquerschnitt, der Spannungsfall-Budget und
 * Thermik für Strom `I` über `length` erfüllt — bzw. der gespeicherte
 * (größere) Querschnitt, wenn der Nutzer bereits dicker geplant hat.
 *
 * **Diese Funktion liefert NICHT den eingebauten Querschnitt.** Sie gibt
 * bewusst nie weniger zurück als `dataCrossSection` (eine vorhandene Leitung
 * darf nicht stillschweigend geschwächt werden). Wer bewerten will, was
 * tatsächlich verlegt ist, nutzt `assessCableSelection` — sonst bewertet die
 * Anzeige die Empfehlung statt der Leitung (AUDIT ELE-001).
 */
export const calculateCrossSection = (
  I: number,
  length: number,
  dataCrossSection?: number,
  electricalDomain: 'DC_12V' | 'AC_230V' = 'DC_12V'
): number => {
  // Schritt A: Mindestquerschnitt nach Spannungsfall
  // DC 12V: 3% von 12V = 0.36V — fachüblicher Planungswert für Niederspannungs-
  //   Gleichstromkreise (KEINE Zitatgröße aus DIN VDE 0298-4; die 0298-4 enthält
  //   Belastbarkeiten, keine Spannungsfall-Grenzwerte. Grenzwert-Herkunft ist
  //   Praxis-/Faustregel, z. B. 0100-520-umfeld 3 % Licht / 5 % Sonstiges).
  // AC 230V: 3% von 230V = 6.9V → 4.6V (2% konservativer Planungswert)
  const maxAllowedVoltageDrop = electricalDomain === 'AC_230V' ? 4.6 : 0.36;
  const dropArea = (I * (length * 2)) / (COPPER_CONDUCTIVITY_MS_PER_MM2 * maxAllowedVoltageDrop);

  // Schritt B: Mindestquerschnitt nach thermischer Belastbarkeit.
  // Die Modellgrenze wird EXPLIZIT behandelt (Auftrag Phase 5): Liegt der
  // Strom über der größten hinterlegten Belastbarkeit, gibt es keine
  // Tabellenstufe — die Empfehlung bleibt an der Modellgrenze, aber der
  // Status ist als `outside-model` (bzw. `beyondModeledRange` in
  // `assessCableSelection`) ausgewiesen statt als „70 mm² genügt“.
  const thermalBoundary = thermalCrossSectionFor(I);
  const thermalArea =
    thermalBoundary.status === 'within-model'
      ? thermalBoundary.crossSectionMm2
      : MAX_MODELED_CROSS_SECTION_MM2;

  // Finaler Querschnitt: Maximum aus beiden Kriterien und eventuellem manuellen Querschnitt
  const rawMax = Math.max(1.5, dropArea, thermalArea, dataCrossSection || 0);

  // Aufgerundet auf die nächste VDE-Normgröße. Über 70 mm² hinaus gibt es in
  // der Normreihe keine Stufe mehr; ein vorhandener Nutzer-/importierter
  // Querschnitt (z. B. 95 mm²) darf dabei nie auf 70 mm² heruntergerundet
  // werden — das würde eine bereits größere Leitung stillschweigend schwächen.
  const fallback = dataCrossSection ? Math.max(rawMax, dataCrossSection) : 70.0;
  return VDE_SIZES.find((size) => size >= rawMax) || fallback;
};

/**
 * Ergebnis der Querschnitts-Bewertung einer Kante: **verbaut vs. gefordert**
 * (AUDIT ELE-001).
 *
 * Der Fehler, den diese Struktur unmöglich macht: Anzeige, Spannungsfall,
 * Label und Sicherungsgrenze rechneten mit `calculateCrossSection(…, data.crossSection)`
 * — also mit der EMPFEHLUNG. Bei einer zu dünn gespeicherten Leitung (2,5 mm²
 * gespeichert, 10 mm² gerechnet) zeigte der Plan 10 mm², 2,87 % Spannungsfall
 * und 32 A Maximalsicherung, während real 2,5 mm² mit 11,49 % und höchstens
 * 16 A verlegt waren. Die Sicherungsangabe war damit um den Faktor 2 zu
 * optimistisch.
 */
export type CableSelection = {
  /** Querschnitt, der nach dem Modell VERBAUT ist: gespeicherter Wert, sonst die Empfehlung. */
  installedCrossSection: number;
  /** Querschnitt, den Spannungsfall + Thermik fordern (ohne gespeicherten Wert). */
  recommendedCrossSection: number;
  /** true = der gespeicherte Querschnitt stammt aus Plan/Import. */
  crossSectionIsStored: boolean;
  /** true = verbauter Querschnitt ist kleiner als die Empfehlung. */
  undersized: boolean;
  /**
   * true = der Strom liegt oberhalb der größten hinterlegten Belastbarkeit
   * (Auftrag Phase 5). Dann gibt es KEINE Querschnittsempfehlung aus der
   * Tabelle; die Anzeige muss „Für diesen Strom liegt keine hinterlegte
   * Belastbarkeitstabelle vor“ sagen und darf nicht „70 mm² genügt“ behaupten.
   */
  beyondModeledRange: boolean;
  /** Geforderter Tabellenstrom (A) — nur gesetzt, wenn `beyondModeledRange`. */
  requiredTableCurrentA: number | null;
  /** Größter hinterlegter Tabellenstrom (A) — die Modellgrenze selbst. */
  maximumModeledCurrentA: number;
};

/** Bewertet gespeicherten gegen den geforderten Querschnitt (AUDIT ELE-001). */
export const assessCableSelection = (
  I: number,
  length: number,
  storedCrossSection: number | undefined,
  electricalDomain: 'DC_12V' | 'AC_230V' = 'DC_12V'
): CableSelection => {
  const recommendedCrossSection = calculateCrossSection(I, length, undefined, electricalDomain);
  const thermalBoundary = thermalCrossSectionFor(I);
  const hasStored =
    typeof storedCrossSection === 'number' && Number.isFinite(storedCrossSection) && storedCrossSection > 0;
  const installedCrossSection = hasStored ? storedCrossSection : recommendedCrossSection;
  const beyondModeledRange = thermalBoundary.status === 'outside-model';
  return {
    installedCrossSection,
    recommendedCrossSection,
    crossSectionIsStored: hasStored,
    // Toleranz gegen Float-Ränder, nicht gegen echte Unterdimensionierung.
    undersized: hasStored && installedCrossSection < recommendedCrossSection - 1e-9,
    beyondModeledRange,
    requiredTableCurrentA: beyondModeledRange ? I : null,
    maximumModeledCurrentA: MAX_MODELED_AMPACITY_A * DERATE_FACTOR,
  };
};

/**
 * Design-Belastbarkeit $I_z^{design}(A)$ = Tabellenwert × Derating.
 *
 * 1-Argument (PRODUKTIV, unverändert): × `DERATE_FACTOR` 0,7 — die
 * „Ist"-Wahrheit von AUDIT ELE-001; sizing/fuse/validierung rufen so auf
 * und bleiben byte-stabil.
 *
 * 2. Argument (MISSION Stufe 2, Evaluierung/Validierung): × $k_B(n)$ aus
 * `groupFactor` — die Spec-Formel $I_{z,eff} = I_{z,Tabelle} \cdot
 * k_\vartheta \cdot k_B \cdot k_V$ (§3.2) mit Basis B2/30 °C
 * ($k_\vartheta = k_V = 1$). NICHT für automatische Dimensionierung:
 * f_H(2) = 0,80 wäre optimistischer als die Pauschale 0,7 — Einsatz nur
 * nach begründetem Recapture (L1-Regel, Drift-Guard im Test).
 */
export const designAmpacity = (crossSection: number, bundleCircuits?: number): number => {
  const table = VDE_AMPACITY[crossSection] ?? 0;
  if (bundleCircuits !== undefined) {
    // Evaluierungsvariante (Mission Stufe 2): Tabellenwert × k_B(n). Bewusst
    // NICHT die Produktivwahrheit — f_H(2) = 0,80 läge über der Pauschale 0,7.
    return table * groupFactor(bundleCircuits);
  }
  // Produktiv: exakt dieselbe Zahl wie die EINE I_z-Funktion. Unbekannte
  // Querschnitte bleiben hier bewusst 0 (Drift-Guard Test) — die strikte
  // Variante, die bei fehlendem Tabellenwert WIRFT, ist `calculateCableIz`.
  if (VDE_AMPACITY[crossSection] === undefined) return 0;
  return calculateCableIz({ crossSectionMm2: crossSection }).correctedIz;
};

/**
 * Thermische Überlast eines KONKRETEN Querschnitts: der Strom übersteigt
 * dessen Design-Belastbarkeit. Über `calculateCrossSection` ist das nicht
 * erkennbar (dort ist Iz nur ein Term der Empfehlung); hier ist es das
 * Verdikt über die verlegte Leitung.
 */
export const isThermallyOverloaded = (I: number, crossSection: number): boolean => {
  const iz = calculateCableIz({ crossSectionMm2: crossSection }).correctedIz;
  return iz > 0 && I > iz + 1e-9;
};

// ============================================================================
// DIE EINE I_z-WAHRHEIT (`calculateCableIz`)
// ============================================================================
//
// Vorher lagen die Faktoren an zwei Orten: die Planer-Pauschale hier
// (`DERATE_FACTOR`), die physikalischen Faktoren f₁/f₂ in
// `lib/verify/physics.ts` (`calculateCorrectedIz`). Beide beschrieben
// dieselbe Leitung, durften aber auseinanderlaufen — genau das Verbotene in
// einem „eine Quelle je Zuständigkeit"-Repo. Ab hier gibt es EINE Funktion,
// die jede zulässige Belastbarkeit bildet; `physics.calculateCorrectedIz` ist
// nur noch ihre Fassade für die Verifikation (gleiche Zahlen, andere Namen).

/** Isolierstoffklasse — bestimmt die Grenzleitertemperatur T_max. */
export type InsulationClass = 'PVC' | 'XLPE';

/** Grenzleitertemperaturen der Isolierstoffe in °C (IEC 60364-5-52 Tab. 52-4). */
export const MAX_CONDUCTOR_TEMPERATURE_C: Record<InsulationClass, number> = {
  PVC: 70,
  XLPE: 90,
};

/** Referenz-Umgebungstemperatur der Tabellenwerte in °C (Luft). */
export const REFERENCE_AMBIENT_C = 30;

/**
 * Umgebungstemperatur-Korrekturfaktor f₁:
 *
 *   f₁ = √((T_max − ϑ_U) / (T_max − 30 °C))
 *
 * @throws RangeError bei ϑ_U ≥ T_max: Der Leiter kann bei dieser
 *   Umgebungstemperatur gar nicht mehr betrieben werden — das ist kein
 *   Faktor 0, sondern ein Planungsfehler mit Ansage.
 */
export function ambientTemperatureFactor(ambientC: number, insulation: InsulationClass = 'PVC'): number {
  if (!Number.isFinite(ambientC)) {
    throw new RangeError(`ambientTemperatureFactor: Temperatur muss endlich sein (erhielt ${ambientC})`);
  }
  const tMax = MAX_CONDUCTOR_TEMPERATURE_C[insulation];
  if (ambientC >= tMax) {
    throw new RangeError(
      `ambientTemperatureFactor: Umgebung ${ambientC} °C ≥ Grenzleitertemperatur ${tMax} °C (${insulation}) — Betrieb unzulässig`
    );
  }
  return Math.sqrt((tMax - ambientC) / (tMax - REFERENCE_AMBIENT_C));
}

/** Eingabe der einen I_z-Rechnung. Alle Felder beschreiben GENAU EINE Leitung. */
export interface CableIzContext {
  /** Querschnitt der Leitung in mm² (muss in `VDE_AMPACITY` stehen). */
  crossSectionMm2: number;
  /** Umgebungstemperatur in °C; ohne Angabe 30 °C (Tabellenreferenz, f₁ = 1). */
  ambientC?: number;
  /** Isolierstoff (Default PVC, weil die Tabelle PVC-Werte führt). */
  insulation?: InsulationClass;
  /** Anzahl belasteter Stromkreise in derselben Trasse (1…9, s. `groupFactor`). */
  bundledCircuits?: number;
}

/** Woher die angesetzte Korrektur stammt — Report- und UI-Pflicht. */
export type CableIzSource = 'planner-derate' | 'physics-correction';

/** Vertrauensgrad der Zahl: gerechnet oder auf Referenzbedingungen angenommen. */
export type CableIzConfidence = 'computed' | 'reference-conditions-assumed';

/** Vollständige, benannte Aufschlüsselung der zulässigen Belastbarkeit I_z. */
export interface CableIzResult {
  /** Basistabellenwert der Leitung in A (Verlegeart-B2-Reihe). */
  baseIz: number;
  /** f₁ — Umgebungstemperatur (1 bei fehlender Angabe = 30 °C Referenz). */
  ambientFactor: number;
  /** f₂ — Häufung (1 ohne Angabe). */
  groupingFactor: number;
  /** f₃ — Verlegesart (nicht modelliert, explizit 1,0). */
  installationFactor: number;
  /** Planer-Pauschale `DERATE_FACTOR` (0,7) — eigene, dokumentierte Annahme. */
  plannerFactor: number;
  /** Ergebnis: die zulässige Belastbarkeit in A. */
  correctedIz: number;
  /** Welcher der beiden Wege die Zahl bestimmt hat (der strengere gewinnt). */
  source: CableIzSource;
  /** Rechenweg oder Annahme — ohne Angabe: Referenzbedingungen. */
  confidence: CableIzConfidence;
  /** Menschenlesbare Rechnung (UI „Warum?“). */
  explanation: string;
}

/**
 * DIE zentrale I_z-Funktion: zulässige Belastbarkeit EINER Leitung.
 *
 *   I_z = I_z,Basis · min(Planer-Pauschale, f₁ · f₂ · f₃)
 *
 * Der STRENGERE der beiden Wege gewinnt; ein Kältebonus (f₁ > 1) wird nie
 * kapazitätserhöhend angesetzt (`min(1, …)`). Die Pauschale 0,7 wird damit
 * exakt einmal wirksam — nicht doppelt, nicht umgangen.
 *
 * @throws RangeError bei unbekanntem Querschnitt (keine stille 0 A).
 */
export function calculateCableIz(context: CableIzContext): CableIzResult {
  const { crossSectionMm2 } = context;
  const base = VDE_AMPACITY[crossSectionMm2];
  if (base === undefined) {
    throw new RangeError(
      `calculateCableIz: Querschnitt ${crossSectionMm2} mm² ist nicht in der Belastbarkeitstabelle — kein stiller Ersatzwert`
    );
  }

  const insulation = context.insulation ?? 'PVC';
  const hasAmbient = context.ambientC !== undefined;
  const ambientFactor = hasAmbient ? ambientTemperatureFactor(context.ambientC as number, insulation) : 1;
  const groupingFactor = context.bundledCircuits === undefined ? 1 : groupFactor(context.bundledCircuits);
  const installationFactor = 1; // Verlegesart nicht modelliert — explizit 1,0.
  const plannerFactor = DERATE_FACTOR;

  const physical = Math.min(1, ambientFactor * groupingFactor * installationFactor);
  const plannerIsStricter = plannerFactor <= physical;
  const effective = plannerIsStricter ? plannerFactor : physical;
  const correctedIz = base * effective;

  const fmt = (value: number): string => value.toFixed(2);
  const explanation = `I_z = ${fmt(base)} A × min(${fmt(plannerFactor)} [Planerpauschale], ${fmt(
    physical
  )} [f₁ ${fmt(ambientFactor)} × f₂ ${fmt(groupingFactor)} × f₃ ${fmt(installationFactor)}]) = ${fmt(
    correctedIz
  )} A`;

  return {
    baseIz: base,
    ambientFactor,
    groupingFactor,
    installationFactor,
    plannerFactor,
    correctedIz,
    source: plannerIsStricter ? 'planner-derate' : 'physics-correction',
    confidence:
      hasAmbient || context.bundledCircuits !== undefined ? 'computed' : 'reference-conditions-assumed',
    explanation,
  };
}

// ============================================================================
// DIE EINE KOORDINATIONSPRÜFUNG (`evaluateCableProtection`)
// ============================================================================

/** Ergebnis je Teilstück der Koordinationskette `I_b ≤ I_n ≤ I_z`. */
export interface CableProtectionVerdict {
  /** Betriebsstrom I_b in A; `null` = nicht bestimmt. */
  ib: number | null;
  /** Nennstrom I_n des wirksamen Schutzorgans in A; `null` = kein Organ bekannt. */
  in: number | null;
  /** Zulässige Belastbarkeit I_z in A; `null` = nicht bestimmbar. */
  iz: number | null;
  /** Zustand der Kette (Vokabular aus `lib/validationSeverity.ts`). */
  status: 'satisfied' | 'violated' | 'incomplete' | 'not_applicable';
  /** Schwere im Sinne der Anzeige (kritisch nur bei echter Überlast). */
  severity: 'critical' | 'error' | 'warning' | 'info';
  /** Welche Teilstücke verletzt sind — leer, wenn none. */
  violations: readonly ('ib-over-iz' | 'ib-over-in' | 'in-over-iz')[];
  /** Klartext der Rechnung („I_b = 158,7 A ≤ I_n = 100 A ✗ …"). */
  explanation: string;
}

/**
 * Die EINE Prüfung der Schutzkoordination nach IEC 60364-4-43 §433.1:
 *
 *   (1)  I_b ≤ I_n ≤ I_z
 *
 * Vorher stand diese Ungleichung in `lib/verify/ampacity.ts` (Engine), im
 * Kanten-Fehlerpfad (`components/edges/CableEdge.tsx`) und in Teilen der
 * Anzeige jeweils neu — drei Stellen, drei Gelegenheiten zum Auseinanderlaufen.
 * Hier steht sie einmal; alle Validatoren rufen sie auf.
 *
 * Semantik der Zustände:
 *   - `violated`      — mindestens ein Teilstück ist widerlegt (Zahlen liegen vor).
 *   - `incomplete`    — ein Wert fehlt (Ib unbekannt, keine Sicherung, kein Iz).
 *   - `not_applicable`— kein Strom (I_b = 0 A) und kein Organ: nichts zu prüfen.
 *   - `satisfied`     — alle vorliegenden Teilstücke erfüllt.
 *
 * Die Schwere bewertet die FOLGE, nicht die Datenlage: Ein überlasteter Leiter
 * (`I_b > I_z`) ist `critical`, ein zu großer Nennstrom bei tragfähigem Leiter
 * ist `error`, ein fehlendes Organ `warning`, eine Datenlücke `info`.
 */
export function evaluateCableProtection(input: {
  ib: number | null;
  in: number | null;
  iz: number | null;
}): CableProtectionVerdict {
  const { ib, iz } = input;
  const ratedCurrent = input.in;
  const violations: Array<'ib-over-iz' | 'ib-over-in' | 'in-over-iz'> = [];
  const fmt = (value: number | null): string => (value === null ? '—' : `${value.toFixed(1)} A`);

  if (ib !== null && iz !== null && ib > iz + 1e-9) violations.push('ib-over-iz');
  if (ib !== null && ratedCurrent !== null && ib > ratedCurrent + 1e-9) violations.push('ib-over-in');
  if (ratedCurrent !== null && iz !== null && ratedCurrent > iz + 1e-9) violations.push('in-over-iz');

  const explanation = `I_b = ${fmt(ib)} ≤ I_n = ${fmt(ratedCurrent)} ≤ I_z = ${fmt(iz)}`;

  if (violations.includes('ib-over-iz')) {
    return {
      ib,
      in: ratedCurrent,
      iz,
      status: 'violated',
      severity: 'critical',
      violations,
      explanation,
    };
  }
  if (violations.length > 0) {
    return {
      ib,
      in: ratedCurrent,
      iz,
      status: 'violated',
      severity: 'error',
      violations,
      explanation,
    };
  }
  if (ib === null || iz === null) {
    return {
      ib,
      in: ratedCurrent,
      iz,
      status: 'incomplete',
      severity: 'info',
      violations,
      explanation,
    };
  }
  if (ratedCurrent === null) {
    // Leiter thermisch bewertet, aber ohne (wirksames) Schutzorgan: Die
    // Grundanforderung „I_n vorhanden" meldet eine eigene Regel; hier ist die
    // Datenlage unvollständig, keine Verletzung.
    return {
      ib,
      in: null,
      iz,
      status: 'incomplete',
      severity: 'warning',
      violations,
      explanation,
    };
  }
  if (ib === 0 && ratedCurrent === 0 && iz === 0) {
    return { ib, in: ratedCurrent, iz, status: 'not_applicable', severity: 'info', violations, explanation };
  }
  return { ib, in: ratedCurrent, iz, status: 'satisfied', severity: 'info', violations, explanation };
}

// ── ΔU %-Stufen (MISSION Stufe 2: „ΔU% 1/3/4 %") ─────────────────────────
//
// Semantik der drei Missionsschwellen, abgeleitet aus der bestehenden
// Quellenlage (kein Normzitat — die 0298-4 kennt keine Spannungsfall-
// grenzwerte, AUDIT ELE-010; die 3 % sind dokumentierte Planungsannahme):
//   1 %  — Zielband der Evaluierung (μ-Kalibrierung §3.4: 1 % ≡ k px)
//   3 %  — bestehende Planungsgrenze (0,36 V @ 12 V; `hasVoltageDropError`
//          feuert strikt > 3, unverändert)
//   4 %  — kritische Stufe: Werte > 4 % gelten im Report als driftschwer.

/** Zielband ΔU % (MISSION Stufe 2). */
export const VOLTAGE_DROP_PCT_TARGET = 1;
/** Bestehende Planungsgrenze ΔU % (0,36 V @ 12 V, AUDIT ELE-010). */
export const VOLTAGE_DROP_PCT_PLAN_LIMIT = 3;
/** Kritische Stufe ΔU % (MISSION Stufe 2). */
export const VOLTAGE_DROP_PCT_CRITICAL = 4;

export type VoltageDropBand = 'ziel' | 'planungsgrenze' | 'verstoss' | 'kritisch';

/**
 * Einordnung eines Spannungsfall-Prozents in die Stufen 1/3/4 %.
 *
 * Kanten-konsistent mit dem Produktivverdict: (3, …] ⇒ `verstoss` ab
 * `> VOLTAGE_DROP_PCT_PLAN_LIMIT`, weil `hasVoltageDropError` dort feuert;
 * Werte > 4 % werden zusätzlich als `kritisch` ausgezeichnet (härtere
 * Reportklasse, kein zweites Produktivverdict).
 *
 * @throws RangeError bei nicht-endlichem oder negativem Eingangswert
 *   (Regel M: fehlende/ungültige Eingabe wird nicht still „ok").
 */
export function classifyVoltageDropPercent(percent: number): VoltageDropBand {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new RangeError(`classifyVoltageDropPercent: ungültiger Prozentwert ${percent}`);
  }
  if (percent <= VOLTAGE_DROP_PCT_TARGET) return 'ziel';
  if (percent <= VOLTAGE_DROP_PCT_PLAN_LIMIT) return 'planungsgrenze';
  if (percent <= VOLTAGE_DROP_PCT_CRITICAL) return 'verstoss';
  return 'kritisch';
}

/** ρ des Modells — für Kurzschluss-/Schleifenimpedanz-Rechnungen. */
export const COPPER_RESISTIVITY = COPPER_RESISTIVITY_OHM_MM2_PER_M;

export const calculateStrokeWidth = (cs: number): number => {
  if (cs <= 1.5) return 2;
  if (cs <= 4) return 4;
  if (cs <= 6) return 6;
  return 10;
};

export const getEdgeDomain = (
  sourceNodeType: string | undefined,
  targetNodeType: string | undefined,
  sourceHandle: string | null | undefined,
  targetHandle?: string | null
): HandleDomainValue =>
  // Eine Tabelle, eine Funktion: `edgeDomainOf` (lib/domain/handleDomains.ts)
  // kennt seit AUDIT ELE-007 die AC/DC-Rollen und seit AUDIT N2 auch Solar mit
  // derselben Vorrangfolge (Solar → AC → DC), die hier vorher als eigener
  // `isSolarNode`-Vorzweig stand. Zwei Solar-Logiken an zwei Stellen waren die
  // Ursache des gemessenen Drifts `handle=DC_12V / edge=Solar`.
  edgeDomainOf(sourceNodeType, targetNodeType, sourceHandle, targetHandle ?? undefined);

/**
 * Domäne eines Handles beim Ziehen/Verbinden. Delegiert an die gemeinsame
 * Autorität `lib/domain/handleDomains.ts` (AUDIT ELE-007).
 */
export const getHandleDomain = (
  nodeType: string | undefined,
  handleId: string | null | undefined,
  handleType: 'source' | 'target' | undefined
): HandleDomainValue => handleDomain(nodeType, handleId, handleType);
