import { describe, expect, it } from 'vitest';
import { optimisticFavorite, optimisticVote } from './optimistic-reactions';

describe('optimistic reactions', () => {
  const votes = [-1, 0, 1] as const;
  for (const previous of votes) {
    for (const next of votes) {
      it(`changes vote ${previous} to ${next} without changing other accounts or favorites`, () => {
        const state = {
          count: 4 + Number(previous === 1),
          dislikeCount: 2 + Number(previous === -1),
          favoriteCount: 3,
          liked: previous === 1,
          disliked: previous === -1,
        };
        expect(optimisticVote(state, next)).toEqual({
          count: 4 + Number(next === 1),
          dislikeCount: 2 + Number(next === -1),
          favoriteCount: 3,
          liked: next === 1,
          disliked: next === -1,
        });
        expect(state.count).toBe(4 + Number(previous === 1));
      });
    }
  }

  it('adds and removes a save without mutating the confirmed snapshot needed for rollback', () => {
    const state = { count: 4, dislikeCount: 2, favoriteCount: 3, liked: true, disliked: false };
    const saved = optimisticFavorite(state, false);
    expect(saved).toEqual({ ...state, favoriteCount: 4 });
    expect(optimisticFavorite(saved, true)).toEqual(state);
    expect(state.favoriteCount).toBe(3);
  });

  it('keeps counts nonnegative even if an old snapshot has no aggregate votes', () => {
    const state = { count: 0, dislikeCount: 0, favoriteCount: 0, liked: true, disliked: false };
    expect(optimisticVote(state, 0).count).toBe(0);
    expect(optimisticFavorite(state, true).favoriteCount).toBe(0);
  });
});
