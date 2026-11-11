import { useRef, useState } from 'react';
import type { Artwork } from '@ikun-q/catalog';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import { Button } from '@ikun-q/ui/components/button';
import { ArtworkReactions } from '@/components/artwork-reactions';
import { ArtworkDownload } from '@/components/artwork-download';
import { assetUrl, artworkUrl, previewSet, previewUrl } from '@/lib/catalog';

interface Props {
  artworks: Artwork[];
  onOpen: () => void;
  onBrowseSeries: (series: string) => void;
}

/** A series-led reading view using the same catalog and immutable images as the full index. */
export function ConceptBook({ artworks, onOpen, onBrowseSeries }: Props) {
  const worlds = [...new Set(artworks.map((artwork) => artwork.theme))];
  const [world, setWorld] = useState(worlds[0] ?? '');
  const [selectedId, setSelectedId] = useState<string>();
  const reader = useRef<HTMLDivElement>(null);
  const chapterTitle = useRef<HTMLHeadingElement>(null);
  const cast = artworks.filter((artwork) => artwork.theme === world);
  const selected = cast.find((artwork) => artwork.id === selectedId) ?? cast[0];
  const page = worlds.indexOf(world);
  function turn(index: number, reveal = false) {
    const next = worlds[index];
    if (next) {
      setWorld(next);
      setSelectedId(undefined);
      if (reveal)
        requestAnimationFrame(() => {
          reader.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
          chapterTitle.current?.focus({ preventScroll: true });
        });
    }
  }
  if (!selected) return null;
  return (
    <div className="concept-book">
      <nav className="book-index" aria-label="设定集作品目录">
        <h2>作品目录</h2>
        <ol>
          {worlds.map((name, index) => (
            <li key={name}>
              <button
                type="button"
                aria-current={name === world ? 'page' : undefined}
                onClick={() => turn(index)}
              >
                <span className="world-page">{String(index + 1).padStart(2, '0')}</span>
                <span>{name}</span>
                <span className="world-cast-count">
                  {artworks.filter((artwork) => artwork.theme === name).length}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className="book-reader" ref={reader}>
        <section className="book-sheet" aria-labelledby="book-world-title">
          <div className="sheet-header">
            <h2 id="book-world-title" ref={chapterTitle} tabIndex={-1}>
              {world}
            </h2>
            <button type="button" onClick={() => onBrowseSeries(world)}>
              {cast.length} 位人物
              <ArrowRightIcon aria-hidden="true" />
            </button>
          </div>
          <div className="sheet-content" key={selected.id}>
            <div className="sheet-illustration">
              <a
                className="sheet-fullbody"
                href={artworkUrl(selected)}
                onClick={onOpen}
                aria-label={`查看${selected.character}完整立绘`}
              >
                <img
                  src={previewUrl(selected)}
                  srcSet={previewSet(selected)}
                  sizes="(max-width:760px) 80vw, 420px"
                  width={selected.width}
                  height={selected.height}
                  alt={`${selected.character}完整立绘，${selected.pose}`}
                  fetchPriority="high"
                />
              </a>
              <span className="illustration-caption">
                角色形象 · v{String(selected.version).padStart(2, '0')}
              </span>
              <div className="sheet-save-action">
                <ArtworkDownload key={selected.id} artwork={selected} />
              </div>
            </div>
            <div className="sheet-notes">
              <div className="sheet-character">
                <h3>{selected.character}</h3>
                <p>{selected.edition}</p>
              </div>
              <p className="sheet-description">{selected.description}</p>
              <div className="study-details">
                <StudyDetail
                  artwork={selected}
                  label="中分轮廓 · 小鸟身份"
                  focus={{ x: 50, y: 23, scale: 2.8 }}
                  onOpen={onOpen}
                />
                {selected.detail ? (
                  <StudyDetail
                    artwork={selected}
                    label={selected.detail.label}
                    focus={selected.detail}
                    onOpen={onOpen}
                  />
                ) : null}
              </div>
              <ul className="study-traits" aria-label="造型识别点">
                {selected.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
              <ArtworkReactions artworkId={selected.id} />
              <a className="sheet-detail-link" href={artworkUrl(selected)} onClick={onOpen}>
                查看角色详情
                <ArrowRightIcon aria-hidden="true" />
              </a>
            </div>
          </div>
          {cast.length > 1 ? (
            <div key={world} className="cast-selector" aria-label={`${world}人物选择`}>
              <span>本页人物</span>
              {cast.map((artwork) => (
                <button
                  type="button"
                  key={artwork.id}
                  aria-label={`${artwork.character} · ${artwork.title}`}
                  title={artwork.edition || artwork.title}
                  aria-pressed={artwork.id === selected.id}
                  onClick={() => setSelectedId(artwork.id)}
                >
                  <img src={previewUrl(artwork)} width={42} height={56} alt="" loading="lazy" />
                  <span>
                    {artwork.character}
                    {cast.some(
                      (other) => other.id !== artwork.id && other.character === artwork.character,
                    )
                      ? ` · ${artwork.title}`
                      : ''}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
        <div className="book-pagination">
          <span className="page-count">
            {String(page + 1).padStart(2, '0')}
            <span>/</span>
            {String(worlds.length).padStart(2, '0')}
          </span>
          <div>
            <Button
              variant="ghost"
              aria-label="上一作品"
              disabled={page === 0}
              onClick={() => turn(page - 1, true)}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              上一作品
            </Button>
            <Button
              variant="ghost"
              aria-label="下一作品"
              disabled={page === worlds.length - 1}
              onClick={() => turn(page + 1, true)}
            >
              下一作品
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
        <output className="sr-only" aria-live="polite">
          {world}，{selected.character}，第{page + 1}页，共{worlds.length}页
        </output>
      </div>
    </div>
  );
}

/** CSS-only inspection window. It never crops, rewrites or exports a new source image. */
function StudyDetail({
  artwork,
  label,
  focus,
  onOpen,
}: {
  artwork: Artwork;
  label: string;
  focus: { x: number; y: number; scale: number };
  onOpen: () => void;
}) {
  const heightRatio = (focus.scale * 1.5) / (artwork.width / artwork.height);
  const percentage = (point: number, ratio: number) =>
    Math.max(0, Math.min(100, (((point / 100) * ratio - 0.5) / (ratio - 1)) * 100));
  return (
    <figure>
      <a
        href={artworkUrl(artwork)}
        onClick={onOpen}
        aria-label={`查看${artwork.character}的${label}细节`}
      >
        <div
          className="study-crop"
          aria-hidden="true"
          style={{
            backgroundImage: `url("${assetUrl(artwork.previewLarge ?? artwork.image)}")`,
            backgroundSize: `${focus.scale * 100}% auto`,
            backgroundPosition: `${percentage(focus.x, focus.scale)}% ${percentage(focus.y, heightRatio)}%`,
          }}
        />
        <figcaption>{label}</figcaption>
      </a>
    </figure>
  );
}
