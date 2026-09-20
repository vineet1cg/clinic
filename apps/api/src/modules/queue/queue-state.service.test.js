import { describe, expect, it } from 'vitest';
import { assertQueueTransition } from './queue-state.service.js';

describe('queue state transitions', () => {
  it('allows the normal vitals progression', () => {
    expect(() => assertQueueTransition('WAITING', 'VITALS_PENDING')).not.toThrow();
  });

  it('rejects an unsafe state jump', () => {
    expect(() => assertQueueTransition('WAITING', 'PAID')).toThrowError(/transition/i);
  });

  it('does not allow staff to manually release a fee-pending visit', () => {
    expect(() => assertQueueTransition('PAYMENT_PENDING', 'WAITING')).toThrowError(/transition/i);
  });
});
