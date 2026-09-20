import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Volume2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { getPublicQueue } from '../services/clinic.service.js';
import { ThemeSelect } from '../components/ui/ThemeSelect.jsx';
import { ClinicBrand } from '../components/ui/ClinicBrand.jsx';

export default function QueueDisplayPage() {
  const { doctorId } = useParams();
  const queueQuery = useQuery({
    queryKey: ['public-queue', doctorId],
    queryFn: () => getPublicQueue(doctorId),
    refetchInterval: 5_000,
  });
  const current = queueQuery.data?.nowConsulting?.[0];
  const waiting = queueQuery.data?.waiting || [];

  return (
    <main className="flex min-h-dvh flex-col bg-clinic-bg p-6 text-clinic-text sm:p-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-clinic-border pb-5">
        <ClinicBrand subtitle="Hospital & Maternity Home · Waiting room" />
        <div className="text-right">
          <p className="text-sm font-semibold text-clinic-muted">
            {doctorId === 'main' ? 'All doctor stations' : `Doctor station ${doctorId}`}
          </p>
          <p className="mt-1 text-xs text-clinic-muted">
            Live queue ·{' '}
            {queueQuery.data?.date ? formatClinicDate(queueQuery.data.date) : 'connecting…'}
          </p>
        </div>
        <ThemeSelect />
      </header>
      <section
        className="flex flex-1 flex-col items-center justify-center text-center"
        aria-live="polite"
      >
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-clinic-primary">
          Now consulting
        </p>
        <p className="mt-5 font-display text-8xl font-bold tabular-nums sm:text-9xl">
          {current?.tokenNumber ?? '—'}
        </p>
        <p className="mt-6 text-xl text-clinic-muted">
          {current ? `Please proceed to ${current.doctorName}` : 'No token has been called yet'}
        </p>
        <div className="mt-12 w-full max-w-3xl rounded-2xl bg-clinic-surface px-6 py-6 sm:px-8">
          <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider text-clinic-primary">
            <Volume2 aria-hidden="true" size={17} />
            Please wait
          </div>
          <p className="mt-2 text-lg font-semibold text-clinic-text">Next tokens</p>
          {queueQuery.isError ? (
            <p className="mt-3 text-sm text-clinic-danger">Waiting-room display is reconnecting…</p>
          ) : null}
          {!queueQuery.isError && !waiting.length ? (
            <p className="mt-3 text-sm text-clinic-muted">The queue is clear.</p>
          ) : null}
          {waiting.length ? (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {waiting.slice(0, 12).map((entry) => (
                <span
                  key={`${entry.tokenNumber}-${entry.doctorName}`}
                  className="rounded-xl bg-clinic-primary-soft px-4 py-3 text-2xl font-bold tabular-nums text-clinic-text"
                >
                  {entry.tokenNumber}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs text-clinic-muted">
          <RefreshCw aria-hidden="true" size={14} />
          Updates automatically
        </p>
      </section>
      <footer className="border-t border-clinic-border pt-5 text-center text-sm text-clinic-muted">
        Only token numbers are shown to protect patient privacy.
      </footer>
    </main>
  );
}
import { formatClinicDate } from '../utils/format.js';
