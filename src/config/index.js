export const config = {
  port: process.env.PORT || 3001,
  mercadopagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  mercadopagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  mercadopagoClientId: process.env.MERCADOPAGO_CLIENT_ID,
  mercadopagoClientSecret: process.env.MERCADOPAGO_CLIENT_SECRET,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  backendUrl: process.env.BACKEND_URL || "http://localhost:3001",
  adminUrl: process.env.ADMIN_URL || "http://localhost:5174",
};
