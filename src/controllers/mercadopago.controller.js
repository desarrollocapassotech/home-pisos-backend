/**
 * Controlador de Mercado Pago - Preferencias y webhooks
 */
import { buildOrder } from "../models/order.model.js";
import * as ordersService from "../services/orders.service.js";
import * as mercadopagoService from "../services/mercadopago.service.js";
import { ORDER_STATUS } from "../models/order.model.js";
import { config } from "../config/index.js";
import crypto from "crypto";

/**
 * POST /api/orders/create-preference
 * Crea la orden en BD, crea la preferencia de MP y devuelve la URL de checkout
 */
export const createPreference = async (req, res, next) => {
  try {
    const { valid, order, errors } = buildOrder(req.body);
    if (!valid) {
      return res.status(400).json({
        error: "Datos inválidos",
        code: "VALIDATION_ERROR",
        details: errors,
      });
    }

    if (!config.mercadopagoAccessToken) {
      return res.status(503).json({
        error: "Mercado Pago no está configurado",
        code: "MP_NOT_CONFIGURED",
      });
    }

    if (!config.frontendUrl?.trim() || !config.frontendUrl.startsWith("http")) {
      return res.status(503).json({
        error: "FRONTEND_URL no configurada. Configurar en Render > Environment (ej: https://tu-sitio.onrender.com)",
        code: "FRONTEND_URL_MISSING",
      });
    }

    // Persistir orden con estado pendiente
    await ordersService.create(order);

    // Crear preferencia en Mercado Pago
    const { initPoint, preferenceId } = await mercadopagoService.createPreference(order);

    res.status(201).json({
      orderId: order.id,
      preferenceId,
      initPoint,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Valida la firma x-signature del webhook de Mercado Pago
 * @see https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/notifications/webhooks
 */
function validateWebhookSignature(req) {
  const secret = config.mercadopagoWebhookSecret;
  if (!secret) return false;

  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];
  if (!xSignature || !xRequestId) return false;

  // Extraer ts y v1 del header x-signature
  const parts = xSignature.split(",");
  let ts = null;
  let hash = null;
  for (const part of parts) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if (key === "ts") ts = value;
    else if (key === "v1") hash = value;
  }
  if (!ts || !hash) return false;

  // data.id puede venir en query params (data.id) o en body
  const dataId = req.query["data.id"] ?? req.body?.data?.id ?? "";
  const dataIdStr = String(dataId).toLowerCase();

  const manifest = `id:${dataIdStr};request-id:${xRequestId};ts:${ts};`;
  const computed = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

/**
 * POST /api/webhooks/mercadopago
 * Recibe notificaciones de Mercado Pago (payment aprobado, rechazado, pendiente)
 */
export const handleWebhook = async (req, res, next) => {
  try {
    const body = req.body;
    const type = body.type;
    const dataId = body.data?.id;

    if (!type || !dataId) {
      return res.status(400).json({ error: "Notificación inválida" });
    }

    if (config.mercadopagoWebhookSecret) {
      if (!validateWebhookSignature(req)) {
        return res.status(401).json({ error: "Firma inválida" });
      }
    }

    if (type !== "payment") {
      return res.status(200).json({ received: true });
    }

    const payment = await mercadopagoService.getPayment(dataId);
    if (!payment) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    const orderId = payment.external_reference;
    if (!orderId) {
      return res.status(200).json({ received: true });
    }

    const order = await ordersService.findById(orderId);
    if (!order) {
      return res.status(200).json({ received: true });
    }

    const updatedAt = new Date().toISOString();
    let newStatus = order.status;

    switch (payment.status) {
      case "approved":
        newStatus = ORDER_STATUS.PAID;
        break;
      case "rejected":
      case "cancelled":
        newStatus = ORDER_STATUS.REJECTED;
        break;
      case "pending":
      case "in_process":
      case "in_mediation":
        newStatus = ORDER_STATUS.PENDING;
        break;
      default:
        return res.status(200).json({ received: true });
    }

    await ordersService.updateStatusWithPayment(
      orderId,
      newStatus,
      updatedAt,
      String(payment.id)
    );

    res.status(200).json({ received: true, orderId, status: newStatus });
  } catch (err) {
    next(err);
  }
};
