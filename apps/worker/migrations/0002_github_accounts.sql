-- IKUN同学已确认：网站尚未正式发布，旧匿名点赞从零开始。
-- Authentication schema generated with Better Auth 1.7.17 (SQLite/D1).
CREATE TABLE auth_user (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, emailVerified INTEGER NOT NULL, image TEXT, createdAt DATE NOT NULL, updatedAt DATE NOT NULL);
CREATE TABLE auth_session (id TEXT NOT NULL PRIMARY KEY, expiresAt DATE NOT NULL, token TEXT NOT NULL UNIQUE, createdAt DATE NOT NULL, updatedAt DATE NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE);
CREATE TABLE auth_account (id TEXT NOT NULL PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt DATE, refreshTokenExpiresAt DATE, scope TEXT, password TEXT, createdAt DATE NOT NULL, updatedAt DATE NOT NULL);
CREATE TABLE auth_verification (id TEXT NOT NULL PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt DATE NOT NULL, createdAt DATE NOT NULL, updatedAt DATE NOT NULL);
CREATE INDEX auth_session_userId_idx ON auth_session(userId);
CREATE INDEX auth_account_userId_idx ON auth_account(userId);
CREATE UNIQUE INDEX auth_account_provider_identity ON auth_account(providerId, accountId);
CREATE INDEX auth_verification_identifier_idx ON auth_verification(identifier);

DROP TRIGGER likes_insert_count;
DROP TRIGGER likes_delete_count;
DROP TABLE likes;
DELETE FROM like_counts;
CREATE TABLE likes (artwork_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (artwork_id, user_id)) WITHOUT ROWID;
CREATE INDEX likes_by_user ON likes(user_id, artwork_id);
CREATE TRIGGER likes_insert_count AFTER INSERT ON likes BEGIN INSERT INTO like_counts (artwork_id, count) VALUES (NEW.artwork_id, 1) ON CONFLICT (artwork_id) DO UPDATE SET count = count + 1; END;
CREATE TRIGGER likes_delete_count AFTER DELETE ON likes BEGIN UPDATE like_counts SET count = count - 1 WHERE artwork_id = OLD.artwork_id; END;
