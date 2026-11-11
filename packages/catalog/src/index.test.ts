import { describe, expect, it } from 'vitest';
import {
  matchesArtwork,
  selectCatalogCandidates,
  selectCharacterStudies,
  selectPublicationCandidates,
} from './index.ts';

const finalAsset = {
  id: 'art-001',
  title: '篮球招式',
  theme: '动漫联动',
  character: '待选人物',
  pose: '招式动作',
  path: 'assets/finals/art-001.png',
  status: 'final',
  user_final_approved: true,
  width: 1536,
  height: 2048,
};
const publish = (asset = finalAsset, phase = 'production') =>
  selectPublicationCandidates({ phase, spec: { width: 1536, height: 2048 }, assets: [asset] });

describe('public catalog publication boundary', () => {
  it('keeps references and drafts out of the public catalog', () => {
    expect(
      selectPublicationCandidates({
        phase: 'specification_refinement',
        spec: { width: 1536, height: 2048 },
        assets: [
          { ...finalAsset, id: 'ref', status: 'source_reference' },
          { ...finalAsset, id: 'draft', status: 'draft' },
        ],
      }),
    ).toEqual([]);
  });
  it('blocks publication before production is started', () => {
    expect(() => publish(finalAsset, 'specification_refinement')).toThrow('正式生产');
  });
  it('requires explicit final approval and exact dimensions', () => {
    expect(() => publish({ ...finalAsset, user_final_approved: false })).toThrow('确认定稿');
    expect(() => publish({ ...finalAsset, width: 1024 })).toThrow();
  });
  it('rejects traversal, external paths and duplicate IDs', () => {
    expect(() =>
      publish({ ...finalAsset, path: 'assets/finals/../../references/original.png' }),
    ).toThrow();
    expect(() => publish({ ...finalAsset, path: '/private/original.png' })).toThrow();
    expect(() =>
      selectPublicationCandidates({
        phase: 'production',
        spec: { width: 1536, height: 2048 },
        assets: [finalAsset, finalAsset],
      }),
    ).toThrow('重复');
  });
  it('exports only the allowlisted public fields', () => {
    const [candidate] = publish();
    expect(candidate?.artwork.image).toBe('catalog/art-001.png');
    expect(candidate?.artwork).not.toHaveProperty('path');
    expect(candidate?.artwork).not.toHaveProperty('user_final_approved');
  });
  it('accepts an approved portrait matching the configured batch canvas', () => {
    expect(publish()[0]?.artwork).toMatchObject({ width: 1536, height: 2048 });
  });
  it('rejects old square finals in a portrait batch', () => {
    expect(() => publish({ ...finalAsset, width: 2048 })).toThrow('当前批次画布');
  });
  it('allows a deliberately configured different canvas without changing source code', () => {
    const result = selectPublicationCandidates({
      phase: 'production',
      spec: { width: 1080, height: 1920 },
      assets: [{ ...finalAsset, width: 1080, height: 1920 }],
    });
    expect(result[0]?.artwork).toMatchObject({ width: 1080, height: 1920 });
  });
});

const study = {
  ...finalAsset,
  id: 'gaara-study',
  path: 'assets/drafts/gaara.png',
  status: 'draft',
  user_final_approved: false,
  width: 1086,
  height: 1448,
  display: {
    listed: true,
    character_slug: 'gaara',
    title: '砂之守护',
    series: '火影忍者',
    description: '背负葫芦的风影造型',
    tags: ['大葫芦'],
    aliases: ['Gaara'],
  },
};
const catalog = (assets: unknown[]) =>
  selectCatalogCandidates({
    phase: 'sample_validation',
    spec: { width: 1536, height: 2048 },
    assets,
  });

describe('explicit exhibition selection', () => {
  it('exports validated detail focus data without changing original image dimensions', () => {
    const detail = { label: '背负砂葫芦', x: 18, y: 54, scale: 3.2 };
    const [entry] = catalog([{ ...study, display: { ...study.display, detail } }]);
    expect(entry?.artwork.detail).toEqual(detail);
    expect(entry?.artwork).toMatchObject({ width: 1086, height: 1448 });
    expect(() =>
      catalog([{ ...study, display: { ...study.display, detail: { ...detail, x: 150 } } }]),
    ).toThrow();
    expect(() =>
      catalog([{ ...study, display: { ...study.display, detail: { ...detail, scale: 10 } } }]),
    ).toThrow();
  });
  it('exhibits an opted-in native-size study without upgrading its final approval', () => {
    const [entry] = catalog([study]);
    expect(entry?.artwork).toMatchObject({
      stage: 'study',
      width: 1086,
      characterSlug: 'gaara',
      theme: '火影忍者',
    });
    expect(study.user_final_approved).toBe(false);
    expect(
      selectPublicationCandidates({
        phase: 'sample_validation',
        spec: { width: 1536, height: 2048 },
        assets: [study],
      }),
    ).toEqual([]);
  });
  it('keeps unlisted studies, old trials, and reference images out', () => {
    expect(catalog([{ ...study, display: undefined }])).toEqual([]);
    expect(catalog([{ ...study, display: { ...study.display, listed: false } }])).toEqual([]);
    expect(() => catalog([{ ...study, status: 'source_reference' }])).toThrow('参考素材');
  });
  it('continues enforcing final approval rules even with display metadata', () => {
    expect(() => catalog([{ ...study, status: 'final' }])).toThrow('正式生产');
  });
  it('rejects traversal and unsafe public slugs', () => {
    expect(() => catalog([{ ...study, id: '../escape' }])).toThrow();
    expect(() => catalog([{ ...study, path: 'assets/drafts/../../private.png' }])).toThrow();
    expect(() =>
      catalog([{ ...study, display: { ...study.display, character_slug: '../gaara' } }]),
    ).toThrow();
  });
  it('strips internal notes, prompt paths and source data from the public catalog', () => {
    const output = JSON.stringify(
      catalog([
        {
          ...study,
          prompt_file: 'private-prompt',
          review_notes: ['private-review'],
          source: '/private/source',
        },
      ]),
    );
    expect(output).not.toContain('private');
    expect(output).not.toContain('user_final_approved');
  });
  it('searches aliases, series and equipment tags across case and whitespace', () => {
    const artwork = catalog([study])[0]!.artwork;
    expect(matchesArtwork(artwork, ' GaaRA ')).toBe(true);
    expect(matchesArtwork(artwork, '大 葫芦')).toBe(true);
    expect(matchesArtwork(artwork, '火影忍者')).toBe(true);
    expect(matchesArtwork(artwork, '日轮刀')).toBe(false);
  });
});

describe('character Q and optional IP studies', () => {
  const primary = {
    ...study,
    id: 'gaara-q',
    display: { ...study.display, surface: 'character_study' },
  };
  const input = {
    phase: 'sample_validation',
    spec: { width: 1536, height: 2048 },
    assets: [study, primary],
    character_studies: [{ slug: 'gaara', primary_asset_id: primary.id, ip_asset_id: study.id }],
  };

  it('keeps a pilot Q image out of the current catalog while linking one character to both images', () => {
    expect(selectCatalogCandidates(input).map(({ artwork }) => artwork.id)).toEqual([study.id]);
    const [character] = selectCharacterStudies(input);
    expect(character?.primary.artwork.id).toBe(primary.id);
    expect(character?.ip?.artwork.id).toBe(study.id);
    expect(character?.primary.artwork).not.toHaveProperty('surface');
  });

  it('allows a complete character without IP, and never treats an orphan pilot image as a catalog entry', () => {
    const [character] = selectCharacterStudies({
      ...input,
      character_studies: [{ slug: 'gaara', primary_asset_id: primary.id }],
    });
    expect(character).not.toHaveProperty('ip');
    expect(selectCharacterStudies({ ...input, character_studies: [] })).toEqual([]);
    expect(selectCatalogCandidates(input)).toHaveLength(1);
  });

  it('rejects hidden, missing, duplicate or cross-character image selections instead of substituting', () => {
    expect(() =>
      selectCharacterStudies({
        ...input,
        assets: [study, { ...primary, display: { ...primary.display, listed: false } }],
      }),
    ).toThrow('未明确选择');
    expect(() =>
      selectCharacterStudies({
        ...input,
        character_studies: [{ slug: 'gaara', primary_asset_id: 'missing' }],
      }),
    ).toThrow('未明确选择');
    expect(() =>
      selectCharacterStudies({
        ...input,
        character_studies: [...input.character_studies, ...input.character_studies],
      }),
    ).toThrow('重复人物');
    expect(() =>
      selectCharacterStudies({
        ...input,
        assets: [{ ...study, display: { ...study.display, character_slug: 'naruto' } }, primary],
      }),
    ).toThrow('其他人物');
    expect(() =>
      selectCharacterStudies({
        ...input,
        character_studies: [
          { slug: 'gaara', primary_asset_id: primary.id, ip_asset_id: primary.id },
        ],
      }),
    ).toThrow('不能指向同一张');
  });
});
