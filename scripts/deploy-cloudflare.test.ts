import { afterEach, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const roots: string[] = [];
const execute = promisify(execFile);
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(databaseId = '11111111-1111-1111-1111-111111111111') {
  const root = await mkdtemp(join(tmpdir(), 'ikun-q-publish-'));
  roots.push(root);
  await Promise.all(
    ['scripts', 'apps/worker', 'bin'].map((path) => mkdir(join(root, path), { recursive: true })),
  );
  await copyFile(
    new URL('./deploy-cloudflare.ts', import.meta.url),
    join(root, 'scripts/deploy-cloudflare.ts'),
  );
  await symlink(
    new URL('../node_modules', import.meta.url).pathname,
    join(root, 'node_modules'),
    'dir',
  );
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await writeFile(
    join(root, 'apps/worker/wrangler.jsonc'),
    `{
    // Wrangler and Oxfmt both support this JSONC syntax.
    "d1_databases": [{"binding":"DB","database_id":"${databaseId}",}],
  }`,
  );
  const shim = join(root, 'bin/corepack');
  await writeFile(
    shim,
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$PUBLISH_TEST_LOG"\nif [ "$*" = "pnpm --filter @ikun-q/worker db:remote" ] && [ "$PUBLISH_TEST_FAIL" = "migration" ]; then exit 9; fi\nif [ "$*" = "pnpm --filter @ikun-q/worker deploy" ]; then exit 11; fi\n',
  );
  await chmod(shim, 0o755);
  const log = join(root, 'commands.log');
  const run = (failure = '') =>
    execute(process.execPath, [join(root, 'scripts/deploy-cloudflare.ts')], {
      env: {
        ...process.env,
        PATH: `${join(root, 'bin')}:${process.env.PATH}`,
        PUBLISH_TEST_LOG: log,
        PUBLISH_TEST_FAIL: failure,
      },
    });
  const commands = async () => (await readFile(log, 'utf8')).trim().split('\n');
  return { run, commands };
}

it('publishes through the package script instead of pnpm deploy, after checks and migrations', async () => {
  const { run, commands } = await fixture();
  await run();
  expect(await commands()).toEqual([
    'pnpm check',
    'pnpm --filter @ikun-q/worker db:remote',
    'pnpm --filter @ikun-q/worker run deploy',
  ]);
});

it('does not publish when the database migration fails', async () => {
  const { run, commands } = await fixture();
  await expect(run('migration')).rejects.toThrow();
  expect(await commands()).toEqual(['pnpm check', 'pnpm --filter @ikun-q/worker db:remote']);
});

it('rejects a placeholder database before any remote operation', async () => {
  const { run, commands } = await fixture('00000000-0000-0000-0000-000000000000');
  await expect(run()).rejects.toThrow();
  await expect(commands()).rejects.toThrow();
});
