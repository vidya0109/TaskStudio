export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "semantic_search",
      description:
        "Search the indexed codebase for relevant code chunks using semantic similarity. Prefer this for most code-related questions.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find relevant code"
          },
          topK: {
            type: "number",
            description: "Number of chunks to retrieve, between 1 and 10. Defaults to 6."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_source",
      description:
        "Read the exact source code of a specific file chunk by its path and chunk index. Use this when semantic_search has already identified a relevant file and you need its full content.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "File path relative to the repo root, e.g. server/src/services/llmService.js"
          },
          chunkIndex: {
            type: "number",
            description: "Zero-based index of the chunk within that file"
          }
        },
        required: ["filePath", "chunkIndex"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "github_commits",
      description:
        "Fetch recent git commit history from GitHub. Use for questions about commit count, recent changes, who made changes, contributors, or git log.",
      parameters: {
        type: "object",
        properties: {
          perPage: {
            type: "number",
            description: "Number of commits to fetch, between 1 and 100. Defaults to 50."
          }
        },
        required: []
      }
    }
  }
];
