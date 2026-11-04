#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Zwei Messläufe vergleichen — exakt, nicht „ungefähr gleich“.
 *
 * Ein Diff, der fehlende Felder stillschweigend als gleich zählt, ist die
 * Fehlerquelle, die in diesem Projekt zu zwei falschen Befunden geführt hat.
 * Deshalb meldet dieses Skript fehlende Schlüssel als eigenen Befund.
 *
 * Nutzung:
 *   node scripts/design-audit/vergleichen.js <a> <b> [--ohne-zeitstempel]
 *   <a>/<b> sind Dateinamen oder Pfade relativ zu scripts/design-audit/ergebnis
 */

const [a, b, ...flags] = process.argv.slice(2);
if (!a || !b) {
  console.error('Usage: node scripts/design-audit/vergleichen.js <a> <b> [--ohne-zeitstempel]');
  process.exit(1);
}
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ergebnis');
const laden = (name) => {
  const pfad = name.includes('/') || name.startsWith('.') ? path.resolve(name) : path.join(DIR, name);
  if (!fs.existsSync(pfad)) throw new Error(`Messlauf fehlt: ${pfad}`);
  const daten = JSON.parse(fs.readFileSync(pfad, 'utf8'));
  if (flags.includes('--ohne-zeitstempel')) {
    delete daten.erfasst;
    delete daten.bezug;
    if (daten.erg)
      for (const seite of Object.values(daten.erg))
        for (const feld of Object.values(seite ?? {})) if (feld) delete feld.erfasst;
  }
  return daten;
};

const fehlend = [];
const unterschied = [];

function vergleichen(weg, x, y) {
  if (x === y) return;
  if (Array.isArray(x) || Array.isArray(y)) {
    if (!Array.isArray(x) || !Array.isArray(y)) {
      unterschied.push(`${weg}: Array ↔ ${JSON.stringify(x === undefined ? 'fehlt' : typeof x)}`);
      return;
    }
    if (x.length !== y.length) {
      unterschied.push(`${weg}: Länge ${x.length} → ${y.length}`);
      return;
    }
    // Elementweise, sonst meldet jeder Array-Vergleich „anders“ ohne Grund.
    for (let i = 0; i < x.length; i++) vergleichen(`${weg}[${i}]`, x[i], y[i]);
    return;
  }
  const xObjekt = x !== null && typeof x === 'object';
  const yObjekt = y !== null && typeof y === 'object';
  if (!xObjekt || !yObjekt) {
    if (x === undefined) fehlend.push(`${weg}: nur in ${b} vorhanden`);
    else if (y === undefined) fehlend.push(`${weg}: nur in ${a} vorhanden`);
    else unterschied.push(`${weg}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`);
    return;
  }
  const schluessel = new Set([...Object.keys(x), ...Object.keys(y)]);
  for (const schluesselName of [...schluessel].sort()) {
    vergleichen(`${weg}.${schluesselName}`, x[schluesselName], y[schluesselName]);
  }
}

const datenA = laden(a);
const datenB = laden(b);
vergleichen('', datenA, datenB);

console.log(`Verglichen: ${a} ↔ ${b}`);
console.log(`  identisch:  ${unterschied.length === 0 && fehlend.length === 0 ? 'JA' : 'nein'}`);
console.log(`  Werte anders: ${unterschied.length}`);
console.log(`  Feld fehlt:   ${fehlend.length}`);
for (const z of unterschied.slice(0, 40)) console.log('    ~ ' + z);
for (const z of fehlend.slice(0, 40)) console.log('    ! ' + z);
if (unterschied.length > 40 || fehlend.length > 40) console.log('    … weitere abgeschnitten');

process.exit(unterschied.length + fehlend.length === 0 ? 0 : 1);
