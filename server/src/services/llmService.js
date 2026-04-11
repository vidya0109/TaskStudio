import OpenAI from "openai";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";

const client = new OpenAI({
  apiKey: env.openAiApiKey,
  baseURL: env.llmBaseUrl
});

function requireApiKey() {
  if (!env.openAiApiKey) {
    throw new AppError("Missing OPENAI_API_KEY in environment", 500);
  }
}

export async function generateGroundedAnswer({ question, contextChunks }) {
  requireApiKey();

  const contextText = contextChunks
    .map(
      (chunk, idx) =>
        `Source ${idx + 1} (${chunk.filePath}#${chunk.chunkIndex}):\n${chunk.text}`
    )
    .join("\n\n");

  const systemPrompt = `
You are a senior codebase assistant.
Answer ONLY from the provided sources.

Output format (plain text, exactly these sections):
Answer:
- <2-5 concise bullets with direct answer>

Code pointers:
- [S1] \`path/to/file\` - <what this source proves>
- [S2] \`path/to/file\` - <what this source proves>

Confidence:
- <High|Medium|Low> - <short reason>

Rules:
- Do not paste raw source snippets unless explicitly asked.
- Do not say "implementation details are not provided" if the relevant symbol/file exists in sources.
- If context is insufficient, clearly say what is missing.
- Keep the answer practical and scannable.
`.trim();

  const userPrompt = `Question:\n${question}\n\nContext:\n${contextText}`;

  console.log("LLM called with model:", env.llmModel);


  const completion = await client.chat.completions.create({
    model: env.llmModel,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  return completion.choices?.[0]?.message?.content?.trim() || "No answer generated.";
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

export async function streamGroundedAnswer({ question, contextChunks, onToken }) {
  const contextText = contextChunks
    .map(
      (chunk, idx) =>
        `Source ${idx + 1} (${chunk.filePath}#${chunk.chunkIndex}):\n${chunk.text}`
    )
    .join("\n\n");

  const systemPrompt = `
You are a senior codebase assistant.
Answer ONLY from the provided sources.

Output format (plain text, exactly these sections):
Answer:
- <2-5 concise bullets with direct answer>

Code pointers:
- [S1] \`path/to/file\` - <what this source proves>
- [S2] \`path/to/file\` - <what this source proves>

Confidence:
- <High|Medium|Low> - <short reason>
`.trim();

  const userPrompt = `Question:\n${question}\n\nContext:\n${contextText}`;
  return streamAnswer({ systemPrompt, userPrompt, onToken });
}

export async function generateAgentDecision({ question, scratchpad, step }) {
  requireApiKey();

  const systemPrompt = `
You are a codebase QA agent planner.
You can choose ONE next action:
1) call semantic_search(query, topK)
2) call read_source(filePath, chunkIndex)
3) return final answer

Return STRICT JSON with this shape only:
{
  "action": "tool" | "final",
  "toolName": "semantic_search" | "read_source" | null,
  "toolArgs": {
    "query": "string",
    "topK": 8,
    "filePath": "string",
    "chunkIndex": 0
  },
  "finalAnswer": "string"
}

Rules:
- Prefer semantic_search first.
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

export async function generateAgentFinalAnswer({ question, evidenceText }) {
  requireApiKey();

  const systemPrompt = `
You are a senior codebase assistant.
Answer ONLY from evidence.
Be concise and structured.

Output format:
Answer:
- bullet points

Code pointers:
- \`path/to/file\` - why relevant

Confidence:
- High|Medium|Low - reason
`.trim();

  const userPrompt = `Question:\n${question}\n\nEvidence:\n${evidenceText}`;
  const completion = await client.chat.completions.create({
    model: env.llmModel,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  return completion.choices?.[0]?.message?.content?.trim() || "No answer generated.";
}

export async function streamAgentFinalAnswer({ question, evidenceText, onToken }) {
  const systemPrompt = `
You are a senior codebase assistant.
Answer ONLY from evidence.
Be concise and structured.

Output format:
Answer:
- bullet points

Code pointers:
- \`path/to/file\` - why relevant

Confidence:
- High|Medium|Low - reason
`.trim();

  const userPrompt = `Question:\n${question}\n\nEvidence:\n${evidenceText}`;
  return streamAnswer({ systemPrompt, userPrompt, onToken });
}