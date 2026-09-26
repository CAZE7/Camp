/**
 * Deploy-Trigger-Wächter (AUDIT T7).
 *
 * `.github/workflows/deploy.yml` trägt unter `on.push.branches` eine
 * handgeschriebene Branch-Liste, weil GitHub Actions dort KEINE Ausdrücke
 * auswerten kann (`github.event.repository.default_branch` ist in `on:`
 * nicht verfügbar). Die Jobs sind zusätzlich mit einem Default-Branch-
 * Vergleich geschützt.
 *
 * Genau diese Kombination rotet still: Wird der Default-Branch des Repos
 * umbenannt, triggert der Workflow auf dem neuen Branch **gar nicht mehr**.
 * Es gibt dann keinen Fehlschlag, kein Skipped-Rauschen und keine Meldung —
 * nur keinen Deploy. Ein Gate, das nicht läuft, ist grüner als eines, das
 * scheitert; das ist die teuerste Fehlerklasse dieses Projekts.
 *
 * Dieser Wächter macht die Abweichung laut: Er läuft im Quality Gate (also
 * bei jedem PR und bei jedem Deploy-Versuch) und vergleicht die Liste mit
 * dem tatsächlichen Default-Branch des Repos.
 *
 * Aufruf (CI):  EXPECTED_DEFAULT_BRANCH=main npx tsx scripts/ci/verifyDeployTrigger.ts
 * Aufruf (lokal, ohne Env): prüft nur die Form der Liste und sagt das.
 * Exit 0 = Trigger passt, Exit 1 = Trigger würde nicht (oder falsch) feuern.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

export const DEPLOY_WORKFLOW_PATH = join('.github', 'workflows', 'deploy.yml');

export type DeployTriggerCheck = {
  /** Liste aus `on.push.branches` (leer, wenn die Form nicht stimmt). */
  branches: string[];
  ok: boolean;
  /** Klartext für CI-Log und PR — immer mit Grund, nie ein nacktes „fail". */
  message: string;
};

/**
 * Liest `on.push.branches` aus dem Workflow-YAML.
 *
 * Wirft bei unerwarteter Form: Ein Wächter, der eine umbenannte oder
 * umstrukturierte Trigger-Sektion nicht findet, darf nicht „alles gut"
 * melden (Regel M: fehlende Eingabe ⇒ UNKNOWN, niemals PASS).
 */
export function deployTriggerBranches(yamlText: string): string[] {
  const parsed: unknown = load(yamlText);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${DEPLOY_WORKFLOW_PATH} ist kein gültiges YAML-Objekt`);
  }
  // YAML-Parsing von `on:` liefert in js-yaml den Schlüssel `on`
  // ( boolesch `true` ist nur bei YAML 1.1 ohne Quotes ein Problem —
  // js-yaml 4 parst `on` als String-Schlüssel).
  const workflow = parsed as { on?: unknown };
  const on = workflow.on;
  if (typeof on !== 'object' || on === null) {
    throw new Error(`${DEPLOY_WORKFLOW_PATH} hat keine Trigger-Sektion \`on:\``);
  }
  const push = (on as { push?: unknown }).push;
  if (typeof push !== 'object' || push === null) {
    throw new Error(`${DEPLOY_WORKFLOW_PATH} hat keinen \`on.push\`-Trigger`);
  }
  const branches = (push as { branches?: unknown }).branches;
  if (!Array.isArray(branches) || branches.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${DEPLOY_WORKFLOW_PATH}: \`on.push.branches\` fehlt oder ist keine Liste von Strings`);
  }
  return branches as string[];
}

/**
 * Vergleicht die Trigger-Liste mit dem Default-Branch.
 *
 * @param params.expectedDefaultBranch Default-Branch des Repos, wie ihn der
 *   Runner kennt (`github.event.repository.default_branch`). Ohne diesen Wert
 *   (lokaler Aufruf) wird nur die Form geprüft — und das wird gesagt.
 */
export function checkDeployTrigger(params: {
  yamlText: string;
  expectedDefaultBranch?: string | null;
}): DeployTriggerCheck {
  const { yamlText, expectedDefaultBranch } = params;
  let branches: string[];
  try {
    branches = deployTriggerBranches(yamlText);
  } catch (error) {
    return {
      branches: [],
      ok: false,
      message: `Deploy-Trigger nicht prüfbar: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (branches.length === 0) {
    return {
      branches,
      ok: false,
      message:
        'Deploy-Trigger leer: `on.push.branches: []` feuert nie — es gäbe keinen Deploy und keine Fehlermeldung.',
    };
  }

  // Wildcards würden genau das zurückbringen, was die Liste verhindert:
  // Runs auf 100+ Agent-/Dependabot-Branches, in denen alle Jobs übersprungen
  // werden (Skipped-Rauschen, belegt in deploy.yml).
  const wildcards = branches.filter((branch) => branch.includes('*'));
  if (wildcards.length > 0) {
    return {
      branches,
      ok: false,
      message: `Deploy-Trigger enthält Wildcards (${wildcards.join(', ')}): Das erzeugt Runs auf jedem Agent-Branch, in denen alle Jobs übersprungen werden.`,
    };
  }

  const expected = expectedDefaultBranch?.trim() ?? '';
  if (expected === '') {
    return {
      branches,
      ok: true,
      message: `Deploy-Trigger formell in Ordnung (${branches.join(', ')}). Kein Default-Branch übergeben — der Abgleich gegen das Repo läuft nur im CI (EXPECTED_DEFAULT_BRANCH).`,
    };
  }

  if (branches.length === 1 && branches[0] === expected) {
    return {
      branches,
      ok: true,
      message: `Deploy-Trigger passt: Push auf '${expected}' (Default-Branch) löst den Workflow aus.`,
    };
  }

  return {
    branches,
    ok: false,
    message:
      `Deploy-Trigger weicht vom Default-Branch ab: ` +
      `on.push.branches = [${branches.join(', ')}], Default-Branch des Repos = '${expected}'. ` +
      `Pushes auf '${expected}' lösen den Deploy-Workflow damit NICHT aus — es gäbe keinen Deploy und keine Fehlermeldung. ` +
      `Bitte die Liste in .github/workflows/deploy.yml (und die Kopie in docs/ci/workflows/deploy.yml) auf genau ['${expected}'] setzen.`,
  };
}

/** CLI-Teil: nur bei direktem Aufruf, damit Tests die Funktionen pur nutzen. */
function main(): void {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const yamlText = readFileSync(join(repoRoot, DEPLOY_WORKFLOW_PATH), 'utf8');
  const result = checkDeployTrigger({
    yamlText,
    expectedDefaultBranch: process.env.EXPECTED_DEFAULT_BRANCH ?? null,
  });
  console.log(`[deploy-trigger] ${result.message}`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main();
}
