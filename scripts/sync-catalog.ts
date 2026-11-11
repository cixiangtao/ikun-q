import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncCatalog } from './catalog-sync.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const count = await syncCatalog(root);
console.info(`已同步 ${count} 张明确选择的图鉴图片（展示状态与定稿状态独立）。`);
