import { config } from "../config/index.js";
import { getDbConfig, setDbConfig, deleteDbConfig } from "../config/firebase.js";

const MP_AUTH_URL = "https://auth.mercadopago.com.ar/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const CONFIG_KEY = "mercadopago";

export function getOAuthUrl() {
  const redirectUri = `${config.backendUrl}/api/mercadopago/oauth/callback`;
  const params = new URLSearchParams({
    client_id: config.mercadopagoClientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri,
  });
  return `${MP_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const redirectUri = `${config.backendUrl}/api/mercadopago/oauth/callback`;
  const body = new URLSearchParams({
    client_id: config.mercadopagoClientId,
    client_secret: config.mercadopagoClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Error al obtener token de MP: ${res.status}`);
  }

  return res.json();
}

export async function saveCredentials(tokenData) {
  await setDbConfig(CONFIG_KEY, {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || null,
    userId: String(tokenData.user_id),
    publicKey: tokenData.public_key || null,
    savedAt: new Date().toISOString(),
  });
}

export async function getCredentials() {
  return getDbConfig(CONFIG_KEY);
}

export async function revokeCredentials() {
  await deleteDbConfig(CONFIG_KEY);
}
