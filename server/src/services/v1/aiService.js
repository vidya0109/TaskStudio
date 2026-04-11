import fs from "fs/promises";
import path from "path";
import {
  generateAgentDecision,
  generateAgentFinalAnswer,
  generateGroundedAnswer,
  streamAgentFinalAnswer,
  streamGroundedAnswer
} from "../llmService.js";
import { embedMany, embedQuery, getEmbeddingModelName } from "../embeddingService.js";
import { fileURLToPath } from "url";
import pool from "../../config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const SCAN_DIRS = [
  path.join(PROJECT_ROOT, "client/src"),
  path.join(PROJECT_ROOT, "server/src")
];
const ALLOWED_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".md"]);
const RETRIEVAL_CANDIDATE_LIMIT = 20;
const FINAL_CONTEXT_LIMIT = 5;
const AGENT_MAX_STEPS = 3;

// ---------------------------------------------------------------------------
// File walking + chunking
// ---------------------------------------------------------------------------

async function walkFiles(dirPath, fileList = []) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await walkFiles(fullPath, fileList);
      continue;
    }

    const ext = path.extname(entry.name);
    if (ALLOWED_EXTENSIONS.has(ext)) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

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
  const allFiles = [];

  for (const dir of SCAN_DIRS) {
    try {
      const files = await walkFiles(dir);
      allFiles.push(...files);
    } catch {
      // Ignore missing directories during early setup.
    }
  }

  const indexedFiles = [];
  const allChunks = [];

  for (const filePath of allFiles) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const relativePath = path.relative(PROJECT_ROOT, filePath);
      indexedFiles.push(relativePath);
      allChunks.push(...toChunks(content, relativePath));
    } catch {
      // Ignore unreadable files.
    }
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
// RAG — non-streaming
// ---------------------------------------------------------------------------

export async function askFromCodeIndex(question) {
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

  const ranked = await getRankedChunks({ question: normalizedQuestion });

  if (ranked.length === 0) {
    return {
      answer:
        "I could not find relevant code for this question in the current index. Try rephrasing or re-indexing.",
      sources: []
    };
  }

  const sources = ranked.map((chunk) => ({
    filePath: chunk.filePath,
    chunkIndex: chunk.chunkIndex
  }));

  console.log("AI service: invoking LLM with ranked chunks:", ranked.length);
  const answer = await generateGroundedAnswer({
    question: normalizedQuestion,
    contextChunks: ranked
  });

  return { answer, sources };
}

// ---------------------------------------------------------------------------
// RAG — streaming
// ---------------------------------------------------------------------------

export async function askFromCodeIndexStream(question, onToken) {
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

  const ranked = await getRankedChunks({ question: normalizedQuestion });

  if (ranked.length === 0) {
    return {
      answer:
        "I could not find relevant code for this question. Try rephrasing or re-indexing.",
      sources: []
    };
  }

  const sources = ranked.map((chunk) => ({
    filePath: chunk.filePath,
    chunkIndex: chunk.chunkIndex
  }));

  const answer = await streamGroundedAnswer({
    question: normalizedQuestion,
    contextChunks: ranked,
    onToken
  });
  return { answer, sources };
}

// ---------------------------------------------------------------------------
// Agent helpers
// ---------------------------------------------------------------------------

function summarizeToolResult(toolName, result) {
  if (toolName === "semantic_search") {
    return `semantic_search returned ${result.length} chunks:\n${result
      .map(
        (chunk, idx) =>
          `${idx + 1}. ${chunk.filePath}#${chunk.chunkIndex} (score ${chunk.score.toFixed(3)})`
      )
      .join("\n")}`;
  }
  if (toolName === "read_source" && result) {
    return `read_source returned ${result.filePath}#${result.chunkIndex}:\n${String(
      result.text || ""
    ).slice(0, 1200)}`;
  }
  return `${toolName} returned no data`;
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
  const streaming = typeof onToken === "function";

  for (let step = 1; step <= AGENT_MAX_STEPS; step += 1) {
    const scratchpad = evidence.map((e, i) => `Step ${i + 1}: ${e}`).join("\n\n");
    const decision = await generateAgentDecision({ question, scratchpad, step });

    if (decision?.action === "final") {
      const evidenceText = evidence.join("\n\n");
      const answer =
        decision?.finalAnswer?.trim() ||
        (streaming
          ? await streamAgentFinalAnswer({ question, evidenceText, onToken })
          : await generateAgentFinalAnswer({ question, evidenceText }));

      if (decision?.finalAnswer?.trim() && streaming) {
        onToken(decision.finalAnswer.trim());
      }

      return { answer, sources: Array.from(sourcesMap.values()) };
    }

    if (decision?.toolName === "semantic_search") {
      const toolQuery = String(decision?.toolArgs?.query || question).trim();
      const topK = Math.min(Math.max(Number(decision?.toolArgs?.topK || 6), 1), 10);
      const ranked = await getRankedChunks({
        question: toolQuery || question,
        limit: topK
      });
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

    evidence.push("Planner returned an unknown action. Proceeding to final answer.");
    break;
  }

  const answer = streaming
    ? await streamAgentFinalAnswer({ question, evidenceText: evidence.join("\n\n"), onToken })
    : await generateAgentFinalAnswer({ question, evidenceText: evidence.join("\n\n") });

  return { answer, sources: Array.from(sourcesMap.values()) };
}

// ---------------------------------------------------------------------------
// Agent — non-streaming
// ---------------------------------------------------------------------------

export async function askFromCodeIndexAgent(question) {
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

  return runAgentLoop(normalizedQuestion, null);
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
