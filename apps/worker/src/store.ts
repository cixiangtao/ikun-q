interface CountRow {
  artwork_id: string;
  count: number;
  dislike_count: number;
  favorite_count: number;
}

/** Reads indexed aggregates and only this account's choices, without scanning every vote. */
export async function readLikes(db: D1Database, ids: ReadonlySet<string>, userId?: string) {
  const [counts, own] = await db.batch<{
    artwork_id: string;
    count?: number;
    dislike_count?: number;
    favorite_count?: number;
    value?: number;
  }>([
    db.prepare('SELECT artwork_id, count, dislike_count, favorite_count FROM like_counts'),
    db.prepare('SELECT artwork_id, value FROM likes WHERE user_id = ?').bind(userId ?? ''),
  ]);
  if (!counts || !own) throw new Error('D1 未返回互动快照。');
  const totals = new Map(counts.results.map((row) => [row.artwork_id, row]));
  const votes = new Map(own.results.map((row) => [row.artwork_id, row.value]));
  return Object.fromEntries(
    [...ids].map((id) => [
      id,
      {
        count: totals.get(id)?.count ?? 0,
        dislikeCount: totals.get(id)?.dislike_count ?? 0,
        favoriteCount: totals.get(id)?.favorite_count ?? 0,
        liked: votes.get(id) === 1,
        disliked: votes.get(id) === -1,
      },
    ]),
  );
}

/** A unique row plus triggers makes positive/neutral/negative transitions atomic and idempotent. */
export async function setVote(db: D1Database, id: string, userId: string, value: -1 | 0 | 1) {
  const mutation = value
    ? db
        .prepare(
          'INSERT INTO likes (artwork_id, user_id, value) VALUES (?, ?, ?) ON CONFLICT (artwork_id, user_id) DO UPDATE SET value = excluded.value WHERE value <> excluded.value',
        )
        .bind(id, userId, value)
    : db.prepare('DELETE FROM likes WHERE artwork_id = ? AND user_id = ?');
  const [, state] = await db.batch<CountRow & { own_value: number }>([
    value ? mutation : mutation.bind(id, userId),
    db
      .prepare(`
      SELECT COALESCE((SELECT count FROM like_counts WHERE artwork_id = ?), 0) AS count,
             COALESCE((SELECT dislike_count FROM like_counts WHERE artwork_id = ?), 0) AS dislike_count,
             COALESCE((SELECT favorite_count FROM like_counts WHERE artwork_id = ?), 0) AS favorite_count,
             COALESCE((SELECT value FROM likes WHERE artwork_id = ? AND user_id = ?), 0) AS own_value
    `)
      .bind(id, id, id, id, userId),
  ]);
  const row = state?.results[0];
  if (!row) throw new Error('D1 未返回点赞结果。');
  return {
    count: Number(row.count),
    dislikeCount: Number(row.dislike_count),
    favoriteCount: Number(row.favorite_count),
    liked: row.own_value === 1,
    disliked: row.own_value === -1,
  };
}

/** Private, newest-first image IDs; unpublished images never escape through saved collections. */
export async function readFavorites(db: D1Database, ids: ReadonlySet<string>, userId?: string) {
  if (!userId) return [];
  const { results } = await db
    .prepare(
      'SELECT artwork_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC, artwork_id',
    )
    .bind(userId)
    .all<{ artwork_id: string }>();
  return results.map((row) => row.artwork_id).filter((id) => ids.has(id));
}

/** Returns an authoritative snapshot from the same transaction as the idempotent save/remove. */
export async function setFavorite(
  db: D1Database,
  ids: ReadonlySet<string>,
  id: string,
  userId: string,
  favorited: boolean,
) {
  const mutation = favorited
    ? db.prepare('INSERT OR IGNORE INTO favorites (artwork_id, user_id) VALUES (?, ?)')
    : db.prepare('DELETE FROM favorites WHERE artwork_id = ? AND user_id = ?');
  const [, saved, counts] = await db.batch<{ artwork_id: string; favorite_count?: number }>([
    mutation.bind(id, userId),
    db
      .prepare(
        'SELECT artwork_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC, artwork_id',
      )
      .bind(userId),
    db.prepare('SELECT favorite_count FROM like_counts WHERE artwork_id = ?').bind(id),
  ]);
  if (!saved || !counts) throw new Error('D1 未返回收藏快照。');
  const favorites = saved.results.map((row) => row.artwork_id).filter((key) => ids.has(key));
  return {
    favorites,
    favorited: favorites.includes(id),
    favoriteCount: counts.results[0]?.favorite_count ?? 0,
  };
}
