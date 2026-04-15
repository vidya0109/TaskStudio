import OpenAI from "openai";
import env from "../config/env.js";
import AppError from "../utils/AppError.js";
import { agentAnswerSchema } from "../schemas/agentAnswerSchema.js";
import { AGENT_TOOLS } from "../schemas/agentTools.js";

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
Use the available tools to gather evidence before answering.
- Prefer semantic_search for most code questions.
- Use read_source when you already know which file to inspect.
- Use github_commits for questions about commit history or recent changes.
- If you already have enough evidence, do not call any tool — just respond without a tool call.
`.trim();

  const userPrompt = `Question: ${question}
Step: ${step}
Current evidence:
${scratchpad || "No evidence yet."}`;

  const completion = await client.chat.completions.create({
    model: env.llmModel,
    temperature: 0,
    tools: AGENT_TOOLS,
    tool_choice: "auto",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  const message = completion.choices?.[0]?.message;
  const finishReason = completion.choices?.[0]?.finish_reason;

  if (finishReason === "tool_calls" && message?.tool_calls?.length > 0) {
    const toolCall = message.tool_calls[0];
    let toolArgs = {};
    try {
      toolArgs = JSON.parse(toolCall.function.arguments || "{}");
    } catch {
      toolArgs = {};
    }
    return { action: "tool", toolName: toolCall.function.name, toolArgs };
  }

  return { action: "final", toolName: null, toolArgs: {} };
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