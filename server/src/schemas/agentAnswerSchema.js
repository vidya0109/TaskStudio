export const agentAnswerSchema = {
    name: "agent_answer",
    strict: true,
    schema: {
      type: "object",
      properties: {
        answer: {
          type: "array",
          items: { type: "string" },
          description: "2-5 concise bullet points answering the question"
        },
        codePointers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              file: { type: "string" },
              reason: { type: "string" }
            },
            required: ["file", "reason"],
            additionalProperties: false
          },
          description: "Relevant files and why they matter"
        },
        confidence: {
          type: "string",
          enum: ["High", "Medium", "Low"]
        },
        confidenceReason: { type: "string" }
      },
      required: ["answer", "codePointers", "confidence", "confidenceReason"],
      additionalProperties: false
    }
  };