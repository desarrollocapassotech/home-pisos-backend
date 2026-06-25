/**
 * Servicio de órdenes - Persistencia en Realtime Database o archivo JSON (fallback)
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getRealtimeDb, readRefOnceSafe, ORDERS_PATH } from "../config/firebase.js";

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

function sortOrdersNewestFirst(orders) {
  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function firstOrderFromQueryVal(data) {
  if (!data) return null;
  const ids = Object.keys(data);
  if (ids.length === 0) return null;
  const id = ids[0];
  return { id, ...data[id] };
}

/**
 * Lista todas las órdenes ordenadas por fecha (más recientes primero)
 */
export async function findAll() {
  if (await useRealtimeDb()) {
    const result = await readRefOnceSafe(ORDERS_PATH, { label: ORDERS_PATH });
    if (!result.ok) {
      console.warn("[Orders] Firebase read failed, usando fallback archivo:", result.error);
      return sortOrdersNewestFirst(await loadFromFile());
    }
    const data = result.val;
    if (!data) return [];
    const orders = Object.entries(data).map(([id, order]) => ({ id, ...order }));
    return sortOrdersNewestFirst(orders);
  }
  return sortOrdersNewestFirst(await loadFromFile());
}

/**
 * Obtiene una orden por ID
 */
export async function findById(id) {
  if (await useRealtimeDb()) {
    const result = await readRefOnceSafe(`${ORDERS_PATH}/${id}`, {
      label: `${ORDERS_PATH}/${id}`,
    });
    if (!result.ok) {
      console.warn("[Orders] Firebase read failed, usando fallback archivo:", result.error);
      const orders = await loadFromFile();
      return orders.find((o) => o.id === id) ?? null;
    }
    if (!result.val) return null;
    return { id, ...result.val };
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
  return updateStatusWithPayment(id, status, updatedAt);
}

/**
 * Busca una orden por ID de pago de Mercado Pago (evitar duplicados en webhooks)
 */
export async function findByMercadopagoId(mercadopagoId) {
  if (!mercadopagoId) return null;
  if (await useRealtimeDb()) {
    const mpId = String(mercadopagoId);
    const result = await readRefOnceSafe(
      (database) =>
        database.ref(ORDERS_PATH).orderByChild("mercadopagoId").equalTo(mpId),
      { label: `${ORDERS_PATH}?mercadopagoId=${mpId}` }
    );
    if (!result.ok) {
      console.warn("[Orders] Firebase query failed, usando fallback archivo:", result.error);
      const orders = await loadFromFile();
      return orders.find((o) => o.mercadopagoId === mpId) ?? null;
    }
    return firstOrderFromQueryVal(result.val);
  }
  const orders = await loadFromFile();
  return orders.find((o) => o.mercadopagoId === String(mercadopagoId)) ?? null;
}

/**
 * Busca una orden por preference_id de Mercado Pago
 */
export async function findByPreferenceId(preferenceId) {
  if (!preferenceId) return null;
  if (await useRealtimeDb()) {
    const prefId = String(preferenceId);
    const result = await readRefOnceSafe(
      (database) =>
        database.ref(ORDERS_PATH).orderByChild("preferenceId").equalTo(prefId),
      { label: `${ORDERS_PATH}?preferenceId=${prefId}` }
    );
    if (!result.ok) {
      console.warn("[Orders] Firebase query failed, usando fallback archivo:", result.error);
      const orders = await loadFromFile();
      return orders.find((o) => o.preferenceId === prefId) ?? null;
    }
    return firstOrderFromQueryVal(result.val);
  }
  const orders = await loadFromFile();
  return orders.find((o) => o.preferenceId === String(preferenceId)) ?? null;
}

/**
 * Actualiza campos de una orden existente
 */
export async function update(orderId, updates) {
  if (await useRealtimeDb()) {
    const db = await getRealtimeDb();
    const ref = db.ref(`${ORDERS_PATH}/${orderId}`);
    const result = await readRefOnceSafe(`${ORDERS_PATH}/${orderId}`, {
      label: `${ORDERS_PATH}/${orderId}`,
    });
    if (!result.ok) {
      console.warn("[Orders] Firebase read failed en update, usando fallback archivo:", result.error);
      const orders = await loadFromFile();
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) return null;
      Object.assign(orders[idx], updates);
      await saveToFile(orders);
      return orders[idx];
    }
    if (!result.exists) return null;
    await ref.update(updates);
    return { id: orderId, ...result.val, ...updates };
  }
  const orders = await loadFromFile();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;
  Object.assign(orders[idx], updates);
  await saveToFile(orders);
  return orders[idx];
}

/**
 * Actualiza el estado de una orden (para webhooks de Mercado Pago)
 * Permite persistir mercadopagoId del pago
 */
export async function updateStatusWithPayment(id, status, updatedAt, mercadopagoId = null) {
  const updates = { status, updatedAt };
  if (mercadopagoId) updates.mercadopagoId = mercadopagoId;

  if (await useRealtimeDb()) {
    const db = await getRealtimeDb();
    const ref = db.ref(`${ORDERS_PATH}/${id}`);
    const result = await readRefOnceSafe(`${ORDERS_PATH}/${id}`, {
      label: `${ORDERS_PATH}/${id}`,
    });
    if (!result.ok) {
      console.warn("[Orders] Firebase read failed en updateStatus, usando fallback archivo:", result.error);
      const orders = await loadFromFile();
      const idx = orders.findIndex((o) => o.id === id);
      if (idx === -1) return null;
      Object.assign(orders[idx], updates);
      await saveToFile(orders);
      return orders[idx];
    }
    if (!result.exists) return null;
    await ref.update(updates);
    return { id, ...result.val, ...updates };
  }
  const orders = await loadFromFile();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  Object.assign(orders[idx], updates);
  await saveToFile(orders);
  return orders[idx];
}
