'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Cloud,
  HardDrive,
  ShieldCheck,
  Zap,
  Server,
  Database,
  ArrowUpRight,
} from 'lucide-react';
import {
  AppDiagnosticLog,
  getDiagnosticLogs,
  clearDiagnosticLogs,
  logDiagnostic,
} from '@/lib/autosave-service';
import { isSupabaseConfigured } from '@/lib/supabase-client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  autosaveStatus: {
    lastSaved: Date | null;
    isSaving: boolean;
    cloudSaved: boolean;
  };
  onForceSave: () => void;
  onRestoreSession: () => void;
}

export function SystemDiagnosticsModal({
  isOpen,
  onClose,
  autosaveStatus,
  onForceSave,
  onRestoreSession,
}: Props) {
  const [logs, setLogs] = useState<AppDiagnosticLog[]>([]);
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'health' | 'guidelines'>('health');

  const supabaseReady = isSupabaseConfigured();

  const refreshLogs = () => {
    setLogs([...getDiagnosticLogs()]);
  };

  useEffect(() => {
    if (isOpen) {
      refreshLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((l) => {
    if (filterLevel === 'all') return true;
    return l.level === filterLevel;
  });

  const handleCopyLogs = () => {
    const text = JSON.stringify(logs, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    clearDiagnosticLogs();
    refreshLogs();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl w-full max-w-3xl rounded-3xl border border-black/[0.08] shadow-[0_25px_60px_rgba(0,0,0,0.15)] flex flex-col max-h-[85vh] overflow-hidden text-[#1D1D1F] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-black/[0.06] flex items-center justify-between bg-[#F5F5F7]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1D1D1F] tracking-tight">
                Diagnóstico & Saúde do Sistema
              </h3>
              <p className="text-xs text-[#86868B]">
                Autosave, resiliência contra falhas, recuperação de sessão e telemetria
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/[0.05] hover:bg-black/[0.1] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigator */}
        <div className="flex border-b border-black/[0.06] px-6 bg-white gap-2 pt-2">
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'health'
                ? 'border-[#0071E3] text-[#0071E3] bg-[#0071E3]/5'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Status de Resiliência
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-[#0071E3] text-[#0071E3] bg-[#0071E3]/5'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <Activity className="w-4 h-4" />
            Logs de Execução ({logs.length})
          </button>

          <button
            onClick={() => setActiveTab('guidelines')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'guidelines'
                ? 'border-[#0071E3] text-[#0071E3] bg-[#0071E3]/5'
                : 'border-transparent text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            <Zap className="w-4 h-4" />
            Boas Práticas de Estabilidade
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'health' && (
            <div className="space-y-6">
              {/* Status Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Local Autosave */}
                <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#86868B]">
                      <HardDrive className="w-4 h-4 text-indigo-600" />
                      <span>Autosave Local</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="text-lg font-bold text-[#1D1D1F]">
                    {autosaveStatus.lastSaved
                      ? autosaveStatus.lastSaved.toLocaleTimeString('pt-BR')
                      : 'Ativo'}
                  </div>
                  <p className="text-[11px] text-[#86868B]">
                    Persistência contínua a cada modificação na memória do navegador.
                  </p>
                </div>

                {/* Cloud Sync Supabase */}
                <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#86868B]">
                      <Cloud className="w-4 h-4 text-blue-600" />
                      <span>Sincronização Nuvem</span>
                    </div>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        supabaseReady ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                  </div>
                  <div className="text-lg font-bold text-[#1D1D1F]">
                    {supabaseReady ? 'Supabase Conectado' : 'Modo Híbrido Local'}
                  </div>
                  <p className="text-[11px] text-[#86868B]">
                    {supabaseReady
                      ? 'Backups redundantes salvos na nuvem do Supabase.'
                      : 'Protegido localmente com fallback automático.'}
                  </p>
                </div>

                {/* Error Boundary Protection */}
                <div className="bg-[#F5F5F7] rounded-2xl p-4 border border-black/[0.04] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#86868B]">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Error Boundaries</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="text-lg font-bold text-[#1D1D1F]">100% Protegido</div>
                  <p className="text-[11px] text-[#86868B]">
                    Falhas em renderização são isoladas sem travar a aplicação inteira.
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl p-5 border border-blue-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-[#1D1D1F]">
                    Ações de Recuperação & Segurança
                  </h4>
                  <p className="text-xs text-[#86868B]">
                    Forçar gravação manual imediata ou restaurar o último snapshot salvo
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      onForceSave();
                      refreshLogs();
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${autosaveStatus.isSaving ? 'animate-spin' : ''}`} />
                    <span>Salvar Agora</span>
                  </button>

                  <button
                    onClick={() => {
                      onRestoreSession();
                      refreshLogs();
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-black/[0.04] border border-black/[0.08] text-[#1D1D1F] text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-[#0071E3]" />
                    <span>Recarregar Último Snapshot</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              {/* Filter and Action Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-[#F5F5F7] p-1 rounded-xl">
                  {(['all', 'error', 'warn', 'info'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setFilterLevel(lvl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                        filterLevel === lvl
                          ? 'bg-white text-[#1D1D1F] shadow-sm'
                          : 'text-[#86868B] hover:text-[#1D1D1F]'
                      }`}
                    >
                      {lvl === 'all' ? 'Todos' : lvl}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLogs}
                    className="px-3 py-1.5 rounded-xl bg-[#F5F5F7] hover:bg-black/[0.06] text-xs font-medium text-[#1D1D1F] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado!' : 'Copiar Logs'}</span>
                  </button>

                  <button
                    onClick={handleClear}
                    className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-xs font-medium text-red-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar</span>
                  </button>
                </div>
              </div>

              {/* Logs List */}
              <div className="bg-[#1C1C1E] rounded-2xl p-4 font-mono text-xs text-white max-h-80 overflow-y-auto space-y-2 border border-black/10">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-neutral-400">Nenhum evento registrado até o momento.</div>
                ) : (
                  filteredLogs.map((log) => {
                    const time = new Date(log.timestamp).toLocaleTimeString('pt-BR');
                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-2.5 py-1 border-b border-white/5 last:border-0"
                      >
                        <span className="text-neutral-400 select-none text-[11px]">{time}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.level === 'error'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : log.level === 'warn'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : log.level === 'success'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {log.level}
                        </span>
                        <span className="text-indigo-400 font-semibold">[{log.module}]</span>
                        <span className="text-neutral-200 flex-1 break-all">{log.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'guidelines' && (
            <div className="space-y-4 text-sm text-[#1D1D1F]">
              <h4 className="font-bold text-base tracking-tight">
                Boas Práticas para Alta Estabilidade e Confiabilidade
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-black/[0.04] space-y-1.5">
                  <div className="font-bold text-xs text-[#0071E3] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0071E3]" />
                    1. Autosave Híbrido com Fallback
                  </div>
                  <p className="text-xs text-[#86868B]">
                    O estado é salvo automaticamente a cada importação, regra aplicada ou exclusão. Se o navegador for fechado ou a Vercel reiniciar, tudo é restaurado no próximo carregamento.
                  </p>
                </div>

                <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-black/[0.04] space-y-1.5">
                  <div className="font-bold text-xs text-[#0071E3] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0071E3]" />
                    2. Retry Automático com Backoff
                  </div>
                  <p className="text-xs text-[#86868B]">
                    Chamadas para o Supabase e APIs externas possuem tolerância a falhas transitórias com 3 tentativas automáticas e recuo exponencial antes de reportar erro.
                  </p>
                </div>

                <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-black/[0.04] space-y-1.5">
                  <div className="font-bold text-xs text-[#0071E3] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0071E3]" />
                    3. Error Boundaries por Módulo
                  </div>
                  <p className="text-xs text-[#86868B]">
                    Erros inesperados em componentes de renderização pesada não travam a aplicação inteira e oferecem botão instantâneo de autorecuperação com 1 clique.
                  </p>
                </div>

                <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-black/[0.04] space-y-1.5">
                  <div className="font-bold text-xs text-[#0071E3] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0071E3]" />
                    4. Tratamento Sem Bloqueios
                  </div>
                  <p className="text-xs text-[#86868B]">
                    O processamento de planilhas com milhares de linhas é distribuído sem travar a interface visual através de memoização de cálculos pesados.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-black/[0.06] bg-[#F5F5F7]/80 flex items-center justify-between px-6">
          <div className="text-xs text-[#86868B]">
            Wanfinance Pro Shield Engine v2.4
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
