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

  it('formats and processes payment receipt notifications', async () => {
    const result = await processNotificationJob({
      id: 'job-receipt-1',
      name: 'PAYMENT_RECEIPT',
      data: {
        recipient: '+919876543210',
        templateCode: 'payment_receipt',
        payload: {
          invoiceNumber: 'INV000001',
          amount: 500,
          patientName: 'Jane Doe',
        },
      },
    });

    expect(result.jobId).toBe('job-receipt-1');
    expect(result.messageSummary).toContain('INV000001');
    expect(result).not.toHaveProperty('recipient');
  });

  it('formats and processes appointment confirmation notifications', async () => {
    const result = await processNotificationJob({
      id: 'job-appoint-1',
      name: 'APPOINTMENT_CONFIRMATION',
      data: {
        recipient: 'patient@example.com',
        templateCode: 'appointment_confirmation',
        payload: {
          doctorName: 'Dr. Smith',
          patientName: 'John Doe',
          date: '2026-10-06',
          time: '10:00 AM',
        },
      },
    });

    expect(result.channel).toBe('email');
    expect(result.messageSummary).toContain('Dr. Smith');
  });

  it('rejects an unknown job type', async () => {
    await expect(
      processNotificationJob({ id: 'job-2', name: 'UNKNOWN', data: {} }),
    ).rejects.toThrow(/unsupported/i);
  });
});
