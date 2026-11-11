import { ArrowLeftIcon, SearchIcon } from 'lucide-react';
import type { CharacterStudy } from '@ikun-q/catalog';
import { Input } from '@ikun-q/ui/components/input';
import { Field, FieldLabel } from '@ikun-q/ui/components/field';
import { Button } from '@ikun-q/ui/components/button';
import { ArtworkCard } from '@/components/artwork-gallery';
import { characterStudyUrl, selectGalleryArtworks, type GalleryFilters } from '@/lib/catalog';

interface Props {
  studies: CharacterStudy[];
  filters: GalleryFilters;
  onFilters: (filters: GalleryFilters) => void;
  onOpen: () => void;
}

/** The pilot gallery counts characters and shows only their Q main image; IP art stays in details. */
export function CharacterStudies({ studies, filters, onFilters, onOpen }: Props) {
  const primary = studies.map((study) => study.primary);
  const filtered = selectGalleryArtworks(primary, filters);
  const series = [...new Set(primary.map((artwork) => artwork.theme))];
  return (
    <section className="character-studies" aria-labelledby="character-studies-title">
      <a href="#/" className="back-link">
        <ArrowLeftIcon /> 返回全部图鉴
      </a>
      <div className="character-studies-heading">
        <div>
          <h1 id="character-studies-title">人物展示样例</h1>
          <p>从 Q 版认识人物，在详情里欣赏 IP 形象。</p>
        </div>
        <span>{studies.length} 位人物</span>
      </div>
      <div className="character-studies-toolbar">
        <nav className="series-filter" aria-label="按作品浏览人物样例">
          {['', ...series].map((name) => (
            <a
              key={name}
              href="#/character-studies"
              aria-current={filters.series === name ? 'true' : undefined}
              onClick={(event) => {
                event.preventDefault();
                onFilters({ ...filters, series: name });
              }}
            >
              {name || '全部人物'}
            </a>
          ))}
        </nav>
        <Field className="character-studies-search">
          <FieldLabel className="sr-only" htmlFor="study-search">
            搜索人物样例
          </FieldLabel>
          <div className="search-wrap">
            <SearchIcon aria-hidden="true" />
            <Input
              id="study-search"
              type="search"
              value={filters.query}
              placeholder="搜索人物或作品…"
              onChange={(event) => onFilters({ ...filters, query: event.target.value })}
            />
          </div>
        </Field>
      </div>
      <output className="sr-only" aria-live="polite">
        找到 {filtered.length} 位人物
      </output>
      {filtered.length ? (
        <div className="character-studies-grid">
          {filtered.map((artwork) => (
            <ArtworkCard
              key={artwork.characterSlug}
              artwork={artwork}
              href={characterStudyUrl(artwork.characterSlug ?? artwork.id)}
              onOpen={onOpen}
              actions={null}
              eager
            />
          ))}
        </div>
      ) : (
        <div className="gallery-empty">
          <h2>暂时没有找到这位人物</h2>
          <p>试试人物别名，或回到全部人物。</p>
          <Button
            variant="outline"
            onClick={() => onFilters({ query: '', series: '', tag: '', sort: 'curated' })}
          >
            查看全部人物
          </Button>
        </div>
      )}
    </section>
  );
}
