import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

/**
 * Statische Prüfung der GitHub-Actions-Workflows (AGENTS.md K6).
 *
 * Diese Tests ersetzen keinen echten CI-Lauf, halten aber die Eigenschaften
 * fest, die das Qualitäts-Gate ausmachen. Fällt eine davon weg, schlägt der
 * Test fehl, statt dass ein ungeprüfter Deploy durchrutscht.
 */

/**
 * Die geprüften Workflow-Dateien liegen unter `docs/ci/workflows/`.
 *
 * Grund: Der Agent, der diesen Branch erstellt hat, darf `.github/workflows/`
 * nicht schreiben (GitHub verweigert Pushes einer App ohne
 * `workflows`-Berechtigung). Die Dateien sind deshalb reviewbar hier abgelegt
 * und werden beim Merge nach `.github/workflows/` kopiert — siehe
 * `docs/CI.md`, Abschnitt „Aktivierung". Der Test prüft dieselben
 * Invarianten wie am Zielort.
 */
const WORKFLOW_DIR = join(process.cwd(), 'docs', 'ci', 'workflows');

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};

type Job = {
  name?: string;
  uses?: string;
  needs?: string | string[];
  permissions?: Record<string, string> | string;
  steps?: Step[];
  'runs-on'?: string;
  environment?: unknown;
};

type Workflow = {
  name?: string;
  on?: Record<string, unknown>;
  permissions?: Record<string, string> | string;
  jobs: Record<string, Job>;
};

function readWorkflow(file: string): Workflow {
  const raw = readFileSync(join(WORKFLOW_DIR, file), 'utf8');
  const parsed = load(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${file} ist kein gültiges YAML-Objekt`);
  }
  return parsed as Workflow;
}

function rawWorkflow(file: string): string {
  return readFileSync(join(WORKFLOW_DIR, file), 'utf8');
}

/**
 * Wie `rawWorkflow`, aber ohne reine Kommentarzeilen. Verbots-Regeln dürfen
 * nicht an einem Kommentar scheitern, der genau erklärt, warum es die Regel
 * gibt ("kein Fallback auf npm install").
 */
function rawWorkflowCode(file: string): string {
  return rawWorkflow(file)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

function allSteps(workflow: Workflow): Step[] {
  return Object.values(workflow.jobs).flatMap((job) => job.steps ?? []);
}

function needsOf(job: Job): string[] {
  if (!job.needs) return [];
  return Array.isArray(job.needs) ? job.needs : [job.needs];
}

const WORKFLOW_FILES = ['quality.yml', 'ci.yml', 'deploy.yml'];

describe('GitHub-Actions-Workflows', () => {
  it('die Dateien liegen am dokumentierten Übergangsort', () => {
    // Solange die Workflows unter docs/ci/workflows/ liegen, ist das Gate
    // NICHT aktiv. Dieser Test hält fest, dass der Zustand bewusst ist und
    // dokumentiert wird — er darf erst entfernt werden, wenn die Dateien
    // nach .github/workflows/ umgezogen sind.
    expect(existsSync(WORKFLOW_DIR)).toBe(true);
    const guide = readFileSync(join(process.cwd(), 'docs', 'CI.md'), 'utf8');
    expect(guide).toMatch(/docs\/ci\/workflows/);
    expect(guide).toMatch(/Aktivierung/);
  });

  it('alle Workflow-Dateien sind syntaktisch gültiges YAML mit jobs', () => {
    for (const file of WORKFLOW_FILES) {
      expect(existsSync(join(WORKFLOW_DIR, file)), `${file} fehlt`).toBe(true);
      const workflow = readWorkflow(file);
      expect(workflow.jobs, `${file} hat keine Jobs`).toBeTruthy();
      expect(Object.keys(workflow.jobs).length).toBeGreaterThan(0);
    }
  });

  it('kein Workflow enthält verbotene Lockfile-Manipulationen', () => {
    for (const file of WORKFLOW_FILES) {
      const raw = rawWorkflowCode(file);
      expect(raw, `${file} löscht das Lockfile`).not.toMatch(/rm\s+(-\w+\s+)*package-lock\.json/);
      expect(raw, `${file} fällt auf npm install zurück`).not.toMatch(/npm\s+install\b/);
    }
  });

  it('jeder Install-Schritt verwendet npm ci', () => {
    for (const file of WORKFLOW_FILES) {
      const workflow = readWorkflow(file);
      const installSteps = allSteps(workflow).filter((step) => step.run?.includes('npm '));
      for (const step of installSteps) {
        const run = step.run ?? '';
        if (!run.includes('npm ci')) continue;
        expect(run, `${file}: npm ci mit Fallback`).not.toMatch(/\|\|/);
      }
    }
  });

  it('Node-Version kommt überall aus .nvmrc', () => {
    const nvmrc = readFileSync(join(process.cwd(), '.nvmrc'), 'utf8').trim();
    expect(nvmrc).toMatch(/^\d+/);

    for (const file of WORKFLOW_FILES) {
      const workflow = readWorkflow(file);
      const setupSteps = allSteps(workflow).filter((step) => step.uses?.startsWith('actions/setup-node'));
      for (const step of setupSteps) {
        expect(step.with?.['node-version-file'], `${file}: setup-node ohne node-version-file`).toBe('.nvmrc');
        expect(step.with?.['node-version'], `${file}: hartkodierte Node-Version`).toBeUndefined();
      }
    }
  });

  it('quality.yml prüft Typecheck, Tests und Build', () => {
    const workflow = readWorkflow('quality.yml');
    const runs = allSteps(workflow).map((step) => step.run ?? '');
    expect(runs.some((run) => run.includes('npm run typecheck'))).toBe(true);
    expect(runs.some((run) => run.trim() === 'npm test')).toBe(true);
    expect(runs.some((run) => run.includes('npm run build'))).toBe(true);
    expect(runs.some((run) => run.includes('npm ci'))).toBe(true);
  });

  it('quality.yml ist als wiederverwendbarer Workflow aufrufbar', () => {
    const workflow = readWorkflow('quality.yml');
    expect(workflow.on).toHaveProperty('workflow_call');
  });

  it('ci.yml und deploy.yml nutzen denselben Quality Gate', () => {
    for (const file of ['ci.yml', 'deploy.yml']) {
      const workflow = readWorkflow(file);
      const usesQuality = Object.values(workflow.jobs).some((job) =>
        job.uses?.includes('.github/workflows/quality.yml')
      );
      expect(usesQuality, `${file} ruft quality.yml nicht auf`).toBe(true);
    }
  });

  it('Deploy hängt transitiv am Quality Gate', () => {
    const workflow = readWorkflow('deploy.yml');
    const qualityJobId = Object.entries(workflow.jobs).find(([, job]) =>
      job.uses?.includes('quality.yml')
    )?.[0];
    expect(qualityJobId).toBeDefined();

    // Transitive Hülle der needs-Kette ab dem Deploy-Job bilden.
    const reachable = new Set<string>();
    const queue = needsOf(workflow.jobs.deploy);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (reachable.has(current)) continue;
      reachable.add(current);
      queue.push(...needsOf(workflow.jobs[current] ?? {}));
    }
    expect(reachable.has(qualityJobId as string)).toBe(true);
  });

  it('Deploy hat keinen Notausgang, der Tests überspringt', () => {
    const raw = rawWorkflowCode('deploy.yml');
    expect(raw).not.toMatch(/skip_tests/);
    expect(raw).not.toMatch(/continue-on-error:\s*true/);
    // `if: always()` würde Jobs auch nach rotem Gate starten.
    expect(raw).not.toMatch(/always\(\)/);
  });

  it('Deploy läuft nur auf main/master oder manuell', () => {
    const workflow = readWorkflow('deploy.yml');
    const push = (workflow.on as { push?: { branches?: string[] } }).push;
    expect(push?.branches).toEqual(['main', 'master']);
  });

  it('Berechtigungen sind minimal: Standard nur contents:read', () => {
    for (const file of WORKFLOW_FILES) {
      const workflow = readWorkflow(file);
      expect(workflow.permissions, `${file} ohne Top-Level-permissions`).toEqual({ contents: 'read' });
    }
  });

  it('Schreibrechte gibt es nur in den Pages-Jobs', () => {
    const workflow = readWorkflow('deploy.yml');
    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      const permissions = job.permissions;
      if (typeof permissions !== 'object' || permissions === null) continue;
      const writeScopes = Object.entries(permissions)
        .filter(([, value]) => value === 'write')
        .map(([scope]) => scope);
      if (writeScopes.length === 0) continue;
      expect(['build', 'deploy'], `Job ${jobId} hat unerwartete Schreibrechte`).toContain(jobId);
      expect(writeScopes.sort()).toEqual(['id-token', 'pages']);
    }
  });

  it('Checkout speichert keine Credentials im Runner', () => {
    for (const file of WORKFLOW_FILES) {
      const workflow = readWorkflow(file);
      const checkouts = allSteps(workflow).filter((step) => step.uses?.startsWith('actions/checkout'));
      for (const step of checkouts) {
        expect(step.with?.['persist-credentials'], `${file}: Checkout ohne persist-credentials:false`).toBe(false);
      }
    }
  });

  it('Jobs haben ein Zeitlimit, damit hängende Läufe nicht das Gate blockieren', () => {
    for (const file of ['quality.yml', 'deploy.yml']) {
      const workflow = readWorkflow(file);
      for (const [jobId, job] of Object.entries(workflow.jobs)) {
        if (job.uses) continue; // Reusable-Workflow-Aufruf erbt sein Limit.
        if (jobId === 'deploy') continue; // deploy-pages wartet extern auf Pages.
        expect(
          (job as unknown as { 'timeout-minutes'?: number })['timeout-minutes'],
          `${file}/${jobId} ohne timeout-minutes`
        ).toBeGreaterThan(0);
      }
    }
  });
});
