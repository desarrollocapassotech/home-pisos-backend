/**
 * Controlador de Mercado Pago - Preferencias y webhooks
 */
import { buildOrder, buildOrderFromMetadata } from "../models/order.model.js";
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

    // Asociar preferenceId a la orden para búsqueda por webhook
    await ordersService.update(order.id, {
      preferenceId,
      updatedAt: new Date().toISOString(),
    });

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
 * Recibe notificaciones de Mercado Pago (payment aprobado, rechazado, pendiente).
 * Crea o actualiza la orden automáticamente según el estado del pago.
 */
export const handleWebhook = async (req, res, next) => {
  try {
    const body = req.body;
    const type = body.type;
    const dataId = body.data?.id;

    console.log("[Webhook MP] Recibida notificación", { type, dataId });

    if (!type || !dataId) {
      console.log("[Webhook MP] Notificación inválida: faltan type o data.id");
      return res.status(400).json({ error: "Notificación inválida" });
    }

    if (config.mercadopagoWebhookSecret) {
      if (!validateWebhookSignature(req)) {
        console.log("[Webhook MP] Firma inválida");
        return res.status(401).json({ error: "Firma inválida" });
      }
    }

    if (type !== "payment") {
      console.log("[Webhook MP] Tipo ignorado:", type);
      return res.status(200).json({ received: true });
    }

    const payment = await mercadopagoService.getPayment(dataId);
    if (!payment) {
      console.log("[Webhook MP] Pago no encontrado en MP:", dataId);
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    const paymentIdStr = String(payment.id);
    console.log("[Webhook MP] Pago obtenido", { id: paymentIdStr, status: payment.status, external_reference: payment.external_reference });

    // Idempotencia: evitar órdenes duplicadas si el webhook se reenvía
    const existingByPayment = await ordersService.findByMercadopagoId(paymentIdStr);
    if (existingByPayment) {
      console.log("[Webhook MP] Pago ya procesado (idempotencia), orden:", existingByPayment.id);
      return res.status(200).json({ received: true, orderId: existingByPayment.id, status: existingByPayment.status, duplicate: true });
    }

    // Buscar orden: por external_reference (orderId) o por preference_id
    let order = null;
    const orderId = payment.external_reference;
    if (orderId) {
      order = await ordersService.findById(orderId);
      if (order) console.log("[Webhook MP] Orden encontrada por external_reference:", orderId);
    }
    if (!order && payment.preference_id) {
      order = await ordersService.findByPreferenceId(payment.preference_id);
      if (order) console.log("[Webhook MP] Orden encontrada por preference_id:", payment.preference_id);
    }

    // Si no existe orden, intentar crear desde metadata de la preferencia (aprobados y rechazados)
    const shouldCreateFromMetadata = ["approved", "rejected", "cancelled"].includes(payment.status);
    if (!order && payment.preference_id && shouldCreateFromMetadata) {
      const preference = await mercadopagoService.getPreference(payment.preference_id);
      if (preference?.metadata?.order_data) {
        const newOrder = buildOrderFromMetadata(
          preference.metadata,
          paymentIdStr,
          payment.preference_id
        );
        if (newOrder) {
          await ordersService.create(newOrder);
          order = { ...newOrder, id: newOrder.id };
          console.log("[Webhook MP] Orden creada desde metadata de preferencia:", order.id);
        }
      }
    }

    if (!order) {
      console.log("[Webhook MP] No se encontró orden para external_reference:", orderId, "preference_id:", payment.preference_id);
      return res.status(200).json({ received: true });
    }

    // Determinar nuevo estado según pago
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
        console.log("[Webhook MP] Estado de pago ignorado:", payment.status);
        return res.status(200).json({ received: true });
    }

    // Actualizar orden: estado "pagado"/"confirmado" y asociar ID de transacción MP
    const updatedOrder = await ordersService.updateStatusWithPayment(
      order.id,
      newStatus,
      updatedAt,
      paymentIdStr
    );

    console.log("[Webhook MP] Orden actualizada", { orderId: order.id, status: newStatus, mercadopagoId: paymentIdStr });

    res.status(200).json({ received: true, orderId: order.id, status: newStatus });
  } catch (err) {
    console.error("[Webhook MP] Error:", err.message, err.stack);
    next(err);
  }
};
