import { expect, it } from 'vitest';
import { extractCreationRules } from './creation-rules.ts';

it('extracts only the public B instructions and refuses ambiguous or invalid boundaries', () => {
  const start = '<!-- creation-studio-rules:start -->';
  const end = '<!-- creation-studio-rules:end -->';
  const body = '# IKUN-Q B主图创作规则\n\n唯一输入：完整原始小鸟。';
  expect(extractCreationRules(`私有路径\n${start}\n${body}\n${end}\n私有历史`)).toBe(body + '\n');
  for (const source of [
    body,
    start + body,
    start + body + end + end,
    end + body + start,
    start + end,
  ])
    expect(() => extractCreationRules(source)).toThrow('创作台规则');
});
