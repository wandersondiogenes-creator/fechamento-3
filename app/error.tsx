'use client';

import React, { useEffect } from 'react';
import { RefreshCw, AlertTriangle, Home, Trash2 } from 'lucide-react';

import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error Boundary caught an unhandled error:', error);
  }, [error]);

  const handleClearCacheAndReload = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
    } catch {}
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center p-4 font-sans antialiased">
      <div className="max-w-md w-full bg-white/95 border border-black/[0.08] rounded-3xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100 shadow-sm">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
            Ocorreu um erro na aplicação
          </h2>
          <p className="text-sm text-slate-500 font-normal leading-relaxed">
            {error?.message || 'Não foi possível carregar a visualização no momento.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full h-11 bg-[#007AFF] hover:bg-[#0062cc] text-white font-medium text-sm rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>

          <button
            onClick={handleClearCacheAndReload}
            className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Trash2 className="w-4 h-4 text-slate-500" />
            Limpar cache e recarregar
          </button>

          <Link
            href="/"
            className="w-full h-10 text-slate-500 hover:text-slate-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}
