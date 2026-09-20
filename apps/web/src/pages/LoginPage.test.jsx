import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../contexts/ThemeProvider.jsx';

const login = vi.fn().mockResolvedValue({ passwordResetRequired: false });

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
    login,
    isLoggingIn: false,
  }),
}));

let LoginPage;

beforeAll(async () => {
  ({ default: LoginPage } = await import('./LoginPage.jsx'));
});

afterEach(() => {
  login.mockClear();
});

describe('LoginPage', () => {
  it('submits staff-entered credentials', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <LoginPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Work email'), {
      target: { value: 'admin@clinic.local' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe123!' } });

    fireEvent.click(screen.getByRole('button', { name: 'Sign in securely' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'admin@clinic.local',
        password: 'ChangeMe123!',
      });
    });
  });
});
