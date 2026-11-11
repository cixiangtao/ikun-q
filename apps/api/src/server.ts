import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const databasePath = resolve(
  process.env.DATABASE_PATH ?? resolve(projectRoot, 'data/likes.sqlite'),
);
const catalogPath =
  process.env.CATALOG_PATH ?? resolve(projectRoot, 'apps/web/src/generated/catalog.json');
const production = process.env.NODE_ENV === 'production';
if (production && !process.env.PUBLIC_ORIGIN) throw new Error('生产服务必须配置 PUBLIC_ORIGIN。');
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为有效端口。');
const catalog: unknown = JSON.parse(await readFile(catalogPath, 'utf8'));
if (
  typeof catalog !== 'object' ||
  catalog === null ||
  !('artworks' in catalog) ||
  !Array.isArray(catalog.artworks)
)
  throw new Error('公开目录无效，请先执行 catalog:sync。');
const artworkIds = catalog.artworks.map((artwork: unknown) => {
  if (
    typeof artwork !== 'object' ||
    artwork === null ||
    !('id' in artwork) ||
    typeof artwork.id !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{0,127}$/.test(artwork.id)
  ) {
    throw new Error('公开目录包含无效图片 ID。');
  }
  return artwork.id;
});
await mkdir(dirname(databasePath), { recursive: true });
const app = await createApp({
  databasePath,
  artworkIds,
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:5173',
  secureCookie: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : production,
  staticRoot: process.env.STATIC_ROOT ? resolve(process.env.STATIC_ROOT) : undefined,
  trustProxy: process.env.TRUST_PROXY,
  logger: true,
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch((error: unknown) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  });
}
try {
  await app.listen({ host: process.env.HOST ?? '127.0.0.1', port });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
