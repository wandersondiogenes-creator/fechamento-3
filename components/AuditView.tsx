'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AuditLogEntry, AuditLogFilters, UserProfile } from '@/types/audit';
import {
  fetchAuditLogs,
  subscribeToAuditRealtime,
  logAuditAction,
} from '@/lib/audit-service';
import { getCurrentUser, getAllUsers, hasPermission } from '@/lib/auth-service';
import { CADASTRO_EMPRESAS } from '@/lib/cadastros';
import { ItemTimelineModal } from './ItemTimelineModal';
import { UserSelectorModal } from './UserSelectorModal';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  Building2,
  User,
  Clock,
  Activity,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Eye,
  RotateCcw,
  Users,
  Scale,
  DollarSign,
  TrendingUp,
  FileText,
  Layers,
  ArrowRight,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface AuditViewFilters {
  filterUser?: string;
  filterEmpresa?: string;
  filterBanco?: string;
  filterOperacao?: string;
  filterDataInicial?: string;
  filterDataFinal?: string;
  filterSituacao?: string;
  filterLote?: string;
  filterRegistro?: string;
  filterValorMin?: string;
  filterValorMax?: string;
  freeQuery?: string;
  activeSubTab?: 'trilha' | 'dashboard' | 'usuarios';
}

interface AuditViewProps {
  filters?: AuditViewFilters;
  onFiltersChange?: (filters: AuditViewFilters) => void;
}

export function AuditView({ filters: externalFilters, onFiltersChange }: AuditViewProps = {}) {
  const [activeUser, setActiveUser] = useState<UserProfile>(() => getCurrentUser());

  // Sub-tab
  const [internalActiveTab, setInternalActiveTab] = useState<'trilha' | 'dashboard' | 'usuarios'>('dashboard');
  const activeTab = externalFilters?.activeSubTab !== undefined ? externalFilters.activeSubTab : internalActiveTab;
  const setActiveTab = (tab: 'trilha' | 'dashboard' | 'usuarios') => {
    if (onFiltersChange) {
      onFiltersChange({ ...(externalFilters || {}), activeSubTab: tab });
    } else {
      setInternalActiveTab(tab);
    }
  };

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Drawer States
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLogEntry | null>(null);
  const [timelineTargetItem, setTimelineTargetItem] = useState<{
    id: string;
    title?: string;
    amount?: number;
  } | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Filters State
  const [internalUser, setInternalUser] = useState('');
  const [internalEmpresa, setInternalEmpresa] = useState('');
  const [internalBanco, setInternalBanco] = useState('');
  const [internalOperacao, setInternalOperacao] = useState('');
  const [internalDataInicial, setInternalDataInicial] = useState('');
  const [internalDataFinal, setInternalDataFinal] = useState('');
  const [internalSituacao, setInternalSituacao] = useState('');
  const [internalLote, setInternalLote] = useState('');
  const [internalRegistro, setInternalRegistro] = useState('');
  const [internalValorMin, setInternalValorMin] = useState<string>('');
  const [internalValorMax, setInternalValorMax] = useState<string>('');
  const [internalFreeQuery, setInternalFreeQuery] = useState('');

  const filterUser = externalFilters?.filterUser !== undefined ? externalFilters.filterUser : internalUser;
  const filterEmpresa = externalFilters?.filterEmpresa !== undefined ? externalFilters.filterEmpresa : internalEmpresa;
  const filterBanco = externalFilters?.filterBanco !== undefined ? externalFilters.filterBanco : internalBanco;
  const filterOperacao = externalFilters?.filterOperacao !== undefined ? externalFilters.filterOperacao : internalOperacao;
  const filterDataInicial = externalFilters?.filterDataInicial !== undefined ? externalFilters.filterDataInicial : internalDataInicial;
  const filterDataFinal = externalFilters?.filterDataFinal !== undefined ? externalFilters.filterDataFinal : internalDataFinal;
  const filterSituacao = externalFilters?.filterSituacao !== undefined ? externalFilters.filterSituacao : internalSituacao;
  const filterLote = externalFilters?.filterLote !== undefined ? externalFilters.filterLote : internalLote;
  const filterRegistro = externalFilters?.filterRegistro !== undefined ? externalFilters.filterRegistro : internalRegistro;
  const filterValorMin = externalFilters?.filterValorMin !== undefined ? externalFilters.filterValorMin : internalValorMin;
  const filterValorMax = externalFilters?.filterValorMax !== undefined ? externalFilters.filterValorMax : internalValorMax;
  const freeQuery = externalFilters?.freeQuery !== undefined ? externalFilters.freeQuery : internalFreeQuery;

  const updateSingleFilter = (key: keyof AuditViewFilters, val: any) => {
    if (onFiltersChange) {
      onFiltersChange({
        filterUser,
        filterEmpresa,
        filterBanco,
        filterOperacao,
        filterDataInicial,
        filterDataFinal,
        filterSituacao,
        filterLote,
        filterRegistro,
        filterValorMin,
        filterValorMax,
        freeQuery,
        activeSubTab: activeTab,
        [key]: val,
      });
    } else {
      if (key === 'filterUser') setInternalUser(val);
      if (key === 'filterEmpresa') setInternalEmpresa(val);
      if (key === 'filterBanco') setInternalBanco(val);
      if (key === 'filterOperacao') setInternalOperacao(val);
      if (key === 'filterDataInicial') setInternalDataInicial(val);
      if (key === 'filterDataFinal') setInternalDataFinal(val);
      if (key === 'filterSituacao') setInternalSituacao(val);
      if (key === 'filterLote') setInternalLote(val);
      if (key === 'filterRegistro') setInternalRegistro(val);
      if (key === 'filterValorMin') setInternalValorMin(val);
      if (key === 'filterValorMax') setInternalValorMax(val);
      if (key === 'freeQuery') setInternalFreeQuery(val);
    }
  };

  const setFilterUser = (val: string) => updateSingleFilter('filterUser', val);
  const setFilterEmpresa = (val: string) => updateSingleFilter('filterEmpresa', val);
  const setFilterBanco = (val: string) => updateSingleFilter('filterBanco', val);
  const setFilterOperacao = (val: string) => updateSingleFilter('filterOperacao', val);
  const setFilterDataInicial = (val: string) => updateSingleFilter('filterDataInicial', val);
  const setFilterDataFinal = (val: string) => updateSingleFilter('filterDataFinal', val);
  const setFilterSituacao = (val: string) => updateSingleFilter('filterSituacao', val);
  const setFilterLote = (val: string) => updateSingleFilter('filterLote', val);
  const setFilterRegistro = (val: string) => updateSingleFilter('filterRegistro', val);
  const setFilterValorMin = (val: string) => updateSingleFilter('filterValorMin', val);
  const setFilterValorMax = (val: string) => updateSingleFilter('filterValorMax', val);
  const setFreeQuery = (val: string) => updateSingleFilter('freeQuery', val);

  // Auto-fetch data
  const loadLogs = React.useCallback(async () => {
    setLoading(true);
    const filters: AuditLogFilters = {
      user_id: filterUser || undefined,
      empresa: filterEmpresa || undefined,
      banco: filterBanco || undefined,
      operacao: filterOperacao || undefined,
      data_inicial: filterDataInicial || undefined,
      data_final: filterDataFinal || undefined,
      situacao: filterSituacao || undefined,
      lote_id: filterLote || undefined,
      registro: filterRegistro || undefined,
      valor_min: filterValorMin ? Number(filterValorMin) : undefined,
      valor_max: filterValorMax ? Number(filterValorMax) : undefined,
      query: freeQuery || undefined,
    };

    const result = await fetchAuditLogs(filters);
    setLogs(result);
    setLoading(false);
  }, [
    filterUser,
    filterEmpresa,
    filterBanco,
    filterOperacao,
    filterDataInicial,
    filterDataFinal,
    filterSituacao,
    filterLote,
    filterRegistro,
    filterValorMin,
    filterValorMax,
    freeQuery,
  ]);

  useEffect(() => {
    loadLogs();

    // Inscrição em tempo real no Supabase
    const unsubscribe = subscribeToAuditRealtime((newLog) => {
      setLogs((prev) => [newLog, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [loadLogs]);

  const allUsersList = useMemo(() => getAllUsers(), []);

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(
      (l) => new Date(l.created_at).toISOString().split('T')[0] === todayStr
    );

    const activeUserNames = new Set(logs.map((l) => l.user_name));
    const importacoesCount = logs.filter(
      (l) => l.operacao === 'IMPORTACAO_ARQUIVO' || l.operacao === 'IMPORTACAO_COMPROVANTE'
    ).length;
    const fechamentosCount = logs.filter(
      (l) => l.operacao === 'FECHAMENTO_LOTE' || l.operacao === 'FECHAMENTO_DIARIO'
    ).length;
    const reaberturasCount = logs.filter((l) => l.operacao === 'REABERTURA_LOTE').length;

    const totalValorAuditado = logs.reduce((acc, l) => acc + (l.valor || 0), 0);

    return {
      totalHoje: todayLogs.length,
      usuariosAtivos: activeUserNames.size,
      importacoes: importacoesCount,
      fechamentos: fechamentosCount,
      reaberturas: reaberturasCount,
      valorTotal: totalValorAuditado,
      ultimosRegistros: logs.slice(0, 8),
    };
  }, [logs]);

  const clearFilters = () => {
    setFilterUser('');
    setFilterEmpresa('');
    setFilterBanco('');
    setFilterOperacao('');
    setFilterDataInicial('');
    setFilterDataFinal('');
    setFilterSituacao('');
    setFilterLote('');
    setFilterRegistro('');
    setFilterValorMin('');
    setFilterValorMax('');
    setFreeQuery('');
  };

  const handleExportAuditExcel = () => {
    const rows = logs.map((log) => {
      const dt = new Date(log.created_at);
      return {
        'ID Operação': log.id,
        Data: dt.toLocaleDateString('pt-BR'),
        Hora: dt.toLocaleTimeString('pt-BR'),
        Usuário: log.user_name,
        Empresa: log.empresa || '-',
        Banco: log.banco || '-',
        Operação: log.operacao,
        Descrição: log.descricao,
        'Registro / NSU': log.registro || '-',
        'Valor (R$)': log.valor ? log.valor.toFixed(2) : '-',
        'Situação Anterior': log.situacao_anterior || '-',
        'Nova Situação': log.situacao_nova || '-',
        'ID do Lote': log.lote_id || '-',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trilha_Auditoria');
    XLSX.writeFile(wb, `Relatorio_Auditoria_Supabase_${new Date().toISOString().split('T')[0]}.xlsx`);

    logAuditAction({
      operacao: 'EXPORTACAO_ARQUIVO',
      descricao: `Relatório oficial de auditoria exportado com ${logs.length} registros`,
      valor: logs.reduce((acc, l) => acc + (l.valor || 0), 0),
    });
  };

  const formatBRL = (val?: number) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const canViewAudit = hasPermission('visualizar_historico', activeUser);

  if (!canViewAudit) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-8 bg-white rounded-2xl shadow-xl border border-red-200 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-red-600 mx-auto" />
        <h2 className="text-xl font-extrabold text-slate-900">Acesso Restrito - Trilha de Auditoria</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Seu perfil atual (<strong>{activeUser.name}</strong> - {activeUser.role.toUpperCase()}) não possui a permissão <code className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-mono">visualizar_historico</code> ativada.
        </p>
        <button
          onClick={() => setIsUserModalOpen(true)}
          className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 cursor-pointer shadow-md"
        >
          Alternar para Usuário com Acesso (Admin / Gerente)
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner / Section Title */}
      <div className="bg-slate-950 text-white rounded-2xl p-6 border border-slate-800 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">
                Histórico, Auditoria & Rastreamento em Tempo Real
              </h1>
              <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-400 font-extrabold text-[10px] rounded-full border border-emerald-800 uppercase tracking-widest">
                Supabase RLS Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Todas as movimentações e operações do sistema registradas imutavelmente no banco de dados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUserModalOpen(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold rounded-xl border border-slate-700 text-xs flex items-center gap-2 cursor-pointer transition-all shadow-xs"
          >
            <User className="w-4 h-4 text-amber-400" />
            <span>Perfil: {activeUser.name}</span>
          </button>

          <button
            onClick={loadLogs}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Sincronizar</span>
          </button>

          <button
            onClick={handleExportAuditExcel}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Relatório</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'dashboard'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Dashboard de Atividades</span>
          </button>

          <button
            onClick={() => setActiveTab('trilha')}
            className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'trilha'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Trilha de Auditoria Geral ({logs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('usuarios')}
            className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'usuarios'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Usuários e Permissões RLS ({allUsersList.length})</span>
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-500 hidden sm:block">
          Total auditado: <strong className="text-emerald-700 font-mono">{formatBRL(stats.valorTotal)}</strong>
        </div>
      </div>

      {/* TAB 1: DASHBOARD DE ATIVIDADES */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Operações Hoje
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                  {stats.totalHoje}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                  Registradas em tempo real
                </span>
              </div>
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <Activity className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Usuários Ativos
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                  {stats.usuariosAtivos}
                </span>
                <span className="text-[11px] text-blue-600 font-semibold mt-1 block">
                  Sessões autorizadas
                </span>
              </div>
              <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Fechamentos de Lote
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                  {stats.fechamentos}
                </span>
                <span className="text-[11px] text-purple-600 font-semibold mt-1 block">
                  {stats.reaberturas} Reabertura(s)
                </span>
              </div>
              <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
                <Scale className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Importações de Arquivos
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                  {stats.importacoes}
                </span>
                <span className="text-[11px] text-amber-600 font-semibold mt-1 block">
                  Planilhas/Comprovantes
                </span>
              </div>
              <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                <Layers className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Activity Feed & Recent Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Feed em Tempo Real "Últimas Atividades" */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-base text-slate-900">
                    Feed de Últimas Atividades do Sistema
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  Atualização automática via Supabase
                </span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {stats.ultimosRegistros.map((log) => {
                  const dateObj = new Date(log.created_at);
                  const timeStr = dateObj.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={log.id}
                      onClick={() => setSelectedLogForDetail(log)}
                      className="p-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-all cursor-pointer flex items-start justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {log.user_name.charAt(0)}
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{log.user_name}</span>
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-extrabold uppercase">
                              {log.operacao}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium mt-0.5">
                            {log.descricao}
                          </p>

                          {log.empresa && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-semibold">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{log.empresa}</span>
                              {log.registro && log.registro !== '-' && (
                                <span className="font-mono text-slate-700 bg-slate-200/60 px-1.5 py-0.2 rounded">
                                  {log.registro}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono text-slate-500 font-bold block">
                          {timeStr}
                        </span>
                        {log.valor !== undefined && (
                          <span className="text-xs font-extrabold text-emerald-700 font-mono block mt-1">
                            {formatBRL(log.valor)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Security & System Audit Summary */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-5 border border-slate-800">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base text-white">Status da Segurança & RLS</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
                  <span className="text-slate-300">Auditoria Imutável:</span>
                  <span className="font-bold text-emerald-400">ATIVADA</span>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
                  <span className="text-slate-300">Persistência Supabase:</span>
                  <span className="font-bold text-emerald-400">ONLINE</span>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
                  <span className="text-slate-300">Sincronização Realtime:</span>
                  <span className="font-bold text-blue-400">CONECTADA</span>
                </div>

                <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
                  <span className="text-slate-300">Controle de Reabertura:</span>
                  <span className="font-bold text-amber-400">RASTREADO</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('trilha')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
                >
                  <span>Abrir Trilha de Auditoria Completa</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRILHA DE AUDITORIA GERAL */}
      {activeTab === 'trilha' && (
        <div className="space-y-4">
          {/* Advanced Filter Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                  Filtros da Trilha de Auditoria
                </h3>
              </div>
              <button
                onClick={clearFilters}
                className="text-xs font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              {/* Search Query */}
              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 block">Pesquisa Livre</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={freeQuery}
                    onChange={(e) => setFreeQuery(e.target.value)}
                    placeholder="Usuário, descrição, registro, NSU..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* User Select */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Usuário</label>
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">Todos os Usuários</option>
                  {allUsersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Empresa Select */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Empresa</label>
                <select
                  value={filterEmpresa}
                  onChange={(e) => setFilterEmpresa(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">Todas as Empresas</option>
                  {CADASTRO_EMPRESAS.map((emp) => (
                    <option key={emp} value={emp}>
                      {emp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Operação Select */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tipo de Operação</label>
                <select
                  value={filterOperacao}
                  onChange={(e) => setFilterOperacao(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">Todas as Operações</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="CRIACAO_LANCAMENTO">CRIACAO_LANCAMENTO</option>
                  <option value="ALTERACAO_LANCAMENTO">ALTERACAO_LANCAMENTO</option>
                  <option value="EXCLUSAO_LANCAMENTO">EXCLUSAO_LANCAMENTO</option>
                  <option value="FECHAMENTO_LOTE">FECHAMENTO_LOTE</option>
                  <option value="REABERTURA_LOTE">REABERTURA_LOTE</option>
                  <option value="CONCILIACAO">CONCILIACAO</option>
                  <option value="IMPORTACAO_ARQUIVO">IMPORTACAO_ARQUIVO</option>
                  <option value="EXPORTACAO_ARQUIVO">EXPORTACAO_ARQUIVO</option>
                  <option value="CADASTRO_USUARIO">CADASTRO_USUARIO</option>
                </select>
              </div>

              {/* Data Inicial */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Data Inicial</label>
                <input
                  type="date"
                  value={filterDataInicial}
                  onChange={(e) => setFilterDataInicial(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Data Final */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Data Final</label>
                <input
                  type="date"
                  value={filterDataFinal}
                  onChange={(e) => setFilterDataFinal(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Lote / Registro */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">NSU / Documento</label>
                <input
                  type="text"
                  value={filterRegistro}
                  onChange={(e) => setFilterRegistro(e.target.value)}
                  placeholder="Ex: 849201"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Valor Min */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor Min (R$)</label>
                <input
                  type="number"
                  value={filterValorMin}
                  onChange={(e) => setFilterValorMin(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Valor Max */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor Max (R$)</label>
                <input
                  type="number"
                  value={filterValorMax}
                  onChange={(e) => setFilterValorMax(e.target.value)}
                  placeholder="100000,00"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Audit Data Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-800">
                    <th className="px-4 py-3.5">Usuário</th>
                    <th className="px-4 py-3.5">Data / Hora</th>
                    <th className="px-4 py-3.5">Empresa</th>
                    <th className="px-4 py-3.5">Operação</th>
                    <th className="px-4 py-3.5">Descrição</th>
                    <th className="px-4 py-3.5">Registro / Doc</th>
                    <th className="px-4 py-3.5 text-right">Valor (R$)</th>
                    <th className="px-4 py-3.5">Situação</th>
                    <th className="px-4 py-3.5 text-center">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                        <span>Carregando registros de auditoria...</span>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <span className="font-bold text-sm block">Nenhum registro encontrado</span>
                        <span className="text-xs text-slate-400">Ajuste os filtros acima para expandir a busca.</span>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const dateObj = new Date(log.created_at);
                      const dtStr = dateObj.toLocaleDateString('pt-BR');
                      const hrStr = dateObj.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      const opBadgeColor =
                        log.operacao.includes('FECHAMENTO')
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : log.operacao.includes('REABERTURA')
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : log.operacao.includes('EXCLUSAO')
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : log.operacao.includes('CRIACAO')
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : 'bg-blue-100 text-blue-800 border-blue-200';

                      return (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                          onClick={() => setSelectedLogForDetail(log)}
                        >
                          <td className="px-4 py-3 font-extrabold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">
                                {log.user_name.charAt(0)}
                              </div>
                              <span>{log.user_name}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                            <span className="font-bold text-slate-800">{dtStr}</span>{' '}
                            <span className="text-slate-400">{hrStr}</span>
                          </td>

                          <td className="px-4 py-3 font-semibold text-slate-700 max-w-[160px] truncate">
                            {log.empresa || '-'}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${opBadgeColor}`}
                            >
                              {log.operacao}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-800 font-medium max-w-[260px] truncate">
                            {log.descricao}
                          </td>

                          <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {log.registro || '-'}
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                            {formatBRL(log.valor)}
                          </td>

                          <td className="px-4 py-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {log.situacao_nova || '-'}
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedLogForDetail(log)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Ver Detalhes do Log"
                            >
                              <Eye className="w-4 h-4 text-emerald-600" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USUÁRIOS E PERMISSÕES */}
      {activeTab === 'usuarios' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Gestão de Usuários e Políticas de Permissão RLS
              </h3>
              <p className="text-xs text-slate-500">
                Gerencie quem pode criar, alterar, fechar e reabrir lançamentos no banco Supabase
              </p>
            </div>

            <button
              onClick={() => setIsUserModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md"
            >
              <Users className="w-4 h-4" />
              <span>Gerenciar e Alternar Perfis</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allUsersList.map((u) => (
              <div
                key={u.id}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 relative hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">{u.name}</h4>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 bg-slate-200 text-slate-800 font-black text-[10px] rounded uppercase">
                    {u.role}
                  </span>
                </div>

                <div className="border-t border-slate-200/80 pt-2 space-y-1">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Permissões Ativas ({u.permissions?.length || 0}):
                  </div>

                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {u.permissions?.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Detalhes Completos do Log Selecionado */}
      {selectedLogForDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">Detalhes do Registro de Auditoria</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedLogForDetail.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-500 uppercase block text-[10px]">Usuário Responsável:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedLogForDetail.user_name}</span>
                </div>

                <div>
                  <span className="font-bold text-slate-500 uppercase block text-[10px]">Data & Hora Oficial:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {new Date(selectedLogForDetail.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>

                <div>
                  <span className="font-bold text-slate-500 uppercase block text-[10px]">Empresa Relacionada:</span>
                  <span className="font-bold text-slate-800">{selectedLogForDetail.empresa || '-'}</span>
                </div>

                <div>
                  <span className="font-bold text-slate-500 uppercase block text-[10px]">Banco / Instituição:</span>
                  <span className="font-bold text-slate-800">{selectedLogForDetail.banco || '-'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-extrabold text-slate-900 uppercase text-[10px]">Operação Executada:</span>
                <div className="p-3 bg-emerald-50 text-emerald-950 font-bold border border-emerald-200 rounded-xl text-sm">
                  {selectedLogForDetail.operacao} — {selectedLogForDetail.descricao}
                </div>
              </div>

              {(selectedLogForDetail.situacao_anterior !== '-' || selectedLogForDetail.situacao_nova !== '-') && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <span className="text-[10px] font-bold text-red-700 uppercase block">Situação Anterior:</span>
                    <span className="font-mono font-bold text-red-900">{selectedLogForDetail.situacao_anterior}</span>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Nova Situação:</span>
                    <span className="font-mono font-bold text-emerald-900">{selectedLogForDetail.situacao_nova}</span>
                  </div>
                </div>
              )}

              {selectedLogForDetail.meta_data && Object.keys(selectedLogForDetail.meta_data).length > 0 && (
                <div className="space-y-1">
                  <span className="font-extrabold text-slate-900 uppercase text-[10px]">Metadados JSON no Supabase:</span>
                  <pre className="p-3 bg-slate-900 text-amber-300 font-mono text-[11px] rounded-xl overflow-x-auto">
                    {JSON.stringify(selectedLogForDetail.meta_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLogForDetail(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestão de Usuários */}
      <UserSelectorModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onUserChanged={(u) => setActiveUser(u)}
      />

      {/* Modal da Linha do Tempo do Item */}
      {timelineTargetItem && (
        <ItemTimelineModal
          isOpen={true}
          onClose={() => setTimelineTargetItem(null)}
          itemIdentifier={timelineTargetItem.id}
          itemTitle={timelineTargetItem.title}
          itemAmount={timelineTargetItem.amount}
        />
      )}
    </div>
  );
}
