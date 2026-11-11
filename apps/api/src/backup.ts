import { DatabaseSync, backup } from 'node:sqlite';
import { access, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const destination = process.argv[2];
if (!destination) throw new Error('请指定新的备份文件路径。');
const target = resolve(destination);
await mkdir(dirname(target), { recursive: true });
const exists = await access(target).then(
  () => true,
  () => false,
);
if (exists) throw new Error('备份文件已存在，请使用新的文件名。');
const source = process.env.DATABASE_PATH ?? new URL('../../../data/likes.sqlite', import.meta.url);
const db = new DatabaseSync(source, { readOnly: true });
try {
  // The backup API also includes committed WAL data while the live service is running.
  await backup(db, target);
  console.info(`点赞数据库已备份到 ${target}`);
} finally {
  db.close();
}
