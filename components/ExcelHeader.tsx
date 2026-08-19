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
  onLogout?: () => void;
  currentUser?: UserProfile;
  onOpenDiagnostics?: () => void;
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
  onLogout,
  currentUser: initialUser,
  onOpenDiagnostics,
  autosaveStatus,
}: ExcelHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [includeHiddenExport, setIncludeHiddenExport] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => initialUser || getCurrentUser());

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

          {/* Preset Rules Button */}
          <button
            onClick={onOpenPresetsModal}
            id="apple-btn-presets"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50/80 hover:bg-amber-100/80 active:scale-97 text-amber-800 font-semibold rounded-xl border border-amber-200/60 transition-all cursor-pointer text-xs shadow-2xs"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-600" />
            <span>Regras Prontas</span>
          </button>

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

      {/* LOWER TAB BAR: Apple iPadOS / iOS Segmented Glass Controller */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between overflow-x-auto scrollbar-none gap-2">
        <div className="flex items-center p-1 bg-slate-200/60 border border-black/[0.04] rounded-2xl backdrop-blur-xl shadow-inner-xs">
          {/* Tab 1: DEALER */}
          <button
            onClick={() => onTabChange('dealer')}
            id="apple-tab-dealer"
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer select-none ${
              activeTab === 'dealer'
                ? 'bg-white text-emerald-700 shadow-sm border border-black/[0.04]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>DEALER</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'dealer'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-300/60 text-slate-600'
              }`}
            >
              {tabCounts.dealer}
            </span>
          </button>

          {/* Tab 2: SITEF */}
          <button
            onClick={() => onTabChange('sitef')}
            id="apple-tab-sitef"
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer select-none ${
              activeTab === 'sitef'
                ? 'bg-white text-[#007AFF] shadow-sm border border-black/[0.04]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>SITEF</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'sitef'
                  ? 'bg-blue-100 text-[#0071E3]'
                  : 'bg-slate-300/60 text-slate-600'
              }`}
            >
              {tabCounts.sitef}
            </span>
          </button>

          {/* Tab 3: PENDENTE DE CDC */}
          <button
            onClick={() => onTabChange('pendente_cdc')}
            id="apple-tab-pendente-cdc"
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer select-none ${
              activeTab === 'pendente_cdc'
                ? 'bg-white text-amber-700 shadow-sm border border-black/[0.04]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>PENDENTE DE CDC</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'pendente_cdc'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-300/60 text-slate-600'
              }`}
            >
              {tabCounts.pendente_cdc}
            </span>
          </button>

          {/* Tab 4: FECHAMENTO DE CONCILIAÇÃO */}
          <button
            onClick={() => onTabChange('fechamento')}
            id="apple-tab-fechamento"
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer select-none ${
              activeTab === 'fechamento'
                ? 'bg-white text-purple-700 shadow-sm border border-black/[0.04]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-purple-600" />
            <span>FECHAMENTO DE CONCILIAÇÃO</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'fechamento'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-slate-300/60 text-slate-600'
              }`}
            >
              {tabCounts.fechamento ?? 0}
            </span>
          </button>

          {/* Tab 5: AUDITORIA & HISTÓRICO SUPABASE */}
          <button
            onClick={() => onTabChange('auditoria')}
            id="apple-tab-auditoria"
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer select-none ${
              activeTab === 'auditoria'
                ? 'bg-white text-indigo-700 shadow-sm border border-black/[0.04]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>AUDITORIA SUPABASE</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        </div>

        {/* Apple Realtime Supabase Sync Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full text-[11px] font-semibold text-emerald-800 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_8px_#34C759]" />
          <span>Supabase Live</span>
        </div>
      </div>
    </header>
  );
}
