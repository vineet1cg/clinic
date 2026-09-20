import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermissionBoundary } from './PermissionBoundary.jsx';

let permissions = [];
vi.mock('../../hooks/useAuth.js', () => ({ useAuth: () => ({ user: { permissions } }) }));
afterEach(cleanup);

describe('direct page permission boundary', () => {
  it('does not mount the page or start its queries when access is denied', () => {
    permissions = ['patient.view'];
    const RestrictedPage = vi.fn(() => <p>Financial records</p>);
    render(
      <MemoryRouter>
        <PermissionBoundary permissions={['billing.view']}>
          <RestrictedPage />
        </PermissionBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'This page is restricted' })).toBeInTheDocument();
    expect(RestrictedPage).not.toHaveBeenCalled();
  });

  it('allows a page when the user has any of its accepted permissions', () => {
    permissions = ['report.operational'];
    render(
      <MemoryRouter>
        <PermissionBoundary permissions={['report.operational', 'report.financial']}>
          <p>Operational report</p>
        </PermissionBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText('Operational report')).toBeInTheDocument();
  });
});
