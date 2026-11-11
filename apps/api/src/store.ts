import { DatabaseSync } from 'node:sqlite';

/** Public counts and the current anonymous visitor's selection for one immutable asset ID. */
export interface LikeState {
  count: number;
  liked: boolean;
}

/** A small, single-instance store. SQLite calls stay synchronous and transactions contain no network work. */
export function openLikeStore(path: string) {
  const db = new DatabaseSync(path);
  try {
    const version = db.prepare('PRAGMA user_version').get();
    if (Number(version?.user_version) > 1) throw new Error('数据库版本高于当前服务支持的版本。');
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS likes (
        artwork_id TEXT NOT NULL,
        visitor_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (artwork_id, visitor_id)
      ) WITHOUT ROWID;
      PRAGMA user_version = 1;
    `);
    const summary = db.prepare(`
      SELECT artwork_id, COUNT(*) AS count, MAX(visitor_id = ?) AS liked
      FROM likes GROUP BY artwork_id
    `);
    const single = db.prepare(`
      SELECT COUNT(*) AS count, COALESCE(MAX(visitor_id = ?), 0) AS liked
      FROM likes WHERE artwork_id = ?
    `);
    const insert = db.prepare('INSERT OR IGNORE INTO likes (artwork_id, visitor_id) VALUES (?, ?)');
    const remove = db.prepare('DELETE FROM likes WHERE artwork_id = ? AND visitor_id = ?');
    return {
      readAll(ids: ReadonlySet<string>, visitor: string): Record<string, LikeState> {
        const result: Record<string, LikeState> = Object.fromEntries(
          [...ids].map((id) => [id, { count: 0, liked: false }]),
        );
        for (const row of summary.all(visitor)) {
          const id = String(row.artwork_id);
          if (ids.has(id)) result[id] = { count: Number(row.count), liked: Boolean(row.liked) };
        }
        return result;
      },
      set(id: string, visitor: string, liked: boolean): LikeState {
        if (liked) insert.run(id, visitor);
        else remove.run(id, visitor);
        const row = single.get(visitor, id);
        return { count: Number(row?.count ?? 0), liked: Boolean(row?.liked) };
      },
      close: () => db.close(),
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
