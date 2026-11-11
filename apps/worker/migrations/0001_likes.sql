CREATE TABLE IF NOT EXISTS likes (artwork_id TEXT NOT NULL, visitor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (artwork_id, visitor_id)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS likes_by_visitor ON likes (visitor_id, artwork_id);
CREATE TABLE IF NOT EXISTS like_counts (artwork_id TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK (count >= 0)) WITHOUT ROWID;
INSERT OR REPLACE INTO like_counts (artwork_id, count) SELECT artwork_id, COUNT(*) FROM likes GROUP BY artwork_id;
CREATE TRIGGER IF NOT EXISTS likes_insert_count AFTER INSERT ON likes BEGIN INSERT INTO like_counts (artwork_id, count) VALUES (NEW.artwork_id, 1) ON CONFLICT (artwork_id) DO UPDATE SET count = count + 1; END;
CREATE TRIGGER IF NOT EXISTS likes_delete_count AFTER DELETE ON likes BEGIN UPDATE like_counts SET count = count - 1 WHERE artwork_id = OLD.artwork_id; END;
