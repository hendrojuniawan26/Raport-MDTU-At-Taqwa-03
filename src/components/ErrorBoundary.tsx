import { AlertTriangle, RefreshCw } from 'lucide-react';
import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan pada aplikasi.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F9F8] flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-700" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-slate-900">
                Terjadi Gangguan Tampilan
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                Aplikasi mengalami kendala sementara saat memproses halaman ini. Data yang sudah tersimpan di server tetap aman.
              </p>
              {this.state.errorMessage && (
                <p className="text-[11px] font-mono text-slate-400 break-words pt-1">
                  {this.state.errorMessage}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
