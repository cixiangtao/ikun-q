import { matchesArtwork, type Artwork } from '@ikun-q/catalog';

/** Prefixes generated relative paths so preview and subdirectory hosting share the same assets. */
export const assetUrl = (path: string) => import.meta.env.BASE_URL + path;
export const characterSlug = (artwork: Artwork) => artwork.characterSlug ?? artwork.id;
/** Each listed image has its own address, even when several images share a character name. */
export const artworkUrl = (artwork: Artwork) => `#/artworks/${encodeURIComponent(artwork.id)}`;
/** A pilot character page has one stable address regardless of its current Q or optional IP image. */
export const characterStudyUrl = (slug: string) =>
  `#/character-studies/${encodeURIComponent(slug)}`;

/** Retired Q trial links lead to the B gallery or character, preserving any exact-image constraint. */
export function canonicalGalleryHash(hash: string) {
  const [path, query] = hash.split('?', 2);
  const suffix = query === undefined ? '' : `?${query}`;
  if (path === '#/character-studies') return `#/${suffix}`;
  if (path?.startsWith('#/character-studies/'))
    return `#/characters/${path.slice('#/character-studies/'.length)}${suffix}`;
  return hash;
}
export const previewUrl = (artwork: Artwork) => assetUrl(artwork.preview ?? artwork.image);
/** Full-size source PNG for native long-press saving, downloads and file sharing. */
export const fullImageUrl = (artwork: Artwork) => assetUrl(artwork.image);
export const previewSet = (artwork: Artwork) =>
  artwork.preview && artwork.previewLarge
    ? `${assetUrl(artwork.preview)} 480w, ${assetUrl(artwork.previewLarge)} 960w`
    : undefined;

/** Old shared character links still resolve, but an invalid explicit image never opens another image. */
export function resolveArtwork(artworks: Artwork[], artworkId?: string, legacySlug?: string) {
  if (artworkId !== undefined)
    return artworks.find(
      (artwork) =>
        artwork.id === artworkId && (!legacySlug || characterSlug(artwork) === legacySlug),
    );
  return legacySlug ? artworks.find((artwork) => characterSlug(artwork) === legacySlug) : undefined;
}

export interface GalleryFilters {
  query: string;
  series: string;
  tag: string;
  sort: string;
}

/** Filtering and ordering retain every matching image; display names are never grouping keys. */
export function selectGalleryArtworks(artworks: Artwork[], filters: GalleryFilters) {
  return artworks
    .filter(
      (artwork) =>
        matchesArtwork(artwork, filters.query) &&
        (!filters.series || artwork.theme === filters.series) &&
        (!filters.tag || artwork.tags.includes(filters.tag)),
    )
    .toSorted((a, b) =>
      filters.sort === 'newest'
        ? b.createdDate.localeCompare(a.createdDate) || a.order - b.order
        : filters.sort === 'name'
          ? a.character.localeCompare(b.character, 'zh-CN')
          : a.order - b.order,
    );
}
