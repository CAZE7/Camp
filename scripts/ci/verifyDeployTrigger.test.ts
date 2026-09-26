import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import { checkDeployTrigger, deployTriggerBranches, DEPLOY_WORKFLOW_PATH } from './verifyDeployTrigger';

/**
 * AUDIT T7 — der Deploy-Trigger ist eine handgeschriebene Branch-Liste.
 *
 * `on.push.branches` kann in GitHub Actions keine Ausdrücke auswerten, also
 * steht dort ein fester Branch-Name, während die Jobs gegen
 * `github.event.repository.default_branch` prüfen. Diese Kombination rotet
 * still: Nach einer Umbenennung des Default-Branches triggert der Workflow
 * nicht mehr — es gibt keinen Fehlschlag und keinen Deploy, nur Stille.
 *
 * Diese Tests pinnen den Wächter selbst (Form-Prüfung, Abweichung, Wildcards)
 * UND seine Verankerung im Quality Gate. Ein Wächter, den kein Workflow
 * aufruft, wäre genau dieselbe Fehlerklasse, die er melden soll.
 */

const REPO_ROOT = process.cwd();

const deployYaml = (): string => readFileSync(join(REPO_ROOT, DEPLOY_WORKFLOW_PATH), 'utf8');

/** Minimales Workflow-YAML mit frei wählbarer Trigger-Liste. */
const workflowWith = (branchesYaml: string): string => `
name: Deploy to GitHub Pages
on:
  push:
${branchesYaml}
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
`;

describe('deployTriggerBranches', () => {
  it('liest die Liste aus dem echten deploy.yml', () => {
    const branches = deployTriggerBranches(deployYaml());
    expect(branches.length).toBeGreaterThan(0);
    expect(branches.every((branch) => typeof branch === 'string')).toBe(true);
    expect(branches.some((branch) => branch.includes('*'))).toBe(false);
  });

  it('wirft bei fehlender Trigger-Sektion statt „alles gut" zu melden', () => {
    // Regel M: fehlende Eingabe ⇒ UNKNOWN, niemals PASS. Ein Wächter, der
    // eine umstrukturierte Sektion nicht findet, darf nicht grün sein.
    expect(() =>
      deployTriggerBranches('name: Deploy\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n')
    ).toThrow(/keine Trigger-Sektion/);
    expect(() =>
      deployTriggerBranches('name: Deploy\non:\n  workflow_dispatch:\njobs:\n  deploy: {}\n')
    ).toThrow(/keinen `on\.push`-Trigger/);
    expect(() => deployTriggerBranches(workflowWith('    branches: "main"\n'))).toThrow(
      /keine Liste von Strings/
    );
    expect(() => deployTriggerBranches(workflowWith('    branches-ignore: ["agent/**"]\n'))).toThrow(
      /`on\.push\.branches` fehlt/
    );
  });
});

describe('checkDeployTrigger', () => {
  it('ist grün, wenn die Liste genau den Default-Branch nennt', () => {
    const result = checkDeployTrigger({
      yamlText: workflowWith('    branches: ["main"]\n'),
      expectedDefaultBranch: 'main',
    });
    expect(result.ok).toBe(true);
    expect(result.branches).toEqual(['main']);
  });

  it('ist rot, wenn der Default-Branch umbenannt wurde — mit Handlungsanweisung', () => {
    const result = checkDeployTrigger({
      yamlText: workflowWith('    branches: ["feature/alt"]\n'),
      expectedDefaultBranch: 'main',
    });
    expect(result.ok).toBe(false);
    // Die Meldung muss sagen, was kaputt ist UND was zu tun ist.
    expect(result.message).toMatch(/lösen den Deploy-Workflow damit NICHT aus/);
    expect(result.message).toContain("['main']");
    expect(result.message).toContain('docs/ci/workflows/deploy.yml');
  });

  it('ist rot bei zusätzlichen Branches (Skipped-Rauschen)', () => {
    const result = checkDeployTrigger({
      yamlText: workflowWith('    branches: ["main", "agent/irgendwas"]\n'),
      expectedDefaultBranch: 'main',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/weicht vom Default-Branch ab/);
  });

  it('ist rot bei Wildcards und bei leerer Liste', () => {
    expect(
      checkDeployTrigger({ yamlText: workflowWith('    branches: ["**"]\n'), expectedDefaultBranch: 'main' })
        .ok
    ).toBe(false);
    expect(
      checkDeployTrigger({ yamlText: workflowWith('    branches: ["**"]\n'), expectedDefaultBranch: 'main' })
        .message
    ).toMatch(/Wildcards/);

    const empty = checkDeployTrigger({
      yamlText: workflowWith('    branches: []\n'),
      expectedDefaultBranch: 'main',
    });
    expect(empty.ok).toBe(false);
    expect(empty.message).toMatch(/feuert nie/);
  });

  it('prüft ohne Env-Wert nur die Form — und sagt das ausdrücklich', () => {
    // Lokaler Aufruf ohne EXPECTED_DEFAULT_BRANCH: kein Repo-Kontext, also
    // keine Behauptung über den Default-Branch. Still durchwinken wäre
    // wieder ein PASS ohne Beleg.
    const result = checkDeployTrigger({
      yamlText: workflowWith('    branches: ["irgendein-branch"]\n'),
      expectedDefaultBranch: null,
    });
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/Kein Default-Branch übergeben/);
  });

  it('das echte deploy.yml besteht die Formprüfung', () => {
    expect(checkDeployTrigger({ yamlText: deployYaml(), expectedDefaultBranch: null }).ok).toBe(true);
  });
});
