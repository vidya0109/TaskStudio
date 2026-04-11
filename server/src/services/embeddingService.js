import OpenAI from "openai";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";

/**
 * OpenAI client for embeddings (same key + base URL as chat completions).
 * Model default: text-embedding-3-small — good cost/quality for code RAG.
 */
const client = new OpenAI({
  apiKey: env.openAiApiKey,
  baseURL: env.llmBaseUrl
});

/** Max inputs per embeddings request (stay under token limits per batch). */
const BATCH_SIZE = 64;

function requireApiKey() {
  if (!env.openAiApiKey) {
    throw new AppError("Missing OPENAI_API_KEY in environment", 500);
  }
}

/**
 * Embed a single query string (e.g. user question). Used at ask-time in Phase 1.2+.
 */
export async function embedQuery(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new AppError("Query text is required for embedding", 400);
  }
  requireApiKey();
  const vectors = await embedManyInternal([trimmed]);
  return vectors[0];
}

/**
 * Embed many strings in order (e.g. all chunks at index time). Phase 1.2 will call this from buildCodeIndex.
 */
export async function embedMany(texts) {
  requireApiKey();
  const trimmed = texts.map((t) => String(t ?? "").trim());
  if (trimmed.length === 0) {
    return [];
  }
  if (trimmed.some((s) => s.length === 0)) {
    throw new AppError("Empty strings are not allowed in embedding batch", 400);
  }
  return embedManyInternal(trimmed);
}

async function embedManyInternal(inputs) {
  const all = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: env.openAiEmbeddingModel,
      input: batch
    });
    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    for (const row of sorted) {
      all.push(row.embedding);
    }
  }
  return all;
}

/** Exposed for logs/tests — which model Phase 1 uses. */
export function getEmbeddingModelName() {
  return env.openAiEmbeddingModel;
}
