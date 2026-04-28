import { config } from "../config/index.js";
import * as oauthService from "../services/mercadopago.oauth.js";

export const getOAuthUrl = async (req, res, next) => {
  try {
    if (!config.mercadopagoClientId || !config.mercadopagoClientSecret) {
      return res.status(503).json({
        error: "OAuth no configurado: faltan MERCADOPAGO_CLIENT_ID y MERCADOPAGO_CLIENT_SECRET en el servidor",
        code: "OAUTH_NOT_CONFIGURED",
      });
    }
    const url = oauthService.getOAuthUrl();
    res.json({ url });
  } catch (err) {
    next(err);
  }
};

export const handleCallback = async (req, res, next) => {
  try {
    const { code, error: oauthError } = req.query;
    const adminUrl = (config.adminUrl || "").trim().replace(/\/$/, "");

    if (oauthError) {
      console.error("[OAuth MP] Error devuelto por MP:", oauthError);
      return res.redirect(`${adminUrl}/pagos?status=error&reason=${encodeURIComponent(oauthError)}`);
    }

    if (!code) {
      return res.redirect(`${adminUrl}/pagos?status=error&reason=no_code`);
    }

    const tokenData = await oauthService.exchangeCodeForToken(code);
    await oauthService.saveCredentials(tokenData);

    console.log("[OAuth MP] Cuenta conectada, userId:", tokenData.user_id);
    res.redirect(`${adminUrl}/pagos?status=success`);
  } catch (err) {
    console.error("[OAuth MP] Error en callback:", err.message);
    const adminUrl = (config.adminUrl || "").trim().replace(/\/$/, "");
    res.redirect(`${adminUrl}/pagos?status=error&reason=${encodeURIComponent(err.message)}`);
  }
};

export const getConnectionStatus = async (req, res, next) => {
  try {
    const creds = await oauthService.getCredentials();
    if (!creds?.accessToken) {
      return res.json({
        connected: false,
        source: config.mercadopagoAccessToken ? "env" : "none",
      });
    }
    res.json({
      connected: true,
      source: "oauth",
      userId: creds.userId,
      savedAt: creds.savedAt,
    });
  } catch (err) {
    next(err);
  }
};

export const disconnect = async (req, res, next) => {
  try {
    await oauthService.revokeCredentials();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
