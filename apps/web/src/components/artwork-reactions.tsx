import { ReactionButtons, type ReactionButtonsProps } from '@ikun-q/ui/components/reaction-buttons';
import { useArtworkReaction } from '@/components/likes-provider';

interface ArtworkReactionsProps {
  artworkId: string;
  label?: string;
  variant?: ReactionButtonsProps['variant'];
  onRemoved?: () => void;
}

/** Connects the shared controls to the exact image's account state and optimistic queues. */
export function ArtworkReactions({
  artworkId,
  label,
  variant = 'minimal',
  onRemoved,
}: ArtworkReactionsProps) {
  const {
    state,
    saved,
    status,
    syncing,
    voteError,
    favoriteError,
    refresh,
    toggleVote,
    toggleFavorite,
    signingOut,
  } = useArtworkReaction(artworkId);
  const busy = status === 'loading';
  const missing = status === 'ready' && !state;
  const disabled = busy || missing || signingOut;
  const voteFailed = status === 'error' || Boolean(voteError);
  const favoriteFailed = status === 'error' || Boolean(favoriteError);
  const describe = (action: string) =>
    `${busy ? '正在加载互动' : missing ? '这张图片暂不可互动' : action}${label ? `：${label}` : ''}`;
  const current = status === 'ready' ? state : undefined;
  function favorite() {
    if (status === 'error') {
      void refresh();
      return;
    }
    const accepted = toggleFavorite(artworkId);
    // Removing a saved card restores keyboard focus in the same frame as the optimistic update.
    if (accepted && saved && onRemoved) requestAnimationFrame(onRemoved);
  }
  return (
    <div className="artwork-reactions" data-syncing={syncing || undefined}>
      <ReactionButtons
        variant={variant}
        actions={{
          like: {
            count: current?.count,
            selected: state?.liked ?? false,
            label: describe(voteFailed ? '重试点赞' : state?.liked ? '取消点赞' : '为这张图片点赞'),
            busy,
            disabled,
            onClick: () => void (status === 'error' ? refresh() : toggleVote(artworkId, 1)),
          },
          dislike: {
            count: current?.dislikeCount,
            selected: state?.disliked ?? false,
            label: describe(
              voteFailed ? '重试点踩' : state?.disliked ? '取消点踩' : '为这张图片点踩',
            ),
            busy,
            disabled,
            onClick: () => void (status === 'error' ? refresh() : toggleVote(artworkId, -1)),
          },
          favorite: {
            count: current?.favoriteCount,
            selected: saved,
            label: describe(favoriteFailed ? '重试收藏' : saved ? '取消收藏' : '收藏这张图片'),
            busy,
            disabled,
            onClick: favorite,
          },
        }}
      />
      <output className="like-note" aria-live="polite">
        {status === 'error'
          ? '互动暂不可用，点击按钮重试。'
          : missing
            ? '这张图片尚未接入互动服务。'
            : [voteError, favoriteError].filter(Boolean).join(' ')}
      </output>
    </div>
  );
}
