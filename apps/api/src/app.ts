import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { openLikeStore } from './store.ts';

export const visitorCookie = 'ikun_q_visitor';
const visitorPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface AppOptions {
  databasePath: string;
  artworkIds: readonly string[];
  /** Exact browser origin; the Vite origin in development and the public HTTPS origin in production. */
  publicOrigin: string;
  secureCookie?: boolean;
  staticRoot?: string;
  logger?: boolean;
  /** Only set trusted proxy addresses when the server is behind a controlled reverse proxy. */
  trustProxy?: string;
  writeLimit?: number;
}

/** Builds the same-origin API, optionally serving the built gallery. It never opens the private manifest. */
export async function createApp(options: AppOptions) {
  const origin = new URL(options.publicOrigin).origin;
  const ids = new Set(options.artworkIds);
  const store = openLikeStore(options.databasePath);
  const app = Fastify({
    logger: options.logger
      ? { redact: ['req.headers.cookie', 'req.headers.authorization'] }
      : false,
    bodyLimit: 1024,
    trustProxy: options.trustProxy ?? false,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  });
  app.addHook('onClose', async () => store.close());
  try {
    await app.register(cookie);
    await app.register(rateLimit, { global: false });
    app.addHook('onRequest', async (request, reply) => {
      if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'private, no-store');
    });
    app.get('/api/health', async () => ({ status: 'ok' }));
    app.get(
      '/api/likes',
      {
        config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        let visitor = request.cookies[visitorCookie];
        if (!visitor || !visitorPattern.test(visitor)) {
          visitor = randomUUID();
          reply.setCookie(visitorCookie, visitor, {
            httpOnly: true,
            sameSite: 'lax',
            secure: options.secureCookie ?? false,
            path: '/api',
            maxAge: 60 * 60 * 24 * 365,
          });
        }
        return { likes: store.readAll(ids, visitor) };
      },
    );
    app.put<{ Params: { id: string }; Body: { liked: boolean } }>(
      '/api/artworks/:id/like',
      {
        config: { rateLimit: { max: options.writeLimit ?? 30, timeWindow: '1 minute' } },
        schema: {
          params: {
            type: 'object',
            required: ['id'],
            additionalProperties: false,
            properties: { id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,127}$' } },
          },
          body: {
            type: 'object',
            required: ['liked'],
            additionalProperties: false,
            properties: { liked: { type: 'boolean' } },
          },
        },
        onRequest: async (request, reply) => {
          if (request.headers.origin !== origin) {
            return reply.code(403).send({ message: '请求来源不受信任。' });
          }
        },
      },
      async (request, reply) => {
        if (!ids.has(request.params.id)) return reply.code(404).send({ message: '图片未收录。' });
        const visitor = request.cookies[visitorCookie];
        if (!visitor || !visitorPattern.test(visitor)) {
          return reply.code(401).send({ message: '请先加载点赞状态，并允许浏览器保存 Cookie。' });
        }
        return store.set(request.params.id, visitor, request.body.liked);
      },
    );
    if (options.staticRoot) {
      await app.register(staticFiles, { root: options.staticRoot, maxAge: 0 });
    }
    await app.ready();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
