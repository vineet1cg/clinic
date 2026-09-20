import { describe, expect, it } from 'vitest';
import { processNotificationJob } from './notification.handler.js';

describe('notification worker handler', () => {
  it('accepts a valid development reminder without exposing patient data', async () => {
    const result = await processNotificationJob({
      id: 'job-1',
      name: 'APPOINTMENT_REMINDER',
      data: { recipient: '+919999999999', templateCode: 'appointment_reminder' },
    });

    expect(result).toMatchObject({
      delivered: false,
      provider: 'development-log',
      jobId: 'job-1',
    });
    expect(result).not.toHaveProperty('recipient');
  });

  it('rejects an unknown job type', async () => {
    await expect(
      processNotificationJob({ id: 'job-2', name: 'UNKNOWN', data: {} }),
    ).rejects.toThrow(/unsupported/i);
  });
});
