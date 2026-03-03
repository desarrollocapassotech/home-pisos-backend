import { Router } from "express";
import { handleWebhook } from "../controllers/mercadopago.controller.js";

const router = Router();
router.post("/mercadopago", handleWebhook);
export default router;
