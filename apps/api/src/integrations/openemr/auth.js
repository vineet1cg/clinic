import { env } from '../../config/env.js';
import { OpenEmrError } from './errors.js';

let cachedToken;

export function clearOpenEmrToken() {
  cachedToken = undefined;
}

export async function getOpenEmrAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.OPENEMR_CLIENT_ID,
    client_secret: env.OPENEMR_CLIENT_SECRET,
    scope: env.OPENEMR_SCOPES,
  });

  let response;
  try {
    response = await fetch(env.OPENEMR_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(env.OPENEMR_TIMEOUT_MS),
    });
  } catch {
    throw new OpenEmrError('OpenEMR authentication is unavailable.', {
      operation: 'oauth.client_credentials',
    });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new OpenEmrError('OpenEMR rejected the configured integration credentials.', {
      statusCode: response.status || 502,
      operation: 'oauth.client_credentials',
    });
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 300) * 1000,
  };
  return cachedToken.value;
}
