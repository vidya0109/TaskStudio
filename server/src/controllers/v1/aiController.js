import asyncHandler from "../../utils/asyncHandler.js";
import {
  buildCodeIndex,
  askFromCodeIndexAgentStream
} from "../../services/v1/aiService.js";

export const indexCodebase = asyncHandler(async (_req, res) => {
  const result = await buildCodeIndex();
  res.status(200).json({ success: true, message: "Codebase indexed successfully", data: result });
});

function initializeSse(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

function sendSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}



export const askCodebaseAgentStream = asyncHandler(async (req, res) => {
  const { question } = req.body || {};
  initializeSse(res);
  try {
    const result = await askFromCodeIndexAgentStream(question, (token) => {
      sendSse(res, "token", { token });
    });
    sendSse(res, "sources", { sources: result.sources || [] });
    sendSse(res, "done", { answer: result.answer || "" });
  } catch (error) {
    sendSse(res, "error", { message: error?.message || "Streaming failed" });
  } finally {
    res.end();
  }
});