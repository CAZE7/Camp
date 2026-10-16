import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { routeAllCables } from '../../components/edges/utils/routeAll';

/** Exact session baseline, not a switch that can accidentally enable old bugs in production. */
export const LEGACY_COMMIT = '498c57ba596e46c16dea62687a4839f622af815b';
let loaded: typeof routeAllCables | undefined;
export async function legacyRouter(): Promise<typeof routeAllCables> {
  if (loaded) return loaded;
  const directory = join(homedir(), '.cache', 'camp-routing-baseline', LEGACY_COMMIT);
  mkdirSync(directory, { recursive: true });
  if (!existsSync(join(directory, 'package.json'))) {
    const archive = execFileSync(
      'git',
      ['archive', '--format=tar', LEGACY_COMMIT, 'components', 'lib', 'package.json', 'tsconfig.json'],
      { maxBuffer: 64 * 1024 * 1024 }
    );
    execFileSync('tar', ['-xf', '-', '-C', directory], { input: archive });
  }
  if (!existsSync(join(directory, 'node_modules')))
    symlinkSync(resolve('node_modules'), join(directory, 'node_modules'), 'dir');
  const module = (await import(
    pathToFileURL(join(directory, 'components/edges/utils/routeAll.ts')).href
  )) as { routeAllCables: typeof routeAllCables };
  loaded = module.routeAllCables;
  return loaded;
}
