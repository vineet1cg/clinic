import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '@clinicos/contracts';
import { AuthContext } from '../../contexts/auth-context.js';
import { ConsultationPayment } from './ConsultationPayment.jsx';
import { collectPayment } from '../../services/clinic.service.js';

vi.mock('../../services/clinic.service.js', () => ({ collectPayment: vi.fn() }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const invoice = { id: 'invoice-1', invoiceNumber: 'TEST-1', balance: 500, status: 'UNPAID' };
function setup(permissions = [PERMISSIONS.PAYMENT_COLLECT]) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <AuthContext.Provider value={{ user: { permissions } }}>
        <MemoryRouter>
          <ConsultationPayment invoice={invoice} onClose={() => {}} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
describe('inline consultation payment', () => {
  it('records only on explicit confirmation, reuses its key after a failed response, then confirms paid', async () => {
    collectPayment
      .mockRejectedValueOnce(new Error('Network interrupted'))
      .mockResolvedValueOnce({ ...invoice, balance: 0, status: 'PAID' });
    setup();
    expect(collectPayment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Record ₹500/ }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /Record ₹500/ }));
    await screen.findByRole('status');
    expect(collectPayment).toHaveBeenCalledTimes(2);
    expect(collectPayment.mock.calls[0][2]).toBe(collectPayment.mock.calls[1][2]);
    expect(collectPayment.mock.calls[0][1]).toEqual({ amount: 500, method: 'CASH', reference: '' });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Record ₹500/ })).not.toBeInTheDocument(),
    );
  });
  it('does not offer collection without permission', () => {
    setup([]);
    expect(screen.queryByRole('button', { name: /Record ₹500/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Ask authorized billing staff/)).toBeInTheDocument();
  });
});
