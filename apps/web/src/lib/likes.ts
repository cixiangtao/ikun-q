/** One image's server snapshot or in-flight prediction; never inferred from local storage. */
export interface LikeState {
  count: number;
  dislikeCount: number;
  favoriteCount: number;
  liked: boolean;
  disliked: boolean;
}

/** Only the public profile needed by the UI; session tokens stay in HttpOnly cookies. */
export interface LikeAuth {
  loginAvailable: boolean;
  user: { id: string; name: string } | null;
}

export class LoginRequiredError extends Error {}

function isLikeAuth(value: unknown): value is LikeAuth {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('loginAvailable' in value) ||
    typeof value.loginAvailable !== 'boolean' ||
    !('user' in value)
  )
    return false;
  return (
    value.user === null ||
    (typeof value.user === 'object' &&
      'id' in value.user &&
      typeof value.user.id === 'string' &&
      'name' in value.user &&
      typeof value.user.name === 'string')
  );
}

function parseLikeState(value: unknown): LikeState | undefined {
  if (
    !(
      typeof value === 'object' &&
      value !== null &&
      'count' in value &&
      typeof value.count === 'number' &&
      Number.isSafeInteger(value.count) &&
      value.count >= 0 &&
      'liked' in value &&
      typeof value.liked === 'boolean'
    )
  )
    return undefined;
  const dislikeCount = 'dislikeCount' in value ? value.dislikeCount : 0;
  const favoriteCount = 'favoriteCount' in value ? value.favoriteCount : 0;
  const disliked = 'disliked' in value ? value.disliked : false;
  if (
    typeof dislikeCount !== 'number' ||
    !Number.isSafeInteger(dislikeCount) ||
    dislikeCount < 0 ||
    typeof favoriteCount !== 'number' ||
    !Number.isSafeInteger(favoriteCount) ||
    favoriteCount < 0 ||
    typeof disliked !== 'boolean' ||
    (disliked && value.liked)
  )
    return undefined;
  return { count: value.count, liked: value.liked, dislikeCount, favoriteCount, disliked };
}

function isFavoriteList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((id) => typeof id === 'string') &&
    new Set(value).size === value.length
  );
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: init.signal ?? AbortSignal.timeout(8000),
  });
  if (response.status === 401) throw new LoginRequiredError('请登录后再点赞。');
  if (!response.ok)
    throw new Error(
      response.status === 429 ? '操作较频繁，请稍后重试。' : '互动服务暂时不可用，请重试。',
    );
  return response.json();
}

/** Public counts remain available without signing in; only authenticated choices are returned. */
export async function fetchLikes(signal?: AbortSignal): Promise<{
  likes: Record<string, LikeState>;
  auth: LikeAuth;
  favorites: string[];
}> {
  const result = await request('/likes', { signal });
  if (
    typeof result !== 'object' ||
    result === null ||
    !('likes' in result) ||
    typeof result.likes !== 'object' ||
    result.likes === null ||
    Array.isArray(result.likes)
  ) {
    throw new Error('点赞数据暂时无法读取。');
  }
  const entries = Object.entries(result.likes).map(
    ([id, state]) => [id, parseLikeState(state)] as const,
  );
  if (!entries.every((entry): entry is readonly [string, LikeState] => Boolean(entry[1]))) {
    throw new Error('点赞数据暂时无法读取。');
  }
  // The retained standalone SQLite backend has no account login. Never treat it as authenticated.
  let auth: LikeAuth = { loginAvailable: false, user: null };
  if ('auth' in result) {
    if (!isLikeAuth(result.auth)) throw new Error('登录状态暂时无法读取。');
    auth = result.auth;
  }
  const favorites = 'favorites' in result ? result.favorites : [];
  if (!isFavoriteList(favorites)) throw new Error('收藏数据暂时无法读取。');
  return { likes: Object.fromEntries(entries), auth, favorites: auth.user ? favorites : [] };
}

/** Starts the same-origin OAuth flow; the return URL includes the current character hash route. */
export async function signIn() {
  const errorURL = new URL(window.location.href);
  errorURL.searchParams.set('auth_error', '1');
  const result = await request('/auth/sign-in/social', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'github',
      callbackURL: window.location.href,
      errorCallbackURL: errorURL.href,
      disableRedirect: true,
    }),
  });
  if (
    typeof result !== 'object' ||
    result === null ||
    !('url' in result) ||
    typeof result.url !== 'string'
  )
    throw new Error('暂时无法打开 GitHub 登录，请重试。');
  const url = new URL(result.url);
  if (url.origin !== 'https://github.com' || url.pathname !== '/login/oauth/authorize')
    throw new Error('登录地址异常，请稍后重试。');
  window.location.assign(url.href);
}

/** Revokes the current server-side session as well as clearing its browser cookie. */
export async function signOut() {
  await request('/auth/sign-out', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

/** Sets the desired state so a retried request cannot add an extra vote. */
export async function setVote(id: string, vote: -1 | 0 | 1): Promise<LikeState> {
  const result = parseLikeState(
    await request(`/artworks/${encodeURIComponent(id)}/vote`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    }),
  );
  if (!result) throw new Error('未能确认赞踩结果，请刷新后重试。');
  return result;
}

/** Saves a concrete image version; the list is private and the aggregate count is public. */
export async function setFavorite(
  id: string,
  favorited: boolean,
): Promise<{ favorites: string[]; favorited: boolean; favoriteCount: number }> {
  const result = await request(`/artworks/${encodeURIComponent(id)}/favorite`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorited }),
  });
  if (
    typeof result !== 'object' ||
    result === null ||
    !('favorites' in result) ||
    !isFavoriteList(result.favorites) ||
    !('favorited' in result) ||
    typeof result.favorited !== 'boolean' ||
    !('favoriteCount' in result) ||
    typeof result.favoriteCount !== 'number' ||
    !Number.isSafeInteger(result.favoriteCount) ||
    result.favoriteCount < 0
  )
    throw new Error('未能确认收藏结果，请重试。');
  return {
    favorites: result.favorites,
    favorited: result.favorited,
    favoriteCount: result.favoriteCount,
  };
}
