#!/usr/bin/env node

/**
 * Run Knip without Oxc's six-gigabyte raw-transfer buffer.
 *
 * The normal Oxc parser is sufficient for this review-only audit and keeps the
 * command usable in memory-constrained CI/sandbox environments. The wrapper
 * forwards all arguments and preserves Knip's exit status.
 */
process.env.KNIP_DISABLE_RAW_TRANSFER = '1';

const { spawn } = await import('node:child_process');
const command = process.platform === 'win32' ? 'knip.cmd' : 'knip';
const child = spawn(command, ['--no-progress', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
});

child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  process.exitCode = typeof code === 'number' ? code : signal ? 1 : 0;
});
