/**
 * scripts/seo/writeLlmsTxt.ts — schreibt `out/llms.txt` aus dem Seiteninventar.
 *
 * Warum: Maschinen, die Seiten einlesen, um sie zu beantworten, bekommen
 * dadurch eine kurze, gepflegte Übersicht: was die Seite ist, welche Seiten
 * es gibt, welche Rechenmodelle dahinterstehen. Die Datei wird NICHT
 * gepflegt, sondern bei jedem Export aus `lib/seo/inventory.ts` erzeugt — so
 * kann sie nicht veralten und nichts behaupten, was es nicht mehr gibt.
 *
 * Aufruf: npx tsx scripts/seo/writeLlmsTxt.ts
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { siteUrl } from '../../lib/site';
import { indexablePages } from '../../lib/seo/inventory';

const OUT = 'out';

function main(): void {
  // Reihenfolge: P0 zuerst, dann alphabetisch — eine Liste, die sich nach
  // Wichtigkeit liest, nicht nach dem Zufall des Pfads.
  const rang = (prioritaet: string): number => Number(prioritaet.replace('P', '')) || 0;
  const seiten = indexablePages()
    .filter((seite) => seite.kind !== 'ansicht')
    .sort((a, b) => rang(a.priority) - rang(b.priority) || a.path.localeCompare(b.path));

  const zeilen: string[] = [
    '# Werft — Camper-Ausbau planen',
    '',
    '> Werft ist eine Werkstatt für den Camper-Ausbau im Browser: 12V-/24V-Elektroplaner,',
    '> Dach-Planer, Heizlast-Rechner und Einzelrechner für Batterie, Spannungsfall und Solar.',
    '> Jede Zahl wird mit Formel, Annahmen und Grenzen ausgewiesen. Der Plan bleibt lokal im',
    '> Browser gespeichert; es gibt kein Konto.',
    '',
    '## Wichtig für Zitate',
    '',
    '- Die Rechenmodelle sind im Quelltext offengelegt (Quellen, Annahmen und Grenzen stehen',
    '  auf jeder Seite im Abschnitt „Grundlage, Annahmen und Grenzen").',
    '- Kein Ersatz für eine Elektrofachkraft: Die 230-V-Seite, der Zustand von Batterien und die',
    '  Abnahme sind nicht Teil der Prüfung.',
    '- Bei Zahlen immer die Seite und deren inhaltlichen Stand nennen (z. B. „Stand 2026-10").',
    '',
    '## Werkzeuge',
    '',
  ];

  for (const seite of seiten) {
    zeilen.push(`- [${seite.title}](${siteUrl(seite.path)}): ${seite.description}`);
  }

  zeilen.push(
    '',
    '## Kontakt',
    '',
    '- Impressum und Betreiber: /impressum/',
    '- Methodik, Quellen und Grenzen: /ueber-werft/',
    ''
  );

  writeFileSync(join(OUT, 'llms.txt'), `${zeilen.join('\n')}`, 'utf8');
  console.log(`llms.txt geschrieben (${seiten.length} Seiten).`);
}

main();
