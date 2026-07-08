import { Resend } from "resend";
import { config } from "../config/index.js";

function formatPrice(amount) {
  return `$ ${Number(amount).toLocaleString("es-AR")}`;
}

function itemsRows(items) {
  return items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0e8dc;font-size:13px;">${item.productName}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0e8dc;text-align:center;font-size:13px;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0e8dc;text-align:right;font-size:13px;">${formatPrice(item.price * item.quantity)}</td>
      </tr>`
    )
    .join("");
}

function baseLayout(title, accentColor, bodyContent) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Helvetica Neue',Arial,sans-serif;color:#3d2b1f;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:${accentColor};padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Home Pisos Vinílicos</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="background:#f5f0eb;padding:20px 32px;text-align:center;font-size:12px;color:#9e8272;">
              Este es un email automático, por favor no respondas a este mensaje.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function orderSummaryTable(order) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0e8dc;border-radius:6px;overflow:hidden;margin:20px 0;">
      <thead>
        <tr style="background:#f5f0eb;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#9e8272;font-weight:600;">Producto</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#9e8272;font-weight:600;">Cant.</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#9e8272;font-weight:600;">Precio</th>
        </tr>
      </thead>
      <tbody>${itemsRows(order.items)}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:8px 12px;text-align:right;font-size:13px;color:#9e8272;">Subtotal</td>
          <td style="padding:8px 12px;text-align:right;font-size:13px;">${formatPrice(order.subtotal)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:8px 12px;text-align:right;font-size:13px;color:#9e8272;">Envío</td>
          <td style="padding:8px 12px;text-align:right;font-size:13px;">${order.shippingCost > 0 ? formatPrice(order.shippingCost) : "Gratis"}</td>
        </tr>
        <tr style="background:#f5f0eb;">
          <td colspan="2" style="padding:10px 12px;text-align:right;font-weight:700;font-size:14px;">Total</td>
          <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:14px;">${formatPrice(order.total)}</td>
        </tr>
      </tfoot>
    </table>`;
}

function shippingLine(order) {
  const s = order.shipping;
  return `${s.address}, ${s.city}, ${s.province} (CP ${s.postalCode})`;
}

async function sendWithTemplate(to, subject, templateId, variables) {
  if (!config.emailEnabled) {
    console.log(`[Email] Deshabilitado. Se hubiera enviado a ${to}: ${subject}`);
    return;
  }
  const resend = new Resend(config.resendApiKey);
  const { error } = await resend.emails.send({
    from: `${config.emailFromName} <${config.emailFrom}>`,
    to,
    subject,
    template: {
      id: templateId,
      variables,
    },
  });
  if (error) throw new Error(error.message);
  console.log(`[Email] Enviado (template) a ${to}: ${subject}`);
}

async function sendWithHtml(to, subject, html) {
  if (!config.emailEnabled) {
    console.log(`[Email] Deshabilitado. Se hubiera enviado a ${to}: ${subject}`);
    return;
  }
  const resend = new Resend(config.resendApiKey);
  const { error } = await resend.emails.send({
    from: `${config.emailFromName} <${config.emailFrom}>`,
    to,
    subject,
    html,
  });
  if (error) throw new Error(error.message);
  console.log(`[Email] Enviado a ${to}: ${subject}`);
}

export async function sendOrderPaid(order) {
  const sharedVars = {
    orderId: order.id,
    itemsHtml: itemsRows(order.items),
    subtotal: formatPrice(order.subtotal),
    shippingCost: order.shippingCost > 0 ? formatPrice(order.shippingCost) : "Gratis",
    total: formatPrice(order.total),
    shippingAddress: shippingLine(order),
    shippingMethod: order.shipping.method?.name || "A coordinar",
  };

  await sendWithTemplate(
    order.customer.email,
    `✅ Pedido confirmado #${order.id} – Home Pisos Vinílicos`,
    config.resendTemplatePaidId,
    { ...sharedVars, customerName: order.customer.firstName }
  );

  if (config.adminEmail) {
    await sendWithTemplate(
      config.adminEmail,
      `🛒 Nuevo pedido #${order.id} – ${order.customer.firstName} ${order.customer.lastName}`,
      config.resendTemplateAdminId,
      {
        ...sharedVars,
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
        customerEmail: order.customer.email,
        customerPhone: order.customer.phone,
        adminUrl: config.adminUrl,
      }
    );
  }
}

export async function sendOrderPending(order) {
  const html = baseLayout("Pago en proceso – Home Pisos Vinílicos", "#b08850", `
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;">Tu pago está en proceso</p>
    <p style="margin:0 0 20px;font-size:14px;color:#5c4033;">Hola ${order.customer.firstName}, estamos esperando la confirmación de tu pago.</p>
    <p style="margin:0 0 4px;font-size:13px;color:#9e8272;">N° de pedido</p>
    <p style="margin:0 0 20px;font-size:15px;font-weight:600;">${order.id}</p>
    ${orderSummaryTable(order)}
    <p style="margin:24px 0 0;font-size:14px;color:#5c4033;">
      Una vez que el pago sea acreditado te enviaremos otro email con la confirmación. Si tenés alguna duda, no dudes en contactarnos.
    </p>`);
  await sendWithHtml(
    order.customer.email,
    `⏳ Pago en proceso #${order.id} – Home Pisos Vinílicos`,
    html
  );
}

export async function sendOrderRejected(order) {
  const html = baseLayout("Pago no aprobado – Home Pisos Vinílicos", "#8b4513", `
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;">No pudimos procesar tu pago</p>
    <p style="margin:0 0 20px;font-size:14px;color:#5c4033;">Hola ${order.customer.firstName}, lamentablemente tu pago no fue aprobado.</p>
    <p style="margin:0 0 4px;font-size:13px;color:#9e8272;">N° de pedido</p>
    <p style="margin:0 0 20px;font-size:15px;font-weight:600;">${order.id}</p>
    ${orderSummaryTable(order)}
    <p style="margin:24px 0 0;font-size:14px;color:#5c4033;">
      Podés intentar nuevamente con otro medio de pago. Si el problema persiste, contactanos y te ayudamos.
    </p>`);
  await sendWithHtml(
    order.customer.email,
    `❌ Pago no aprobado #${order.id} – Home Pisos Vinílicos`,
    html
  );
}
