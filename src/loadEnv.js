/**
 * Carga variables de entorno según NODE_ENV.
 * Orden: archivo del entorno → .env (fallback local).
 *
 * NODE_ENV=production → .env.production
 * NODE_ENV=qa         → .env.qa
 * otro / sin definir  → .env.development
 */
import dotenv from "dotenv";

const ENV_FILES = {
  production: ".env.production",
  qa: ".env.qa",
  development: ".env.development",
};

const nodeEnv = process.env.NODE_ENV || "development";
const envFile = ENV_FILES[nodeEnv] ?? ENV_FILES.development;

dotenv.config({ path: envFile });
dotenv.config();
