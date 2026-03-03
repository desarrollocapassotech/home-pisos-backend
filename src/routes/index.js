import { Router } from "express";
import ordersRoutes from "./orders.routes.js";

const router = Router();
router.use("/orders", ordersRoutes);
export default router;
