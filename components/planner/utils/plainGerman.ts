import { getComponentSpec } from '../../registry';

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
const AUTO_RULE_ID = /\bAUTO-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;

const AUTO_NODE_TYPE: Readonly<Record<string, string>> = {
  shunt: 'Batteriecomputer',
  fuse: 'Sicherung',
  busbar: 'Sammelschiene',
  battery: 'Batterie',
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Technische Knoten-Ids (`auto-node:…`, URL-Kodierung, Schienenkürzel) als Bauteilnamen. */
function humanizeIds(text: string): string {
  return text
    .replace(/auto-node:([^\s→,.;)]+)/g, (_match, rest: string) => {
      const decoded = safeDecode(rest);
      const [type, ...labelParts] = decoded.split(':');
      const label = labelParts.join(':').replace(/:\d+$/, '');
      const named = type ? AUTO_NODE_TYPE[type] : undefined;
      if (named && label) return `${named} „${label}“`;
      return label || decoded;
    })
    .replace(/(?:%[0-9A-Fa-f]{2})+/g, (encoded) => safeDecode(encoded))
    .replace(/\bbusbar-minus\b/g, 'Minus-Sammelschiene')
    .replace(/\bbusbar-plus\b/g, 'Plus-Sammelschiene')
    .replace(/\b([A-Za-z][A-Za-z0-9]*)-\d+\b/g, (match, type: string) => {
      return getComponentSpec(type)?.label ?? match;
    });
}

/** Primärtext ohne Formelzeichen, Regel-Codes und technische Ids. Technische Details nicht hier durchreichen. */
export function toPlainGerman(text: string): string {
  let result = humanizeIds(text);
  for (const [pattern, replacement] of PHRASES) result = result.replace(pattern, replacement);
  result = result
    .replace(
      /konventioneller Auslösestrom I_2 von Sicherung ([^()]+) \(([^()]+)\) ist nicht belegt \([^.]*\)\. Eine Annahme wäre eine erfundene Schutzwirkung\./g,
      'Für die Sicherung $1 ($2) nennt keine allgemeine Norm einen festen Auslöse-Prüfstrom — der genaue Wert steht nur im Hersteller-Datenblatt.'
    )
    .replace(/\bbolt-down\s+midi\b/gi, 'MIDI-Sicherung')
    .replace(/\bbolt-down\s+mega\b/gi, 'MEGA-Sicherung')
    .replace(/\bbolt-down\s+mrbf\b/gi, 'MRBF-Polsicherung')
    .replace(/\bbolt-down\s+anl\b/gi, 'ANL-Sicherung')
    .replace(/\bbolt-down\b/gi, 'Bolzensicherung')
    .replace(/I²t/g, 'Durchlassenergie')
    .replace(/I_2/g, 'Prüfstrom')
    .replace(/I_z/g, 'zulässige Strombelastbarkeit')
    .replace(/I_n/g, 'Nennstrom')
    .replace(/I_b/g, 'Betriebsstrom')
    .replace(/ul248-classT(?:\s+classT)?/g, 'Class T')
    .replace(/\bclassT\b/g, 'Class T')
    .replace(/im Feld `i2A`/g, 'als Prüfstrom laut Datenblatt')
    .replace(/Feld `i2A`/g, 'Prüfstrom laut Datenblatt')
    .replace(/`i2A`/g, 'Prüfstrom laut Datenblatt')
    .replace(/\bi2A\b/g, 'Prüfstrom laut Datenblatt')
    .replace(/\(\s*Regel\s+[^)]*\)/g, '')
    .replace(RULE_ID, '')
    .replace(AUTO_RULE_ID, '')
    .replace(/≤/g, ' höchstens ')
    .replace(/≥/g, ' mindestens ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/(\()\s+/g, '$1')
    .replace(/\s+→/g, ' →')
    .trim();
  return result;
}
