import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { createApp, visitorCookie } from './app.ts';

const apps: Awaited<ReturnType<typeof createApp>>[] = [];
const roots: string[] = [];
const origin = 'https://ikun-q.example';
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(
  options: { databasePath?: string; writeLimit?: number; staticRoot?: string } = {},
) {
  const app = await createApp({
    databasePath: ':memory:',
    artworkIds: ['gaara-standing-v01', 'gaara-standing-v02'],
    publicOrigin: origin,
    secureCookie: true,
    ...options,
  });
  apps.push(app);
  return app;
}

async function visitor(app: Awaited<ReturnType<typeof createApp>>) {
  const response = await app.inject({ url: '/api/likes' });
  expect(response.statusCode).toBe(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
  const cookie = response.cookies.find((item) => item.name === visitorCookie);
  if (!cookie) throw new Error('缺少匿名访客 Cookie。');
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.secure).toBe(true);
  return { cookie: `${visitorCookie}=${cookie.value}`, origin };
}

it('keeps likes idempotent, reversible, visitor-specific and scoped to the exact image version', async () => {
  const app = await fixture();
  const first = await visitor(app);
  const second = await visitor(app);
  const vote = (headers: typeof first, id = 'gaara-standing-v01', liked = true) =>
    app.inject({ method: 'PUT', url: `/api/artworks/${id}/like`, headers, payload: { liked } });
  const repeated = await Promise.all(Array.from({ length: 5 }, () => vote(first)));
  for (const response of repeated) expect(response.json()).toEqual({ count: 1, liked: true });
  expect((await vote(second)).json()).toEqual({ count: 2, liked: true });
  expect((await vote(first, 'gaara-standing-v02')).json()).toEqual({ count: 1, liked: true });
  expect((await vote(first, 'gaara-standing-v01', false)).json()).toEqual({
    count: 1,
    liked: false,
  });
  expect((await vote(first, 'gaara-standing-v01', false)).json()).toEqual({
    count: 1,
    liked: false,
  });
  const state = await app.inject({ url: '/api/likes', headers: first });
  expect(state.json()).toEqual({
    likes: {
      'gaara-standing-v01': { count: 1, liked: false },
      'gaara-standing-v02': { count: 1, liked: true },
    },
  });
  expect(JSON.stringify(state.json())).not.toContain(visitorCookie);
});

it('rejects unknown assets, malformed payloads, missing identity and foreign or missing origins', async () => {
  const app = await fixture();
  const headers = await visitor(app);
  const put = (id: string, payload: Record<string, unknown>, customHeaders = headers) =>
    app.inject({
      method: 'PUT',
      url: `/api/artworks/${id}/like`,
      payload,
      headers: customHeaders,
    });
  expect((await put('private-draft', { liked: true })).statusCode).toBe(404);
  expect((await put('gaara-standing-v01', { liked: 'true' })).statusCode).toBe(400);
  expect((await put('gaara-standing-v01', { liked: true, count: 500 })).statusCode).toBe(400);
  expect((await put('gaara-standing-v01', {})).statusCode).toBe(400);
  expect(
    (await put('gaara-standing-v01', { liked: true }, { cookie: '', origin })).statusCode,
  ).toBe(401);
  expect(
    (
      await put(
        'gaara-standing-v01',
        { liked: true },
        { ...headers, origin: 'https://foreign.example' },
      )
    ).statusCode,
  ).toBe(403);
  expect(
    (await put('gaara-standing-v01', { liked: true }, { ...headers, origin: '' })).statusCode,
  ).toBe(403);
  const counts = await app.inject({ url: '/api/likes', headers });
  expect(counts.json().likes['gaara-standing-v01'].count).toBe(0);
});

it('rate limits writes even if the caller changes visitor cookies', async () => {
  const app = await fixture({ writeLimit: 2 });
  const headers = await visitor(app);
  for (let i = 0; i < 2; i++) {
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/artworks/gaara-standing-v01/like',
          headers,
          payload: { liked: true },
        })
      ).statusCode,
    ).toBe(200);
  }
  const second = await visitor(app);
  const blocked = await app.inject({
    method: 'PUT',
    url: '/api/artworks/gaara-standing-v01/like',
    headers: second,
    payload: { liked: true },
  });
  expect(blocked.statusCode).toBe(429);
  expect(blocked.headers['retry-after']).toBeDefined();
});

it('persists votes through restarts and produces a consistent live backup without content tables', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ikun-q-likes-'));
  roots.push(root);
  const databasePath = join(root, 'likes.sqlite');
  const app = await fixture({ databasePath });
  const headers = await visitor(app);
  await app.inject({
    method: 'PUT',
    url: '/api/artworks/gaara-standing-v01/like',
    headers,
    payload: { liked: true },
  });
  const reader = new DatabaseSync(databasePath, { readOnly: true });
  const target = join(root, 'backup.sqlite');
  await backup(reader, target);
  reader.close();
  const snapshot = new DatabaseSync(target, { readOnly: true });
  expect(snapshot.prepare('SELECT COUNT(*) AS total FROM likes').get()?.total).toBe(1);
  expect(snapshot.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual([
    { name: 'likes' },
  ]);
  snapshot.close();
  await app.close();
  apps.splice(apps.indexOf(app), 1);
  const restarted = await fixture({ databasePath });
  const response = await restarted.inject({ url: '/api/likes', headers });
  expect(response.json().likes['gaara-standing-v01']).toEqual({ count: 1, liked: true });
});

it('serves only the specified frontend root and keeps missing API routes as JSON 404s', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ikun-q-static-'));
  roots.push(root);
  const staticRoot = join(root, 'web');
  await mkdir(staticRoot);
  await writeFile(join(staticRoot, 'index.html'), '<!doctype html><title>IKUN-Q</title>');
  await writeFile(join(root, 'private.txt'), 'PRIVATE');
  const app = await fixture({ staticRoot });
  expect((await app.inject('/')).body).toContain('<title>IKUN-Q</title>');
  expect((await app.inject('/api/missing')).statusCode).toBe(404);
  expect((await app.inject('/%2e%2e/private.txt')).body).not.toContain('PRIVATE');
});
