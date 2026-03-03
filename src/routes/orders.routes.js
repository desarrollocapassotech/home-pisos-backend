import { Router } from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
} from "../controllers/orders.controller.js";
import { createPreference } from "../controllers/mercadopago.controller.js";

const router = Router();
router.get("/", getOrders);
router.get("/:id", getOrderById);
router.post("/", createOrder);
router.post("/create-preference", createPreference);
router.patch("/:id/status", updateOrderStatus);
export default router;
