'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile } from '@/types/audit';
import {
  PendingFileRecord,
  UserWorkspaceSession,
  fetchUserPendingFiles,
  saveUserPendingFile,
  deleteUserPendingFile,
  extractMetricsFromSession,
  cleanEmailKey,
  SESSION_MAX_HOURS,
} from '@/lib/pending-files-service';
import { SpreadsheetState } from '@/types/spreadsheet';
import { FechamentoItem } from '@/lib/fechamento-utils';
import {
  FolderArchive,
  Clock,
  RotateCcw,
  Trash2,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  CreditCard,
  Building2,
  Sparkles,
  Plus,
  X,
  Mail,
  ShieldCheck,
  HardDriveDownload,
  Info,
} from 'lucide-react';

interface PendingFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  currentWorkspaceState: {
    dealerState: SpreadsheetState;
    sitefState: SpreadsheetState;
    pendenteCdcState: SpreadsheetState;
    manualFechamentoItems: FechamentoItem[];
    deletedFechamentoIds: Set<string>;
    activeTab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento' | 'auditoria';
  };
  onRestorePendingFile: (file: PendingFileRecord) => void;
}

export function PendingFilesModal({
  isOpen,
  onClose,
  currentUser,
  currentWorkspaceState,
  onRestorePendingFile,
}: PendingFilesModalProps) {
  const [files, setFiles] = useState<PendingFileRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSavingCurrent, setIsSavingCurrent] = useState<boolean>(false);
  const [saveTitleInput, setSaveTitleInput] = useState<string>('');
  const [showSaveCustomInput, setShowSaveCustomInput] = useState<boolean>(false);
  const [restoreConfirmFile, setRestoreConfirmFile] = useState<PendingFileRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const cleanEmail = cleanEmailKey(currentUser?.email);

  const loadPendingList = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserPendingFiles(cleanEmail);
      setFiles(data);
    } catch (err) {
      console.warn('Erro ao carregar lista de arquivos pendentes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cleanEmail]);

  useEffect(() => {
    if (isOpen) {
      loadPendingList();
      setSaveTitleInput(`Lançamentos e Planilhas - ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
    }
  }, [isOpen, loadPendingList]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleSaveCurrentSession = async () => {
    const { dealerState, sitefState, pendenteCdcState, manualFechamentoItems, deletedFechamentoIds, activeTab } =
      currentWorkspaceState;

    const hasData =
      (dealerState.rawData && dealerState.rawData.length > 0) ||
      (sitefState.rawData && sitefState.rawData.length > 0) ||
      manualFechamentoItems.length > 0;

    if (!hasData) {
      alert('Não há planilhas ou lançamentos carregados na tela atual para salvar como pendência.');
      return;
    }

    setIsSavingCurrent(true);
    try {
      const metrics = extractMetricsFromSession(dealerState, sitefState, pendenteCdcState, manualFechamentoItems);
      const title = saveTitleInput.trim() || `Lançamentos Salvos - ${new Date().toLocaleString('pt-BR')}`;

      // Get stored conciliated companies from localStorage
      let conciliated: any = {};
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`wanfinance_conciliated_${cleanEmail}`) || localStorage.getItem('wanfinance_conciliated_empresas_v1');
          if (raw) conciliated = JSON.parse(raw);
        } catch {}
      }

      const newRecord: PendingFileRecord = {
        id: `pend_manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userEmail: cleanEmail,
        userName: currentUser.name,
        createdAt: new Date().toISOString(),
        title,
        description: `Salvo manualmente pelo usuário ${currentUser.name || cleanEmail}`,
        source: 'manual_save',
        dealerState,
        sitefState,
        pendenteCdcState,
        manualFechamentoItems: manualFechamentoItems || [],
        deletedFechamentoIds: Array.from(deletedFechamentoIds),
        conciliatedEmpresas: conciliated,
        activeTab,
        metrics,
      };

      await saveUserPendingFile(newRecord);
      setShowSaveCustomInput(false);
      await loadPendingList();
      showToast('Sessão atual salva com sucesso em seus Arquivos Pendentes!');
    } catch (err) {
      console.error('Erro ao salvar arquivo pendente:', err);
      alert('Erro ao salvar arquivo pendente.');
    } finally {
      setIsSavingCurrent(false);
    }
  };

  const handleConfirmRestore = (file: PendingFileRecord) => {
    onRestorePendingFile(file);
    setRestoreConfirmFile(null);
    onClose();
  };

  const handleDeleteFile = async (id: string) => {
    await deleteUserPendingFile(id, cleanEmail);
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setDeleteConfirmId(null);
    showToast('Arquivo pendente removido com sucesso.');
  };

  const handleExportJson = (file: PendingFileRecord) => {
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arquivo_pendente_${file.id}_${file.userEmail.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q)) ||
        (f.metrics?.empresasNomes && f.metrics.empresasNomes.some((e) => e.toLowerCase().includes(q)))
    );
  }, [files, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center shadow-inner">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">Arquivos Pendentes</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {files.length} arquivo{files.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3 h-3 text-amber-400" />
                <span>Armazenamento vinculado ao e-mail:</span>
                <strong className="text-white font-mono bg-white/10 px-1.5 py-0.2 rounded text-[11px]">
                  {cleanEmail}
                </strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 8-Hour Rule Explanatory Banner */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/80 px-6 py-3 flex items-center justify-between gap-4 text-xs text-amber-900 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-2xs font-bold text-[11px]">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold">Regra de Segurança de {SESSION_MAX_HOURS} Horas:</span> As informações de onde você parou ficam ativas por até {SESSION_MAX_HOURS}h. Após esse período, os dados são arquivados automaticamente aqui e o sistema inicia em branco pronto para novos lotes.
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!showSaveCustomInput ? (
              <button
                onClick={() => setShowSaveCustomInput(true)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Salvar Sessão Atual</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Save Current Session Input Box (Collapsible) */}
        {showSaveCustomInput && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top duration-200">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nome / Identificação do Arquivo Pendente:
              </label>
              <input
                type="text"
                value={saveTitleInput}
                onChange={(e) => setSaveTitleInput(e.target.value)}
                placeholder="Ex: Movimento 23/08 - Fechamento Pendente..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <button
                onClick={handleSaveCurrentSession}
                disabled={isSavingCurrent}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSavingCurrent ? 'Salvando...' : 'Confirmar e Salvar'}</span>
              </button>
              <button
                onClick={() => setShowSaveCustomInput(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Success Toast */}
        {successToast && (
          <div className="mx-6 mt-3 bg-emerald-100 border border-emerald-300 text-emerald-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-800 hover:text-emerald-950 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="p-4 border-b border-slate-200 bg-white flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, data ou empresa no arquivo..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
          <button
            onClick={loadPendingList}
            title="Atualizar lista"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Content List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-50/50">
          {isLoading ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Buscando arquivos pendentes salvos...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white border border-dashed border-slate-300 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
                <FolderArchive className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Nenhum Arquivo Pendente para este e-mail</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Quando uma sessão ultrapassar 8 horas de inatividade ou você clicar em <strong>&quot;Salvar Sessão Atual&quot;</strong>, os dados das planilhas e fechamentos serão preservados aqui com segurança e segregados por seu e-mail ({cleanEmail}).
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const isAutoExpired = file.source === 'auto_expired';
              const createdDate = new Date(file.createdAt);
              const formattedDate = createdDate.toLocaleDateString('pt-BR');
              const formattedTime = createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={file.id}
                  className="bg-white border border-slate-200 hover:border-amber-400/80 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col gap-3 group"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-slate-900">{file.title}</span>
                        {isAutoExpired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Auto-Arquivado (+8h)</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Salvo pelo Usuário</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>Gravado em: <strong>{formattedDate} às {formattedTime}</strong></span>
                        <span>•</span>
                        <span>Operador: <strong>{file.userName || file.userEmail}</strong></span>
                      </p>
                    </div>

                    {/* Quick Metric Badges */}
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <div className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-mono font-bold">
                        Dealer: {formatBRL(file.metrics?.totalDealer || 0)}
                      </div>
                      <div className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 font-mono font-bold">
                        SiTef: {formatBRL(file.metrics?.totalSitef || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Counts Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Dealer: <strong>{file.metrics?.countDealer || 0}</strong> linhas</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>SiTef: <strong>{file.metrics?.countSitef || 0}</strong> linhas</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>CDC: <strong>{file.metrics?.countPendenteCdc || 0}</strong> linhas</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2 py-1 rounded-lg">
                      <Building2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>Empresas: <strong>{file.metrics?.countEmpresas || 0}</strong></span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExportJson(file)}
                        title="Baixar cópia de segurança em formato JSON"
                        className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Exportar Backup</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {deleteConfirmId === file.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                          <span className="text-[10px] text-rose-700 font-bold">Confirmar exclusão?</span>
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700 cursor-pointer"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-1.5 py-0.5 text-slate-600 text-[10px] hover:text-slate-900 cursor-pointer"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(file.id)}
                          title="Excluir este arquivo pendente"
                          className="w-7 h-7 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Primary Restore Button */}
                      <button
                        onClick={() => setRestoreConfirmFile(file)}
                        className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold rounded-xl text-xs shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-97"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Recuperar Dados</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Sincronização em nuvem ativa por e-mail (funciona em qualquer computador ou dispositivo).</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Data Restoration */}
      {restoreConfirmFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Recuperar este Arquivo Pendente?</h4>
                <p className="text-xs text-slate-500">Restaurar para a tela de trabalho ativa</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
              <p className="font-bold">{restoreConfirmFile.title}</p>
              <p className="text-[11px] text-amber-800">
                Esta ação carregará as planilhas Dealer ({restoreConfirmFile.metrics?.countDealer || 0} linhas), SiTef ({restoreConfirmFile.metrics?.countSitef || 0} linhas) e os lançamentos de fechamento salvos.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRestoreConfirmFile(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmRestore(restoreConfirmFile)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-lg text-xs shadow-xs transition-all cursor-pointer"
              >
                Sim, Recuperar Dados
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
