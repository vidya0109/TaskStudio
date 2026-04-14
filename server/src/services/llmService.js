import OpenAI from "openai";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";
import { agentAnswerSchema } from "../schemas/agentAnswerSchema.js";

const client = new OpenAI({
  apiKey: env.openAiApiKey,
  baseURL: env.llmBaseUrl
});

function requireApiKey() {
  if (!env.openAiApiKey) {
    throw new AppError("Missing OPENAI_API_KEY in environment", 500);
  }
}

async function streamAnswer({ systemPrompt, userPrompt, onToken }) {
  requireApiKey();
  const stream = await client.chat.completions.create({
    model: env.llmModel,
    temperature: 0.1,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  let fullText = "";
  for await (const part of stream) {
    const token = part?.choices?.[0]?.delta?.content || "";
    if (!token) {
      continue;
    }
    fullText += token;
    onToken(token);
  }
  return fullText.trim() || "No answer generated.";
}

export async function generateAgentDecision({ question, scratchpad, step }) {
  requireApiKey();

  const systemPrompt = `
You are a codebase QA agent planner.
You can choose ONE next action:
1) call semantic_search(query, topK) — search indexed codebase for relevant code
2) call read_source(filePath, chunkIndex) — read a specific chunk from the index
3) call github_commits(perPage) — fetch recent git commit history from GitHub
4) return final answer

Use github_commits when the question is about:
- number of commits, recent changes, commit history
- who made changes, when something was added or changed
- git log, contributors, latest updates

Return STRICT JSON with this shape only:
{
  "action": "tool" | "final",
  "toolName": "semantic_search" | "read_source" | "github_commits" | null,
  "toolArgs": {
    "query": "string",
    "topK": 8,
    "filePath": "string",
    "chunkIndex": 0,
    "perPage": 50
  },
  "finalAnswer": "string"
}

Rules:
- Prefer semantic_search for code questions.
- Use github_commits for git/history questions.
- Use read_source only when you need deeper details from a specific source.
- If you already have enough evidence, choose action=final.
- Never output markdown; JSON only.
`.trim();

  const userPrompt = `Question: ${question}
Step: ${step}
Current evidence:
${scratchpad || "No evidence yet."}`;

  const completion = await client.chat.completions.create({
    model: env.llmModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const raw = completion.choices?.[0]?.message?.content?.trim() || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { action: "final", toolName: null, toolArgs: {}, finalAnswer: "I could not parse planner output." };
  }
}

export async function streamAgentFinalAnswer({ question, evidenceText, onToken }) {
  requireApiKey();

  const systemPrompt = `
You are a senior codebase assistant.
Answer ONLY from the provided evidence.
Be concise and accurate.
`.trim();

  const userPrompt = `Question:\n${question}\n\nEvidence:\n${evidenceText}`;

  const stream = await client.chat.completions.create({
    model: env.llmModel,
    temperature: 0.1,
    stream: true,
    response_format: {
      type: "json_schema",
      json_schema: agentAnswerSchema
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  let fullText = "";
  for await (const part of stream) {
    const token = part?.choices?.[0]?.delta?.content || "";
    if (!token) continue;
    fullText += token;
    onToken(token);
  }

  return fullText.trim() || "{}";
}