import { readFavorites, readLikes, setFavorite, setVote } from './store.ts';
import { authOrigin, createAuth, type AuthBindings } from './auth.ts';

/** Cloudflare bindings; static files and API share the request origin and session cookie. */
export interface Bindings extends AuthBindings {
  ASSETS: Fetcher;
  READ_LIMITER: RateLimit;
  WRITE_LIMITER: RateLimit;
}

const maxBodyBytes = 1024;

function json(value: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

/** Bounds actual streamed bytes instead of trusting the caller's Content-Length. */
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(body);
}

/** Creates the Workers entrypoint using only the generated public asset-ID allowlist. */
export function createWorker(artworkIds: readonly string[]) {
  const ids = new Set(artworkIds);
  return {
    async fetch(request: Request, env: Bindings): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname !== '/api' && !url.pathname.startsWith('/api/'))
        return env.ASSETS.fetch(request);
      if (url.pathname === '/api/health' && request.method === 'GET') return json({ status: 'ok' });
      const isLikesRead = url.pathname === '/api/likes' && request.method === 'GET';
      const isFavoritesRead = url.pathname === '/api/favorites' && request.method === 'GET';
      const isRead = isLikesRead || isFavoritesRead;
      const isAuth =
        (url.pathname === '/api/auth/sign-in/social' && request.method === 'POST') ||
        (url.pathname === '/api/auth/callback/github' && request.method === 'GET') ||
        (url.pathname === '/api/auth/sign-out' && request.method === 'POST');
      const vote = /^\/api\/artworks\/([a-z0-9][a-z0-9-]{0,127})\/(like|vote|favorite)$/.exec(
        url.pathname,
      );
      if (!isRead && !isAuth && (!vote || request.method !== 'PUT'))
        return json({ message: '接口不存在。' }, 404);
      if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) {
        return json({ message: '请求来源不受信任。' }, 403);
      }
      try {
        // Cloudflare overwrites this header at the edge. Local requests share a development key.
        const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
        const limiter = isRead ? env.READ_LIMITER : env.WRITE_LIMITER;
        if (!(await limiter.limit({ key: `${isAuth ? 'auth' : 'likes'}:${ip}` })).success) {
          return json({ message: '操作较频繁，请稍后重试。' }, 429, { 'Retry-After': '60' });
        }
        const origin = authOrigin(env);
        // Do not mint sessions on an unconfigured or unexpected host, including preview URLs.
        const auth = origin === url.origin ? createAuth(env) : null;
        if (isAuth) {
          if (!auth) return json({ message: 'GitHub 登录暂未开放，请稍后再试。' }, 503);
          let authRequest = request;
          if (request.method === 'POST') {
            const body = await readBody(request);
            if (body === null) return json({ message: '请求内容过大或为空。' }, 413);
            authRequest = new Request(request, { method: 'POST', body });
          }
          const response = await auth.handler(authRequest);
          const secured = new Response(response.body, response);
          secured.headers.set('Cache-Control', 'private, no-store');
          secured.headers.set('X-Content-Type-Options', 'nosniff');
          return secured;
        }
        const session = auth
          ? await auth.api.getSession({ headers: request.headers, query: { disableRefresh: true } })
          : null;
        if (isFavoritesRead) {
          if (!session) return json({ message: '请先登录后查看收藏。' }, 401);
          return json({ favorites: await readFavorites(env.DB, ids, session.user.id) });
        }
        if (isLikesRead) {
          const [likes, favorites] = await Promise.all([
            readLikes(env.DB, ids, session?.user.id),
            readFavorites(env.DB, ids, session?.user.id),
          ]);
          return json({
            likes,
            favorites,
            auth: {
              loginAvailable: Boolean(auth),
              user: session ? { id: session.user.id, name: session.user.name } : null,
            },
          });
        }
        const id = vote?.[1];
        if (!id || !ids.has(id)) return json({ message: '图片未收录。' }, 404);
        if (!session) return json({ message: '请先登录 GitHub 后再操作。' }, 401);
        if (!(await env.WRITE_LIMITER.limit({ key: `user:${session.user.id}` })).success)
          return json({ message: '操作较频繁，请稍后重试。' }, 429, { 'Retry-After': '60' });
        if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json') {
          return json({ message: '请使用 JSON 提交。' }, 415);
        }
        let body: unknown;
        try {
          const text = await readBody(request);
          if (text === null) return json({ message: '请求内容过大或为空。' }, 413);
          body = JSON.parse(text);
        } catch {
          return json({ message: '操作参数无效。' }, 400);
        }
        if (typeof body !== 'object' || body === null || Object.keys(body).length !== 1) {
          return json({ message: '操作参数无效。' }, 400);
        }
        if (vote?.[2] === 'favorite' && 'favorited' in body && typeof body.favorited === 'boolean')
          return json(await setFavorite(env.DB, ids, id, session.user.id, body.favorited));
        if (
          vote?.[2] === 'vote' &&
          'vote' in body &&
          (body.vote === -1 || body.vote === 0 || body.vote === 1)
        )
          return json(await setVote(env.DB, id, session.user.id, body.vote));
        if (vote?.[2] === 'like' && 'liked' in body && typeof body.liked === 'boolean') {
          const result = await setVote(env.DB, id, session.user.id, body.liked ? 1 : 0);
          return json({ count: result.count, liked: result.liked });
        }
        return json({ message: '操作参数无效。' }, 400);
      } catch {
        console.error('登录或互动服务请求失败。');
        return json({ message: '互动服务暂时不可用，请稍后重试。' }, 503);
      }
    },
  };
}
