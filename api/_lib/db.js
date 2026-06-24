import { neon } from "@neondatabase/serverless";

let initialized = false;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error("Database connection is not configured");
  return neon(databaseUrl);
}

export async function ensureSchema() {
  if (initialized) return;
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(30) NOT NULL,
      username_key VARCHAR(30) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(10) NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS predictions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      scores JSONB NOT NULL,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, round_number)
    )
  `;

  await sql`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`;
  await sql`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`;
  await sql`UPDATE predictions SET created_at = submitted_at WHERE created_at IS NULL`;
  await sql`UPDATE predictions SET updated_at = submitted_at WHERE updated_at IS NULL`;
  await sql`ALTER TABLE predictions ALTER COLUMN created_at SET DEFAULT NOW()`;
  await sql`ALTER TABLE predictions ALTER COLUMN updated_at SET DEFAULT NOW()`;

  await sql`
    CREATE TABLE IF NOT EXISTS round_scores (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      points INTEGER NOT NULL CHECK (points >= 0),
      source VARCHAR(10) NOT NULL DEFAULT 'manual',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, round_number)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS prediction_events (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      home TEXT NOT NULL,
      away TEXT NOT NULL,
      action VARCHAR(10) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS prediction_events_user_match_idx
    ON prediction_events (user_id, match_id, created_at)
  `;

  initialized = true;
}
