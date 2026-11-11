import { afterEach, beforeAll, expect, it } from 'vitest';
import { createFetchMock, Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let script: string;
const runtimes: Miniflare[] = [];
const roots: string[] = [];
const origin = 'https://gallery.example';
beforeAll(async () => {
  const source = fileURLToPath(new URL('../src/app.ts', import.meta.url));
  const result = await build({
    stdin: {
      contents: `import { createWorker } from ${JSON.stringify(source)}; export default createWorker(['study-v01', 'study-v02']);`,
      resolveDir: import.meta.dirname,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    conditions: ['workerd'],
    target: 'es2024',
    external: ['node:*'],
  });
  script = result.outputFiles[0]!.text;
});
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}
async function fixture(
  options: {
    persist?: string;
    limit?: number;
    migrate?: boolean;
    configured?: boolean;
    legacyVote?: boolean;
  } = {},
) {
  let githubId = 1;
  const fetchMock = createFetchMock();
  fetchMock.disableNetConnect();
  const replyHeaders = { headers: { 'content-type': 'application/json' } };
  fetchMock
    .get('https://github.com')
    .intercept({ path: '/login/oauth/access_token', method: 'POST' })
    .reply(
      200,
      { access_token: 'test-github-token', token_type: 'bearer', scope: 'read:user,user:email' },
      replyHeaders,
    )
    .persist();
  fetchMock
    .get('https://api.github.com')
    .intercept({ path: '/user', method: 'GET' })
    .reply(
      200,
      () =>
        JSON.stringify({
          id: githubId,
          login: `user-${githubId}`,
          name: `User ${githubId}`,
          email: `user${githubId}@example.com`,
          avatar_url: null,
        }),
      replyHeaders,
    )
    .persist();
  fetchMock
    .get('https://api.github.com')
    .intercept({ path: '/user/emails', method: 'GET' })
    .reply(
      200,
      () =>
        JSON.stringify([{ email: `user${githubId}@example.com`, primary: true, verified: true }]),
      replyHeaders,
    )
    .persist();
  const runtime = new Miniflare({
    modules: [
      { type: 'ESModule', path: join(import.meta.dirname, 'fixture-worker.mjs'), contents: script },
    ],
    compatibilityDate: '2026-07-30',
    compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'],
    d1Persist: options.persist,
    fetchMock,
    bindings:
      options.configured === false
        ? {}
        : {
            AUTH_BASE_URL: origin,
            BETTER_AUTH_SECRET: 'test-only-secret-0123456789abcdef0123456789abcdef',
            GITHUB_CLIENT_ID: 'test-client',
            GITHUB_CLIENT_SECRET: 'test-client-secret',
          },
    serviceBindings: { ASSETS: () => new Response('<title>IKUN-Q</title>') },
    ratelimits: {
      READ_LIMITER: { namespace_id: '1001', simple: { limit: 120, period: 60 } },
      WRITE_LIMITER: { namespace_id: '1002', simple: { limit: options.limit ?? 30, period: 60 } },
    },
  });
  runtimes.push(runtime);
  const db = await runtime.getD1Database('DB');
  if (options.migrate !== false) {
    await db.exec(await readFile(new URL('../migrations/0001_likes.sql', import.meta.url), 'utf8'));
    if (options.legacyVote)
      await db
        .prepare("INSERT INTO likes(artwork_id, visitor_id) VALUES ('study-v01', 'legacy-visitor')")
        .run();
    const migration = await readFile(
      new URL('../migrations/0002_github_accounts.sql', import.meta.url),
      'utf8',
    );
    await db.exec(
      migration
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('--'))
        .join('\n'),
    );
    const interactions = await readFile(
      new URL('../migrations/0003_votes_and_favorites.sql', import.meta.url),
      'utf8',
    );
    await db.exec(
      interactions
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('--'))
        .join('\n'),
    );
  }
  const request = (path: string, init?: RequestInit) =>
    runtime.dispatchFetch(`${origin}${path}`, init);
  const initial = await request('/api/likes');
  const post = (path: string, body: unknown, cookie = '') =>
    request(path, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  async function startLogin() {
    const response = await post('/api/auth/sign-in/social', {
      provider: 'github',
      callbackURL: `${origin}/#/characters/study`,
      errorCallbackURL: `${origin}/?auth_error=1`,
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { url: string };
    const url = new URL(result.url);
    expect(url.origin).toBe('https://github.com');
    expect(url.searchParams.get('redirect_uri')).toBe(`${origin}/api/auth/callback/github`);
    expect(url.searchParams.get('scope')).not.toContain('repo');
    return { cookie: cookies(response), state: url.searchParams.get('state')! };
  }
  async function login(id = 1) {
    githubId = id;
    const start = await startLogin();
    const response = await request(
      `/api/auth/callback/github?code=test-code&state=${encodeURIComponent(start.state)}`,
      { headers: { Cookie: start.cookie }, redirect: 'manual' },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${origin}/#/characters/study`);
    const cookie = cookies(response);
    expect(cookie).toContain('session_token=');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
    return cookie;
  }
  const vote = (id: string, liked: boolean, cookie = '', ip?: string) =>
    request(`/api/artworks/${id}/like`, {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        Origin: origin,
        'Content-Type': 'application/json',
        ...(ip ? { 'CF-Connecting-IP': ip } : {}),
      },
      body: JSON.stringify({ liked }),
    });
  const interaction = (
    id: string,
    action: 'vote' | 'favorite',
    value: number | boolean,
    cookie = '',
  ) =>
    request(`/api/artworks/${id}/${action}`, {
      method: 'PUT',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'vote' ? { vote: value } : { favorited: value }),
    });
  return { runtime, db, request, post, vote, interaction, initial, login, startLogin };
}

it('keeps browsing and counts public, rejects anonymous votes, and fails closed without provider configuration', async () => {
  const f = await fixture({ configured: false });
  expect(f.initial.status).toBe(200);
  expect(f.initial.headers.get('set-cookie')).toBeNull();
  expect(await f.initial.json()).toMatchObject({
    likes: { 'study-v01': { count: 0, liked: false }, 'study-v02': { count: 0, liked: false } },
    auth: { loginAvailable: false, user: null },
    favorites: [],
  });
  expect((await f.vote('study-v01', true)).status).toBe(401);
  expect(
    (await f.vote('study-v01', true, 'ikun_q_visitor=00000000-0000-4000-8000-000000000001')).status,
  ).toBe(401);
  expect((await f.post('/api/auth/sign-in/social', { provider: 'github' })).status).toBe(503);
  expect(await (await f.request('/')).text()).toContain('IKUN-Q');
  expect((await f.request('/api/health')).status).toBe(200);
  expect((await f.request('/api/missing')).status).toBe(404);
  expect((await f.request('/api/auth/sign-up/email', { method: 'POST' })).status).toBe(404);
});

it('runs mocked GitHub OAuth in real Workers + D1 and counts each account once across sessions', async () => {
  const f = await fixture();
  const first = await f.login();
  for (let i = 0; i < 3; i++)
    expect(await (await f.vote('study-v01', true, first)).json()).toEqual({
      count: 1,
      liked: true,
    });
  const sameAccount = await f.login();
  expect(await (await f.vote('study-v01', true, sameAccount)).json()).toEqual({
    count: 1,
    liked: true,
  });
  const other = await f.login(2);
  expect(await (await f.vote('study-v01', true, other)).json()).toEqual({ count: 2, liked: true });
  expect(await (await f.vote('study-v02', true, first)).json()).toEqual({ count: 1, liked: true });
  expect(await (await f.vote('study-v01', false, first)).json()).toEqual({
    count: 1,
    liked: false,
  });
  expect(await (await f.vote('study-v01', false, first)).json()).toEqual({
    count: 1,
    liked: false,
  });
  const read = await f.request('/api/likes', { headers: { Cookie: sameAccount } });
  expect(read.headers.get('cache-control')).toBe('private, no-store');
  const payload = (await read.json()) as { likes: unknown; auth: { user: unknown } };
  expect(payload.likes).toMatchObject({
    'study-v01': { count: 1, liked: false },
    'study-v02': { count: 1, liked: true },
  });
  expect(payload.auth.user).toMatchObject({ name: 'User 1' });
  expect(JSON.stringify(payload)).not.toMatch(/token|secret|@example/);
  const otherHost = await f.runtime.dispatchFetch('https://untrusted.example/api/likes', {
    headers: { Cookie: first },
  });
  expect(((await otherHost.json()) as { auth: unknown }).auth).toEqual({
    loginAvailable: false,
    user: null,
  });
  expect(await f.db.prepare('SELECT COUNT(*) AS count FROM auth_user').first('count')).toBe(2);
  expect(
    await f.db.prepare('SELECT accessToken FROM auth_account LIMIT 1').first('accessToken'),
  ).not.toBe('test-github-token');
  const plan = await f.db
    .prepare('EXPLAIN QUERY PLAN SELECT artwork_id FROM likes WHERE user_id = ?')
    .bind('user')
    .all();
  expect(JSON.stringify(plan.results)).toContain('likes_by_user');
});

it('rejects forged, expired and revoked sessions without deleting the account vote', async () => {
  const f = await fixture();
  const cookie = await f.login();
  await f.vote('study-v01', true, cookie);
  expect((await f.vote('study-v01', true, `${cookie}tampered`)).status).toBe(401);
  const id = await f.db.prepare('SELECT id FROM auth_user LIMIT 1').first('id');
  expect((await f.vote('study-v01', true, `ikun_q_visitor=${id}; user_id=${id}`)).status).toBe(401);
  expect((await f.post('/api/auth/sign-out', {}, cookie)).status).toBe(200);
  expect((await f.vote('study-v01', false, cookie)).status).toBe(401);
  const publicState = (await (
    await f.request('/api/likes', { headers: { Cookie: cookie } })
  ).json()) as {
    likes: Record<string, { count: number; liked: boolean }>;
    auth: { user: unknown };
  };
  expect(publicState.auth.user).toBeNull();
  expect(publicState.likes['study-v01']).toMatchObject({ count: 1, liked: false });
  const fresh = await f.login();
  await f.db.prepare("UPDATE auth_session SET expiresAt = '2000-01-01T00:00:00.000Z'").run();
  expect((await f.vote('study-v01', true, fresh)).status).toBe(401);
});

it('rejects OAuth callbacks without matching browser state, callback replays, and foreign return URLs', async () => {
  const f = await fixture();
  const start = await f.startLogin();
  const callback = `/api/auth/callback/github?code=test-code&state=${encodeURIComponent(start.state)}`;
  const missing = await f.request(callback, { redirect: 'manual' });
  expect(missing.headers.get('location')).toContain('error=');
  expect(cookies(missing)).not.toContain('session_token=');
  expect(await f.db.prepare('SELECT COUNT(*) AS count FROM auth_user').first('count')).toBe(0);
  const wrong = await f.request('/api/auth/callback/github?code=test-code&state=wrong-state', {
    headers: { Cookie: start.cookie },
    redirect: 'manual',
  });
  expect(cookies(wrong)).not.toContain('session_token=');
  const valid = await f.request(callback, {
    headers: { Cookie: start.cookie },
    redirect: 'manual',
  });
  expect(cookies(valid)).toContain('session_token=');
  const replay = await f.request(callback, {
    headers: { Cookie: start.cookie },
    redirect: 'manual',
  });
  expect(cookies(replay)).not.toContain('session_token=');
  expect(
    (
      await f.post('/api/auth/sign-in/social', {
        provider: 'github',
        callbackURL: 'https://foreign.example',
      })
    ).status,
  ).toBe(403);
});

it('rejects unlisted assets, foreign origins, malformed, oversized and unexpected fields', async () => {
  const f = await fixture();
  const cookie = await f.login();
  expect((await f.vote('private-draft', true, cookie)).status).toBe(404);
  const send = (body: string, headers: Record<string, string> = {}) =>
    f.request('/api/artworks/study-v01/like', {
      method: 'PUT',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', ...headers },
      body,
    });
  expect((await send('{"liked":true}', { Origin: 'https://foreign.example' })).status).toBe(403);
  expect((await send('{"liked":"true"}')).status).toBe(400);
  expect((await send('{"liked":true,"userId":"other"}')).status).toBe(400);
  expect((await send('broken')).status).toBe(400);
  expect((await send('{"liked":true}', { 'Content-Type': 'text/plain' })).status).toBe(415);
  expect((await send(' '.repeat(1100))).status).toBe(413);
  expect(
    (
      await f.request('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: ' '.repeat(1100),
      })
    ).status,
  ).toBe(413);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(' '.repeat(1100)));
      controller.close();
    },
  });
  expect(
    (
      await f.request('/api/artworks/study-v01/like', {
        method: 'PUT',
        headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
        body: stream,
        duplex: 'half',
      } as RequestInit)
    ).status,
  ).toBe(413);
});

it('enforces account rate limits even when a caller changes IP', async () => {
  const f = await fixture({ limit: 2 });
  const cookie = await f.login();
  expect((await f.vote('study-v01', true, cookie, '192.0.2.1')).status).toBe(200);
  expect((await f.vote('study-v01', true, cookie, '192.0.2.2')).status).toBe(200);
  const blocked = await f.vote('study-v02', true, cookie, '192.0.2.3');
  expect(blocked.status).toBe(429);
  expect(blocked.headers.get('retry-after')).toBe('60');
});

it('resets anonymous votes in migration and fails closed without the account schema', async () => {
  const f = await fixture({ legacyVote: true });
  expect(await f.db.prepare('SELECT COUNT(*) AS count FROM likes').first('count')).toBe(0);
  expect(await f.db.prepare('SELECT COUNT(*) AS count FROM like_counts').first('count')).toBe(0);
  const columns = await f.db.prepare('PRAGMA table_info(likes)').all();
  expect(columns.results.map((row) => row.name)).toContain('user_id');
  expect(columns.results.map((row) => row.name)).not.toContain('visitor_id');
  const unmigrated = await fixture({ migrate: false });
  expect(unmigrated.initial.status).toBe(503);
});

it('persists account choices across runtimes and hides unpublished artwork records', async () => {
  const persist = await mkdtemp(join(tmpdir(), 'ikun-q-d1-'));
  roots.push(persist);
  const first = await fixture({ persist });
  const cookie = await first.login();
  await first.vote('study-v01', true, cookie);
  const user = await first.db.prepare('SELECT id FROM auth_user LIMIT 1').first('id');
  await first.db
    .prepare("INSERT INTO likes(artwork_id, user_id) VALUES ('hidden-draft', ?)")
    .bind(user)
    .run();
  await first.runtime.dispose();
  runtimes.splice(runtimes.indexOf(first.runtime), 1);
  const second = await fixture({ persist, migrate: false });
  const result = (await (
    await second.request('/api/likes', { headers: { Cookie: cookie } })
  ).json()) as { likes: unknown };
  expect(result.likes).toMatchObject({
    'study-v01': { count: 1, liked: true },
    'study-v02': { count: 0, liked: false },
  });
  expect(JSON.stringify(result)).not.toContain('hidden-draft');
});

it('keeps positive and negative votes mutually exclusive through every transition and isolates image versions', async () => {
  const f = await fixture();
  const cookie = await f.login();
  const react = async (value: -1 | 0 | 1) =>
    (await f.interaction('study-v01', 'vote', value, cookie)).json();
  expect(await react(1)).toEqual({
    count: 1,
    dislikeCount: 0,
    favoriteCount: 0,
    liked: true,
    disliked: false,
  });
  expect(await react(1)).toMatchObject({ count: 1, dislikeCount: 0 });
  expect(await react(-1)).toEqual({
    count: 0,
    dislikeCount: 1,
    favoriteCount: 0,
    liked: false,
    disliked: true,
  });
  expect(await react(-1)).toMatchObject({ count: 0, dislikeCount: 1 });
  expect(await react(0)).toMatchObject({
    count: 0,
    dislikeCount: 0,
    liked: false,
    disliked: false,
  });
  expect(await react(-1)).toMatchObject({ count: 0, dislikeCount: 1 });
  expect(await react(1)).toMatchObject({ count: 1, dislikeCount: 0, liked: true, disliked: false });
  expect(await react(0)).toMatchObject({ count: 0, dislikeCount: 0 });
  await f.interaction('study-v02', 'vote', -1, cookie);
  const other = await f.login(2);
  await f.interaction('study-v01', 'vote', 1, other);
  const publicData = (await (await f.request('/api/likes')).json()) as {
    likes: Record<string, unknown>;
  };
  expect(publicData.likes['study-v01']).toEqual({
    count: 1,
    dislikeCount: 0,
    favoriteCount: 0,
    liked: false,
    disliked: false,
  });
  expect(publicData.likes['study-v02']).toEqual({
    count: 0,
    dislikeCount: 1,
    favoriteCount: 0,
    liked: false,
    disliked: false,
  });
  // Old clients still use the boolean endpoint, but cannot leave both kinds of vote behind.
  expect(await (await f.vote('study-v02', true, cookie)).json()).toEqual({ count: 1, liked: true });
  expect(
    await f.db.prepare("SELECT value FROM likes WHERE artwork_id = 'study-v02'").first('value'),
  ).toBe(1);
});

it('saves exact images independently of votes, exposes only public totals, and keeps each collection private', async () => {
  const f = await fixture();
  expect((await f.request('/api/favorites')).status).toBe(401);
  expect((await f.interaction('study-v01', 'favorite', true)).status).toBe(401);
  const first = await f.login();
  expect(await (await f.interaction('study-v01', 'favorite', true, first)).json()).toEqual({
    favorites: ['study-v01'],
    favorited: true,
    favoriteCount: 1,
  });
  expect(await (await f.interaction('study-v01', 'favorite', true, first)).json()).toMatchObject({
    favoriteCount: 1,
  });
  await f.interaction('study-v01', 'vote', -1, first);
  await f.interaction('study-v02', 'favorite', true, first);
  const other = await f.login(2);
  expect(await (await f.request('/api/favorites', { headers: { Cookie: other } })).json()).toEqual({
    favorites: [],
  });
  await f.interaction('study-v01', 'favorite', true, other);
  const firstList = await f.request('/api/favorites?user_id=other', { headers: { Cookie: first } });
  expect(firstList.headers.get('cache-control')).toBe('private, no-store');
  expect(await firstList.json()).toEqual({ favorites: ['study-v02', 'study-v01'] });
  const publicData = (await (await f.request('/api/likes')).json()) as {
    favorites: unknown;
    likes: Record<string, unknown>;
  };
  expect(publicData.favorites).toEqual([]);
  expect(publicData.likes['study-v01']).toEqual({
    count: 0,
    dislikeCount: 1,
    favoriteCount: 2,
    liked: false,
    disliked: false,
  });
  expect(await (await f.interaction('study-v01', 'favorite', false, first)).json()).toEqual({
    favorites: ['study-v02'],
    favorited: false,
    favoriteCount: 1,
  });
  expect(await (await f.interaction('study-v01', 'favorite', false, first)).json()).toMatchObject({
    favoriteCount: 1,
  });
  const user = await f.db
    .prepare("SELECT id FROM auth_user WHERE email = 'user1@example.com'")
    .first('id');
  await f.db
    .prepare("INSERT INTO favorites(artwork_id, user_id) VALUES ('hidden-draft', ?)")
    .bind(user)
    .run();
  expect(
    JSON.stringify(await (await f.request('/api/likes', { headers: { Cookie: first } })).json()),
  ).not.toContain('hidden-draft');
  expect(await (await f.request('/api/favorites', { headers: { Cookie: first } })).json()).toEqual({
    favorites: ['study-v02'],
  });
  const plan = await f.db
    .prepare(
      'EXPLAIN QUERY PLAN SELECT artwork_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC, artwork_id',
    )
    .bind(user)
    .all();
  expect(JSON.stringify(plan.results)).toContain('favorites_by_user');
});

it('rejects malformed interaction writes and revoked sessions for both saves and votes', async () => {
  const f = await fixture();
  const cookie = await f.login();
  expect((await f.interaction('study-v01', 'vote', 2, cookie)).status).toBe(400);
  expect((await f.interaction('study-v01', 'vote', 0.5, cookie)).status).toBe(400);
  expect((await f.interaction('study-v01', 'favorite', 1, cookie)).status).toBe(400);
  expect((await f.interaction('hidden-draft', 'favorite', true, cookie)).status).toBe(404);
  for (const action of ['vote', 'favorite']) {
    const response = await f.request(`/api/artworks/study-v01/${action}`, {
      method: 'PUT',
      headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [action === 'vote' ? 'vote' : 'favorited']: 1,
        user_id: 'another-user',
      }),
    });
    expect(response.status).toBe(400);
  }
  await f.post('/api/auth/sign-out', {}, cookie);
  expect((await f.interaction('study-v01', 'favorite', true, cookie)).status).toBe(401);
  expect((await f.interaction('study-v01', 'vote', -1, cookie)).status).toBe(401);
  expect((await f.request('/api/favorites', { headers: { Cookie: cookie } })).status).toBe(401);
});

it('keeps aggregates consistent during concurrent retries and cascading account removal', async () => {
  const f = await fixture();
  const cookie = await f.login();
  const results = await Promise.all([
    ...[1, -1, 1, -1, 1, -1].map((value) => f.interaction('study-v01', 'vote', value, cookie)),
    ...[true, true, true].map((value) => f.interaction('study-v01', 'favorite', value, cookie)),
  ]);
  expect(results.every((result) => result.status === 200)).toBe(true);
  const row = await f.db
    .prepare(
      "SELECT count, dislike_count, favorite_count FROM like_counts WHERE artwork_id = 'study-v01'",
    )
    .first();
  expect(Number(row?.count) + Number(row?.dislike_count)).toBe(1);
  expect(row?.favorite_count).toBe(1);
  await f.db.prepare('DELETE FROM auth_user').run();
  expect(
    await f.db
      .prepare(
        "SELECT count, dislike_count, favorite_count FROM like_counts WHERE artwork_id = 'study-v01'",
      )
      .first(),
  ).toEqual({ count: 0, dislike_count: 0, favorite_count: 0 });
});
