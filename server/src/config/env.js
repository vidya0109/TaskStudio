import dotenv from "dotenv";

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number.parseInt(process.env.PORT || "5001", 10),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  llmProvider: process.env.LLM_PROVIDER || "openai",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
  llmBaseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
  // Phase 1 semantic retrieval — same API key/base URL as chat; model is embeddings-only.
  openAiEmbeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  databaseUrl: process.env.DATABASE_URL || `postgresql://${process.env.USER || "postgres"}@localhost:5432/taskstudio`,
  githubToken: process.env.GITHUB_TOKEN || "",
  githubRepo: process.env.GITHUB_REPO || "",
  githubBranch: process.env.GITHUB_BRANCH || "main"
};



export default env;