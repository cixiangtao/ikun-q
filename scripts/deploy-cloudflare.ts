import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parse, type ParseError } from 'jsonc-parser';

const root = fileURLToPath(new URL('../', import.meta.url));
const errors: ParseError[] = [];
const config: unknown = parse(
  await readFile(new URL('../apps/worker/wrangler.jsonc', import.meta.url), 'utf8'),
  errors,
  { allowTrailingComma: true },
);
if (errors.length) throw new Error('Cloudflare JSONC 配置存在语法错误。');
if (
  typeof config !== 'object' ||
  config === null ||
  !('d1_databases' in config) ||
  !Array.isArray(config.d1_databases)
) {
  throw new Error('Cloudflare D1 配置无效。');
}
const binding: unknown = config.d1_databases.find(
  (item: unknown) =>
    typeof item === 'object' && item !== null && 'binding' in item && item.binding === 'DB',
);
if (
  typeof binding !== 'object' ||
  binding === null ||
  !('database_id' in binding) ||
  typeof binding.database_id !== 'string' ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(binding.database_id) ||
  binding.database_id === '00000000-0000-0000-0000-000000000000'
) {
  throw new Error(
    '请先登录 Cloudflare、创建 D1，并把真实 database_id 写入 apps/worker/wrangler.jsonc。占位配置只用于本地验证。',
  );
}

async function run(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('corepack', ['pnpm', ...args], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Cloudflare 发布步骤失败（${code}）。`)),
    );
  });
}

// This command is explicitly invoked for publication; ordinary check/build never modifies remote data.
await run(['check']);
await run(['--filter', '@ikun-q/worker', 'db:remote']);
await run(['--filter', '@ikun-q/worker', 'run', 'deploy']);
