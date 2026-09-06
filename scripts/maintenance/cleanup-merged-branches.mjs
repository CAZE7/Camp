#!/usr/bin/env node
/**
 * scripts/maintenance/cleanup-merged-branches.mjs
 *
 * Cross-platform script to safely delete the 254 verified merged remote branches
 * listed in docs/merged-branch-candidates.txt.
 *
 * Usage:
 *   node scripts/maintenance/cleanup-merged-branches.mjs --dry-run
 *   node scripts/maintenance/cleanup-merged-branches.mjs --execute
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const candidatesPath = join(repoRoot, 'docs', 'merged-branch-candidates.txt');

const mode = process.argv[2];
if (mode !== '--execute' && mode !== '--dry-run') {
  console.log('Verwendung: node scripts/maintenance/cleanup-merged-branches.mjs [--dry-run | --execute]');
  console.log('  --dry-run: Zeigt alle zu löschenden Remote-Branches an, ohne Änderungen vorzunehmen.');
  console.log('  --execute: Führt die Löschung auf "origin" aus.');
  process.exit(1);
}

if (!existsSync(candidatesPath)) {
  console.error(`Fehler: Kandidatendatei ${candidatesPath} nicht gefunden.`);
  process.exit(1);
}

const raw = readFileSync(candidatesPath, 'utf8');
const branches = raw
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

console.log(`Gefundene gemergte Branches zur Bereinigung: ${branches.length}`);

if (mode === '--dry-run') {
  console.log('=== DRY RUN (keine Änderungen) ===');
  for (const branch of branches) {
    console.log(`Würde löschen: origin/${branch}`);
  }
  console.log(`=== DRY RUN BEENDET: ${branches.length} Branches aufgelistet ===`);
  process.exit(0);
}

if (mode === '--execute') {
  console.log(`=== AUSFÜHRUNG: Lösche ${branches.length} Remote-Branches auf origin ===`);
  const BATCH_SIZE = 25;
  for (let i = 0; i < branches.length; i += BATCH_SIZE) {
    const batch = branches.slice(i, i + BATCH_SIZE);
    console.log(
      `Lösche Batch ${i + 1} bis ${Math.min(i + BATCH_SIZE, branches.length)} von ${branches.length}...`
    );
    try {
      execSync(`git push origin --delete ${batch.join(' ')}`, { stdio: 'inherit' });
    } catch (err) {
      console.warn(`Warnung beim Löschen von Batch: ${err.message}`);
    }
  }
  console.log('✔ Bereinigung abgeschlossen.');
}
