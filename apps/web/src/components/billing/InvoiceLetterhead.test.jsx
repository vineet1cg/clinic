import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InvoiceLetterhead } from './InvoiceLetterhead.jsx';

afterEach(cleanup);
const invoice = {
  invoiceNumber: 'TEST-001',
  status: 'UNPAID',
  purpose: 'CONSULTATION',
  createdAt: '2026-09-20T08:00:00Z',
  patientId: { fullName: 'Demo Patient', patientNumber: 'PT-TEST' },
  doctorId: { name: 'Demo Doctor' },
};

describe('Maitri invoice letterhead', () => {
  it('uses the original logo and live invoice identity without calling an unpaid invoice a receipt', () => {
    render(<InvoiceLetterhead invoice={invoice} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/branding/maitri-logo.jpeg');
    expect(screen.getByRole('heading', { name: 'Invoice · TEST-001' })).toBeInTheDocument();
    expect(screen.getByText('Demo Patient')).toBeInTheDocument();
    expect(screen.getByText('PT-TEST')).toBeInTheDocument();
    expect(screen.getByText('Demo Doctor')).toBeInTheDocument();
    expect(screen.getByText('Hospital & Maternity Home')).toBeInTheDocument();
  });
  it('labels fully paid invoices as receipts and handles missing optional doctor information', () => {
    render(<InvoiceLetterhead invoice={{ ...invoice, status: 'PAID', doctorId: null }} />);
    expect(screen.getByRole('heading', { name: 'Payment receipt · TEST-001' })).toBeInTheDocument();
    expect(screen.queryByText('Doctor')).not.toBeInTheDocument();
  });
});
