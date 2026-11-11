import { LoginRequiredError, type LikeAuth, type LikeState } from './likes';
import { optimisticFavorite, optimisticVote } from './optimistic-reactions';

interface Snapshot {
  likes: Record<string, LikeState>;
  favorites: readonly string[];
  auth: LikeAuth;
  status: 'loading' | 'ready' | 'error';
  pending: ReadonlySet<string>;
  errors: Record<string, string>;
  signingOut: boolean;
}
interface Dependencies {
  load: (signal?: AbortSignal) => Promise<Pick<Snapshot, 'likes' | 'favorites' | 'auth'>>;
  vote: (id: string, vote: -1 | 0 | 1) => Promise<LikeState>;
  favorite: (id: string, saved: boolean) => Promise<{ favorited: boolean; favoriteCount: number }>;
  signOut: () => Promise<void>;
  requestLogin: (reason?: string, expired?: boolean) => void;
  onLoggedOut: () => void;
  onLogoutError: () => void;
}
type Intent =
  | { id: string; kind: 'vote'; target: -1 | 0 | 1 }
  | { id: string; kind: 'favorite'; target: boolean };
type Listener = () => void;

/** Shared account state with per-image subscriptions and one latest intent per mutation lane. */
export function createReactionStore(deps: Dependencies) {
  let snapshot: Snapshot = {
    likes: {},
    favorites: [],
    auth: { loginAvailable: false, user: null },
    status: 'loading',
    pending: new Set(),
    errors: {},
    signingOut: false,
  };
  let confirmed: Record<string, LikeState> = {};
  let saved = new Set<string>();
  let generation = 0;
  const intents = new Map<string, Intent>();
  const running = new Set<string>();
  const listeners = new Set<Listener>();
  const images = new Map<string, ReturnType<typeof createImageChannel>>();

  function readImage(id: string) {
    return {
      state: snapshot.likes[id],
      saved: snapshot.favorites.includes(id),
      status: snapshot.status,
      signingOut: snapshot.signingOut,
      syncing: running.has(`vote:${id}`) || running.has(`favorite:${id}`),
      voteError: snapshot.errors[`vote:${id}`] ?? '',
      favoriteError: snapshot.errors[`favorite:${id}`] ?? '',
    };
  }
  function createImageChannel(id: string) {
    let value = readImage(id);
    const subscribers = new Set<Listener>();
    return {
      getSnapshot: () => value,
      subscribe: (listener: Listener) => {
        subscribers.add(listener);
        return () => {
          subscribers.delete(listener);
        };
      },
      notify: () => {
        const next = readImage(id);
        if (
          Object.keys(next).every(
            (key) => next[key as keyof typeof next] === value[key as keyof typeof value],
          )
        )
          return;
        value = next;
        for (const listener of subscribers) listener();
      },
    };
  }
  function publish(id?: string) {
    snapshot = {
      ...snapshot,
      pending: new Set([...running].map((key) => key.slice(key.indexOf(':') + 1))),
    };
    if (id) images.get(id)?.notify();
    else for (const channel of images.values()) channel.notify();
    for (const listener of listeners) listener();
  }
  function rebase(id: string) {
    const base = confirmed[id];
    if (!base) return;
    const vote = intents.get(`vote:${id}`);
    const favorite = intents.get(`favorite:${id}`);
    const favorited = favorite?.kind === 'favorite' ? favorite.target : saved.has(id);
    let state = vote?.kind === 'vote' ? optimisticVote(base, vote.target) : base;
    if (favorited !== saved.has(id)) state = optimisticFavorite(state, saved.has(id));
    const previous = snapshot.likes[id];
    if (
      !previous ||
      Object.keys(state).some(
        (key) => state[key as keyof LikeState] !== previous[key as keyof LikeState],
      )
    ) {
      snapshot = { ...snapshot, likes: { ...snapshot.likes, [id]: state } };
    }
    if (snapshot.favorites.includes(id) !== favorited) {
      snapshot = {
        ...snapshot,
        favorites: favorited
          ? [id, ...snapshot.favorites]
          : snapshot.favorites.filter((item) => item !== id),
      };
    }
  }
  function forgetViewer() {
    generation++;
    intents.clear();
    running.clear();
    saved.clear();
    confirmed = Object.fromEntries(
      Object.entries(confirmed).map(([id, state]) => [
        id,
        { ...state, liked: false, disliked: false },
      ]),
    );
    snapshot = {
      ...snapshot,
      likes: confirmed,
      favorites: [],
      errors: {},
      auth: { ...snapshot.auth, user: null },
    };
    publish();
  }
  async function drain(key: string, id: string) {
    const started = generation;
    running.add(key);
    publish(id);
    try {
      while (generation === started) {
        const sent = intents.get(key);
        if (!sent) break;
        try {
          if (sent.kind === 'vote') {
            const result = await deps.vote(id, sent.target);
            if (generation !== started) return;
            if (result.liked !== (sent.target === 1) || result.disliked !== (sent.target === -1))
              throw new Error('未能确认赞踩结果，请重试。');
            // A vote response may contain an older favorite count. Merge only its own lane.
            confirmed[id] = {
              ...confirmed[id]!,
              count: result.count,
              dislikeCount: result.dislikeCount,
              liked: result.liked,
              disliked: result.disliked,
            };
          } else {
            const result = await deps.favorite(id, sent.target);
            if (generation !== started) return;
            if (result.favorited !== sent.target) throw new Error('未能确认收藏结果，请重试。');
            confirmed[id] = { ...confirmed[id]!, favoriteCount: result.favoriteCount };
            if (result.favorited) saved.add(id);
            else saved.delete(id);
          }
          // An old response confirms the baseline, never overwrites the visitor's latest choice.
          if (intents.get(key)?.target === sent.target) intents.delete(key);
          snapshot = { ...snapshot, errors: { ...snapshot.errors, [key]: '' } };
        } catch (error) {
          if (generation !== started) return;
          if (error instanceof LoginRequiredError) {
            forgetViewer();
            deps.requestLogin(undefined, true);
            return;
          }
          // If a newer choice exists, send it next even after an ambiguous network failure.
          if (intents.get(key) === sent) {
            intents.delete(key);
            snapshot = {
              ...snapshot,
              errors: {
                ...snapshot.errors,
                [key]: error instanceof Error ? error.message : '操作未完成，请重试。',
              },
            };
          }
        }
        rebase(id);
        publish(id);
      }
    } finally {
      if (generation === started) {
        running.delete(key);
        publish(id);
      }
    }
  }
  function enqueue(intent: Intent) {
    if (snapshot.status !== 'ready' || !confirmed[intent.id] || snapshot.signingOut) return false;
    if (!snapshot.auth.user) {
      deps.requestLogin(intent.kind === 'favorite' ? '收藏这张图片' : '为图片表达赞踩');
      return false;
    }
    const key = `${intent.kind}:${intent.id}`;
    intents.set(key, intent);
    snapshot = { ...snapshot, errors: { ...snapshot.errors, [key]: '' } };
    rebase(intent.id);
    if (running.has(key)) publish(intent.id);
    else void drain(key, intent.id);
    return true;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    image: (id: string) => {
      let channel = images.get(id);
      if (!channel) {
        channel = createImageChannel(id);
        images.set(id, channel);
      }
      return channel;
    },
    requestLogin: deps.requestLogin,
    toggleVote: (id: string, value: -1 | 1) => {
      const state = snapshot.likes[id];
      const target = value === 1 ? (state?.liked ? 0 : 1) : state?.disliked ? 0 : -1;
      return enqueue({ id, kind: 'vote', target });
    },
    toggleFavorite: (id: string) =>
      enqueue({ id, kind: 'favorite', target: !snapshot.favorites.includes(id) }),
    refresh: async (signal?: AbortSignal) => {
      if (running.size || snapshot.signingOut) return;
      const started = ++generation;
      snapshot = { ...snapshot, status: 'loading', errors: {} };
      publish();
      try {
        const result = await deps.load(signal);
        if (started !== generation || signal?.aborted) return;
        confirmed = { ...result.likes };
        saved = new Set(result.favorites);
        snapshot = { ...snapshot, ...result, status: 'ready' };
      } catch {
        if (started !== generation || signal?.aborted) return;
        snapshot = { ...snapshot, status: 'error' };
      }
      publish();
    },
    logout: async () => {
      if (snapshot.signingOut || running.size) return;
      snapshot = { ...snapshot, signingOut: true };
      publish();
      try {
        await deps.signOut();
        forgetViewer();
        deps.onLoggedOut();
      } catch {
        deps.onLogoutError();
      } finally {
        snapshot = { ...snapshot, signingOut: false };
        publish();
      }
    },
  };
}
