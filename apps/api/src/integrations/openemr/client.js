import { env } from '../../config/env.js';
import { clearOpenEmrToken, getOpenEmrAccessToken } from './auth.js';
import { OpenEmrError } from './errors.js';

export class OpenEmrClient {
  async request(path, options = {}, retryAuthentication = true) {
    const accessToken = await getOpenEmrAccessToken();
    const url = new URL(path.replace(/^\//, ''), `${env.OPENEMR_BASE_URL.replace(/\/$/, '')}/`);

    const operation = `${options.method || 'GET'} ${path.split('?')[0]}`;
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers: {
          accept: 'application/fhir+json, application/json',
          authorization: `Bearer ${accessToken}`,
          ...(options.body ? { 'content-type': 'application/fhir+json' } : {}),
          ...options.headers,
        },
        signal: AbortSignal.timeout(env.OPENEMR_TIMEOUT_MS),
      });
    } catch {
      throw new OpenEmrError('OpenEMR did not respond in time.', {
        operation,
      });
    }

    if (response.status === 401 && retryAuthentication) {
      clearOpenEmrToken();
      return this.request(path, options, false);
    }

    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new OpenEmrError('OpenEMR could not complete the requested operation.', {
        statusCode: response.status,
        operation,
      });
    }

    return payload;
  }
}

export const openEmrClient = new OpenEmrClient();
