import { useState, type ReactNode } from 'react';
import { SearchIcon, SearchXIcon, XIcon } from 'lucide-react';
import type { Artwork } from '@ikun-q/catalog';
import { Button } from '@ikun-q/ui/components/button';
import { Badge } from '@ikun-q/ui/components/badge';
import { Input } from '@ikun-q/ui/components/input';
import { Field, FieldGroup, FieldLabel } from '@ikun-q/ui/components/field';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from '@ikun-q/ui/components/empty';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ikun-q/ui/components/select';
import { ToggleGroup, ToggleGroupItem } from '@ikun-q/ui/components/toggle-group';
import { ConceptBook } from '@/components/concept-book';
import { ArtworkReactions } from '@/components/artwork-reactions';
import {
  artworkUrl,
  selectGalleryArtworks,
  previewSet,
  previewUrl,
  type GalleryFilters,
} from '@/lib/catalog';
export type { GalleryFilters } from '@/lib/catalog';

interface Props {
  artworks: Artwork[];
  filters: GalleryFilters;
  onFilters: (filters: GalleryFilters) => void;
  onOpen: () => void;
}

/** Public character index. Filters stay mounted while a visitor reads a character detail. */
export function ArtworkGallery({ artworks, filters, onFilters, onOpen }: Props) {
  const [mode, setMode] = useState('catalog');
  const series = [...new Set(artworks.map((artwork) => artwork.theme))];
  const patch = (value: Partial<GalleryFilters>) => {
    if ('query' in value || 'series' in value || 'tag' in value) setMode('catalog');
    onFilters({ ...filters, ...value });
  };
  const filtered = selectGalleryArtworks(artworks, filters);
  const active = Boolean(filters.query || filters.series || filters.tag);
  const showBook = mode === 'book' && !active && artworks.length > 0;
  return (
    <>
      <section
        className="collection-section"
        data-view={showBook ? 'book' : 'catalog'}
        id="collection"
        aria-labelledby="collection-title"
      >
        <div className="collection-heading">
          <div>
            <h1 id="collection-title">角色图鉴</h1>
            <p>
              {showBook
                ? '按作品翻阅角色，欣赏造型与局部细节。'
                : '搜索、筛选全部人物，打开详情查看造型与图片。'}
            </p>
          </div>
          <p className="collection-count">
            <span>{artworks.length} 位人物</span>
            <span className="count-divider" aria-hidden="true">
              /
            </span>
            <span>{series.length} 个作品</span>
          </p>
        </div>
        <div className="gallery-toolbar">
          <ToggleGroup
            type="single"
            variant="outline"
            value={showBook ? 'book' : 'catalog'}
            onValueChange={(value) => {
              if (!value) return;
              setMode(value);
              if (value === 'book')
                onFilters({ query: '', series: '', tag: '', sort: filters.sort });
            }}
            aria-label="图鉴浏览方式"
            className="view-switch"
          >
            <ToggleGroupItem value="catalog">全部人物</ToggleGroupItem>
            <ToggleGroupItem value="book">设定集</ToggleGroupItem>
          </ToggleGroup>
          <FieldGroup className="search-field">
            <Field>
              <FieldLabel className="sr-only" htmlFor="character-search">
                搜索人物、作品或标签
              </FieldLabel>
              <div className="search-wrap">
                <SearchIcon aria-hidden="true" />
                <Input
                  id="character-search"
                  type="search"
                  placeholder="搜索人物、作品或标签…"
                  value={filters.query}
                  onChange={(event) => patch({ query: event.target.value })}
                />
              </div>
            </Field>
          </FieldGroup>
          {!showBook ? (
            <Field className="sort-field">
              <FieldLabel className="sr-only" htmlFor="gallery-sort">
                排列方式
              </FieldLabel>
              <Select value={filters.sort} onValueChange={(sort) => patch({ sort })}>
                <SelectTrigger id="gallery-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectGroup>
                    <SelectItem value="curated">推荐顺序</SelectItem>
                    <SelectItem value="newest">最近收录</SelectItem>
                    <SelectItem value="name">人物名称</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>
        <div hidden={!showBook}>
          <ConceptBook
            artworks={artworks}
            onOpen={onOpen}
            onBrowseSeries={(series) => {
              setMode('catalog');
              patch({ series });
            }}
          />
        </div>
        <div hidden={showBook}>
          <nav className="series-filter" aria-label="按所属作品筛选">
            <a
              href="#collection"
              aria-current={!filters.series ? 'true' : undefined}
              onClick={(event) => {
                event.preventDefault();
                patch({ series: '' });
              }}
            >
              全部作品 <span>{artworks.length}</span>
            </a>
            {series.map((name) => (
              <a
                href="#collection"
                key={name}
                aria-current={filters.series === name ? 'true' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  patch({ series: filters.series === name ? '' : name });
                }}
              >
                {name}
                <span>{artworks.filter((artwork) => artwork.theme === name).length}</span>
              </a>
            ))}
          </nav>
          <div className="result-line">
            <output aria-live="polite">{active ? `找到 ${filtered.length} 位角色` : ''}</output>
            {filters.tag ? (
              <Badge variant="secondary">
                {filters.tag}
                <button
                  type="button"
                  onClick={() => patch({ tag: '' })}
                  aria-label={`移除${filters.tag}标签`}
                >
                  <XIcon />
                </button>
              </Badge>
            ) : null}
            {active ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode('catalog');
                  onFilters({ query: '', series: '', tag: '', sort: filters.sort });
                }}
              >
                清除筛选
              </Button>
            ) : null}
          </div>
          {filtered.length ? (
            <div className="artwork-grid">
              {filtered.map((artwork, index) => (
                <ArtworkCard key={artwork.id} artwork={artwork} onOpen={onOpen} eager={index < 4} />
              ))}
            </div>
          ) : (
            <Empty className="gallery-empty">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {artworks.length ? '暂时没有找到这位角色' : '新的角色，正在准备登场'}
                </EmptyTitle>
                <EmptyDescription>
                  {artworks.length
                    ? '试试人物别名、所属作品，或换一个装备标签。'
                    : '有新的角色加入时，会在这里与你见面。'}
                </EmptyDescription>
              </EmptyHeader>
              {active ? (
                <EmptyContent>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMode('catalog');
                      onFilters({ query: '', series: '', tag: '', sort: 'curated' });
                    }}
                  >
                    查看全部角色
                  </Button>
                </EmptyContent>
              ) : null}
            </Empty>
          )}
        </div>
      </section>
    </>
  );
}

/** Illustration links and image actions are siblings so voting never navigates to the detail. */
export function ArtworkCard({
  artwork,
  onOpen,
  eager = false,
  href,
  actions,
  onFavoriteRemoved,
}: {
  artwork: Artwork;
  onOpen?: () => void;
  eager?: boolean;
  href?: string;
  /** Character entries may omit image-level actions while retaining the existing card grammar. */
  actions?: ReactNode;
  onFavoriteRemoved?: () => void;
}) {
  return (
    <article className="artwork-item">
      <a href={href ?? artworkUrl(artwork)} className="artwork-card" onClick={onOpen}>
        <div className="artwork-stage">
          <img
            src={previewUrl(artwork)}
            srcSet={previewSet(artwork)}
            sizes="(max-width: 600px) 45vw, (max-width: 1000px) 30vw, 280px"
            width={artwork.width}
            height={artwork.height}
            alt={`${artwork.character}联动立绘，${artwork.pose}`}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
          />
        </div>
        <div className="artwork-caption">
          <div>
            <h3>{artwork.character}</h3>
            <p>{artwork.theme}</p>
          </div>
          <span className="card-edition">{artwork.edition || artwork.title}</span>
        </div>
      </a>
      {actions === undefined ? (
        <ArtworkReactions
          artworkId={artwork.id}
          label={`${artwork.character} · ${artwork.edition || artwork.title}`}
          onRemoved={onFavoriteRemoved}
        />
      ) : (
        actions
      )}
    </article>
  );
}
