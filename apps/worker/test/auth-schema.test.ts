import { expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { getMigrations } from 'better-auth/db/migration';
import { authModels } from '../src/auth.ts';

it('keeps the checked-in D1 authentication schema compatible with the pinned auth library', async () => {
  const database = new DatabaseSync(':memory:');
  try {
    for (const name of [
      '0001_likes.sql',
      '0002_github_accounts.sql',
      '0003_votes_and_favorites.sql',
    ]) {
      database.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    }
    const plan = await getMigrations({ ...authModels, database });
    expect(plan.toBeCreated).toEqual([]);
    expect(plan.toBeAdded).toEqual([]);
    expect(plan.toBeAddedIndexes).toEqual([]);
    expect(plan.schemaProblems).toEqual([]);
  } finally {
    database.close();
  }
});

it('upgrades existing account likes without resetting users or votes', async () => {
  const database = new DatabaseSync(':memory:');
  try {
    for (const name of ['0001_likes.sql', '0002_github_accounts.sql']) {
      database.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    }
    database.exec(
      "INSERT INTO auth_user(id, name, email, emailVerified, createdAt, updatedAt) VALUES ('existing-user', 'Existing', 'existing@example.com', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    );
    database.exec(
      "INSERT INTO likes(artwork_id, user_id) VALUES ('existing-image', 'existing-user')",
    );
    database.exec(
      await readFile(
        new URL('../migrations/0003_votes_and_favorites.sql', import.meta.url),
        'utf8',
      ),
    );
    expect(database.prepare('SELECT user_id, value FROM likes').get()).toEqual({
      user_id: 'existing-user',
      value: 1,
    });
    expect(
      database.prepare('SELECT count, dislike_count, favorite_count FROM like_counts').get(),
    ).toEqual({ count: 1, dislike_count: 0, favorite_count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM auth_user').get()).toEqual({ count: 1 });
  } finally {
    database.close();
  }
});
