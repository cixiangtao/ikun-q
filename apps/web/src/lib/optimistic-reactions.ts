import type { LikeState } from './likes';

/** Predicts this account's mutually exclusive vote, preserving other accounts' votes. */
export function optimisticVote(state: LikeState, vote: -1 | 0 | 1): LikeState {
  return {
    ...state,
    count: Math.max(0, state.count + Number(vote === 1) - Number(state.liked)),
    dislikeCount: Math.max(0, state.dislikeCount + Number(vote === -1) - Number(state.disliked)),
    liked: vote === 1,
    disliked: vote === -1,
  };
}

/** Predicts one save change without affecting the image's votes. */
export function optimisticFavorite(state: LikeState, saved: boolean): LikeState {
  return { ...state, favoriteCount: Math.max(0, state.favoriteCount + (saved ? -1 : 1)) };
}
