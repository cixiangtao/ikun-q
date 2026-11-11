import { describe, expect, it, vi } from 'vitest';
import { LoginRequiredError, type LikeState } from './likes';
import { createReactionStore } from './reaction-store';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const base: LikeState = {
  count: 2,
  dislikeCount: 1,
  favoriteCount: 3,
  liked: false,
  disliked: false,
};
const up: LikeState = { ...base, count: 3, liked: true };
const down: LikeState = { ...base, dislikeCount: 2, disliked: true };
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

async function fixture(loggedIn = true) {
  const votes: ReturnType<typeof deferred<LikeState>>[] = [];
  const saves: ReturnType<typeof deferred<{ favorited: boolean; favoriteCount: number }>>[] = [];
  const deps = {
    load: vi.fn(async () => ({
      likes: { a: { ...base }, b: { ...base } },
      favorites: [] as string[],
      auth: { loginAvailable: true, user: loggedIn ? { id: 'test', name: 'Test' } : null },
    })),
    vote: vi.fn((_id: string, _value: -1 | 0 | 1) => {
      const task = deferred<LikeState>();
      votes.push(task);
      return task.promise;
    }),
    favorite: vi.fn((_id: string, _saved: boolean) => {
      const task = deferred<{ favorited: boolean; favoriteCount: number }>();
      saves.push(task);
      return task.promise;
    }),
    signOut: vi.fn(async () => {}),
    requestLogin: vi.fn(),
    onLoggedOut: vi.fn(),
    onLogoutError: vi.fn(),
  };
  const store = createReactionStore(deps);
  await store.refresh();
  return { store, deps, votes, saves };
}

describe('latest-intent reactions', () => {
  it('immediately accepts cancellation while a vote is in flight, preserving the newer view during old acknowledgments', async () => {
    const { store, deps, votes } = await fixture();
    const oldSnapshot = store.getSnapshot();
    store.toggleVote('a', 1);
    expect(store.image('a').getSnapshot().state).toEqual(up);
    store.toggleVote('a', 1);
    expect(store.image('a').getSnapshot().state).toEqual(base);
    expect(deps.vote).toHaveBeenCalledTimes(1);
    votes[0]!.resolve(up);
    await flush();
    expect(deps.vote).toHaveBeenLastCalledWith('a', 0);
    expect(store.image('a').getSnapshot().state).toEqual(base);
    expect(oldSnapshot.likes.a).toEqual(base);
    votes[1]!.resolve(base);
    await flush();
    expect(store.getSnapshot().pending.size).toBe(0);
  });

  it('coalesces on/off/on into the single already-running request', async () => {
    const { store, deps, votes } = await fixture();
    store.toggleVote('a', 1);
    store.toggleVote('a', 1);
    store.toggleVote('a', 1);
    expect(store.image('a').getSnapshot().state).toEqual(up);
    votes[0]!.resolve(up);
    await flush();
    expect(deps.vote).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().pending.size).toBe(0);
  });

  it('keeps a newer dislike visible when an older like succeeds', async () => {
    const { store, deps, votes } = await fixture();
    store.toggleVote('a', 1);
    store.toggleVote('a', -1);
    expect(store.image('a').getSnapshot().state).toEqual(down);
    votes[0]!.resolve(up);
    await flush();
    expect(store.image('a').getSnapshot().state).toEqual(down);
    expect(deps.vote).toHaveBeenLastCalledWith('a', -1);
    votes[1]!.resolve(down);
    await flush();
    expect(store.image('a').getSnapshot().state).toEqual(down);
  });

  it('sends a newer target even when an obsolete request failed ambiguously', async () => {
    const { store, deps, votes } = await fixture();
    store.toggleVote('a', 1);
    store.toggleVote('a', 1);
    votes[0]!.reject(new Error('Network timeout'));
    await flush();
    expect(deps.vote).toHaveBeenLastCalledWith('a', 0);
    expect(store.image('a').getSnapshot().state).toEqual(base);
    expect(store.image('a').getSnapshot().voteError).toBe('');
    votes[1]!.resolve(base);
    await flush();
    expect(store.getSnapshot().pending.size).toBe(0);
  });

  it('rolls back the latest failed choice to its confirmed baseline and allows retry', async () => {
    const { store, votes } = await fixture();
    store.toggleVote('a', 1);
    votes[0]!.resolve(up);
    await flush();
    store.toggleVote('a', -1);
    votes[1]!.reject(new Error('请重试'));
    await flush();
    expect(store.image('a').getSnapshot().state).toEqual(up);
    expect(store.image('a').getSnapshot().voteError).toBe('请重试');
    store.toggleVote('a', -1);
    expect(store.image('a').getSnapshot().voteError).toBe('');
    expect(store.image('a').getSnapshot().state).toEqual(down);
  });

  it('only notifies the affected image; other image snapshots retain their identity', async () => {
    const { store, votes } = await fixture();
    const a = store.image('a'),
      b = store.image('b');
    const aListener = vi.fn(),
      bListener = vi.fn();
    const previous = b.getSnapshot();
    a.subscribe(aListener);
    const remove = b.subscribe(bListener);
    store.toggleVote('a', 1);
    votes[0]!.resolve(up);
    await flush();
    expect(aListener).toHaveBeenCalled();
    expect(bListener).not.toHaveBeenCalled();
    expect(b.getSnapshot()).toBe(previous);
    remove();
    store.toggleVote('b', 1);
    expect(bListener).not.toHaveBeenCalled();
  });

  it('permits vote and save concurrently; their responses cannot overwrite each other', async () => {
    const { store, votes, saves } = await fixture();
    store.toggleVote('a', 1);
    store.toggleFavorite('a');
    expect(store.image('a').getSnapshot().state).toEqual({ ...up, favoriteCount: 4 });
    saves[0]!.resolve({ favorited: true, favoriteCount: 4 });
    await flush();
    votes[0]!.resolve(up);
    await flush();
    expect(store.image('a').getSnapshot().state).toEqual({ ...up, favoriteCount: 4 });
    expect(store.image('a').getSnapshot().saved).toBe(true);
  });

  it('saves different images in parallel without replacing the list with a stale full-list response', async () => {
    const { store, deps, saves } = await fixture();
    store.toggleFavorite('a');
    store.toggleFavorite('b');
    expect(deps.favorite).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().favorites).toEqual(['b', 'a']);
    saves[1]!.resolve({ favorited: true, favoriteCount: 4 });
    await flush();
    saves[0]!.resolve({ favorited: true, favoriteCount: 4 });
    await flush();
    expect(store.getSnapshot().favorites).toEqual(['b', 'a']);
  });

  it('keeps a queued un-save visible after the older save succeeds', async () => {
    const { store, deps, saves } = await fixture();
    store.toggleFavorite('a');
    store.toggleFavorite('a');
    expect(store.getSnapshot().favorites).toEqual([]);
    saves[0]!.resolve({ favorited: true, favoriteCount: 4 });
    await flush();
    expect(store.getSnapshot().favorites).toEqual([]);
    expect(store.image('a').getSnapshot().state?.favoriteCount).toBe(3);
    expect(deps.favorite).toHaveBeenLastCalledWith('a', false);
    saves[1]!.resolve({ favorited: false, favoriteCount: 3 });
    await flush();
    expect(store.image('a').getSnapshot().saved).toBe(false);
  });

  it('rolls back only a failed save while preserving another save and the same image vote', async () => {
    const { store, votes, saves } = await fixture();
    store.toggleVote('a', 1);
    store.toggleFavorite('a');
    store.toggleFavorite('b');
    votes[0]!.resolve(up);
    saves[1]!.resolve({ favorited: true, favoriteCount: 4 });
    await flush();
    saves[0]!.reject(new Error('请重试'));
    await flush();
    expect(store.getSnapshot().favorites).toEqual(['b']);
    expect(store.image('a').getSnapshot().state).toEqual(up);
    expect(store.image('b').getSnapshot().saved).toBe(true);
  });

  it('invalidates every pending intent on expiry and ignores late successful responses', async () => {
    const { store, deps, votes, saves } = await fixture();
    store.toggleVote('a', 1);
    store.toggleFavorite('a');
    store.toggleFavorite('b');
    saves[0]!.reject(new LoginRequiredError());
    await flush();
    expect(store.getSnapshot().auth.user).toBeNull();
    expect(store.getSnapshot().favorites).toEqual([]);
    votes[0]!.resolve(up);
    saves[1]!.resolve({ favorited: true, favoriteCount: 4 });
    await flush();
    expect(store.getSnapshot().favorites).toEqual([]);
    expect(store.image('a').getSnapshot().state).toEqual(base);
    expect(store.getSnapshot().pending.size).toBe(0);
    expect(deps.requestLogin).toHaveBeenCalledWith(undefined, true);
  });

  it('never sends anonymous intents', async () => {
    const { store, deps } = await fixture(false);
    expect(store.toggleVote('a', 1)).toBe(false);
    expect(store.toggleFavorite('a')).toBe(false);
    expect(deps.vote).not.toHaveBeenCalled();
    expect(deps.favorite).not.toHaveBeenCalled();
    expect(deps.requestLogin).toHaveBeenCalledTimes(2);
    expect(store.image('a').getSnapshot().state).toEqual(base);
  });

  it('blocks signout while synchronizing, then clears private state when signout finishes', async () => {
    const { store, deps, votes } = await fixture();
    store.toggleVote('a', 1);
    await store.logout();
    expect(deps.signOut).not.toHaveBeenCalled();
    votes[0]!.resolve(up);
    await flush();
    await store.logout();
    expect(store.image('a').getSnapshot().state?.liked).toBe(false);
    expect(store.image('a').getSnapshot().state?.count).toBe(3);
    expect(store.getSnapshot().auth.user).toBeNull();
    expect(deps.onLoggedOut).toHaveBeenCalledOnce();
  });

  it('retains the newer load when an older initial request completes later', async () => {
    const { store, deps } = await fixture();
    const older = deferred<Awaited<ReturnType<typeof deps.load>>>();
    deps.load.mockImplementationOnce(() => older.promise);
    const first = store.refresh();
    await store.refresh();
    older.resolve({
      likes: { a: { ...base, count: 99 }, b: { ...base } },
      favorites: [],
      auth: { loginAvailable: false, user: null },
    });
    await first;
    expect(store.getSnapshot().auth.user?.id).toBe('test');
    expect(store.image('a').getSnapshot().state).toEqual(base);
  });
});
