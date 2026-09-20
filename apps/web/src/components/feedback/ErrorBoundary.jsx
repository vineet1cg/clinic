import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('ClinicOS render failure', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-dvh items-center justify-center bg-clinic-bg p-6">
        <section className="w-full max-w-lg rounded-2xl border border-clinic-border bg-clinic-surface p-8 text-center shadow-card">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-clinic-danger-soft text-clinic-danger">
            <AlertTriangle aria-hidden="true" size={24} />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold text-clinic-text">
            ClinicOS needs a refresh
          </h1>
          <p className="mt-2 text-base leading-7 text-clinic-muted">
            Reload this page and check the latest saved record before submitting again. A request
            may have completed before this screen stopped responding.
          </p>
          <button
            className="mt-6 min-h-11 rounded-xl bg-clinic-action px-5 py-2.5 font-semibold text-white transition-colors hover:bg-clinic-action-hover"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload ClinicOS
          </button>
        </section>
      </main>
    );
  }
}
