/**
 * Configuración de Firebase Admin para Realtime Database
 * Requiere GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_SERVICE_ACCOUNT (base64).
 * Si firebase-admin no está instalado o no hay credenciales, retorna null (usa archivo).
 */
let db = null;

const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://home-pisos-vinilicos-default-rtdb.firebaseio.com";

async function initRealtimeDb() {
  if (db !== undefined) return db;
  try {
    const admin = await import("firebase-admin").catch(() => null);
    if (!admin) {
      db = null;
      return null;
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.default.initializeApp({ databaseURL: DATABASE_URL });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const credentials = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
      );
      admin.default.initializeApp({
        credential: admin.default.credential.cert(credentials),
        databaseURL: DATABASE_URL,
      });
    } else {
      db = null;
      return null;
    }
    db = admin.default.database();
  } catch (err) {
    db = null;
  }
  return db;
}

export async function getRealtimeDb() {
  return db ?? (await initRealtimeDb());
}

export const ORDERS_PATH = "orders";
