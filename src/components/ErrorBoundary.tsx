import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : 'Unexpected application error';
    return {
      hasError: true,
      message: raw,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Uncaught application error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendlyMessage = `Cloud sync permission or connectivity notice (${parsed.operationType || 'read'} on ${parsed.path || 'database'}): ${parsed.error}`;
        }
      } catch {
        // non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#FBF9F5] text-[#1C1917] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#9A6B2F] font-semibold">
            Gracious Voice Celebration Centre
          </p>
          <h1 className="font-serif text-3xl font-medium">We encountered a temporary issue</h1>
          <p className="text-sm text-stone-600 max-w-lg leading-relaxed break-words">
            {friendlyMessage}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, message: '' });
              window.location.reload();
            }}
            className="px-5 py-2.5 bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
