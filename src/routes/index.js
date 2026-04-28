import { Router } from "express";
import ordersRoutes from "./orders.routes.js";
import webhooksRoutes from "./webhooks.routes.js";
import mercadopagoRoutes from "./mercadopago.routes.js";

const router = Router();
router.use("/orders", ordersRoutes);
router.use("/webhooks", webhooksRoutes);
router.use("/mercadopago", mercadopagoRoutes);
export default router;
