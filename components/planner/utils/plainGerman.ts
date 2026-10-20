/**
 * Klartext für die primäre Oberfläche (Warnung, Abhilfe, Modellgrenzen).
 *
 * Formelzeichen und Regel-Codes bleiben in den technischen Details und in
 * der Engine. Hier werden nur Texte umgeschrieben, die ein Erstnutzer liest.
 */

const PHRASES: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /\(I_n\s*≤\s*I_z,\s*AMP-001\)/g,
    '(der Nennstrom darf die zulässige Strombelastbarkeit nicht übersteigen)',
  ],
  [/\(I_b beachten\)/g, '(den Betriebsstrom dabei nicht unterschreiten)'],
  [
    /\(In\s*≥\s*I_b,\s*In\s*≤\s*I_z\)/g,
    '(Nennstrom mindestens so hoch wie der Betriebsstrom und höchstens so hoch wie die zulässige Strombelastbarkeit)',
  ],
  [
    /I_b\s*≤\s*I_n\s*≤\s*I_z/g,
    'Betriebsstrom nicht über dem Nennstrom und Nennstrom nicht über der zulässigen Strombelastbarkeit',
  ],
  [/I_n\s*≤\s*I_z/g, 'Nennstrom höchstens so hoch wie die zulässige Strombelastbarkeit'],
  [/I_n\s*≥/g, 'Nennstrom mindestens'],
  [/In\s*≥/g, 'Nennstrom mindestens'],
  [/In\s*≤/g, 'Nennstrom höchstens'],
];

const RULE_ID = /\b(?:AMP|RCD|VDR|POL|GND|BAT|SOL|STR|DOM|FUSE)-\d{3}[A-Za-z0-9-]*/g;

/** Primärtext ohne Formelzeichen und Regel-Codes. Technische Details nicht hier durchreichen. */
export function toPlainGerman(text: string): string {
  let result = text;
  for (const [pattern, replacement] of PHRASES) result = result.replace(pattern, replacement);
  result = result
    .replace(/I²t/g, 'Durchlassenergie')
    .replace(/I_2/g, 'Prüfstrom')
    .replace(/I_z/g, 'zulässige Strombelastbarkeit')
    .replace(/I_n/g, 'Nennstrom')
    .replace(/I_b/g, 'Betriebsstrom')
    .replace(RULE_ID, '')
    .replace(/≤/g, ' höchstens ')
    .replace(/≥/g, ' mindestens ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/(\()\s+/g, '$1')
    .trim();
  return result;
}
