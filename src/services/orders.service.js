/**
 * Servicio de órdenes - Persistencia en Realtime Database o archivo JSON (fallback)
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getRealtimeDb, ORDERS_PATH } from "../config/firebase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const ORDERS_FILE = join(DATA_DIR, "orders.json");

async function useRealtimeDb() {
  const db = await getRealtimeDb();
  return db !== null;
}

async function loadFromFile() {
  try {
    const data = await readFile(ORDERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveToFile(orders) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

/**
 * Lista todas las órdenes ordenadas por fecha (más recientes primero)
 */
export async function findAll() {
  if (await useRealtimeDb()) {
    const db = await getRealtimeDb();
    const snapshot = await db.ref(ORDERS_PATH).once("value");
    const data = snapshot.val();
    if (!data) return [];
    const orders = Object.entries(data).map(([id, order]) => ({ id, ...order }));
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const orders = await loadFromFile();
  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Obtiene una orden por ID
 */
export async function findById(id) {
  if (await useRealtimeDb()) {
    const db = await getRealtimeDb();
    const snapshot = await db.ref(`${ORDERS_PATH}/${id}`).once("value");
    const data = snapshot.val();
    if (!data) return null;
    return { id, ...data };
  }
  const orders = await loadFromFile();
  return orders.find((o) => o.id === id) ?? null;
}

/**
 * Crea una nueva orden (el objeto debe incluir id generado por buildOrder)
 */
export async function create(order) {
  if (await useRealtimeDb()) {
    const db = await getRealtimeDb();
    const { id, ...data } = order;
    await db.ref(`${ORDERS_PATH}/${id}`).set(data);
    return { id, ...data };
  }
  const orders = await loadFromFile();
  orders.push(order);
  await saveToFile(orders);
  return order;
}

/**
 * Actualiza el estado de una orden
 */
export async function updateStatus(id, status, updatedAt) {
  if (await useRealtimeDb()) {
    const db = await getRealtimeDb();
    const ref = db.ref(`${ORDERS_PATH}/${id}`);
    const snapshot = await ref.once("value");
    if (!snapshot.exists()) return null;
    await ref.update({ status, updatedAt });
    return { id, ...snapshot.val(), status, updatedAt };
  }
  const orders = await loadFromFile();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  orders[idx].status = status;
  orders[idx].updatedAt = updatedAt;
  await saveToFile(orders);
  return orders[idx];
}
