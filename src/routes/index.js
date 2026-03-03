import { Router } from "express";
import ordersRoutes from "./orders.routes.js";
import webhooksRoutes from "./webhooks.routes.js";

const router = Router();
router.use("/orders", ordersRoutes);
router.use("/webhooks", webhooksRoutes);
export default router;
