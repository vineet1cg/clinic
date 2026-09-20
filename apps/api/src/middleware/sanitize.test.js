import { describe, expect, it, vi } from 'vitest';
import { rejectMongoOperators } from './sanitize.js';

describe('request key sanitization', () => {
  it.each(['$where', 'profile.name', '__proto__', 'prototype', 'constructor'])(
    'rejects unsafe key %s',
    (key) => {
      const next = vi.fn();
      rejectMongoOperators({ body: { [key]: 'unsafe' }, query: {}, params: {} }, {}, next);
      expect(next.mock.calls[0][0]).toMatchObject({ code: 'UNSAFE_INPUT', statusCode: 400 });
    },
  );
});
