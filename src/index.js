import "./loadEnv.js";
import { validateEnvAtStartup } from "./config/validateEnv.js";
import app from "./app.js";
import { config } from "./config/index.js";

validateEnvAtStartup();

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`[Server] NODE_ENV=${config.nodeEnv} — http://localhost:${PORT}`);
});
