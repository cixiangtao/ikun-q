import { useRef } from 'react';
import type { Artwork } from '@ikun-q/catalog';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { useLikes } from '@/components/likes-provider';
import { ArtworkCard } from '@/components/artwork-gallery';
import { Button } from '@ikun-q/ui/components/button';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@ikun-q/ui/components/empty';
import { artworkUrl } from '@/lib/catalog';

/** Private profile: the public catalog provides presentation, while only the account owns its saved IDs. */
export function ProfilePage({ artworks }: { artworks: Artwork[] }) {
  const { auth, favorites, status, refresh, requestLogin } = useLikes();
  const heading = useRef<HTMLHeadingElement>(null);
  const byId = new Map(artworks.map((artwork) => [artwork.id, artwork]));
  const saved = favorites.flatMap((id) => {
    const artwork = byId.get(id);
    return artwork ? [artwork] : [];
  });
  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <a className="back-link" href="#/">
        <ArrowLeftIcon aria-hidden="true" />
        返回图鉴
      </a>
      <header className="profile-heading">
        <h1 id="profile-title">我的主页</h1>
        <p>
          {auth.user
            ? `${auth.user.name}，喜欢的图片，留在这里慢慢看。收藏列表仅自己可见。`
            : '收藏喜欢的图片，下次回来继续看。'}
        </p>
      </header>
      {status === 'loading' ? (
        <output className="profile-loading">正在读取收藏…</output>
      ) : status === 'error' ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>暂时无法读取收藏</EmptyTitle>
            <EmptyDescription>请稍后重试，你也可以继续浏览图鉴。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => void refresh()}>重新加载</Button>
            <Button asChild variant="ghost">
              <a href="#/">浏览图鉴</a>
            </Button>
          </EmptyContent>
        </Empty>
      ) : !auth.user ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>登录后查看你的收藏</EmptyTitle>
            <EmptyDescription>收藏按账号保存，换设备也能找到。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => requestLogin('查看你的收藏')}>使用 GitHub 登录</Button>
            <Button asChild variant="ghost">
              <a href="#/">先逛逛图鉴</a>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <section aria-labelledby="saved-heading">
          <div className="saved-heading">
            <h2 id="saved-heading" ref={heading} tabIndex={-1}>
              我的收藏 <span>{saved.length} 张</span>
            </h2>
            <a className="text-link" href="#/">
              去逛图鉴
              <ArrowRightIcon aria-hidden="true" />
            </a>
          </div>
          {saved.length ? (
            <div className="saved-grid">
              {saved.map((artwork, index) => (
                <div key={artwork.id} className="saved-item">
                  <ArtworkCard
                    artwork={artwork}
                    href={artworkUrl(artwork)}
                    eager={index < 4}
                    onFavoriteRemoved={() => heading.current?.focus()}
                  />
                  <p className="saved-actions">
                    v{String(artwork.version).padStart(2, '0')} · {artwork.title}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>还没有收藏的图片</EmptyTitle>
                <EmptyDescription>在图片旁点击“收藏”，就能在这里找到它。</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <a href="#/">去收藏喜欢的角色</a>
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </section>
      )}
    </section>
  );
}
