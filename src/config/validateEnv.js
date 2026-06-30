import { config } from "./index.js";

/**
 * Validación opcional al arranque.
 * - Producción: exige token MP en env O credenciales OAuth (sin bloquear setups OAuth-only).
 * - QA / development: solo advierte, nunca corta el proceso.
 */
export function validateEnvAtStartup() {
  const hasEnvToken = !!config.mercadopagoAccessToken;
  const hasOAuthSetup = !!(config.mercadopagoClientId && config.mercadopagoClientSecret);
  const hasFirebaseCreds =
    !!process.env.FIREBASE_SERVICE_ACCOUNT ||
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !!(config.firebaseProjectId && config.firebaseClientEmail && config.firebasePrivateKey);

  console.log(`[Config] NODE_ENV=${config.nodeEnv}`);

  if (config.isProduction) {
    if (!hasEnvToken && !hasOAuthSetup) {
      console.error(
        "[Config] ERROR: En producción se requiere MERCADOPAGO_ACCESS_TOKEN (o MP_ACCESS_TOKEN) " +
          "o bien MERCADOPAGO_CLIENT_ID + MERCADOPAGO_CLIENT_SECRET para OAuth."
      );
      process.exit(1);
    }
    if (!hasFirebaseCreds) {
      console.warn(
        "[Config] ADVERTENCIA: Firebase sin credenciales. Órdenes OAuth/MP en Firebase no funcionarán " +
          "(se usará fallback data/orders.json si aplica)."
      );
    }
    return;
  }

  if (config.isQa) {
    if (!hasEnvToken && !hasOAuthSetup) {
      console.warn(
        "[Config] QA: Mercado Pago sin token ni OAuth configurado. El checkout devolverá MP_NOT_CONFIGURED hasta configurar credenciales."
      );
    }
    if (!hasFirebaseCreds) {
      console.warn("[Config] QA: Firebase sin credenciales. Usar FIREBASE_* o FIREBASE_SERVICE_ACCOUNT.");
    }
    return;
  }

  // development local
  if (!hasEnvToken && !hasOAuthSetup) {
    console.warn("[Config] Dev: Mercado Pago no configurado en variables de entorno.");
  }
}
