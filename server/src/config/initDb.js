import pool from "./db.js";

export async function initDb() {
  // Enable pgvector extension (requires pgvector to be installed in Postgres).
  await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id        SERIAL PRIMARY KEY,
      title     TEXT        NOT NULL,
      completed BOOLEAN     NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // text-embedding-3-small produces 1536-dimensional vectors.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS code_chunks (
      id          SERIAL PRIMARY KEY,
      file_path   TEXT        NOT NULL,
      chunk_index INTEGER     NOT NULL,
      text        TEXT        NOT NULL,
      embedding   vector(1536),
      indexed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (file_path, chunk_index)
    )
  `);

  // IVFFlat index for approximate nearest-neighbour search (built after data is loaded).
  await pool.query(`
    CREATE INDEX IF NOT EXISTS code_chunks_embedding_idx
    ON code_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `);

  console.log("Database schema ready");
}
