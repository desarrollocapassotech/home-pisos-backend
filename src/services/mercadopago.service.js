/**
 * Servicio de Mercado Pago - Preferencias y pagos
 */
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { config } from "../config/index.js";

const client = new MercadoPagoConfig({
  accessToken: config.mercadopagoAccessToken,
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);

/**
 * Crea una preferencia de pago (Checkout Pro)
 * @param {object} order - Orden con items, customer, shipping, totales
 * @returns {Promise<{ initPoint: string, preferenceId: string }>}
 */
export async function createPreference(order) {
  const frontendUrl = (config.frontendUrl || "").trim().replace(/\/$/, "");
  const backendUrl = (config.backendUrl || "").trim().replace(/\/$/, "");

  if (!frontendUrl || !frontendUrl.startsWith("http")) {
    throw new Error(
      "FRONTEND_URL no configurada. Definir en variables de entorno (ej: https://tudominio.com)"
    );
  }

  const preference = {
    items: [
      ...order.items.map((item) => ({
        id: item.productId,
        title: item.productName,
        quantity: Number(item.quantity),
        unit_price: Number(item.price),
        picture_url: item.imageUrl || undefined,
        currency_id: "ARS",
      })),
      ...(order.shippingCost > 0
        ? [
            {
              id: "shipping",
              title: order.shipping.method?.name || "Envío",
              quantity: 1,
              unit_price: Number(order.shippingCost),
              currency_id: "ARS",
            },
          ]
        : []),
    ],
    payer: {
      email: order.customer.email,
      name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      phone: {
        number: order.customer.phone?.replace(/\D/g, ""),
      },
      address: {
        street_name: order.shipping.address,
        zip_code: order.shipping.postalCode,
      },
    },
    back_urls: {
      success: `${frontendUrl}/checkout/success`,
      failure: `${frontendUrl}/checkout/failure`,
      pending: `${frontendUrl}/checkout/pending`,
    },
    auto_return: "approved",
    external_reference: order.id,
    notification_url: `${backendUrl}/api/webhooks/mercadopago?source_news=webhooks`,
    statement_descriptor: "HOME PISOS VINILICOS",
  };

  const response = await preferenceClient.create({ body: preference });
  return {
    initPoint: response.init_point,
    preferenceId: response.id,
  };
}

/**
 * Obtiene detalles de un pago
 * @param {string} paymentId - ID del pago en Mercado Pago
 * @returns {Promise<{ status: string, external_reference: string, id: string } | null>}
 */
export async function getPayment(paymentId) {
  const payment = await paymentClient.get({ id: paymentId });
  if (!payment) return null;
  return {
    id: payment.id,
    status: payment.status,
    external_reference: payment.external_reference || null,
    status_detail: payment.status_detail,
  };
}
