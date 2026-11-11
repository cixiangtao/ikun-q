import { BookmarkIcon, BookmarkCheckIcon, ThumbsDownIcon, ThumbsUpIcon } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { Button } from '@ikun-q/ui/components/button';
import { cn } from '@ikun-q/ui/lib/utils';

export type ReactionKind = 'like' | 'dislike' | 'favorite';

export interface ReactionAction {
  count?: number;
  selected: boolean;
  /** Accessible action text, including the subject when several groups share a page. */
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}

export interface ReactionButtonsProps {
  actions: Record<ReactionKind, ReactionAction>;
  /** Minimal icon/count controls or bordered controls with visible labels. */
  variant?: 'minimal' | 'outline';
  className?: string;
}

// Selection colors update immediately, including when a caller queues several rapid toggles.
const reactionVariants = cva('rounded-sm text-xs transition-[transform,box-shadow]', {
  variants: {
    variant: {
      minimal:
        'h-auto min-h-0 min-w-0 justify-start gap-1.5 border-0 p-0 text-muted-foreground has-data-[icon=inline-start]:pl-0 aria-pressed:font-semibold aria-pressed:text-foreground [&_svg]:size-3.5 [&[aria-pressed=true]_svg]:fill-primary [&[aria-pressed=true]_svg]:stroke-foreground',
      outline: 'min-h-11 min-w-11 gap-2 px-3',
    },
  },
});

const reactions = [
  { kind: 'like', text: '点赞', Icon: ThumbsUpIcon, SelectedIcon: ThumbsUpIcon },
  { kind: 'dislike', text: '点踩', Icon: ThumbsDownIcon, SelectedIcon: ThumbsDownIcon },
  { kind: 'favorite', text: '收藏', Icon: BookmarkIcon, SelectedIcon: BookmarkCheckIcon },
] as const;

/** Controlled reaction controls; authentication, persistence and vote exclusivity belong to the caller. */
export function ReactionButtons({ actions, variant = 'minimal', className }: ReactionButtonsProps) {
  return (
    <div
      data-slot="reaction-buttons"
      data-variant={variant}
      className={cn(
        'flex flex-wrap items-center',
        variant === 'minimal' ? 'gap-x-4 gap-y-2' : 'gap-1',
        className,
      )}
    >
      {reactions.map(({ kind, text, Icon, SelectedIcon }) => {
        const action = actions[kind];
        const ActionIcon = action.selected ? SelectedIcon : Icon;
        return (
          <Button
            key={kind}
            type="button"
            data-reaction={kind}
            variant={variant === 'minimal' ? 'ghost' : action.selected ? 'default' : 'outline'}
            className={reactionVariants({ variant })}
            aria-label={action.label}
            title={action.label}
            aria-pressed={action.selected}
            aria-busy={action.busy}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            <ActionIcon data-icon="inline-start" aria-hidden="true" />
            {variant === 'outline' ? text : null}
            <span className="min-w-[1ch] tabular-nums">{action.count ?? '—'}</span>
          </Button>
        );
      })}
    </div>
  );
}
