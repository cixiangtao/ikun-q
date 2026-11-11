import { useEffect, useRef, useState } from 'react';
import type { Artwork } from '@ikun-q/catalog';
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  ArrowRightIcon,
  CheckIcon,
  ExpandIcon,
  LinkIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { Button } from '@ikun-q/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@ikun-q/ui/components/dialog';
import { ArtworkCard } from '@/components/artwork-gallery';
import { ArtworkReactions } from '@/components/artwork-reactions';
import { ArtworkDownload } from '@/components/artwork-download';
import { artworkUrl, fullImageUrl, previewSet, previewUrl } from '@/lib/catalog';

interface Props {
  artworks: Artwork[];
  artwork?: Artwork;
  onSeries: (series: string) => void;
  ipArtwork?: Artwork;
  navigation?: {
    backHref: string;
    artworkHref: (artwork: Artwork) => string;
    shareHref: string;
  };
}

/** One image per detail page, with independent saving, sharing and reactions. */
export function CharacterDetail({
  artworks,
  artwork: selected,
  onSeries,
  ipArtwork,
  navigation,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ipHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  if (!selected)
    return (
      <section className="not-found">
        <h1>这位角色还没登场</h1>
        <p>链接可能有误，也可能暂时未收录。</p>
        <Button asChild>
          <a href={navigation?.backHref ?? '#/'}>返回角色图鉴</a>
        </Button>
      </section>
    );
  const related = artworks.filter(
    (artwork) => artwork.id !== selected.id && artwork.theme === selected.theme,
  );
  const more = related.length
    ? related
    : artworks.filter((artwork) => artwork.id !== selected.id).slice(0, 4);
  async function copyLink() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(
        new URL(navigation?.shareHref ?? artworkUrl(selected), window.location.href).href,
      );
      setCopied(true);
      setCopyError(false);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <>
      <nav className="detail-breadcrumb" aria-label="当前位置">
        <a href={navigation?.backHref ?? '#/'}>
          <ArrowLeftIcon /> 返回图鉴
        </a>
        <span>/</span>
        <button type="button" onClick={() => onSeries(selected.theme)}>
          {selected.theme}
        </button>
        <span>/</span>
        <span>{selected.character}</span>
      </nav>
      <section className="character-detail" aria-labelledby="character-name">
        <div className="detail-visual">
          <ImageViewer key={selected.id} artwork={selected} />
        </div>
        <div className="detail-copy">
          <button className="series-link" type="button" onClick={() => onSeries(selected.theme)}>
            {selected.theme}
            <ArrowUpRightIcon />
          </button>
          <h1 id="character-name">{selected.character}</h1>
          <p className="detail-edition">{selected.edition || selected.title}</p>
          <section className="detail-summary" aria-labelledby="summary-title">
            <h2 id="summary-title">造型介绍</h2>
            <p>{selected.description}</p>
            {selected.tags.length ? (
              <ul className="study-traits" aria-label="造型识别点">
                {selected.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            ) : null}
          </section>
          <div className="detail-actions">
            <ArtworkDownload key={selected.id} artwork={selected} />
            <Button variant="outline" size="lg" onClick={copyLink}>
              {copied ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <LinkIcon data-icon="inline-start" />
              )}
              {copied ? '已复制链接' : '分享链接'}
            </Button>
            {ipArtwork ? (
              <Button
                variant="ghost"
                onClick={() => {
                  ipHeading.current?.scrollIntoView({
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                      ? 'instant'
                      : 'smooth',
                  });
                  ipHeading.current?.focus({ preventScroll: true });
                }}
              >
                查看 IP 形象
              </Button>
            ) : null}
          </div>
          {copyError ? (
            <output className="action-note" aria-live="polite">
              暂时无法复制，请从浏览器地址栏复制链接。
            </output>
          ) : null}
          <ArtworkReactions artworkId={selected.id} />
          <dl className="artwork-facts" aria-label="当前图片信息">
            <div>
              <dt>图片格式</dt>
              <dd>PNG 原图</dd>
            </div>
            <div>
              <dt>图片尺寸</dt>
              <dd>
                {selected.width} × {selected.height} px
              </dd>
            </div>
            <div>
              <dt>收录日期</dt>
              <dd>{selected.createdDate || '—'}</dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd>
                v{String(selected.version).padStart(2, '0')}
                {selected.stage === 'study' ? ' · 探索稿' : ''}
              </dd>
            </div>
          </dl>
        </div>
      </section>
      {ipArtwork ? (
        <section className="character-ip-section" aria-labelledby="ip-title">
          <div className="character-ip-heading">
            <h2 id="ip-title" ref={ipHeading} tabIndex={-1}>
              IP 形象
            </h2>
            <p>同一位人物，更丰富的发束、明暗与材质细节。</p>
          </div>
          <div className="character-ip-layout">
            <ImageViewer artwork={ipArtwork} />
            <div className="character-ip-copy">
              <h3>{ipArtwork.character}</h3>
              <p>{ipArtwork.description}</p>
              <ArtworkDownload artwork={ipArtwork} />
              <ArtworkReactions artworkId={ipArtwork.id} />
              <p className="character-ip-spec">
                {ipArtwork.width} × {ipArtwork.height} · PNG 原图
              </p>
            </div>
          </div>
        </section>
      ) : null}
      <section className="related-section" aria-labelledby="related-title">
        <div className="related-heading">
          <h2 id="related-title">{related.length ? '同作品人物' : '其他人物'}</h2>
          <a href={navigation?.backHref ?? '#/'}>
            全部角色
            <ArrowRightIcon />
          </a>
        </div>
        <div className="artwork-grid">
          {more.slice(0, 4).map((artwork) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              href={navigation?.artworkHref(artwork)}
              actions={navigation ? null : undefined}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function ImageViewer({ artwork }: { artwork: Artwork }) {
  const [zoom, setZoom] = useState(1);
  return (
    <Dialog onOpenChange={() => setZoom(1)}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="detail-image-trigger"
          aria-label={`放大查看${artwork.character}原图`}
        >
          <img
            src={previewUrl(artwork)}
            srcSet={previewSet(artwork)}
            sizes="(max-width: 700px) 90vw, 600px"
            width={artwork.width}
            height={artwork.height}
            alt={`${artwork.character}，${artwork.pose}`}
            fetchPriority="high"
          />
          <span className="expand-hint">
            <ExpandIcon />
            查看大图
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="original-viewer">
        <DialogHeader>
          <DialogTitle>
            {artwork.character} · {artwork.title}
          </DialogTitle>
          <DialogDescription>
            {artwork.width} × {artwork.height} · PNG 原图，可缩放查看细节
          </DialogDescription>
        </DialogHeader>
        <div className="zoom-toolbar">
          <Button
            variant="outline"
            size="icon"
            aria-label="缩小图片"
            disabled={zoom <= 1}
            onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
          >
            <MinusIcon />
          </Button>
          <output aria-live="polite">{Math.round(zoom * 100)}%</output>
          <Button
            variant="outline"
            size="icon"
            aria-label="放大图片"
            disabled={zoom >= 3}
            onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
          >
            <PlusIcon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="重置图片缩放" onClick={() => setZoom(1)}>
            <RotateCcwIcon />
          </Button>
          <ArtworkDownload key={artwork.id} artwork={artwork} />
        </div>
        <div className="original-scroll">
          <div
            className="zoom-canvas"
            style={{ width: `calc(min(100%, calc((90dvh - 190px) * 0.75)) * ${zoom})` }}
          >
            <img
              src={fullImageUrl(artwork)}
              width={artwork.width}
              height={artwork.height}
              alt={`${artwork.character}完整原图`}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
