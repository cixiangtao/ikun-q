-- Preserve existing account likes as positive votes. A row is one account's choice for one image.
ALTER TABLE likes ADD COLUMN value INTEGER NOT NULL DEFAULT 1 CHECK (value IN (-1, 1));
ALTER TABLE like_counts ADD COLUMN dislike_count INTEGER NOT NULL DEFAULT 0 CHECK (dislike_count >= 0);
ALTER TABLE like_counts ADD COLUMN favorite_count INTEGER NOT NULL DEFAULT 0 CHECK (favorite_count >= 0);
DROP TRIGGER likes_insert_count;
DROP TRIGGER likes_delete_count;
CREATE TRIGGER likes_insert_count AFTER INSERT ON likes BEGIN INSERT INTO like_counts (artwork_id, count, dislike_count) VALUES (NEW.artwork_id, NEW.value = 1, NEW.value = -1) ON CONFLICT (artwork_id) DO UPDATE SET count = count + excluded.count, dislike_count = dislike_count + excluded.dislike_count; END;
CREATE TRIGGER likes_delete_count AFTER DELETE ON likes BEGIN UPDATE like_counts SET count = count - (OLD.value = 1), dislike_count = dislike_count - (OLD.value = -1) WHERE artwork_id = OLD.artwork_id; END;
CREATE TRIGGER likes_update_count AFTER UPDATE OF value ON likes WHEN OLD.value <> NEW.value BEGIN UPDATE like_counts SET count = count + (NEW.value = 1) - (OLD.value = 1), dislike_count = dislike_count + (NEW.value = -1) - (OLD.value = -1) WHERE artwork_id = NEW.artwork_id; END;

CREATE TABLE favorites (artwork_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), PRIMARY KEY (artwork_id, user_id)) WITHOUT ROWID;
CREATE INDEX favorites_by_user ON favorites(user_id, created_at DESC, artwork_id);
CREATE TRIGGER favorites_insert_count AFTER INSERT ON favorites BEGIN INSERT INTO like_counts (artwork_id, count, favorite_count) VALUES (NEW.artwork_id, 0, 1) ON CONFLICT (artwork_id) DO UPDATE SET favorite_count = favorite_count + 1; END;
CREATE TRIGGER favorites_delete_count AFTER DELETE ON favorites BEGIN UPDATE like_counts SET favorite_count = favorite_count - 1 WHERE artwork_id = OLD.artwork_id; END;
