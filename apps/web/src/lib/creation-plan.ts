/** User-authored design inputs; they are never uploaded by the creation studio. */
export interface CreationDesign {
  subject: string;
  outfit: string;
  face: string;
  hair: string;
  expression: string;
  equipment: string;
}

export const designFields = [
  {
    key: 'subject',
    label: '人物或职业',
    placeholder: '例如：图书管理员、旅行画家',
    multiline: false,
  },
  {
    key: 'outfit',
    label: '服装与主色',
    placeholder: '服装层次、主色和最有代表性的细节',
    multiline: true,
  },
  { key: 'face', label: '脸部底色', placeholder: '例如：浅暖桃色', multiline: false },
  { key: 'hair', label: '头发主色', placeholder: '选择一种主色，保留中分结构', multiline: false },
  {
    key: 'expression',
    label: '神态与手势',
    placeholder: '神态、鸟喙开合，以及自然待机的手势',
    multiline: true,
  },
  {
    key: 'equipment',
    label: '装备与持握方式',
    placeholder: '有什么装备？手怎样握住，或用什么固定？不需要可写“无”',
    multiline: true,
  },
] as const satisfies ReadonlyArray<{
  key: keyof CreationDesign;
  label: string;
  placeholder: string;
  multiline: boolean;
}>;

export const librarianExample: CreationDesign = {
  subject: '小鸟图书管理员',
  outfit: '浅米色衬衫、深蓝针织背心、棕色长裤，衣物层次清楚。',
  face: '浅暖桃色',
  hair: '深棕色，保留中分与两侧垂落主发束。',
  expression: '专注温和，鸟喙自然闭合，双瞳看向观众。自然站立，一只手臂抱书，另一只手自然垂下。',
  equipment: '一本合拢的硬壳书抱在胸侧，手指接触书脊，书本由手臂支撑，不悬浮。',
};

/** Produces a transferable B prompt without mutating the canonical rules or carrying in other images. */
export function buildCreationPrompt(design: CreationDesign, rules: string) {
  if (!design.subject.trim()) throw new Error('请先填写人物或职业。');
  const details = designFields
    .map(({ key, label }) => `${label}：${design[key].trim() || '未指定，按基础规则协调设计。'}`)
    .join('\n');
  return `${rules.trim()}\n\n## 本次人物设计\n\n${details}\n\n本次设计在上述B基础规则内实现；生成前请检查设计与基础规则是否一致。\n`;
}

/** The saved plan preserves the exact edited prompt alongside the source design and reference notice. */
export function exportCreationPlan(design: CreationDesign, prompt: string) {
  const details = designFields
    .map(({ key, label }) => `- ${label}：${design[key].trim() || '未填写'}`)
    .join('\n');
  return `# IKUN-Q 创作方案\n\n用途：B精细主形象；这是创作准备文件，尚未生成或提交作品。\n\n## 设计记录\n\n设计与提示词分别保留；手动修改后请检查两者是否一致。\n\n${details}\n\n## 本次提示词（保留手动编辑）\n\n${prompt}\n\n## 参考与后续\n\n唯一图像输入：完整原始小鸟 ikun-original.webp（1000 × 986 WebP）。\nSHA-256：65b1896579061665848ec122659d63e06b6350237976d21a430e4ed371f48f39\n下载与使用说明：https://github.com/cixiangtao/ikun-q/blob/main/REFERENCE_USE.md\n基础规则：https://github.com/cixiangtao/ikun-q/blob/main/CREATION_RULES.md\n\n在自己的AI工具中上传完整原图，再粘贴提示词。原图按公开下载、社区AI生成／改编及结果社区展示范围提供，与代码MIT分开。生成后请记录实际尺寸、制作工具、输入来源与修改范围，检查身份、造型和结构；生成不自动代表定稿或收录。\n`;
}
