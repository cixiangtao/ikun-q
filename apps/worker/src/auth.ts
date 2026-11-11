import { betterAuth } from 'better-auth';

/** Secrets live in Wrangler bindings, never in the frontend bundle or repository. */
export interface AuthBindings {
  DB: D1Database;
  AUTH_BASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

/** Shared model names also determine the checked-in D1 authentication schema. */
export const authModels = {
  user: { modelName: 'auth_user' },
  session: { modelName: 'auth_session' },
  account: { modelName: 'auth_account' },
  verification: { modelName: 'auth_verification' },
};

/** Returns the single trusted origin, or disables login until all configuration is valid. */
export function authOrigin(env: AuthBindings) {
  if (
    !env.AUTH_BASE_URL ||
    !env.BETTER_AUTH_SECRET ||
    env.BETTER_AUTH_SECRET.length < 32 ||
    !env.GITHUB_CLIENT_ID ||
    !env.GITHUB_CLIENT_SECRET
  )
    return null;
  try {
    const url = new URL(env.AUTH_BASE_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Creates a request-local auth instance; GitHub identity is verified by the provider callback. */
export function createAuth(env: AuthBindings) {
  const origin = authOrigin(env);
  if (!origin) return null;
  return betterAuth({
    ...authModels,
    appName: 'IKUN-Q',
    baseURL: origin,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins: [origin],
    emailAndPassword: { enabled: false },
    socialProviders: {
      github: { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! },
    },
    session: {
      ...authModels.session,
      expiresIn: 60 * 60 * 24 * 30,
      cookieCache: { enabled: false },
    },
    account: {
      ...authModels.account,
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
    },
    advanced: {
      cookiePrefix: 'ikun_q',
      useSecureCookies: origin.startsWith('https:'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    // Native Cloudflare bindings apply IP and account limits before auth/like handlers.
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    logger: { disabled: true },
    onAPIError: { errorURL: `${origin}/?auth_error=1` },
  });
}
