/**
 * Modelo de datos para pedidos - Home Pisos Vinílicos
 * Alineado con Checkout.tsx y CartContext del frontend React
 */

export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  SHIPPING: "shipping",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

/**
 * Valida y normaliza el body de la request para crear una orden
 * @param {object} body - Body de la request (customer, shipping, items, subtotal, shippingCost, total)
 * @returns {{ valid: boolean, order?: object, errors?: string[] }}
 */
export function buildOrder(body) {
  const errors = [];

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Customer
  const customer = body.customer;
  if (!customer) {
    errors.push("Falta 'customer'");
  } else {
    if (!customer.email?.trim()) errors.push("customer.email es requerido");
    else if (!EMAIL_REGEX.test(customer.email.trim()))
      errors.push("customer.email debe tener formato válido");
    if (!customer.phone?.trim()) errors.push("customer.phone es requerido");
    if (!customer.firstName?.trim()) errors.push("customer.firstName es requerido");
    if (!customer.lastName?.trim()) errors.push("customer.lastName es requerido");
  }

  // Shipping
  const shipping = body.shipping;
  if (!shipping) {
    errors.push("Falta 'shipping'");
  } else {
    if (!shipping.address?.trim()) errors.push("shipping.address es requerido");
    if (!shipping.city?.trim()) errors.push("shipping.city es requerido");
    if (!shipping.province?.trim()) errors.push("shipping.province es requerido");
    if (!shipping.postalCode?.trim()) errors.push("shipping.postalCode es requerido");
    if (!shipping.method?.id) errors.push("shipping.method.id es requerido");
  }

  // Items
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("items debe ser un array con al menos un producto");
  } else {
    items.forEach((item, i) => {
      if (!item.product?.id) errors.push(`items[${i}].product.id es requerido`);
      if (!item.product?.name) errors.push(`items[${i}].product.name es requerido`);
      if (typeof item.product?.price !== "number") errors.push(`items[${i}].product.price debe ser número`);
      if (typeof item.quantity !== "number" || item.quantity < 1) errors.push(`items[${i}].quantity debe ser >= 1`);
    });
  }

  // Totals
  const subtotal = Number(body.subtotal);
  const shippingCost = Number(body.shippingCost);
  const total = Number(body.total);
  if (isNaN(subtotal) || subtotal < 0) errors.push("subtotal debe ser un número >= 0");
  if (isNaN(shippingCost) || shippingCost < 0) errors.push("shippingCost debe ser un número >= 0");
  if (isNaN(total) || total < 0) errors.push("total debe ser un número >= 0");

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const order = {
    id: `ORD-${Date.now()}`,
    customer: {
      email: customer.email.trim(),
      phone: customer.phone.trim(),
      firstName: customer.firstName.trim(),
      lastName: customer.lastName.trim(),
    },
    shipping: {
      address: shipping.address.trim(),
      city: shipping.city.trim(),
      province: shipping.province.trim(),
      postalCode: shipping.postalCode.trim(),
      method: {
        id: shipping.method.id,
        name: shipping.method.name ?? "",
        price: Number(shipping.method.price) ?? 0,
        estimatedDays: shipping.method.estimatedDays ?? "",
      },
    },
    items: items.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      price: Number(item.product.price),
      quantity: Number(item.quantity),
      imageUrl: item.product.images?.[0] ?? null,
    })),
    subtotal,
    shippingCost,
    total,
    status: ORDER_STATUS.PENDING,
    mercadopagoId: body.mercadopagoId ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { valid: true, order };
}
