import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRegistry } from './build-registry.ts';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function outputDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'ikun-q-registry-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('UI source distribution', () => {
  it('ships dependency closures with portable imports and declared npm packages', async () => {
    const directory = await outputDirectory();
    const registry = await buildRegistry(directory);
    const cases = [
      ['dialog', ['button.tsx', 'dialog.tsx', 'utils.ts']],
      ['select', ['select.tsx', 'utils.ts']],
      ['reaction-buttons', ['button.tsx', 'reaction-buttons.tsx', 'utils.ts']],
      ['field', ['field.tsx', 'label.tsx', 'separator.tsx', 'utils.ts']],
      ['toggle-group', ['toggle-group.tsx', 'toggle.tsx', 'utils.ts']],
    ] as const;
    for (const [name, expectedFiles] of cases) {
      const item = registry.items.find((entry) => entry.name === name)!;
      expect(item.files?.map((file) => file.path.split('/').at(-1)).sort()).toEqual(
        [...expectedFiles].sort(),
      );
      expect(item.dependencies).toContain('radix-ui@^1.8.1');
      expect(item.dependencies).toContain('cn@^0.5.0');
      expect(item.registryDependencies ?? []).toEqual([]);
      const serialized = await readFile(join(directory, `${name}.json`), 'utf8');
      expect(serialized).not.toContain('@ikun-q/');
      expect(serialized).not.toContain('apps/web');
    }
    expect(
      registry.items
        .find((entry) => entry.name === 'dialog')
        ?.files?.find((file) => file.path.endsWith('/dialog.tsx'))?.content,
    ).toContain("from '@/components/ui/button'");
    expect(registry.items.find((entry) => entry.name === 'input')?.dependencies).not.toContain(
      'radix-ui@^1.8.1',
    );
  });

  it('keeps the optional theme separate and removes stale generated registry items', async () => {
    const directory = await outputDirectory();
    await writeFile(join(directory, 'removed-component.json'), '{}');
    await writeFile(join(directory, 'keep.txt'), 'not generated JSON');
    const registry = await buildRegistry(directory);
    await expect(readFile(join(directory, 'removed-component.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(join(directory, 'keep.txt'), 'utf8')).toBe('not generated JSON');
    const theme = registry.items.find((item) => item.name === 'theme')!;
    expect(theme.files?.[0]?.target).toBe('~/src/styles/ikun-q.css');
    expect(theme.files?.[0]?.content).toContain('--primary: #f4d334');
    expect(theme.files?.[0]?.content).not.toContain('.concept-book');
    for (const component of registry.items.filter((item) => item.type === 'registry:ui')) {
      expect(component.files?.some((file) => file.path.endsWith('.css'))).toBe(false);
    }
  });
});
