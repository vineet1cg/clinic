import { describe, expect, it } from 'vitest';
import { parseApiEnv } from './env.js';

describe('API production environment', () => {
  it('rejects insecure production cookies, origins, and example secrets', () => {
    expect(() =>
      parseApiEnv({
        NODE_ENV: 'production',
        APP_BASE_URL: 'http://clinic.example',
        CORS_ORIGINS: 'http://clinic.example',
        COOKIE_SECURE: 'false',
        JWT_SECRET: 'local-compose-secret-change-before-deploy',
      }),
    ).toThrow(/JWT_SECRET.*COOKIE_SECURE.*APP_BASE_URL.*CORS_ORIGINS/);
  });

  it('accepts an HTTPS production origin and a strong secret', () => {
    const result = parseApiEnv({
      NODE_ENV: 'production',
      APP_BASE_URL: 'https://clinic.example',
      CORS_ORIGINS: 'https://clinic.example',
      COOKIE_SECURE: 'true',
      JWT_SECRET: 'Q7!vN2@kP9#rT4$xW8%yB3^mD6&fH1*jL5(zC0)sE7-gR2_uI9+aS4=wX8!qN7#vT3@pL6',
    });
    expect(result.COOKIE_SECURE).toBe(true);
  });
});
