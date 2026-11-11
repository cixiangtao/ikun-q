import { copyFile, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { selectCatalogCandidates, selectCharacterStudies, manifestSchema } from '@ikun-q/catalog';

/** Validates every listed PNG before replacing generated public files. Originals stay untouched. */
export async function syncCatalog(root: string) {
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(resolve(root, 'assets/manifest.json'), 'utf8')),
  );
  const catalogCandidates = selectCatalogCandidates(manifest);
  const studies = selectCharacterStudies(manifest);
  const candidates = [
    ...new Map(
      [
        ...catalogCandidates,
        ...studies.flatMap((study) => [study.primary, ...(study.ip ? [study.ip] : [])]),
      ].map((candidate) => [candidate.artwork.id, candidate]),
    ).values(),
  ];
  const publicDir = resolve(root, 'apps/web/public/catalog');
  const stageDir = resolve(root, 'apps/web/public/.catalog-staging');
  const generatedDir = resolve(root, 'apps/web/src/generated');
  const verified = await Promise.all(
    candidates.map(async ({ sourcePath, artwork }) => {
      const allowedRoot = await realpath(
        resolve(root, sourcePath.startsWith('assets/drafts/') ? 'assets/drafts' : 'assets/finals'),
      );
      const source = await realpath(resolve(root, sourcePath));
      if (!source.startsWith(allowedRoot + sep))
        throw new Error(`素材路径超出允许目录：${artwork.id}`);
      const bytes = await readFile(source);
      if (
        bytes.length < 24 ||
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.readUInt32BE(16) !== artwork.width ||
        bytes.readUInt32BE(20) !== artwork.height
      ) {
        throw new Error(
          `${artwork.id} 的实际文件必须是 ${artwork.width} × ${artwork.height} PNG。`,
        );
      }
      const metadata = await sharp(bytes).metadata();
      if (metadata.width !== artwork.width || metadata.height !== artwork.height)
        throw new Error(`无法解码图片：${artwork.id}`);
      return { source, artwork };
    }),
  );
  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });
  try {
    // Bound native image processing concurrency for predictable local/CI memory use.
    for (const { source, artwork } of verified) {
      const sourceHash = createHash('sha256')
        .update(await readFile(source))
        .digest('hex');
      const writeOrigin = (filename: string, treatment: string) =>
        writeFile(
          resolve(stageDir, `${filename}.json`),
          JSON.stringify(
            {
              prompt: `Origin: pre-existing IKUN-Q illustration ${artwork.id}. ${treatment} Source SHA-256: ${sourceHash}.`,
              kind: 'origin_only',
              assetId: artwork.id,
            },
            null,
            2,
          ) + '\n',
        );
      await copyFile(source, resolve(stageDir, artwork.image.replace('catalog/', '')));
      // Origin-only sidecars preserve immutable PNG bytes and avoid publishing private prompts.
      await writeOrigin(`${artwork.id}.png`, 'Original PNG copied byte-for-byte.');
      for (const width of [480, 960]) {
        await sharp(source)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 86 })
          .toFile(resolve(stageDir, `${artwork.id}-${width}.webp`));
        await writeOrigin(
          `${artwork.id}-${width}.webp`,
          `WebP derivative, maximum width ${width}px, aspect ratio preserved, no crop or enlargement.`,
        );
      }
      artwork.preview = `catalog/${artwork.id}-480.webp`;
      artwork.previewLarge = `catalog/${artwork.id}-960.webp`;
    }
    await mkdir(generatedDir, { recursive: true });
    await rm(publicDir, { recursive: true, force: true });
    await rename(stageDir, publicDir);
    const catalogIds = new Set(catalogCandidates.map(({ artwork }) => artwork.id));
    const verifiedById = new Map(verified.map(({ artwork }) => [artwork.id, artwork]));
    const verifiedArtwork = (id: string) => {
      const artwork = verifiedById.get(id);
      if (!artwork) throw new Error(`人物样例图片未通过文件检查：${id}`);
      return artwork;
    };
    await writeFile(
      resolve(generatedDir, 'catalog.json'),
      JSON.stringify(
        {
          phase: manifest.phase,
          canvas: manifest.spec,
          artworks: verified
            .filter(({ artwork }) => catalogIds.has(artwork.id))
            .map(({ artwork }) => artwork),
          characterStudies: studies.map((study) => ({
            slug: study.slug,
            primary: verifiedArtwork(study.primary.artwork.id),
            ...(study.ip ? { ip: verifiedArtwork(study.ip.artwork.id) } : {}),
          })),
        },
        null,
        2,
      ) + '\n',
    );
    const workerCatalogDir = resolve(root, 'apps/worker/src/generated');
    await mkdir(workerCatalogDir, { recursive: true });
    await writeFile(
      resolve(workerCatalogDir, 'artwork-ids.json'),
      JSON.stringify(
        verified.map(({ artwork }) => artwork.id),
        null,
        2,
      ) + '\n',
    );
  } finally {
    await rm(stageDir, { recursive: true, force: true });
  }
  return verified.length;
}
