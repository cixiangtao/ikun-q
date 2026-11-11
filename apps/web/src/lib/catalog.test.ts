import { describe, expect, it } from 'vitest';
import { artworkSchema } from '@ikun-q/catalog';
import { artworkUrl, canonicalGalleryHash, resolveArtwork, selectGalleryArtworks } from './catalog';

const original = artworkSchema.parse({
  id: 'naruto-original',
  characterSlug: 'naruto',
  title: '插兜待机',
  character: '漩涡鸣人',
  theme: '火影忍者',
  pose: '站立',
  image: 'catalog/naruto-original.png',
  width: 1086,
  height: 1448,
  tags: ['待机'],
  createdDate: '2026-11-03',
});
const study = {
  ...original,
  id: 'naruto-study',
  title: '正视对照',
  image: 'catalog/naruto-study.png',
  tags: ['正视'],
  createdDate: '2026-11-06',
  order: 2,
};
const other = {
  ...original,
  id: 'luffy',
  characterSlug: 'luffy',
  character: '路飞',
  theme: '海贼王',
  order: 1,
};
const artworks = [original, study, other];
const filters = { query: '', series: '', tag: '', sort: 'curated' };

describe('retired Q trial bookmarks', () => {
  it('opens the B gallery or the same character without redirecting unrelated routes', () => {
    expect(canonicalGalleryHash('#/character-studies')).toBe('#/');
    expect(canonicalGalleryHash('#/character-studies/naruto')).toBe('#/characters/naruto');
    expect(canonicalGalleryHash('#/characters/naruto')).toBe('#/characters/naruto');
    expect(canonicalGalleryHash('#/artworks/naruto-study')).toBe('#/artworks/naruto-study');
  });

  it('preserves an explicit retired image instead of silently substituting the B image', () => {
    const route = canonicalGalleryHash('#/character-studies/naruto?artwork=retired-q');
    expect(route).toBe('#/characters/naruto?artwork=retired-q');
    const id = new URLSearchParams(route.split('?')[1]).get('artwork');
    expect(resolveArtwork([original, other], id ?? undefined, 'naruto')).toBeUndefined();
    expect(resolveArtwork([original, other], undefined, 'naruto')).toBe(original);
    expect(resolveArtwork([original, other], undefined, 'missing')).toBeUndefined();
  });
});

describe('independent artwork browsing', () => {
  it('keeps same-name entries in the full grid and in name search', () => {
    expect(selectGalleryArtworks(artworks, filters).map((artwork) => artwork.id)).toEqual([
      'naruto-original',
      'luffy',
      'naruto-study',
    ]);
    expect(selectGalleryArtworks(artworks, { ...filters, query: '鸣人' })).toEqual([
      original,
      study,
    ]);
  });

  it('filters the actual image tags and series without substituting another same-name image', () => {
    expect(
      selectGalleryArtworks(artworks, { ...filters, tag: '正视', series: '火影忍者' }),
    ).toEqual([study]);
    expect(selectGalleryArtworks(artworks, { ...filters, tag: '正视', series: '海贼王' })).toEqual(
      [],
    );
  });

  it('retains both same-name entries when sorting by date or name', () => {
    expect(selectGalleryArtworks(artworks, { ...filters, sort: 'newest' })[0]).toBe(study);
    expect(selectGalleryArtworks(artworks, { ...filters, sort: 'name' })).toHaveLength(3);
  });

  it('gives every image a distinct address and resolves the exact shared image', () => {
    expect(new Set(artworks.map(artworkUrl)).size).toBe(3);
    expect(artworkUrl(study)).toBe('#/artworks/naruto-study');
    expect(resolveArtwork(artworks, study.id)).toBe(study);
    expect(resolveArtwork(artworks, original.id)).toBe(original);
  });

  it('preserves legacy character links and links that specify an exact image', () => {
    expect(resolveArtwork(artworks, undefined, 'naruto')).toBe(original);
    expect(resolveArtwork(artworks, study.id, 'naruto')).toBe(study);
  });

  it('does not silently open another image for a missing or mismatched image link', () => {
    expect(resolveArtwork(artworks, 'missing', 'naruto')).toBeUndefined();
    expect(resolveArtwork(artworks, study.id, 'luffy')).toBeUndefined();
    expect(resolveArtwork(artworks, undefined, 'missing')).toBeUndefined();
  });
});
