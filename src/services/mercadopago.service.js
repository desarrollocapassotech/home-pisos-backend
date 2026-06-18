/**
 * Servicio de Mercado Pago - Preferencias y pagos
 */
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { config } from "../config/index.js";
import { getCredentials } from "./mercadopago.oauth.js";

export async function getActiveAccessToken() {
  let creds = null;
  try {
    creds = await getCredentials();
  } catch (err) {
    console.error("[MP] Error leyendo credenciales OAuth desde Firebase:", err.message);
  }
  if (creds?.accessToken) return creds.accessToken;
  if (config.mercadopagoAccessToken) return config.mercadopagoAccessToken;
  return null;
}

/**
 * Diagnóstico para entender por qué no hay token activo.
 */
export async function getAccessTokenSourceStatus() {
  let oauthError = null;
  let creds = null;
  try {
    creds = await getCredentials();
  } catch (err) {
    oauthError = err.message;
  }
  return {
    oauthConnected: !!creds?.accessToken,
    oauthError,
    envTokenSet: !!config.mercadopagoAccessToken,
    clientIdSet: !!config.mercadopagoClientId,
    clientSecretSet: !!config.mercadopagoClientSecret,
  };
}

async function getPreferenceClient() {
  const token = await getActiveAccessToken();
  return new Preference(new MercadoPagoConfig({ accessToken: token }));
}

/**
 * Mercado Pago rechaza `auto_return` cuando las back_urls no son URLs públicas
 * (localhost, IPs privadas, hostnames sin TLD). En esos casos devolvemos false
 * para omitir `auto_return` y permitir testing en local sin un túnel.
 */
function isPublicHttpUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0") return false;
    if (/^127\./.test(host)) return false;
    if (/^10\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    if (!host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

async function getPaymentClient() {
  const token = await getActiveAccessToken();
  return new Payment(new MercadoPagoConfig({ accessToken: token }));
}

/**
 * Crea una preferencia de pago (Checkout Pro)
 * @param {object} order - Orden con items, customer, shipping, totales
 * @returns {Promise<{ initPoint: string, preferenceId: string }>}
 */
export async function createPreference(order) {
  const frontendUrl = (order.frontendUrl || config.frontendUrl || "").trim().replace(/\/$/, "");
  const backendUrl = (config.backendUrl || "").trim().replace(/\/$/, "");

  if (!frontendUrl || !frontendUrl.startsWith("http")) {
    throw new Error(
      "FRONTEND_URL no configurada. Definir en variables de entorno (ej: https://tudominio.com)"
    );
  }

  const backUrls = {
    success: `${frontendUrl}/checkout/success`,
    failure: `${frontendUrl}/checkout/failure`,
    pending: `${frontendUrl}/checkout/pending`,
  };

  const canUseAutoReturn = Object.values(backUrls).every(isPublicHttpUrl);
  if (!canUseAutoReturn) {
    console.warn(
      "[MP] back_urls no son públicas, omitiendo auto_return (modo dev). Para activar auto_return en producción, configurá FRONTEND_URL con un dominio https público."
    );
  }

  const preference = {
    items: [
      ...order.items.map((item) => {
        const qty = Number(item.quantity);
        const isM2 =
          item.priceType === "por m²" &&
          typeof item.m2PerBox === "number" &&
          item.m2PerBox > 0;
        const boxWord = qty === 1 ? "caja" : "cajas";
        const title = isM2
          ? `${item.productName} — ${qty} ${boxWord} (${(qty * item.m2PerBox).toFixed(2)} m²)`
          : item.productName;
        return {
          id: item.productId,
          title: title.length > 127 ? `${title.slice(0, 124)}...` : title,
          quantity: qty,
          unit_price: Number(item.price),
          picture_url: item.imageUrl || undefined,
          currency_id: "ARS",
        };
      }),
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
    back_urls: backUrls,
    ...(canUseAutoReturn ? { auto_return: "approved" } : {}),
    external_reference: order.id,
    metadata: {
      order_id: String(order.id),
      order_data: JSON.stringify({
        customer: order.customer,
        shipping: order.shipping,
        items: order.items,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        total: order.total,
      }).slice(0, 600),
    },
    ...(isPublicHttpUrl(backendUrl)
      ? { notification_url: `${backendUrl}/api/webhooks/mercadopago?source_news=webhooks` }
      : {}),
    statement_descriptor: "HOME PISOS VINILICOS",
  };

  const preferenceClient = await getPreferenceClient();
  const response = await preferenceClient.create({ body: preference });
  return {
    initPoint: response.init_point,
    preferenceId: response.id,
  };
}

/**
 * Obtiene detalles de un pago
 * @param {string} paymentId - ID del pago en Mercado Pago
 * @returns {Promise<{ id: string, status: string, external_reference: string, preference_id?: string } | null>}
 */
export async function getPayment(paymentId) {
  const paymentClient = await getPaymentClient();
  const payment = await paymentClient.get({ id: paymentId });
  if (!payment) return null;
  return {
    id: String(payment.id),
    status: payment.status,
    external_reference: payment.external_reference || null,
    preference_id: payment.metadata?.preference_id || payment.additional_info?.preference_id || null,
    status_detail: payment.status_detail,
  };
}

/**
 * Obtiene una preferencia por ID (para reconstruir orden desde metadata si es necesario)
 * @param {string} preferenceId
 * @returns {Promise<{ metadata?: { order_id?: string, order_data?: string } } | null>}
 */
export async function getPreference(preferenceId) {
  try {
    const preferenceClient = await getPreferenceClient();
    const preference = await preferenceClient.get({ id: preferenceId });
    if (!preference) return null;
    return {
      id: preference.id,
      external_reference: preference.external_reference,
      metadata: preference.metadata || {},
    };
  } catch {
    return null;
  }
}
