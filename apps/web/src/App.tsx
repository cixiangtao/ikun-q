import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { publicCatalogSchema } from '@ikun-q/catalog';
import { ArtworkGallery, type GalleryFilters } from '@/components/artwork-gallery';
import { CharacterDetail } from '@/components/character-detail';
import { Button } from '@ikun-q/ui/components/button';
import { AccountMenu } from '@/components/account-menu';
import { ProfilePage } from '@/components/profile-page';
import { ContributionGuide } from '@/components/contribution-guide';
import { canonicalGalleryHash, resolveArtwork } from '@/lib/catalog';
import rawCatalog from '@/generated/catalog.json';
import originalImage from '../../../references/community-placeholder.webp';

const catalog = publicCatalogSchema.parse(rawCatalog);
const subscribe = (callback: () => void) => {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
};
const snapshot = () => window.location.hash || '#/';

/** Independent image routes with legacy character links; gallery state survives a detail round trip. */
export default function App() {
  const hash = useSyncExternalStore(subscribe, snapshot);
  const routeHash = canonicalGalleryHash(hash);
  const path = routeHash.split('?')[0];
  const slug = path?.startsWith('#/characters/') ? path.slice('#/characters/'.length) : undefined;
  const isAbout = path === '#/about';
  const isProfile = path === '#/me';
  const isContribute = path === '#/contribute';
  const imageId = path?.startsWith('#/artworks/') ? path.slice('#/artworks/'.length) : undefined;
  const artworkId =
    imageId ?? new URLSearchParams(routeHash.split('?')[1] ?? '').get('artwork') ?? undefined;
  const isDetail = slug !== undefined || imageId !== undefined;
  const isGallery =
    !isDetail &&
    !isAbout &&
    !isProfile &&
    !isContribute &&
    (path === '#/' || path === '#' || path === '#collection');
  const [filters, setFilters] = useState<GalleryFilters>({
    query: '',
    series: '',
    tag: '',
    sort: 'curated',
  });
  const galleryScroll = useRef(0);
  const previousRoute = useRef(hash);
  const main = useRef<HTMLElement>(null);
  const current = resolveArtwork(catalog.artworks, artworkId, slug);
  useEffect(() => {
    if (!isGallery) return;
    const rememberScroll = () => {
      const currentPath = canonicalGalleryHash(snapshot()).split('?')[0];
      // Ignore scroll clamping after a hash change has hidden the taller gallery.
      if (currentPath === '#/' || currentPath === '#' || currentPath === '#collection')
        galleryScroll.current = window.scrollY;
    };
    window.addEventListener('scroll', rememberScroll, { passive: true });
    return () => window.removeEventListener('scroll', rememberScroll);
  }, [isGallery]);
  useEffect(() => {
    document.title = `${current?.character ?? (isAbout ? '关于' : isProfile ? '我的主页' : isContribute ? '共创指南' : 'Q 版角色图鉴')} · IKUN-Q`;
    if (previousRoute.current === hash) return;
    const oldRoute = previousRoute.current;
    previousRoute.current = hash;
    if (canonicalGalleryHash(oldRoute).split('?')[0] === path) return;
    const frame = requestAnimationFrame(() => {
      if (hash === '#collection') document.getElementById('collection')?.scrollIntoView();
      else window.scrollTo({ top: isGallery ? galleryScroll.current : 0, behavior: 'instant' });
      main.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, path, isGallery, current?.character, isAbout, isProfile, isContribute]);
  function goFiltered(value: Partial<GalleryFilters>) {
    setFilters((state) => ({ ...state, query: '', series: '', tag: '', ...value }));
    galleryScroll.current = 0;
    window.location.hash = '#/';
  }
  return (
    <div className="site-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        跳到主要内容
      </a>
      <header className="site-header">
        <a href="#/" className="wordmark" aria-label="IKUN-Q 首页">
          IKUN-Q
        </a>
        <nav className="main-nav" aria-label="主导航">
          <a href="#/" aria-current={isGallery || isDetail ? 'page' : undefined}>
            角色图鉴
          </a>
          <a href="#/contribute" aria-current={isContribute ? 'page' : undefined}>
            共创指南
          </a>
          <a href="#/about" aria-current={isAbout ? 'page' : undefined}>
            关于
          </a>
          <AccountMenu active={isProfile} />
        </nav>
      </header>
      <main id="main" ref={main} tabIndex={-1}>
        <div hidden={!isGallery}>
          <ArtworkGallery
            artworks={catalog.artworks}
            filters={filters}
            onFilters={setFilters}
            onOpen={() => {
              galleryScroll.current = window.scrollY;
            }}
          />
        </div>
        {isDetail ? (
          <CharacterDetail
            key={current?.id ?? hash}
            artwork={current}
            artworks={catalog.artworks}
            onSeries={(series) => goFiltered({ series })}
          />
        ) : null}
        {isProfile ? <ProfilePage artworks={catalog.artworks} /> : null}
        {isContribute ? <ContributionGuide /> : null}
        {isAbout ? (
          <section className="about-page">
            <a className="back-link" href="#/">
              <ArrowLeftIcon />
              返回图鉴
            </a>
            <div className="about-layout">
              <div>
                <h1>关于 IKUN-Q</h1>
                <p>用同一只 IKUN 小鸟，演绎不同人物的 Q 版形象。</p>
                <p>IKUN 是固定的小鸟身份，Q 是 Q 版人物的创作主题。</p>
                <p>
                  保留中分、大白眼与成对红脸颊；脸部底色和头发主色可随人物变化，结合服装、配色和标志装备表现联动人物。
                </p>
                <p>本预览使用程序生成的几何示例验证图鉴功能；完整原始参考见共创指南与创作包。</p>
                <p>
                  目前收录 {catalog.artworks.length}{' '}
                  张程序生成的示例图。你可以按作品浏览，搜索人物或装备标签，再打开大图看一看细节。
                </p>
                <p>
                  我们也希望让更多人一起创作。共创正在准备中，可以先了解参与方向，下载清单整理你的想法。
                </p>
                <a className="about-contribution-link" href="#/contribute">
                  阅读共创指南
                  <ArrowRightIcon aria-hidden="true" />
                </a>
                <Button asChild size="lg">
                  <a href="#/">
                    浏览角色
                    <ArrowRightIcon data-icon="inline-end" />
                  </a>
                </Button>
              </div>
              <figure className="about-origin">
                <img
                  src={originalImage}
                  width={1000}
                  height={986}
                  alt="程序生成的几何占位图，不是 IKUN 原型或联动作品"
                />
                <figcaption>
                  几何示例<span>用于验证运行流程，原始参考见共创指南</span>
                </figcaption>
              </figure>
            </div>
          </section>
        ) : null}
        {!isGallery && !isDetail && !isAbout && !isProfile && !isContribute ? (
          <section className="not-found">
            <h1>这条路还没有角色经过</h1>
            <Button asChild>
              <a href="#/">返回图鉴</a>
            </Button>
          </section>
        ) : null}
      </main>
      <footer className="site-footer">
        <div>
          <a className="footer-wordmark" href="#/">
            IKUN-Q
          </a>
          <span>Q 版角色图鉴</span>
        </div>
        <a href="#/about">
          关于图鉴
          <ArrowRightIcon />
        </a>
      </footer>
    </div>
  );
}
