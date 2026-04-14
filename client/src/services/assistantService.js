import httpClient from "./http/httpClient";
import { API_BASE_URL } from "../utils/env";

const INDEX_TIMEOUT_MS = 120000;

export async function indexCodebase() {
  const { data } = await httpClient.post("/ai/index", {}, { timeout: INDEX_TIMEOUT_MS });
  return data;
}

export async function streamAskCodebase({
  question,
  onToken,
  onSources,
  onDone,
  onError
}) {
  const response = await fetch(`${API_BASE_URL}/ai/agent/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true"
    },
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
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const eventMatch = frame.match(/^event:\s*(.+)$/m);
      const dataMatch = frame.match(/^data:\s*(.+)$/m);
      if (!eventMatch || !dataMatch) continue;

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
