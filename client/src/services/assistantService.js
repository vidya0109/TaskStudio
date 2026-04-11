import httpClient from "./http/httpClient";
import { API_BASE_URL } from "../utils/env";

const INDEX_TIMEOUT_MS = 120000;
const ASK_TIMEOUT_MS = 30000;
const AGENT_TIMEOUT_MS = 90000;

export async function indexCodebase() {
  const { data } = await httpClient.post("/ai/index", {}, { timeout: INDEX_TIMEOUT_MS });
  return data;
}

export async function askCodebase(question) {
  const { data } = await httpClient.post("/ai/ask", { question }, { timeout: ASK_TIMEOUT_MS });
  return data;
}

export async function askCodebaseAgent(question) {
  const { data } = await httpClient.post(
    "/ai/agent",
    { question },
    { timeout: AGENT_TIMEOUT_MS }
  );
  return data;
}

export async function streamAskCodebase({
  question,
  mode,
  onToken,
  onSources,
  onDone,
  onError
}) {
  const endpoint = mode === "agent" ? "/ai/agent/stream" : "/ai/ask/stream";
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });

  if (!response.ok || !response.body) {
    throw new Error(`Streaming request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const eventMatch = frame.match(/^event:\s*(.+)$/m);
      const dataMatch = frame.match(/^data:\s*(.+)$/m);
      if (!eventMatch || !dataMatch) {
        continue;
      }

      const event = eventMatch[1].trim();
      let payload = {};
      try {
        payload = JSON.parse(dataMatch[1]);
      } catch {
        payload = {};
      }

      if (event === "token") {
        onToken?.(payload.token || "");
      } else if (event === "sources") {
        onSources?.(payload.sources || []);
      } else if (event === "done") {
        onDone?.(payload.answer || "");
      } else if (event === "error") {
        onError?.(payload.message || "Streaming failed");
      }
    }
  }
}