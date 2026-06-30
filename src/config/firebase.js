/**
 * Firebase Admin — Realtime Database.
 *
 * Credenciales (en orden de prioridad, sin cambiar comportamiento existente):
 * 1. FIREBASE_SERVICE_ACCOUNT (base64 JSON) — compatible con Render/prod actual
 * 2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 * 3. GOOGLE_APPLICATION_CREDENTIALS (ruta a JSON)
 *
 * Lecturas: usar readRefOnceSafe() — nunca db.ref().once("value") directo.
 */
import { config } from "./index.js";

let db = undefined;
let initError = null;
/** Evita inicializaciones concurrentes (race en Render con requests paralelos). */
let initPromise = null;

const DEFAULT_READ_TIMEOUT_MS = Number(process.env.FIREBASE_READ_TIMEOUT_MS) || 15000;

const DATABASE_URL =
  config.firebaseDatabaseUrl ||
  "https://home-pisos-vinilicos-default-rtdb.firebaseio.com";

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    }),
  ]);
}

function buildCertCredential(admin) {
  const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (serviceAccountB64) {
    const credentials = JSON.parse(
      Buffer.from(serviceAccountB64, "base64").toString("utf8")
    );
    return { credential: admin.default.credential.cert(credentials), projectId: credentials.project_id };
  }

  const projectId = config.firebaseProjectId;
  const clientEmail = config.firebaseClientEmail;
  const privateKeyRaw = config.firebasePrivateKey;

  if (projectId && clientEmail && privateKeyRaw) {
    return {
      credential: admin.default.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
      }),
      projectId,
    };
  }

  return null;
}

async function initRealtimeDb() {
  if (db !== undefined) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log("[Firebase] Iniciando conexión...");
    console.log("[Firebase] DATABASE_URL:", DATABASE_URL);
    console.log("[Firebase] NODE_ENV:", config.nodeEnv);
    console.log("[Firebase] FIREBASE_SERVICE_ACCOUNT set:", !!process.env.FIREBASE_SERVICE_ACCOUNT?.trim());
    console.log("[Firebase] FIREBASE_PROJECT_ID set:", !!config.firebaseProjectId);
    console.log("[Firebase] GOOGLE_APPLICATION_CREDENTIALS set:", !!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());

    try {
      const admin = await import("firebase-admin").catch(() => null);
      if (!admin) {
        console.error("[Firebase] firebase-admin no disponible");
        return null;
      }

      const cert = buildCertCredential(admin);
      if (cert) {
        if (cert.projectId && !DATABASE_URL.includes(cert.projectId.replace(/-/g, ""))) {
          console.warn(
            "[Firebase] ADVERTENCIA: DATABASE_URL puede no corresponder al project_id del service account.",
            { databaseUrl: DATABASE_URL, serviceAccountProjectId: cert.projectId }
          );
        }
        admin.default.initializeApp({
          credential: cert.credential,
          databaseURL: DATABASE_URL,
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
        admin.default.initializeApp({ databaseURL: DATABASE_URL });
      } else {
        console.error(
          "[Firebase] No hay credenciales configuradas " +
            "(FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID+CLIENT_EMAIL+PRIVATE_KEY, o GOOGLE_APPLICATION_CREDENTIALS)"
        );
        return null;
      }

      const instance = admin.default.database();
      console.log("[Firebase] Conexión exitosa");
      return instance;
    } catch (err) {
      console.error("[Firebase] Error al inicializar:", err.message, err.stack);
      initError = err.message;
      return null;
    }
  })();

  db = await initPromise;
  initPromise = null;
  return db;
}

export function getFirebaseInitError() {
  return initError;
}

export async function getRealtimeDb() {
  return db ?? (await initRealtimeDb());
}

/**
 * Lectura RTDB segura con timeout obligatorio.
 *
 * @param {string | ((database: import("firebase-admin").database.Database) => import("firebase-admin").database.Reference)} target
 *   Path string (ej. "orders/123") o factory que devuelve una Reference (queries).
 * @param {{ timeoutMs?: number, label?: string }} [options]
 * @returns {Promise<{ ok: true, val: unknown, exists: boolean, snapshot: import("firebase-admin").database.DataSnapshot } | { ok: false, error: string }>}
 */
export async function readRefOnceSafe(target, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
  const label =
    options.label ??
    (typeof target === "string" ? target : "firebase-query");

  const database = await getRealtimeDb();
  if (!database) {
    return { ok: false, error: "firebase_not_connected" };
  }

  const ref = typeof target === "function" ? target(database) : database.ref(target);
  const started = Date.now();
  console.log(`[Firebase] read start ${label}`);

  try {
    const snapshot = await withTimeout(ref.once("value"), timeoutMs, label);
    const elapsed = Date.now() - started;
    console.log(`[Firebase] read OK ${label} (${elapsed}ms)`);
    return {
      ok: true,
      val: snapshot.val(),
      exists: snapshot.exists(),
      snapshot,
    };
  } catch (err) {
    const elapsed = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Firebase] read FAIL ${label} (${elapsed}ms): ${message}`);
    return { ok: false, error: message };
  }
}

/** @deprecated Usar readRefOnceSafe */
export const readRefOnce = readRefOnceSafe;

export const ORDERS_PATH = "orders";
export const CONFIG_PATH = "config";

export async function getDbConfig(key) {
  const result = await readRefOnceSafe(`${CONFIG_PATH}/${key}`, {
    label: `config/${key}`,
  });
  if (!result.ok) return null;
  return result.val;
}

export async function setDbConfig(key, value) {
  const database = await getRealtimeDb();
  if (!database) throw new Error("Firebase no disponible para guardar configuración");
  await database.ref(`${CONFIG_PATH}/${key}`).set(value);
}

export async function deleteDbConfig(key) {
  const database = await getRealtimeDb();
  if (!database) throw new Error("Firebase no disponible para eliminar configuración");
  await database.ref(`${CONFIG_PATH}/${key}`).remove();
}
