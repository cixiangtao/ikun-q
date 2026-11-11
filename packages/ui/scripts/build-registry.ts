import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { registrySchema, registryItemSchema } from 'shadcn/schema';

type RegistryFile = NonNullable<ReturnType<typeof registryItemSchema.parse>['files']>[number];

const root = fileURLToPath(new URL('../', import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
};

/**
 * Builds portable shadcn items from the same sources consumed by the website.
 * Each item includes its local dependency closure, so hosting needs no fixed URL or namespace.
 * CSS is installed separately to avoid replacing a consumer's theme when adding one component.
 */
export async function buildRegistry(outputDirectory = resolve(root, 'dist/r')) {
  const registry = registrySchema.parse(
    JSON.parse(await readFile(resolve(root, 'registry.json'), 'utf8')),
  );
  const sources = new Map(
    registry.items.flatMap((item) => (item.files ?? []).map((file) => [file.path, file] as const)),
  );
  sources.set('src/lib/utils.ts', { path: 'src/lib/utils.ts', type: 'registry:lib' });
  const items = [];
  for (const item of registry.items) {
    const files = new Map<string, RegistryFile>();
    const dependencies = new Set(item.dependencies);
    async function include(path: string) {
      if (files.has(path)) return;
      const file = sources.get(path);
      if (!file) throw new Error(`Registry dependency has no source entry: ${path}`);
      const content = await readFile(resolve(root, path), 'utf8');
      files.set(path, {
        ...file,
        // Standard shadcn aliases are rewritten by `add` to the consumer's configured aliases.
        content: content
          .replaceAll('@ikun-q/ui/components/', '@/components/ui/')
          .replaceAll('@ikun-q/ui/lib/', '@/lib/'),
      });
      if (path.endsWith('.css')) return;
      for (const match of content.matchAll(/from ['"]([^'"]+)['"]/g)) {
        const specifier = match[1]!;
        if (specifier.startsWith('@ikun-q/ui/')) {
          const local = specifier.slice('@ikun-q/ui/'.length);
          await include(`src/${local}.${local.startsWith('components/') ? 'tsx' : 'ts'}`);
        } else if (!packageJson.peerDependencies[specifier]) {
          const version = packageJson.dependencies[specifier];
          if (!version) throw new Error(`Registry import has no declared dependency: ${specifier}`);
          dependencies.add(`${specifier}@${version}`);
        }
      }
    }
    for (const file of item.files ?? []) await include(file.path);
    items.push(
      registryItemSchema.parse({
        ...item,
        dependencies: [...dependencies].sort(),
        files: [...files.values()],
      }),
    );
  }
  await mkdir(outputDirectory, { recursive: true });
  // Remove stale registry JSON only; this dedicated output directory is always generated.
  for (const file of await readdir(outputDirectory)) {
    if (file.endsWith('.json')) await unlink(resolve(outputDirectory, file));
  }
  for (const item of items) {
    await writeFile(
      resolve(outputDirectory, `${item.name}.json`),
      `${JSON.stringify(item, null, 2)}\n`,
    );
  }
  const catalog = registrySchema.parse({ ...registry, items });
  await writeFile(
    resolve(outputDirectory, 'registry.json'),
    `${JSON.stringify(catalog, null, 2)}\n`,
  );
  return catalog;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const registry = await buildRegistry();
  console.log(`Built ${registry.items.length} shadcn registry items in packages/ui/dist/r`);
}
