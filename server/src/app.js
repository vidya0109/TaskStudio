import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import env from "./config/env.js";
import v1Routes from "./routes/v1/index.js";
import errorHandler from "./middlewares/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: env.corsOrigin
  })
);
app.use(express.json());
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// API routes
app.use("/api", v1Routes);

// Serve React client static files
app.use(express.static(CLIENT_DIST));

// Catch-all: let React Router handle client-side routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(CLIENT_DIST, "index.html"));
});

app.use(errorHandler);

export default app;
