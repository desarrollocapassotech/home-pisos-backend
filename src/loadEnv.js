/**
 * Carga variables de entorno según NODE_ENV
 * QA: .env.development | PROD: .env.production
 */
import dotenv from "dotenv";
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });
dotenv.config(); // .env como fallback
