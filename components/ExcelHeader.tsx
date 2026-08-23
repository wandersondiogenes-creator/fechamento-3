'use client';

import React, { useRef, useState, useEffect } from 'react';
import { SpreadsheetState } from '@/types/spreadsheet';
import { WanfinanceLogo } from './WanfinanceLogo';
import { getCurrentUser } from '@/lib/auth-service';
import { UserProfile } from '@/types/audit';
import {
  FileSpreadsheet,
  Upload,
  Download,
  ChevronDown,
  FileText,
  Table,
  CreditCard,
  Clock,
  Scale,
  Sparkles,
  Bookmark,
  Building2,
  ShieldCheck,
  User,
  Radio,
  SlidersHorizontal,
  LogOut,
  Mail,
  UserCheck,
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
  FolderArchive,
} from 'lucide-react';

interface ExcelHeaderProps {
  state: SpreadsheetState;
  activeTab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento' | 'auditoria';
  onTabChange: (tab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento' | 'auditoria') => void;
  tabCounts: { dealer: number; sitef: number; pendente_cdc: number; fechamento?: number; auditoria?: number };
  onImportFile: (file: File) => void;
  onTriggerFileImport?: () => void;
  onAutoOrganize: () => void;
  onOpenPresetsModal: () => void;
  onOpenAIDrawer: () => void;
  onOpenUserModal?: () => void;
  onExport: (format: 'xlsx' | 'csv' | 'json', includeHidden: boolean) => void;
  onReset: () => void;
  onClearAllData?: () => void;
  onClearDealerFile?: () => void;
  onClearSitefFile?: () => void;
  onClearPendenteCdcFile?: () => void;
  onLogout?: () => void;
  currentUser?: UserProfile;
  onOpenDiagnostics?: () => void;
  onOpenPendingFilesModal?: () => void;
  pendingFilesCount?: number;
  autosaveStatus?: {
    lastSaved: Date | null;
    isSaving: boolean;
    cloudSaved: boolean;
  };
}

export function ExcelHeader({
  state,
  activeTab,
  onTabChange,
  tabCounts,
  onImportFile,
  onTriggerFileImport,
  onAutoOrganize,
  onOpenPresetsModal,
  onOpenAIDrawer,
  onOpenUserModal,
  onExport,
  onReset,
  onClearAllData,
  onClearDealerFile,
  onClearSitefFile,
  onClearPendenteCdcFile,
  onLogout,
  currentUser: initialUser,
  onOpenDiagnostics,
  onOpenPendingFilesModal,
  pendingFilesCount = 0,
  autosaveStatus,
}: ExcelHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showClearMenu, setShowClearMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [includeHiddenExport, setIncludeHiddenExport] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => initialUser || getCurrentUser());
  const [confirmModal, setConfirmModal] = useState<{
    type: 'all' | 'dealer' | 'sitef' | 'pendente_cdc';
    title: string;
    description: string;
    badge: string;
  } | null>(null);

  useEffect(() => {
    if (initialUser) {
      setCurrentUser(initialUser);
    }
  }, [initialUser]);

  const handleImportClick = () => {
    if (onTriggerFileImport) {
      onTriggerFileImport();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportFile(e.target.files[0]);
    }
  };

  const executeClearAction = () => {
    if (!confirmModal) return;
    if (confirmModal.type === 'all') {
      if (onClearAllData) onClearAllData();
      else onReset();
    } else if (confirmModal.type === 'dealer') {
      if (onClearDealerFile) onClearDealerFile();
      else if (activeTab === 'dealer') onReset();
    } else if (confirmModal.type === 'sitef') {
      if (onClearSitefFile) onClearSitefFile();
      else if (activeTab === 'sitef') onReset();
    } else if (confirmModal.type === 'pendente_cdc') {
      if (onClearPendenteCdcFile) onClearPendenteCdcFile();
      else if (activeTab === 'pendente_cdc') onReset();
    }
    setConfirmModal(null);
  };

  return (
    <header
      id="wanfinance-apple-header"
      className="bg-white/85 text-[#1D1D1F] border-b border-black/[0.06] shadow-xs sticky top-0 z-40 backdrop-blur-2xl transition-all"
    >
      {/* UPPER TITLEBAR: Apple macOS / iPadOS Pro App Chrome */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-black/[0.04]">
        {/* Left: Traffic Lights & Wanfinance Logo */}
        <div className="flex items-center gap-4">
          <WanfinanceLogo size="md" showTrafficLights={true} showSubtitle={true} />

          <div className="hidden md:block h-6 w-px bg-slate-200" />

          {/* Active File Apple Pill */}
          {state.fileName && activeTab !== 'auditoria' && activeTab !== 'fechamento' && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-100/80 border border-slate-200/80 rounded-full backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
              <span className="font-medium text-slate-700 truncate max-w-[170px] text-[11px]">
                {state.fileName}
              </span>
              <span className="px-1.5 py-0.5 bg-white rounded-md text-[10px] text-[#007AFF] font-mono font-bold shadow-2xs border border-slate-200/60">
                {state.processedData.length} lin
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions Bar & User Switcher */}
        <div className="flex items-center flex-wrap gap-2">
          {/* File Upload Hidden Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          {/* Import Button (Apple Glass Pill) */}
          <button
            onClick={handleImportClick}
            id="apple-btn-import"
            className="px-3.5 py-1.5 bg-slate-100/90 hover:bg-slate-200/80 active:scale-97 text-slate-800 font-semibold rounded-xl border border-slate-200/80 shadow-2xs transition-all flex items-center gap-2 cursor-pointer text-xs"
          >
            <Upload className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>Importar</span>
          </button>

          {/* Export Dropdown (Apple Blue Accent Pill) */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              id="apple-btn-export"
              className="px-3.5 py-1.5 bg-gradient-to-b from-[#007AFF] to-[#0062D2] hover:brightness-105 active:scale-97 text-white font-semibold rounded-xl shadow-xs shadow-blue-500/20 border border-blue-400/40 transition-all flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar</span>
              <ChevronDown className="w-3 h-3 opacity-90" />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white/95 border border-slate-200 rounded-2xl shadow-xl z-30 p-2 text-slate-800 space-y-1 backdrop-blur-2xl animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1">
                    Formato de Exportação
                  </div>

                  <button
                    onClick={() => {
                      onExport('xlsx', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 font-medium text-slate-800 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Excel Workbook (.xlsx)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Planilha nativa formatada</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onExport('csv', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 font-medium text-slate-800 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                      <Table className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">CSV Ponto e Vírgula (.csv)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Compatível com ERPs e bancos BR</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onExport('json', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 font-medium text-slate-800 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-100">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Estrutura JSON (.json)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Payload de integração REST</div>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 pt-2 mt-1 px-2.5">
                    <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={includeHiddenExport}
                        onChange={(e) => setIncludeHiddenExport(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-[#007AFF] border-slate-300 focus:ring-blue-500"
                      />
                      <span>Incluir colunas ocultas</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Clear / Reset Data Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setShowClearMenu(!showClearMenu)}
              id="apple-btn-clear-menu"
              className="px-3.5 py-1.5 bg-rose-50/90 hover:bg-rose-100/90 active:scale-97 text-rose-700 font-semibold rounded-xl border border-rose-200/80 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer text-xs"
              title="Opções de limpeza e exclusão de arquivos importados"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Limpar Dados</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {showClearMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowClearMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white/95 border border-slate-200 rounded-2xl shadow-xl z-30 p-2 text-slate-800 space-y-1 backdrop-blur-2xl animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1">
                    Gerenciamento & Limpeza
                  </div>

                  {/* Option 1: Limpar Todos os Dados (Reiniciar do Início) */}
                  <button
                    onClick={() => {
                      setShowClearMenu(false);
                      setConfirmModal({
                        type: 'all',
                        title: 'Limpar Todos os Dados e Reiniciar?',
                        description:
                          'Esta ação apagará todas as planilhas carregadas (Dealer, Sitef, Pendente CDC) e todos os lançamentos do fechamento para você recomeçar a importação do zero.',
                        badge: 'Reinício Geral',
                      });
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-rose-50 text-rose-700 font-semibold transition-colors text-left group"
                  >
                    <div className="p-2 bg-rose-100/80 text-rose-600 rounded-lg border border-rose-200 group-hover:bg-rose-200/70 transition-colors">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-800">Limpar Tudo do Início</div>
                      <div className="text-[10px] text-rose-600 font-normal">
                        Apagar Dealer, Sitef e Fechamento
                      </div>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 my-1" />

                  {/* Option 2: Excluir Arquivo Dealer */}
                  <button
                    onClick={() => {
                      setShowClearMenu(false);
                      setConfirmModal({
                        type: 'dealer',
                        title: 'Excluir Arquivo da Dealer?',
                        description: `Deseja remover a planilha importada da Dealer e seus ${tabCounts.dealer} registros?`,
                        badge: 'Dealer',
                      });
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>Excluir Arquivo Dealer</span>
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded font-mono text-slate-600">
                          {tabCounts.dealer} lin
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Zerar dados importados da Dealer
                      </div>
                    </div>
                  </button>

                  {/* Option 3: Excluir Arquivo Sitef */}
                  <button
                    onClick={() => {
                      setShowClearMenu(false);
                      setConfirmModal({
                        type: 'sitef',
                        title: 'Excluir Arquivo do Sitef?',
                        description: `Deseja remover o extrato TEF importado do Sitef e seus ${tabCounts.sitef} registros?`,
                        badge: 'Sitef',
                      });
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold flex items-center justify-between">
                        <span>Excluir Arquivo Sitef</span>
                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded font-mono text-slate-600">
                          {tabCounts.sitef} lin
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Zerar dados importados do Sitef
                      </div>
                    </div>
                  </button>

                  {/* Option 4: Excluir Pendente CDC (se houver) */}
                  {tabCounts.pendente_cdc > 0 && (
                    <button
                      onClick={() => {
                        setShowClearMenu(false);
                        setConfirmModal({
                          type: 'pendente_cdc',
                          title: 'Excluir Arquivo Pendente de CDC?',
                          description: `Deseja remover os ${tabCounts.pendente_cdc} registros da planilha de CDC?`,
                          badge: 'Pendente CDC',
                        });
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors text-left"
                    >
                      <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-semibold flex items-center justify-between">
                          <span>Excluir Pendente CDC</span>
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded font-mono text-slate-600">
                            {tabCounts.pendente_cdc} lin
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          Zerar lançamentos de CDC
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Preset Rules Button */}
          <button
            onClick={onOpenPresetsModal}
            id="apple-btn-presets"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50/80 hover:bg-amber-100/80 active:scale-97 text-amber-800 font-semibold rounded-xl border border-amber-200/60 transition-all cursor-pointer text-xs shadow-2xs"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-600" />
            <span>Regras Prontas</span>
          </button>

          {/* Arquivos Pendentes (Salvos por E-mail) Button */}
          {onOpenPendingFilesModal && (
            <button
              onClick={onOpenPendingFilesModal}
              id="apple-btn-pending-files"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 active:scale-97 text-amber-950 font-extrabold rounded-xl border border-amber-300 transition-all cursor-pointer text-xs shadow-2xs group"
              title={`Arquivos Pendentes salvos por e-mail (${currentUser.email}) com regra de 8 horas`}
            >
              <FolderArchive className="w-3.5 h-3.5 text-amber-700 group-hover:scale-110 transition-transform" />
              <span>Arquivos Pendentes</span>
              {pendingFilesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-black">
                  {pendingFilesCount}
                </span>
              )}
            </button>
          )}

          {/* AI Intelligence Drawer Button (Apple Intelligence Siri Glow Pill) */}
          <button
            onClick={onOpenAIDrawer}
            id="apple-btn-ai"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 hover:from-indigo-500/15 hover:to-pink-500/15 active:scale-97 text-purple-900 font-bold rounded-xl border border-purple-300/60 transition-all cursor-pointer text-xs shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            <span>Assistente IA</span>
          </button>

          {/* Autosave & Diagnostics System Pill */}
          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              id="apple-btn-diagnostics"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/90 hover:bg-emerald-100/90 active:scale-97 text-emerald-800 font-semibold rounded-xl border border-emerald-200/70 transition-all cursor-pointer text-xs shadow-2xs"
              title="Diagnóstico de Sistema, Autosave e Recuperação"
            >
              <span className={`w-2 h-2 rounded-full ${autosaveStatus?.isSaving ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`} />
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Autosave Ativo</span>
            </button>
          )}

          {/* User Profile Pill / Switcher (Apple Control Center style) */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              id="apple-btn-user"
              className="flex items-center gap-2 px-2.5 py-1 bg-slate-100/90 hover:bg-slate-200/80 active:scale-97 text-slate-800 rounded-xl border border-slate-200/80 transition-all cursor-pointer text-xs ml-1 shadow-2xs"
              title="Conta e opções de sessão"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                {currentUser?.name
                  ? currentUser.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'OP'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[130px]">
                  {currentUser?.name || 'Operador'}
                </span>
                <span className="text-[9px] text-slate-500 font-medium truncate max-w-[130px]">
                  {currentUser?.email || (currentUser?.role === 'admin' ? 'Administrador' : 'Operador')}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Apple Style Account Menu Popover */}
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-white/95 border border-slate-200 rounded-3xl shadow-2xl z-30 p-3 text-slate-800 space-y-3 backdrop-blur-2xl animate-in fade-in-50 zoom-in-95 duration-150">
                  {/* User Profile Card */}
                  <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/70 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-md flex-shrink-0">
                      {currentUser?.name
                        ? currentUser.name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                        : 'OP'}
                    </div>
                    <div className="overflow-hidden text-left">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {currentUser?.name || 'Operador'}
                      </div>
                      <div className="text-[10.5px] text-slate-500 truncate flex items-center gap-1">
                        <Mail className="w-3 h-3 text-[#007AFF]" />
                        <span>{currentUser?.email || 'conta@gmail.com'}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 text-[9px] font-bold rounded-full uppercase tracking-wide">
                          {currentUser?.role === 'admin'
                            ? 'Administrador'
                            : currentUser?.role === 'auditor'
                            ? 'Auditor'
                            : 'Operador'}
                        </span>
                        {currentUser?.empresa && (
                          <span className="text-[9.5px] text-slate-500 truncate max-w-[110px]">
                            {currentUser.empresa}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions List */}
                  <div className="space-y-1 pt-1">
                    {onOpenPendingFilesModal && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenPendingFilesModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-amber-50 text-xs font-semibold text-amber-900 transition-colors text-left cursor-pointer"
                      >
                        <FolderArchive className="w-3.5 h-3.5 text-amber-600" />
                        <div className="flex-1 flex items-center justify-between">
                          <span>Arquivos Pendentes</span>
                          {pendingFilesCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                              {pendingFilesCount}
                            </span>
                          )}
                        </div>
                      </button>
                    )}

                    {onOpenDiagnostics && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenDiagnostics();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors text-left cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Saúde do Sistema & Autosave</span>
                      </button>
                    )}

                    {onOpenUserModal && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenUserModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors text-left cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Gerenciar Operadores / Permissões</span>
                      </button>
                    )}

                    {onLogout && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-rose-50 text-xs font-semibold text-rose-600 transition-colors text-left cursor-pointer border border-transparent hover:border-rose-100"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-600" />
                        <span>Encerrar Sessão (Sair)</span>
                      </button>
                    )}
                  </div>

                  <div className="text-[9.5px] text-slate-400 text-center pt-1 border-t border-slate-100">
                    Sessão criptografada Wanfinance Pro
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* LOWER TAB BAR: Apple macOS / iOS Liquid Glass Segmented Controller */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between overflow-x-auto scrollbar-none gap-3">
        <nav
          aria-label="Abas de Controle e Conciliação"
          className="flex items-center p-1.5 bg-gradient-to-b from-slate-200/90 via-slate-100/80 to-slate-200/90 border border-slate-300/80 rounded-2xl backdrop-blur-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] gap-1.5"
        >
          {/* Tab 1: DEALER */}
          <button
            onClick={() => onTabChange('dealer')}
            id="apple-tab-dealer"
            className={`relative group px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all duration-300 flex items-center gap-2 cursor-pointer select-none outline-none ${
              activeTab === 'dealer'
                ? 'bg-gradient-to-b from-white via-emerald-50/50 to-white text-emerald-900 shadow-[0_4px_14px_rgba(16,185,129,0.30),0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)] border border-emerald-300/80 ring-2 ring-emerald-400/30'
                : 'text-slate-600 hover:text-emerald-800 hover:bg-white/70 hover:shadow-xs'
            }`}
          >
            {activeTab === 'dealer' && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_#10B981]" />
            )}
            <div
              className={`p-1 rounded-lg transition-transform group-hover:scale-110 duration-200 ${
                activeTab === 'dealer'
                  ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  : 'bg-emerald-100/70 text-emerald-700'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-xs">DEALER</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black transition-all ${
                activeTab === 'dealer'
                  ? 'bg-emerald-600 text-white shadow-[0_2px_6px_rgba(16,185,129,0.4)] ring-1 ring-emerald-300'
                  : 'bg-slate-200/90 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800'
              }`}
            >
              {tabCounts.dealer}
            </span>
          </button>

          {/* Tab 2: SITEF */}
          <button
            onClick={() => onTabChange('sitef')}
            id="apple-tab-sitef"
            className={`relative group px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all duration-300 flex items-center gap-2 cursor-pointer select-none outline-none ${
              activeTab === 'sitef'
                ? 'bg-gradient-to-b from-white via-blue-50/50 to-white text-[#0062D2] shadow-[0_4px_14px_rgba(0,122,255,0.32),0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)] border border-blue-300/80 ring-2 ring-blue-400/30'
                : 'text-slate-600 hover:text-blue-800 hover:bg-white/70 hover:shadow-xs'
            }`}
          >
            {activeTab === 'sitef' && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-[#007AFF] rounded-full shadow-[0_0_8px_#007AFF]" />
            )}
            <div
              className={`p-1 rounded-lg transition-transform group-hover:scale-110 duration-200 ${
                activeTab === 'sitef'
                  ? 'bg-[#007AFF] text-white shadow-[0_0_10px_rgba(0,122,255,0.5)]'
                  : 'bg-blue-100/70 text-blue-700'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-xs">SITEF</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black transition-all ${
                activeTab === 'sitef'
                  ? 'bg-[#007AFF] text-white shadow-[0_2px_6px_rgba(0,122,255,0.4)] ring-1 ring-blue-300'
                  : 'bg-slate-200/90 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-800'
              }`}
            >
              {tabCounts.sitef}
            </span>
          </button>

          {/* Tab 3: PENDENTE DE CDC */}
          <button
            onClick={() => onTabChange('pendente_cdc')}
            id="apple-tab-pendente-cdc"
            className={`relative group px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all duration-300 flex items-center gap-2 cursor-pointer select-none outline-none ${
              activeTab === 'pendente_cdc'
                ? 'bg-gradient-to-b from-white via-amber-50/50 to-white text-amber-900 shadow-[0_4px_14px_rgba(245,158,11,0.30),0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)] border border-amber-300/80 ring-2 ring-amber-400/30'
                : 'text-slate-600 hover:text-amber-800 hover:bg-white/70 hover:shadow-xs'
            }`}
          >
            {activeTab === 'pendente_cdc' && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-amber-500 rounded-full shadow-[0_0_8px_#F59E0B]" />
            )}
            <div
              className={`p-1 rounded-lg transition-transform group-hover:scale-110 duration-200 ${
                activeTab === 'pendente_cdc'
                  ? 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                  : 'bg-amber-100/70 text-amber-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-xs">PENDENTE DE CDC</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black transition-all ${
                activeTab === 'pendente_cdc'
                  ? 'bg-amber-600 text-white shadow-[0_2px_6px_rgba(245,158,11,0.4)] ring-1 ring-amber-300'
                  : 'bg-slate-200/90 text-slate-700 group-hover:bg-amber-100 group-hover:text-amber-800'
              }`}
            >
              {tabCounts.pendente_cdc}
            </span>
          </button>

          {/* Tab 4: FECHAMENTO DE CONCILIAÇÃO */}
          <button
            onClick={() => onTabChange('fechamento')}
            id="apple-tab-fechamento"
            className={`relative group px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all duration-300 flex items-center gap-2 cursor-pointer select-none outline-none ${
              activeTab === 'fechamento'
                ? 'bg-gradient-to-b from-white via-purple-50/60 to-white text-purple-900 shadow-[0_4px_16px_rgba(147,51,234,0.35),0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)] border border-purple-300/80 ring-2 ring-purple-400/40'
                : 'text-slate-600 hover:text-purple-800 hover:bg-white/70 hover:shadow-xs'
            }`}
          >
            {activeTab === 'fechamento' && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-1 bg-purple-600 rounded-full shadow-[0_0_10px_#9333EA]" />
            )}
            <div
              className={`p-1 rounded-lg transition-transform group-hover:scale-110 duration-200 ${
                activeTab === 'fechamento'
                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.5)]'
                  : 'bg-purple-100/70 text-purple-700'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
            </div>
            <span className="font-black text-xs">FECHAMENTO DE CONCILIAÇÃO</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black transition-all ${
                activeTab === 'fechamento'
                  ? 'bg-purple-700 text-white shadow-[0_2px_6px_rgba(147,51,234,0.4)] ring-1 ring-purple-300'
                  : 'bg-slate-200/90 text-slate-700 group-hover:bg-purple-100 group-hover:text-purple-800'
              }`}
            >
              {tabCounts.fechamento ?? 0}
            </span>
          </button>

          {/* Tab 5: AUDITORIA & HISTÓRICO SUPABASE */}
          <button
            onClick={() => onTabChange('auditoria')}
            id="apple-tab-auditoria"
            className={`relative group px-4 py-2 rounded-xl font-bold text-xs tracking-wide transition-all duration-300 flex items-center gap-2 cursor-pointer select-none outline-none ${
              activeTab === 'auditoria'
                ? 'bg-gradient-to-b from-white via-indigo-50/50 to-white text-indigo-900 shadow-[0_4px_14px_rgba(99,102,241,0.32),0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,1)] border border-indigo-300/80 ring-2 ring-indigo-400/30'
                : 'text-slate-600 hover:text-indigo-800 hover:bg-white/70 hover:shadow-xs'
            }`}
          >
            {activeTab === 'auditoria' && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-indigo-600 rounded-full shadow-[0_0_8px_#6366F1]" />
            )}
            <div
              className={`p-1 rounded-lg transition-transform group-hover:scale-110 duration-200 ${
                activeTab === 'auditoria'
                  ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                  : 'bg-indigo-100/70 text-indigo-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-xs">AUDITORIA SUPABASE</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_6px_#10B981]" />
            </span>
          </button>
        </nav>

        {/* Apple Realtime Supabase Sync Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 bg-white/90 border border-emerald-300/80 rounded-full text-[11px] font-bold text-emerald-800 shadow-[0_2px_8px_rgba(16,185,129,0.15)] backdrop-blur-xl">
          <span className="w-2.5 h-2.5 rounded-full bg-[#34C759] shadow-[0_0_10px_#34C759] animate-pulse" />
          <span>Supabase Live</span>
        </div>
      </div>

      {/* Confirmation Modal for Clearing / Deleting Data */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
                  {confirmModal.type === 'all' ? (
                    <RotateCcw className="w-6 h-6" />
                  ) : (
                    <Trash2 className="w-6 h-6" />
                  )}
                </div>
                <button
                  onClick={() => setConfirmModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 mb-2">
                {confirmModal.badge}
              </div>

              <h3 className="text-base font-bold text-slate-900 mb-2 leading-snug">
                {confirmModal.title}
              </h3>

              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                {confirmModal.description}
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeClearAction}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs shadow-rose-600/30 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirmar e Limpar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
