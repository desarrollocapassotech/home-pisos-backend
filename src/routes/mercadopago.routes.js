import { Router } from "express";
import {
  getOAuthUrl,
  handleCallback,
  getConnectionStatus,
  disconnect,
} from "../controllers/mercadopago.oauth.controller.js";

const router = Router();
router.get("/oauth/url", getOAuthUrl);
router.get("/oauth/callback", handleCallback);
router.get("/status", getConnectionStatus);
router.delete("/disconnect", disconnect);
export default router;
