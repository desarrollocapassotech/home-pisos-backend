import { buildOrder, ORDER_STATUS } from "../models/order.model.js";
import * as ordersService from "../services/orders.service.js";

/**
 * GET /api/orders - Lista todas las órdenes
 */
export const getOrders = async (req, res, next) => {
  try {
    const orders = await ordersService.findAll();
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id - Obtiene una orden por ID
 */
export const getOrderById = async (req, res, next) => {
  try {
    const order = await ordersService.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado", code: "ORDER_NOT_FOUND" });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/orders - Crea una nueva orden
 */
export const createOrder = async (req, res, next) => {
  try {
    const { valid, order, errors } = buildOrder(req.body);
    if (!valid) {
      return res.status(400).json({
        error: "Datos inválidos",
        code: "VALIDATION_ERROR",
        details: errors,
      });
    }
    await ordersService.create(order);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/status - Actualiza el estado de una orden
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = Object.values(ORDER_STATUS);

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Estado inválido",
        code: "INVALID_STATUS",
        validStatuses,
      });
    }

    const updatedAt = new Date().toISOString();
    const order = await ordersService.updateStatus(id, status, updatedAt);

    if (!order) {
      return res.status(404).json({ error: "Pedido no encontrado", code: "ORDER_NOT_FOUND" });
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
};
