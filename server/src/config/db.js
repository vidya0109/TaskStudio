import pg from "pg";
import env from "./env.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.databaseUrl
});

pool.on("error", (err) => {
  console.error("Unexpected pg pool error:", err.message);
});

export default pool;
