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

const WORKFLOW_DIR = join(process.cwd(), '.github', 'workflows');

type Step = {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
};

type Job = {
  if?: string;
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
  concurrency?: Record<string, unknown>;
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

  it('quality.yml prüft Lint, Format, Typecheck, Tests (mit Coverage) und Build', () => {
    const workflow = readWorkflow('quality.yml');
    const runs = allSteps(workflow).map((step) => step.run ?? '');
    expect(runs.some((run) => run.includes('npm run lint'))).toBe(true);
    expect(runs.some((run) => run.includes('npm run format:check'))).toBe(true);
    expect(runs.some((run) => run.includes('npm run typecheck'))).toBe(true);
    expect(runs.some((run) => run.trim() === 'npm run test:coverage')).toBe(true);
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
    const queue = needsOf(workflow.jobs.deploy!);
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

  it('Deploy reagiert auf Pushes und überspringt nur den Pages-Ausgabe-Branch', () => {
    const workflow = readWorkflow('deploy.yml');
    const push = (workflow.on as { push?: { 'branches-ignore'?: string[] } }).push;
    expect(push?.['branches-ignore']).toEqual(['gh-pages']);
    for (const jobId of ['quality', 'build', 'deploy']) {
      expect(workflow.jobs[jobId]?.if, `${jobId} ohne Default-Branch-Schutz`).toBe(
        "github.ref == format('refs/heads/{0}', github.event.repository.default_branch)"
      );
    }
  });

  it('Deploy bricht veraltete Läufe bei neuen Pushes ab', () => {
    const workflow = readWorkflow('deploy.yml');
    expect(workflow.concurrency).toEqual({
      group: 'pages',
      'cancel-in-progress': true,
    });
  });

  it('Pages-Build verwendet den von configure-pages gelieferten Basepath', () => {
    const workflow = readWorkflow('deploy.yml');
    const buildSteps = workflow.jobs.build?.steps ?? [];
    // configure-pages ist per SHA gepinnt — suche nach dem Action-Namen ohne Ref.
    const configurePages = buildSteps.find((step) =>
      step.uses?.startsWith('actions/configure-pages@'),
    );
    const staticBuild = buildSteps.find((step) => step.run?.trim() === 'npm run build');

    expect(configurePages?.id).toBe('pages');
    expect(staticBuild?.with).toBeUndefined();
    expect(staticBuild?.env).toEqual({
      NEXT_PUBLIC_BASE_PATH: '${{ steps.pages.outputs.base_path }}',
    });
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
      if (jobId === 'build') {
        // build-Job braucht nur pages:write für upload-pages-artifact.
        // id-token:write ist bewusst NICHT gesetzt (Least-Privilege).
        expect(writeScopes.sort()).toEqual(['pages']);
      } else {
        expect(writeScopes.sort()).toEqual(['id-token', 'pages']);
      }
    }
  });

  it('Checkout speichert keine Credentials im Runner', () => {
    for (const file of WORKFLOW_FILES) {
      const workflow = readWorkflow(file);
      const checkouts = allSteps(workflow).filter((step) => step.uses?.startsWith('actions/checkout'));
      for (const step of checkouts) {
        expect(step.with?.['persist-credentials'], `${file}: Checkout ohne persist-credentials:false`).toBe(
          false
        );
      }
    }
  });

  it('id-token:write ist ausschließlich auf dem deploy-Job (nicht build)', () => {
    const workflow = readWorkflow('deploy.yml');
    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      if (job.uses) continue; // Reusable-Workflow-Aufruf: Permissions kommen vom Caller.
      const permissions = job.permissions;
      if (typeof permissions !== 'object' || permissions === null) continue;
      const hasIdToken = (permissions as Record<string, string>)['id-token'] === 'write';
      if (hasIdToken) {
        expect(jobId, 'id-token:write darf nur auf dem deploy-Job stehen').toBe('deploy');
      }
    }
  });

  it('alle Actions sind per Commit-SHA gepinnt (keine reinen Tag-Referenzen)', () => {
    // Nur Actions mit erhöhten Permissions (pages:write, id-token:write) auditieren.
    // SHA-Format: 40 Hex-Zeichen. Reine Tags wie "@v4" sind nicht erlaubt.
    const SHA_RE = /^[0-9a-f]{40}$/;
    for (const file of WORKFLOW_FILES) {
      const workflow = readWorkflow(file);
      const steps = allSteps(workflow);
      for (const step of steps) {
        if (!step.uses) continue;
        // Lokale Workflow-Referenzen (./.github/...) haben keine SHA-Pins.
        if (step.uses.startsWith('./')) continue;
        const [, ref] = step.uses.split('@');
        expect(ref, `${file}: Action "${step.uses}" ist nicht per SHA gepinnt`).toMatch(SHA_RE);
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
