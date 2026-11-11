import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const start = '<!-- creation-studio-rules:start -->';
const end = '<!-- creation-studio-rules:end -->';
const title = '# IKUN-Q B主图创作规则';

/** Extracts only the reviewed B prompt; ambiguous boundaries must never expose the rest of the private specification. */
export function extractCreationRules(source: string) {
  if (source.split(start).length !== 2 || source.split(end).length !== 2)
    throw new Error('创作台规则标记缺失或重复。');
  const begin = source.indexOf(start) + start.length;
  if (begin > source.indexOf(end)) throw new Error('创作台规则标记顺序无效。');
  return validateRules(source.slice(begin, source.indexOf(end)).trim());
}

function validateRules(source: string) {
  if (!source.startsWith(title + '\n') || source.trim().length <= title.length)
    throw new Error('创作台规则标题或正文无效。');
  return source.trim() + '\n';
}

/** Builds use the canonical marked specification; standalone public checkouts use its reviewed export. */
export async function readCreationRules(root: string) {
  let source: string;
  try {
    source = await readFile(join(root, 'docs/角色规范.md'), 'utf8');
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    return validateRules(await readFile(join(root, 'CREATION_RULES.md'), 'utf8'));
  }
  return extractCreationRules(source);
}
