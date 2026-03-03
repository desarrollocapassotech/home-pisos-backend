import { buildOrder, ORDER_STATUS } from "../models/order.model.js";

// Placeholder - reemplazar con persistencia real (Firebase/Firestore)
const orders = [];

export const getOrders = (req, res) => {
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json(sorted);
};

export const getOrderById = (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  res.json(order);
};

export const createOrder = (req, res) => {
  const { valid, order, errors } = buildOrder(req.body);
  if (!valid) {
    return res.status(400).json({ error: "Datos inválidos", details: errors });
  }
  orders.push(order);
  res.status(201).json(order);
};

export const updateOrderStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = Object.values(ORDER_STATUS);
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: "Estado inválido",
      validStatuses,
    });
  }
  const order = orders.find((o) => o.id === id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
  order.status = status;
  order.updatedAt = new Date().toISOString();
  res.json(order);
};
