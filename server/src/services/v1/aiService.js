import {
  generateAgentDecision,
  streamAgentFinalAnswer
} from "../llmService.js";
import { embedMany, embedQuery, getEmbeddingModelName } from "../embeddingService.js";
import { fetchRepoFiles, fetchFileContent,fetchCommits } from "../githubService.js";
import pool from "../../config/db.js";
import env from "../../config/env.js";
const RETRIEVAL_CANDIDATE_LIMIT = 20;
const FINAL_CONTEXT_LIMIT = 5;
const AGENT_MAX_STEPS = 3;

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

function toChunks(content, filePath, chunkSize = 1200) {
  const chunks = [];

  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push({
      filePath,
      chunkIndex: chunks.length,
      text: content.slice(i, i + chunkSize)
    });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Reranking helpers (applied after pgvector retrieves semantic candidates)
// ---------------------------------------------------------------------------

function tokenizeForRerank(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function rerankChunk({ questionTokens, chunk, semanticScore }) {
  const text = String(chunk.text || "").toLowerCase();
  const filePath = String(chunk.filePath || "").toLowerCase();

  let lexicalHits = 0;
  for (const token of questionTokens) {
    if (text.includes(token)) lexicalHits += 1;
    if (filePath.includes(token)) lexicalHits += 1.5;
  }

  const hasCodeSignals =
    /function\s|\bexport\b|\bclass\b|=>|router\.|app\.use|async\s/.test(text);
  const codeSignalBoost = hasCodeSignals ? 0.03 : 0;

  const questionText = questionTokens.join(" ");
  const backendHint =
    /backend|server|api|route|controller|service/.test(questionText) &&
    filePath.startsWith("server/")
      ? 0.02
      : 0;
  const frontendHint =
    /frontend|client|react|component|page|ui/.test(questionText) &&
    filePath.startsWith("client/")
      ? 0.02
      : 0;

  const lexicalBoost = Math.min(lexicalHits, 8) * 0.01;

  return semanticScore + lexicalBoost + codeSignalBoost + backendHint + frontendHint;
}

// ---------------------------------------------------------------------------
// pgvector retrieval
// ---------------------------------------------------------------------------

async function hasIndexedChunks() {
  const { rows } = await pool.query(
    "SELECT 1 FROM code_chunks WHERE embedding IS NOT NULL LIMIT 1"
  );
  return rows.length > 0;
}

async function getRankedChunks({ question, limit = FINAL_CONTEXT_LIMIT }) {
  const questionEmbedding = await embedQuery(question);
  const questionTokens = tokenizeForRerank(question);

  // pgvector cosine distance operator <=> returns values in [0, 2]; lower = more similar.
  const { rows } = await pool.query(
    `SELECT
       file_path   AS "filePath",
       chunk_index AS "chunkIndex",
       text,
       1 - (embedding <=> $1::vector) AS "semanticScore"
     FROM code_chunks
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [`[${questionEmbedding.join(",")}]`, RETRIEVAL_CANDIDATE_LIMIT]
  );

  return rows
    .map((chunk) => ({
      ...chunk,
      score: rerankChunk({ questionTokens, chunk, semanticScore: chunk.semanticScore })
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Build index (scan → embed → upsert into postgres)
// ---------------------------------------------------------------------------

export async function buildCodeIndex() {
  const filePaths = await fetchRepoFiles();
  console.log(`GitHub: found ${filePaths.length} files to index`);

  const indexedFiles = [];
  const allChunks = [];

  for (const filePath of filePaths) {
    const content = await fetchFileContent(filePath);
    if (!content) continue;
    indexedFiles.push(filePath);
    allChunks.push(...toChunks(content, filePath));
  }

  const chunkTexts = allChunks.map((chunk) => chunk.text);
  const embeddings = chunkTexts.length > 0 ? await embedMany(chunkTexts) : [];

  // Clear stale chunks then bulk-upsert fresh ones inside a transaction.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM code_chunks");

    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      const embedding = embeddings[i];
      await client.query(
        `INSERT INTO code_chunks (file_path, chunk_index, text, embedding)
         VALUES ($1, $2, $3, $4::vector)
         ON CONFLICT (file_path, chunk_index)
         DO UPDATE SET text = $3, embedding = $4::vector, indexed_at = NOW()`,
        [
          chunk.filePath,
          chunk.chunkIndex,
          chunk.text,
          `[${embedding.join(",")}]`
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return {
    fileCount: indexedFiles.length,
    chunkCount: allChunks.length,
    embeddingModel: getEmbeddingModelName()
  };
}

// ---------------------------------------------------------------------------
// Agent helpers
// ---------------------------------------------------------------------------

function summarizeToolResult(toolName, result) {
  if (toolName === "semantic_search") {
    if (!result.length) return "semantic_search returned no results.";
    return `semantic_search returned ${result.length} chunks:\n${result
      .map(
        (chunk, idx) =>
          `--- chunk ${idx + 1}: ${chunk.filePath}#${chunk.chunkIndex} (score ${chunk.score.toFixed(3)}) ---\n${String(chunk.text || "").slice(0, 600)}`
      )
      .join("\n\n")}`;
  }
  if (toolName === "read_source" && result) {
    return `read_source returned ${result.filePath}#${result.chunkIndex}:\n${String(
      result.text || ""
    ).slice(0, 1200)}`;
  }
  return `${toolName} returned no data`;
}

function summarizeCommits(commits) {
  if (!commits || commits.length === 0) {
    return "github_commits returned no commits.";
  }
  const lines = commits.map(
    (c) => `- [${c.sha}] ${c.date.slice(0, 10)} ${c.author}: ${c.message}`
  );
  return `github_commits returned ${commits.length} commits:\n${lines.join("\n")}`;
}


async function fetchChunkByCoords(filePath, chunkIndex) {
  const { rows } = await pool.query(
    `SELECT file_path AS "filePath", chunk_index AS "chunkIndex", text
     FROM code_chunks
     WHERE file_path = $1 AND chunk_index = $2
     LIMIT 1`,
    [filePath, chunkIndex]
  );
  return rows[0] || null;
}

async function runAgentLoop(question, onToken) {
  const evidence = [];
  const sourcesMap = new Map();

  for (let step = 1; step <= AGENT_MAX_STEPS; step += 1) {
    const scratchpad = evidence.map((e, i) => `Step ${i + 1}: ${e}`).join("\n\n");
    const decision = await generateAgentDecision({ question, scratchpad, step });

    if (decision?.action === "final") {
      const evidenceText = evidence.join("\n\n");
      const answer = await streamAgentFinalAnswer({ question, evidenceText, onToken });
      return { answer, sources: Array.from(sourcesMap.values()) };
    }

    if (decision?.toolName === "semantic_search") {
      const toolQuery = String(decision?.toolArgs?.query || question).trim();
      const topK = Math.min(Math.max(Number(decision?.toolArgs?.topK || 6), 1), 10);
      const ranked = await getRankedChunks({ question: toolQuery || question, limit: topK });
      for (const chunk of ranked) {
        const key = `${chunk.filePath}#${chunk.chunkIndex}`;
        if (!sourcesMap.has(key)) {
          sourcesMap.set(key, { filePath: chunk.filePath, chunkIndex: chunk.chunkIndex });
        }
      }
      evidence.push(summarizeToolResult("semantic_search", ranked));
      continue;
    }

    if (decision?.toolName === "read_source") {
      const filePath = String(decision?.toolArgs?.filePath || "").trim();
      const chunkIndex = Number(decision?.toolArgs?.chunkIndex);
      const hit = await fetchChunkByCoords(filePath, chunkIndex);
      if (hit) {
        const key = `${hit.filePath}#${hit.chunkIndex}`;
        if (!sourcesMap.has(key)) {
          sourcesMap.set(key, { filePath: hit.filePath, chunkIndex: hit.chunkIndex });
        }
      }
      evidence.push(summarizeToolResult("read_source", hit));
      continue;
    }

    if (decision?.toolName === "github_commits") {
      const perPage = Math.min(Math.max(Number(decision?.toolArgs?.perPage || 50), 1), 100);
      const commits = await fetchCommits(env.githubRepo, env.githubBranch, perPage);
      evidence.push(summarizeCommits(commits));
      continue;
    }

    evidence.push("Planner returned an unknown action. Proceeding to final answer.");
    break;
  }

  const answer = await streamAgentFinalAnswer({
    question,
    evidenceText: evidence.join("\n\n"),
    onToken
  });
  return { answer, sources: Array.from(sourcesMap.values()) };
}

// ---------------------------------------------------------------------------
// Agent — streaming
// ---------------------------------------------------------------------------

export async function askFromCodeIndexAgentStream(question, onToken) {
  const normalizedQuestion = String(question || "").trim();
  if (!normalizedQuestion) {
    return { answer: "Please provide a non-empty question.", sources: [] };
  }

  if (!(await hasIndexedChunks())) {
    return {
      answer: "No indexed chunks found. Run POST /api/ai/index first.",
      sources: []
    };
  }

  return runAgentLoop(normalizedQuestion, onToken);
}
