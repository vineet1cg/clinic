import { useQuery } from '@tanstack/react-query';
import { Check, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { searchPatients } from '../../services/clinic.service.js';
import { inputClassName } from '../forms/FormField.jsx';

export function PatientPicker({ selectedPatient, onSelect, label = 'Patient' }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim();
  const patientQuery = useQuery({
    queryKey: ['patients', 'picker', normalizedQuery],
    queryFn: () => searchPatients(normalizedQuery),
    enabled: normalizedQuery.length >= 2 && !selectedPatient,
  });

  if (selectedPatient) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold text-clinic-text">{label}</p>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-clinic-primary/30 bg-clinic-primary-soft p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-clinic-surface text-clinic-primary">
              <Check aria-hidden="true" size={19} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-clinic-text">
                {selectedPatient.fullName}
              </p>
              <p className="text-xs text-clinic-muted">
                {selectedPatient.patientNumber} · {selectedPatient.mobile}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery('');
            }}
            className="min-h-11 rounded-lg px-3 text-sm font-bold text-clinic-primary hover:bg-clinic-surface"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="patient-picker-search"
        className="mb-2 block text-sm font-semibold text-clinic-text"
      >
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-clinic-muted"
          size={18}
        />
        <input
          id="patient-picker-search"
          className={`${inputClassName} pl-10`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, mobile or patient ID"
          autoComplete="off"
        />
      </div>
      {normalizedQuery.length > 0 && normalizedQuery.length < 2 ? (
        <p className="mt-1.5 text-xs text-clinic-muted">Enter at least 2 characters.</p>
      ) : null}
      {patientQuery.isFetching ? (
        <p className="mt-2 text-sm text-clinic-muted">Searching patients…</p>
      ) : null}
      {patientQuery.data?.length ? (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-clinic-border bg-clinic-surface p-1 shadow-card">
          {patientQuery.data.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => onSelect(patient)}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-clinic-bg"
              >
                <UserRound aria-hidden="true" className="shrink-0 text-clinic-primary" size={19} />
                <span>
                  <span className="block text-sm font-bold text-clinic-text">
                    {patient.fullName}
                  </span>
                  <span className="block text-xs text-clinic-muted">
                    {patient.patientNumber} · {patient.mobile}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : normalizedQuery.length >= 2 && !patientQuery.isFetching ? (
        <p className="mt-2 text-sm text-clinic-muted">No matching patient found.</p>
      ) : null}
    </div>
  );
}
