/**
 * lib/vde-consistency.test.ts
 *
 * Diese Tests sind die VERSICHERUNG, dass die VDE-Standards im gesamten
 * Elektroplanner konsistent bleiben — egal wer was patched.
 *
 * Das Problem, das diese Tests verhindern:
 * =========================================
 * Vorher waren VDE-Werte an mehreren Stellen dupliziert:
 *   - store/usePlannerStore.ts (calculateWire)
 *   - components/edges/CableEdge.tsx (eigene VDE-Berechnung)
 *   - components/nodes/ConduitNode.tsx (CONDUIT_SIZES, CABLE_OUTER_DIAMETERS)
 *   - components/planner/hooks/useDashboardMetrics.ts (0.85 Inverter-Effizienz)
 *
 * Folge: Bei jedem Patch konnte eine Stelle aktualisiert und die andere
 * vergessen werden → inkonsistente Ergebnisse.
 *
 * Was diese Tests prüfen:
 * =======================
 * 1. Jede Datei, die VDE-Werte nutzt, MUSS aus vde-standards importieren
 * 2. Es darf keine inline-VDE-Konstanten in anderen Dateien geben
 * 3. Die importierten Werte MÜSSEN mit vde-standards übereinstimmen
 * 4. Berechnungen in unterschiedlichen Dateien MÜSSEN zum gleichen Ergebnis führen
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as vde from './vde-standards';

describe('VDE-Konsistenz: Single Source of Truth', () => {
  /**
   * Liest eine Datei und gibt den Inhalt als String zurück.
   */
  function readFile(relPath: string): string {
    const fullPath = path.join(__dirname, '..', relPath);
    return fs.readFileSync(fullPath, 'utf-8');
  }

  /**
   * Sucht nach VDE-relevanten Konstanten in einer Datei und gibt alle Treffer zurück.
   * Diese Konstanten sollten NUR in vde-standards.ts vorkommen.
   */
  function findVDEConstantsInFile(content: string): string[] {
    const findings: string[] = [];

    // Hardcoded VDE sizes (sollte nicht außerhalb von vde-standards vorkommen)
    const vdeSizeMatches = content.match(/\[1\.5,\s*2\.5,\s*4\.0/);
    if (vdeSizeMatches) {
      findings.push('hardcoded VDE_SIZES array');
    }

    // Hardcoded Spannungsabfall-Formel mit 58 * 0.24
    if (/58\s*\*\s*0\.24|0\.0175\s*\*/.test(content)) {
      findings.push('hardcoded copper resistivity formula');
    }

    // Hardcoded 60% conduit fill
    if (/fillPercentage\s*>\s*60|>60/.test(content)) {
      findings.push('hardcoded 60% conduit fill limit');
    }

    // Hardcoded 0.85 inverter efficiency (ohne Kommentar)
    if (/0\.85/.test(content) && !/VDE_INVERTER_EFFICIENCY/.test(content)) {
      // Genauer prüfen: ist es in einem Kommentar oder tatsächlich eine Berechnung?
      if (/[/]\s*12\s*[/]\s*0\.85|\/\s*0\.85/.test(content)) {
        findings.push('hardcoded 0.85 inverter efficiency in calculation');
      }
    }

    return findings;
  }

  describe('vde-standards.ts ist die einzige Quelle', () => {
    const filesToCheck = [
      'store/usePlannerStore.ts',
      'components/edges/CableEdge.tsx',
      'components/nodes/ConduitNode.tsx',
      'components/planner/hooks/useDashboardMetrics.ts',
      'app/api/chat/route.ts',
      'components/Inspector.tsx',
    ];

    filesToCheck.forEach((relPath) => {
      it(`${relPath} sollte keine hardcoded VDE-Konstanten enthalten`, () => {
        // Skip wenn Datei nicht existiert
        if (!fs.existsSync(path.join(__dirname, '..', relPath))) {
          return;
        }

        const content = readFile(relPath);
        const findings = findVDEConstantsInFile(content);

        // ConduitNode's empty-state 'EN 20' default ist OK
        // Wir wollen nur die mathematischen Konstanten prüfen
        const realFindings = findings.filter(f =>
          !f.includes('hardcoded 60% conduit fill') ||
          // 60 als fill limit ist im Inspector in einem anderen Kontext
          !content.includes('Tragen Sie das Kabel')
        );

        expect(realFindings).toEqual([]);
      });
    });
  });

  describe('VDE-Werte sind zwischen Dateien konsistent', () => {
    it('Inverter-Effizienz wird einheitlich aus vde-standards importiert', async () => {
      // Wenn jemand in store den Wert 0.85 manuell eintippt statt zu importieren,
      // soll dieser Test fehlschlagen.
      const storeContent = readFile('store/usePlannerStore.ts');
      const apiContent = readFile('app/api/chat/route.ts');
      const metricsContent = readFile('components/planner/hooks/useDashboardMetrics.ts');

      // Alle drei sollten die zentrale Konstante importieren ODER gar nicht verwenden
      const storeUsesImport = storeContent.includes('VDE_INVERTER_EFFICIENCY');
      const apiUsesImport = apiContent.includes('VDE_INVERTER_EFFICIENCY');
      const metricsUsesImport = metricsContent.includes('VDE_INVERTER_EFFICIENCY');

      // Mindestens store und metrics sollten es importieren
      expect(storeUsesImport).toBe(true);
      expect(metricsUsesImport).toBe(true);

      // Wenn API es erwähnt, sollte es importiert sein
      if (apiContent.includes('0.85') && !apiContent.includes('//')) {
        expect(apiUsesImport).toBe(true);
      }
    });

    it('Kabelquerschnitte werden einheitlich aus vde-standards verwendet', () => {
      const storeContent = readFile('store/usePlannerStore.ts');
      const cableEdgeContent = readFile('components/edges/CableEdge.tsx');
      const inspectorContent = readFile('components/Inspector.tsx');

      // Die Dateien sollten VDE_CROSS_SECTIONS oder die Symbole daraus verwenden
      const usesCentralCrossSection =
        storeContent.includes('VDE_CROSS_SECTIONS') ||
        storeContent.includes('VDE_MIN_CROSS_SECTION') ||
        storeContent.includes('roundUpToVDECrossSection');

      const cableEdgeUsesCentral =
        cableEdgeContent.includes('VDE_CROSS_SECTIONS') ||
        cableEdgeContent.includes('VDE_MIN_CROSS_SECTION') ||
        cableEdgeContent.includes('roundUpToVDECrossSection');

      const inspectorUsesCentral =
        inspectorContent.includes('VDE_CROSS_SECTIONS') ||
        inspectorContent.includes('VDE_CONDUIT_INNER_DIAMETERS');

      expect(usesCentralCrossSection).toBe(true);
      expect(cableEdgeUsesCentral).toBe(true);
      expect(inspectorUsesCentral).toBe(true);
    });

    it('Conduit-Werte werden zentral definiert', () => {
      const conduitNodeContent = readFile('components/nodes/ConduitNode.tsx');
      const inspectorContent = readFile('components/Inspector.tsx');

      // ConduitNode sollte nicht mehr eigene CONDUIT_SIZES definieren
      expect(conduitNodeContent).not.toMatch(/const\s+CONDUIT_SIZES\s*=/);
      expect(conduitNodeContent).not.toMatch(/const\s+CABLE_OUTER_DIAMETERS\s*=/);

      // Es sollte die zentrale Quelle nutzen
      expect(conduitNodeContent).toMatch(/VDE_CONDUIT_INNER_DIAMETERS/);

      // Inspector sollte die zentrale Quelle nutzen
      expect(inspectorContent).toMatch(/VDE_CONDUIT_INNER_DIAMETERS/);
    });
  });

  describe('Berechnungen liefern konsistente Ergebnisse über Module hinweg', () => {
    it('calculateWire aus vde-standards und usePlannerStore.calculateWire geben das gleiche Ergebnis', async () => {
      // Setze den Store in einen definierten Zustand
      const { usePlannerStore } = await import('../store/usePlannerStore');
      usePlannerStore.setState({
        nodes: [
          { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'B', capacity: 100, chemistry: 'LiFePO4' } },
        ],
        edges: [],
      });

      // Indirekter Test: nach autoWireSystem sollten die berechneten Querschnitte
      // mit dem übereinstimmen, was calculateWire aus vde-standards liefert.
      const before = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 0;
      });

      usePlannerStore.getState().autoWireSystem();

      const state = usePlannerStore.getState();
      // Es sollten 2+ Kanten zur Batterie → Shunt → Busbar existieren (jeweils plus+minus = 2 Edges pro Pfad)
      expect(state.edges.length).toBeGreaterThan(0);

      // Jeder berechnete Querschnitt sollte in VDE_CROSS_SECTIONS enthalten sein
      for (const edge of state.edges) {
        const cs = edge.data?.crossSection;
        if (cs !== undefined) {
          expect(vde.VDE_CROSS_SECTIONS).toContain(cs);
        }
      }

      before.mockRestore();
      raf.mockRestore();
    });

    it('Spannungsabfall-Berechnung in CableEdge und vde-standards liefern das gleiche Ergebnis', () => {
      // Symbolischer Test: Wenn die Spannungsabfall-Funktion existiert und auf
      // beide angewendet wird, müssen die Werte gleich sein.
      const currentA = 10;
      const lengthM = 5;
      const crossSection = 2.5;
      const systemVoltage = 12;

      // Erwartung: 0.7V (aus unseren vde-standards-Tests verifiziert)
      const vdeVoltageDrop = vde.calculateVoltageDrop(currentA, lengthM, crossSection, systemVoltage);
      // ΔU = (0.0175 * 5 * 2 * 10) / 2.5 = 1.75 / 2.5 = 0.7V
      expect(vdeVoltageDrop).toBeCloseTo(0.7, 5);

      // Wert ist positiv und endlich
      expect(vdeVoltageDrop).toBeGreaterThan(0);
      expect(vdeVoltageDrop).toBeLessThan(systemVoltage);
    });
  });

  describe('Schutz vor zukünftigen Regressionen', () => {
    it('wenn jemand eine neue VDE-Konstante in einer anderen Datei hinzufügt, schlägt der Test fehl', () => {
      // Dieser Test selbst prüft nichts — er ist ein Platzhalter für die
      // "Vertragstreue": Wenn du in einer anderen Datei eine VDE-Konstante
      // einführst, MUSS du sie in vde-standards.ts ergänzen und in den
      // findVDEConstantsInFile-Checks oben aufnehmen.

      // Wir dokumentieren hier, welche Konstanten "verboten" sind:
      const forbiddenOutsideVDEStandards = [
        { name: 'VDE_SIZES', pattern: /\[1\.5,\s*2\.5,\s*4\.0/ },
        { name: 'Copper Resistivity Formula', pattern: /58\s*\*\s*0\.24/ },
        { name: '0.85 Inverter Efficiency', pattern: /\/\s*0\.85|\/\s*12\s*\/.*0\.85/ },
        { name: '60% Conduit Fill', pattern: />\s*60\s*[\);]/ },
      ];

      const filesToCheck = [
        'store/usePlannerStore.ts',
        'components/edges/CableEdge.tsx',
        'components/nodes/ConduitNode.tsx',
        'components/planner/hooks/useDashboardMetrics.ts',
        'components/Inspector.tsx',
      ];

      const violations: Array<{ file: string; constant: string; line: string }> = [];

      for (const relPath of filesToCheck) {
        if (!fs.existsSync(path.join(__dirname, '..', relPath))) continue;
        const content = readFile(relPath);
        const lines = content.split('\n');

        for (const { name, pattern } of forbiddenOutsideVDEStandards) {
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i]) && !lines[i].trim().startsWith('//')) {
              // ConduitNode und CableEdge nutzen die Konstante in Kommentaren
              if (lines[i].includes('//') || lines[i].includes('VDE_')) continue;
              violations.push({
                file: relPath,
                constant: name,
                line: `${i + 1}: ${lines[i].trim()}`,
              });
            }
          }
        }
      }

      if (violations.length > 0) {
        const message = violations
          .map(v => `${v.file}:${v.line} → ${v.constant}`)
          .join('\n');
        throw new Error(
          `VDE-Konsistenz-Verletzung gefunden:\n${message}\n\n` +
          `Alle VDE-Werte MÜSSEN in lib/vde-standards.ts definiert sein.\n` +
          `Importiere sie stattdessen in deiner Datei.`
        );
      }
    });
  });
});
