import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('ClinicOS API contracts', () => {
  it('reports liveness without external dependencies', async () => {
    const response = await request(createApp()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'clinicos-api' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('reports the versioned API surface', async () => {
    const response = await request(createApp()).get('/api/v1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: 'ClinicOS API',
      version: 'v1',
      status: 'ready',
      resources: [
        'auth',
        'staff',
        'patients',
        'appointments',
        'queue',
        'encounters',
        'billing',
        'reports',
        'audit',
        'settings',
        'inventory',
        'lab',
      ],
    });
  });

  it('uses the standard not-found error contract', async () => {
    const response = await request(createApp()).get('/api/v1/missing');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('returns field-level login validation errors before database access', async () => {
    const response = await request(createApp())
      .post('/api/v1/auth/login')
      .send({ email: 'bad', password: '' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.length).toBeGreaterThan(0);
  });
});
