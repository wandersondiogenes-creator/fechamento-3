'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle, Home, FileText } from 'lucide-react';
import { logDiagnostic } from '@/lib/autosave-service';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoverAttempts: number;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    recoverAttempts: 0,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      recoverAttempts: 0,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    logDiagnostic('error', 'ErrorBoundary', error.message, {
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleTryRecover = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      recoverAttempts: prev.recoverAttempts + 1,
    }));
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-[#F5F5F7]">
          <div className="max-w-lg w-full bg-white/90 backdrop-blur-2xl rounded-3xl p-8 border border-black/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.08)] text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            {/* Apple Style Icon */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#1D1D1F] tracking-tight">
                {this.props.fallbackTitle || 'Ocorreu uma instabilidade inesperada'}
              </h2>
              <p className="text-sm text-[#86868B] leading-relaxed">
                Não se preocupe! O <strong>Autosave inteligente</strong> salvou seus dados e arquivos importados. Você não perderá o seu trabalho.
              </p>
            </div>

            {/* Error Message Details */}
            {this.state.error && (
              <div className="bg-[#F5F5F7] rounded-xl p-3.5 text-left border border-black/[0.05] overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#86868B] mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Detalhes do Diagnóstico</span>
                </div>
                <div className="font-mono text-xs text-red-600 truncate">
                  {this.state.error.name}: {this.state.error.message}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleTryRecover}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Restaurar Painel</span>
              </button>

              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F] text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Recarregar Página</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-[#86868B]">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
              <span>Proteção de Sessão Ativa: Cache local e Supabase protegidos</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
