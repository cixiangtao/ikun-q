import { expect, it } from 'vitest';
import { buildCreationPrompt, exportCreationPlan, librarianExample } from './creation-plan';

it('requires a subject and separates custom design from the unchanged base rules', () => {
  const rules = '# B规则\n唯一输入：完整原图。';
  expect(() => buildCreationPrompt({ ...librarianExample, subject: '  ' }, rules)).toThrow(
    '人物或职业',
  );
  const prompt = buildCreationPrompt(
    { ...librarianExample, subject: '  原创旅行画家  ', equipment: '' },
    rules,
  );
  expect(prompt.startsWith(rules + '\n\n')).toBe(true);
  expect(prompt).toContain('人物或职业：原创旅行画家');
  expect(prompt).toContain('装备与持握方式：未指定');
  expect(prompt).not.toContain('undefined');
});

it('saves the actual edited prompt rather than silently rebuilding it from form fields', () => {
  const edited = '我手动修改过的神态与提示词。\n保留这一段。';
  const plan = exportCreationPlan(librarianExample, edited);
  expect(plan).toContain(edited);
  expect(plan).toContain('小鸟图书管理员');
  expect(plan).toContain('REFERENCE_USE.md');
  expect(plan).toContain('尚未生成或提交作品');
});
