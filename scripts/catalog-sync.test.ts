import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { syncCatalog } from './catalog-sync.ts';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ikun-q-catalog-'));
  roots.push(root);
  await mkdir(join(root, 'assets/drafts'), { recursive: true });
  const bytes = await sharp({
    create: { width: 30, height: 40, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
  await writeFile(join(root, 'assets/drafts/study.png'), bytes);
  const manifest = {
    phase: 'sample_validation',
    spec: { width: 1536, height: 2048 },
    assets: [
      {
        id: 'study',
        theme: '火影忍者',
        character: '我爱罗',
        pose: '站姿',
        status: 'draft',
        path: 'assets/drafts/study.png',
        width: 30,
        height: 40,
        display: {
          listed: true,
          character_slug: 'gaara',
          title: '砂之守护',
          series: '火影忍者',
          description: '展示介绍',
          tags: [],
        },
      },
    ],
  };
  const save = () => writeFile(join(root, 'assets/manifest.json'), JSON.stringify(manifest));
  await save();
  return { root, manifest, save, bytes };
}

it('syncs complete listed images and previews without altering originals, then removes delisted copies', async () => {
  const { root, bytes, manifest, save } = await fixture();
  expect(await syncCatalog(root)).toBe(1);
  expect(
    JSON.parse(await readFile(join(root, 'apps/worker/src/generated/artwork-ids.json'), 'utf8')),
  ).toEqual(['study']);
  expect(await readFile(join(root, 'assets/drafts/study.png'))).toEqual(bytes);
  expect(await readFile(join(root, 'apps/web/public/catalog/study.png'))).toEqual(bytes);
  const preview = await sharp(join(root, 'apps/web/public/catalog/study-480.webp')).metadata();
  expect([preview.width, preview.height]).toEqual([30, 40]);
  const sourceHash = createHash('sha256').update(bytes).digest('hex');
  for (const file of ['study.png', 'study-480.webp', 'study-960.webp']) {
    const origin = JSON.parse(
      await readFile(join(root, `apps/web/public/catalog/${file}.json`), 'utf8'),
    );
    expect(origin).toMatchObject({ kind: 'origin_only', assetId: 'study' });
    expect(origin.prompt).toContain('IKUN-Q');
    expect(origin.prompt).toContain(sourceHash);
    expect(JSON.stringify(origin)).not.toContain(root);
  }
  manifest.assets[0]!.display.listed = false;
  await save();
  await syncCatalog(root);
  expect(await readdir(join(root, 'apps/web/public/catalog'))).toEqual([]);
  expect(
    JSON.parse(await readFile(join(root, 'apps/worker/src/generated/artwork-ids.json'), 'utf8')),
  ).toEqual([]);
});

it('removes obsolete public mirror files while preserving selected originals and previews', async () => {
  const { root, bytes } = await fixture();
  await syncCatalog(root);
  const obsolete = join(root, 'apps/web/public/catalog/mirrored');
  await mkdir(obsolete);
  await writeFile(join(obsolete, 'study.png'), bytes);
  await writeFile(join(obsolete, 'study.png.json'), JSON.stringify({ kind: 'origin_only' }));
  const oldCatalogPath = join(root, 'apps/web/src/generated/catalog.json');
  const oldCatalog = JSON.parse(await readFile(oldCatalogPath, 'utf8'));
  oldCatalog.artworks[0].mirroredImage = 'catalog/mirrored/study.png';
  await writeFile(oldCatalogPath, JSON.stringify(oldCatalog));
  await syncCatalog(root);
  expect(await readdir(join(root, 'apps/web/public/catalog'))).toEqual([
    'study-480.webp',
    'study-480.webp.json',
    'study-960.webp',
    'study-960.webp.json',
    'study.png',
    'study.png.json',
  ]);
  const catalog = JSON.parse(await readFile(oldCatalogPath, 'utf8'));
  expect(catalog.artworks).toHaveLength(1);
  expect(catalog.artworks[0]).not.toHaveProperty('mirroredImage');
  expect(catalog.artworks[0]).toMatchObject({
    id: 'study',
    image: 'catalog/study.png',
    preview: 'catalog/study-480.webp',
  });
  expect(await readFile(join(root, 'assets/drafts/study.png'))).toEqual(bytes);
  expect(await readFile(join(root, 'apps/web/public/catalog/study.png'))).toEqual(bytes);
  expect(
    JSON.parse(await readFile(join(root, 'apps/worker/src/generated/artwork-ids.json'), 'utf8')),
  ).toEqual(['study']);
});

it('rejects dimension mismatch before replacing an existing catalog', async () => {
  const { root, manifest, save } = await fixture();
  await syncCatalog(root);
  manifest.assets[0]!.width = 31;
  await save();
  await expect(syncCatalog(root)).rejects.toThrow('实际文件');
  expect(await readdir(join(root, 'apps/web/public/catalog'))).toContain('study.png');
});

it('rejects a source symlink escaping the selected drafts directory', async () => {
  const { root, bytes } = await fixture();
  await writeFile(join(root, 'outside.png'), bytes);
  await rm(join(root, 'assets/drafts/study.png'));
  await symlink(join(root, 'outside.png'), join(root, 'assets/drafts/study.png'));
  await expect(syncCatalog(root)).rejects.toThrow('超出允许目录');
});

it('syncs only explicitly linked pilot images, exports safe character data and cleans them when the pilot is removed', async () => {
  const { root, bytes, manifest } = await fixture();
  await writeFile(join(root, 'assets/drafts/study-q.png'), bytes);
  const extended = {
    ...manifest,
    assets: [
      ...manifest.assets,
      {
        ...manifest.assets[0]!,
        id: 'study-q',
        path: 'assets/drafts/study-q.png',
        prompt_file: '/private/actual-prompt.txt',
        display: { ...manifest.assets[0]!.display, surface: 'character_study' },
      },
    ],
    character_studies: [{ slug: 'gaara', primary_asset_id: 'study-q', ip_asset_id: 'study' }],
  };
  const save = () => writeFile(join(root, 'assets/manifest.json'), JSON.stringify(extended));
  await save();
  expect(await syncCatalog(root)).toBe(2);
  const catalog = JSON.parse(
    await readFile(join(root, 'apps/web/src/generated/catalog.json'), 'utf8'),
  );
  expect(catalog.artworks.map((artwork: { id: string }) => artwork.id)).toEqual(['study']);
  expect(catalog.characterStudies).toMatchObject([
    {
      slug: 'gaara',
      primary: { id: 'study-q', preview: 'catalog/study-q-480.webp' },
      ip: { id: 'study', previewLarge: 'catalog/study-960.webp' },
    },
  ]);
  expect(JSON.stringify(catalog)).not.toContain('private');
  expect(JSON.stringify(catalog)).not.toContain('sourcePath');
  expect(await readFile(join(root, 'apps/web/public/catalog/study-q.png'))).toEqual(bytes);
  expect(
    JSON.parse(await readFile(join(root, 'apps/worker/src/generated/artwork-ids.json'), 'utf8')),
  ).toEqual(['study', 'study-q']);
  extended.character_studies = [];
  await save();
  expect(await syncCatalog(root)).toBe(1);
  expect(await readdir(join(root, 'apps/web/public/catalog'))).not.toContain('study-q.png');
  expect(await readFile(join(root, 'assets/drafts/study-q.png'))).toEqual(bytes);
});

it('fails a broken character selection before replacing previously published images', async () => {
  const { root, manifest } = await fixture();
  await syncCatalog(root);
  await writeFile(
    join(root, 'assets/manifest.json'),
    JSON.stringify({
      ...manifest,
      character_studies: [{ slug: 'gaara', primary_asset_id: 'missing' }],
    }),
  );
  await expect(syncCatalog(root)).rejects.toThrow('未明确选择');
  expect(await readdir(join(root, 'apps/web/public/catalog'))).toContain('study.png');
});

it('retires Q trial copies and public IDs while keeping archived associations, originals and prompts private', async () => {
  const { root, bytes, manifest } = await fixture();
  await writeFile(join(root, 'assets/drafts/retired-q.png'), bytes);
  await mkdir(join(root, 'prompts'));
  await writeFile(join(root, 'prompts/retired-q.txt'), 'Historical prompt remains unchanged.');
  const q = {
    ...manifest.assets[0]!,
    id: 'retired-q',
    path: 'assets/drafts/retired-q.png',
    display: { ...manifest.assets[0]!.display, surface: 'character_study' },
  };
  const studies = [{ slug: 'gaara', primary_asset_id: q.id, ip_asset_id: 'study' }];
  await writeFile(
    join(root, 'assets/manifest.json'),
    JSON.stringify({ ...manifest, assets: [...manifest.assets, q], character_studies: studies }),
  );
  expect(await syncCatalog(root)).toBe(2);
  await writeFile(
    join(root, 'assets/manifest.json'),
    JSON.stringify({
      ...manifest,
      assets: [...manifest.assets, { ...q, display: { ...q.display, listed: false } }],
      character_studies: [],
      retired_character_study_batches: [{ retired_on: '2026-11-11', studies }],
    }),
  );
  expect(await syncCatalog(root)).toBe(1);
  expect(
    (await readdir(join(root, 'apps/web/public/catalog'))).some((file) =>
      file.startsWith('retired-q'),
    ),
  ).toBe(false);
  const catalog = JSON.parse(
    await readFile(join(root, 'apps/web/src/generated/catalog.json'), 'utf8'),
  );
  expect(catalog.artworks.map((artwork: { id: string }) => artwork.id)).toEqual(['study']);
  expect(catalog.characterStudies).toEqual([]);
  expect(JSON.stringify(catalog)).not.toContain('retired-q');
  expect(
    JSON.parse(await readFile(join(root, 'apps/worker/src/generated/artwork-ids.json'), 'utf8')),
  ).toEqual(['study']);
  expect(await readFile(join(root, 'assets/drafts/retired-q.png'))).toEqual(bytes);
  expect(await readFile(join(root, 'prompts/retired-q.txt'), 'utf8')).toBe(
    'Historical prompt remains unchanged.',
  );
});
