/**
 * ErrorBoundary — voorkomt wit scherm bij onverwachte crashes
 *
 * React vereist een class component voor error boundaries; daarom geen hooks
 * (geen useTheme, geen useAppConfig). De error-state toont generieke fallback-
 * tekst zonder tenant-specifieke labels. LogoBrand zelf is een function-
 * component en haalt brand wel correct op via useTheme.
 */

import React from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";
import LogoBrand from "./LogoBrand";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Hier later eventueel Sentry o.i.d. koppelen
    console.error("[ErrorBoundary] Onverwachte fout:", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[var(--color-primary)] flex items-center justify-center p-8">
          <div className="bg-white rounded-sm shadow-xl max-w-lg w-full p-10 text-center space-y-6">

            {/* Logo */}
            <LogoBrand
              variant="dark"
              imgClassName="h-10 w-auto mx-auto object-contain"
              textClassName="text-[var(--color-primary)] font-bold text-xl tracking-wide text-center block"
            />

            {/* Foutmelding */}
            <div className="flex items-center justify-center gap-3 text-red-500">
              <AlertOctagon size={24} />
              <h2 className="text-lg font-bold text-[var(--color-primary)]">Er is iets misgegaan</h2>
            </div>

            <p className="text-sm text-slate-500 leading-relaxed">
              De applicatie is tegen een onverwachte fout aangelopen.
              Je data is veilig opgeslagen in Supabase.
            </p>

            {/* Foutdetail (alleen in development) */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="text-left text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-auto max-h-32 text-red-600">
                {this.state.error.toString()}
              </pre>
            )}

            {/* Herstel-knop */}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 mx-auto bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-primary)] px-6 py-3 rounded-sm font-bold text-sm uppercase tracking-widest transition-colors shadow-sm"
            >
              <RefreshCw size={14} /> Pagina herladen
            </button>

            <p className="text-[10px] text-slate-300 uppercase tracking-widest">
              Business Transformation Workbench
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
