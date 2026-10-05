import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PatientRegistrationPage from './PatientRegistrationPage.jsx';

vi.mock('../hooks/useClinicClock.js', () => ({
  useClinicClock: () => ({ date: '2026-09-21', time: '10:30' }),
}));

vi.mock('../services/clinic.service.js', () => ({
  createPatient: vi.fn(),
}));

afterEach(cleanup);

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <MemoryRouter>
        <PatientRegistrationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('patient registration age calculation', () => {
  it('adds DOB separators as digits are entered', () => {
    renderPage();
    const dateOfBirth = screen.getByLabelText('Date of birth');

    fireEvent.change(dateOfBirth, { target: { value: '12' } });
    expect(dateOfBirth).toHaveValue('12/');

    fireEvent.change(dateOfBirth, { target: { value: '12/09' } });
    expect(dateOfBirth).toHaveValue('12/09/');
  });

  it('calculates completed years as soon as an exact birth date is entered', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Date of birth'), {
      target: { value: '22/09/2000' },
    });
    await waitFor(() => expect(screen.getByLabelText('Age (calculated)')).toHaveValue(25));

    fireEvent.change(screen.getByLabelText('Date of birth'), {
      target: { value: '21/09/2000' },
    });
    await waitFor(() => expect(screen.getByLabelText('Age (calculated)')).toHaveValue(26));
    expect(screen.getByLabelText('Age (calculated)')).toHaveAttribute('readonly');
  });
});
