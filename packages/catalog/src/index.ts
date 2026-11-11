import { z } from 'zod';

/** Detail crop coordinates are percentages of the source image; source pixels remain unchanged. */
const detailFocusSchema = z.object({
  label: z.string().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  scale: z.number().min(1.5).max(6),
});

/** Public catalog data never exposes prompts, local file paths, or reference entries. */
export const artworkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  theme: z.string().min(1),
  character: z.string().min(1),
  pose: z.string().min(1),
  image: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  characterSlug: z.string().min(1).optional(),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  version: z.number().int().positive().default(1),
  createdDate: z.string().default(''),
  edition: z.string().default(''),
  stage: z.enum(['study', 'final']).default('final'),
  order: z.number().int().default(0),
  featured: z.boolean().default(false),
  preview: z.string().optional(),
  previewLarge: z.string().optional(),
  detail: detailFocusSchema.optional(),
});

export type Artwork = z.infer<typeof artworkSchema>;

/** A character has one Q main image and an optional, detail-only IP illustration. */
export const characterStudySchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  primary: artworkSchema,
  ip: artworkSchema.optional(),
});
export type CharacterStudy = z.infer<typeof characterStudySchema>;

export const projectPhaseSchema = z.enum([
  'specification_refinement',
  'sample_validation',
  'production',
]);
/** The manifest owns the batch canvas; generation and previews must not assume a square. */
export const canvasSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const publicCatalogSchema = z.object({
  phase: projectPhaseSchema,
  canvas: canvasSchema,
  artworks: z.array(artworkSchema),
  characterStudies: z.array(characterStudySchema).default([]),
});

const assetSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/, '素材ID只能使用字母、数字、下划线和连字符'),
  theme: z.string().min(1),
  path: z.string().min(1),
  status: z.enum(['source_reference', 'draft', 'final']),
  user_final_approved: z.boolean().optional(),
  title: z.string().optional(),
  character: z.string().optional(),
  pose: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  version: z.number().int().positive().optional(),
  generation_date: z.string().optional(),
  display: z
    .object({
      listed: z.boolean(),
      surface: z.enum(['catalog', 'character_study']).default('catalog'),
      character_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      title: z.string().min(1),
      series: z.string().min(1),
      description: z.string().min(1),
      tags: z.array(z.string().min(1)),
      aliases: z.array(z.string().min(1)).default([]),
      edition: z.string().default(''),
      order: z.number().int().default(0),
      featured: z.boolean().default(false),
      detail: detailFocusSchema.optional(),
    })
    .optional(),
});

export const manifestSchema = z.object({
  phase: projectPhaseSchema,
  spec: canvasSchema,
  assets: z.array(assetSchema),
  character_studies: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        primary_asset_id: z.string().min(1),
        ip_asset_id: z.string().min(1).optional(),
      }),
    )
    .default([]),
});

export interface PublicationCandidate {
  sourcePath: string;
  artwork: Artwork;
}

/**
 * Selects only explicitly approved finals. Drafts and identity references stay out of the artwork catalog.
 * A broken final fails the build so a partial or misleading release cannot silently ship.
 */
export function selectPublicationCandidates(input: unknown): PublicationCandidate[] {
  const manifest = manifestSchema.parse(input);
  const seen = new Set<string>();
  return manifest.assets.flatMap((asset) => {
    if (seen.has(asset.id)) throw new Error(`重复素材 ID：${asset.id}`);
    seen.add(asset.id);
    if (asset.status !== 'final') return [];
    if (manifest.phase !== 'production') throw new Error('尚未进入正式生产阶段，不能发布成品。');
    if (asset.user_final_approved !== true) throw new Error(`${asset.id} 尚未经用户确认定稿。`);
    if (asset.width !== manifest.spec.width || asset.height !== manifest.spec.height) {
      throw new Error(`${asset.id} 的尺寸与当前批次画布不一致。`);
    }
    // Restrict source paths before filesystem access; symlinks are checked by the sync script.
    if (!/^assets\/finals\/[a-zA-Z0-9_-]+\.png$/.test(asset.path)) {
      throw new Error(`${asset.id} 必须引用 assets/finals/ 下的 PNG 文件。`);
    }
    const artwork = artworkSchema.parse({
      ...asset,
      image: `catalog/${asset.path.split('/').at(-1)}`,
    });
    return [{ sourcePath: asset.path, artwork }];
  });
}

/**
 * An explicitly listed study can be exhibited without becoming an approved final.
 * Final production checks remain enforced; references can never become exhibits.
 */
function selectExhibitCandidates(input: unknown): PublicationCandidate[] {
  const manifest = manifestSchema.parse(input);
  const finals = selectPublicationCandidates(input);
  const byId = new Map(finals.map((candidate) => [candidate.artwork.id, candidate]));
  return manifest.assets
    .flatMap((asset) => {
      const display = asset.display;
      if (display?.listed === false) return [];
      if (asset.status === 'source_reference') {
        if (display?.listed) throw new Error(`${asset.id} 是参考素材，不能作为图鉴作品。`);
        return [];
      }
      const final = byId.get(asset.id);
      if (!final && !display?.listed) return [];
      if (!final && !/^assets\/drafts\/[a-zA-Z0-9_-]+\.png$/.test(asset.path)) {
        throw new Error(`${asset.id} 的展示稿必须位于 assets/drafts/。`);
      }
      const artwork = artworkSchema.parse({
        id: asset.id,
        title: display?.title ?? asset.title,
        theme: display?.series ?? asset.theme,
        character: asset.character,
        pose: asset.pose,
        image: `catalog/${asset.id}.png`,
        width: asset.width,
        height: asset.height,
        characterSlug: display?.character_slug ?? asset.id,
        description: display?.description,
        tags: display?.tags,
        aliases: display?.aliases,
        edition: display?.edition,
        order: display?.order,
        featured: display?.featured,
        detail: display?.detail,
        version: asset.version,
        createdDate: asset.generation_date,
        stage: asset.status === 'draft' ? 'study' : 'final',
      });
      return [{ sourcePath: asset.path, artwork }];
    })
    .sort((a, b) => a.artwork.order - b.artwork.order);
}

/** Main catalog selection stays separate from the explicitly scoped character studies. */
export function selectCatalogCandidates(input: unknown): PublicationCandidate[] {
  const manifest = manifestSchema.parse(input);
  const studyOnly = new Set(
    manifest.assets
      .filter((asset) => asset.display?.surface === 'character_study')
      .map((asset) => asset.id),
  );
  return selectExhibitCandidates(manifest).filter(({ artwork }) => !studyOnly.has(artwork.id));
}

export interface CharacterStudySelection {
  slug: string;
  primary: PublicationCandidate;
  ip?: PublicationCandidate;
}

/**
 * Resolves only named, explicitly listed studies. Invalid or cross-character links fail before sync;
 * choosing a study never promotes a hidden trial, reference image or unapproved final.
 */
export function selectCharacterStudies(input: unknown): CharacterStudySelection[] {
  const manifest = manifestSchema.parse(input);
  const available = new Map(
    selectExhibitCandidates(manifest).map((candidate) => [candidate.artwork.id, candidate]),
  );
  const seen = new Set<string>();
  return manifest.character_studies.map((study) => {
    if (seen.has(study.slug)) throw new Error(`重复人物样例：${study.slug}`);
    seen.add(study.slug);
    const resolve = (id: string) => {
      const candidate = available.get(id);
      if (!candidate) throw new Error(`${study.slug} 的形象未明确选择展示：${id}`);
      if (candidate.artwork.characterSlug !== study.slug)
        throw new Error(`${study.slug} 的形象属于其他人物：${id}`);
      return candidate;
    };
    const primary = resolve(study.primary_asset_id);
    if (
      manifest.assets.find((asset) => asset.id === primary.artwork.id)?.display?.surface !==
      'character_study'
    )
      throw new Error(`${study.slug} 的Q版样例必须显式选择人物样例范围。`);
    if (study.primary_asset_id === study.ip_asset_id)
      throw new Error(`${study.slug} 的Q版与IP形象不能指向同一张图。`);
    return {
      slug: study.slug,
      primary,
      ...(study.ip_asset_id ? { ip: resolve(study.ip_asset_id) } : {}),
    };
  });
}

/** Matches human names, aliases and visual tags with whitespace-insensitive search. */
export function matchesArtwork(artwork: Artwork, query: string): boolean {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, '');
  return normalize(
    [
      artwork.title,
      artwork.character,
      artwork.theme,
      artwork.description,
      ...artwork.aliases,
      ...artwork.tags,
    ].join(' '),
  ).includes(normalize(query));
}
