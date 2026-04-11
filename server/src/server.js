import app from "./app.js";
import env from "./config/env.js";
import { initDb } from "./config/initDb.js";

await initDb();

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
});
