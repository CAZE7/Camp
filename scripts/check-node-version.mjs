#!/usr/bin/env node
/**
 * Prüft, ob die lokale Node.js-Version mindestens die in `.nvmrc` angegebene
 * Major-Version erfüllt. Schlägt fehl mit Exit 1, wenn die Version zu alt ist.
 *
 * Bewusst nur Major-Vergleich: Minor-Abweichungen innerhalb des gleichen Major
 * sind in aller Regel kompatibel. Die CI läuft exakt auf der Version aus
 * .nvmrc — lokal ist eine ≥-Semantik ausreichend.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const nvmrc = readFileSync(join(repoRoot, '.nvmrc'), 'utf8').trim();
const requiredMajor = parseInt(nvmrc, 10);

if (isNaN(requiredMajor)) {
  console.error(`Ungültiger Inhalt in .nvmrc: "${nvmrc}"`);
  process.exit(1);
}

const [localMajor] = process.versions.node.split('.').map(Number);
const supported = localMajor >= requiredMajor;

if (!supported) {
  console.error(`Node.js ${requiredMajor}+ erforderlich; gefunden: ${process.versions.node}`);
  console.error(`Nutze die Version aus .nvmrc (${nvmrc}) und starte den Befehl erneut.`);
  process.exit(1);
}
