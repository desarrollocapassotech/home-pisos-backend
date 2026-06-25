/**
 * Configuración centralizada desde process.env.
 * Aliases MP_* mantienen compatibilidad con nombres alternativos.
 * Los fallbacks de URL son solo para desarrollo local.
 */
function trimEnv(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const nodeEnv = trimEnv(process.env.NODE_ENV) || "development";

export const config = {
  nodeEnv,
  isProduction: nodeEnv === "production",
  isQa: nodeEnv === "qa",
  isDevelopment: nodeEnv === "development",

  port: Number(trimEnv(process.env.PORT)) || 3001,

  // Mercado Pago — misma lógica de negocio; solo fuente de credenciales
  mercadopagoAccessToken:
    trimEnv(process.env.MERCADOPAGO_ACCESS_TOKEN) || trimEnv(process.env.MP_ACCESS_TOKEN),
  mercadopagoPublicKey:
    trimEnv(process.env.MERCADOPAGO_PUBLIC_KEY) || trimEnv(process.env.MP_PUBLIC_KEY),
  mercadopagoWebhookSecret: trimEnv(process.env.MERCADOPAGO_WEBHOOK_SECRET),
  mercadopagoClientId: trimEnv(process.env.MERCADOPAGO_CLIENT_ID),
  mercadopagoClientSecret: trimEnv(process.env.MERCADOPAGO_CLIENT_SECRET),

  // URLs públicas del ecosistema
  frontendUrl: trimEnv(process.env.FRONTEND_URL) || "http://localhost:5173",
  backendUrl: trimEnv(process.env.BACKEND_URL) || "http://localhost:3001",
  adminUrl: trimEnv(process.env.ADMIN_URL) || "http://localhost:5174",

  // Firebase (usadas por firebase.js)
  firebaseDatabaseUrl: trimEnv(process.env.FIREBASE_DATABASE_URL),
  firebaseProjectId: trimEnv(process.env.FIREBASE_PROJECT_ID),
  firebaseClientEmail: trimEnv(process.env.FIREBASE_CLIENT_EMAIL),
  firebasePrivateKey: trimEnv(process.env.FIREBASE_PRIVATE_KEY),
};
