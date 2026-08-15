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
  currentUser?: UserProfile;
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
  currentUser: initialUser,
}: ExcelHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
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
      className="bg-[#0D131F]/90 text-white border-b border-white/[0.08] shadow-2xl sticky top-0 z-40 backdrop-blur-2xl transition-all"
    >
      {/* UPPER TITLEBAR: Apple macOS / iPadOS Pro App Chrome */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-white/[0.06]">
        {/* Left: Traffic Lights & Wanfinance Logo */}
        <div className="flex items-center gap-4">
          <WanfinanceLogo size="md" showTrafficLights={true} showSubtitle={true} />

          <div className="hidden md:block h-6 w-px bg-white/10" />

          {/* Active File Apple Pill */}
          {state.fileName && activeTab !== 'auditoria' && activeTab !== 'fechamento' && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/[0.05] border border-white/[0.08] rounded-full backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
              <span className="font-medium text-slate-200 truncate max-w-[170px] text-[11px]">
                {state.fileName}
              </span>
              <span className="px-1.5 py-0.5 bg-white/10 rounded-md text-[10px] text-[#0A84FF] font-mono font-semibold">
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
            className="px-3.5 py-1.5 bg-white/[0.08] hover:bg-white/[0.14] active:scale-97 text-slate-100 font-medium rounded-xl border border-white/[0.12] shadow-xs transition-all flex items-center gap-2 cursor-pointer text-xs backdrop-blur-md"
          >
            <Upload className="w-3.5 h-3.5 text-[#0A84FF]" />
            <span>Importar</span>
          </button>

          {/* Export Dropdown (Apple Blue Accent Pill) */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              id="apple-btn-export"
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#007AFF] to-[#0A84FF] hover:brightness-110 active:scale-97 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 border border-blue-400/30 transition-all flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-[#161F30]/95 border border-white/15 rounded-2xl shadow-2xl z-30 p-2 text-slate-100 space-y-1 backdrop-blur-2xl animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1">
                    Formato de Exportação
                  </div>

                  <button
                    onClick={() => {
                      onExport('xlsx', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 font-medium text-slate-200 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Excel Workbook (.xlsx)</div>
                      <div className="text-[10px] text-slate-400 font-normal">Planilha nativa formatada</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onExport('csv', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 font-medium text-slate-200 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
                      <Table className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">CSV Ponto e Vírgula (.csv)</div>
                      <div className="text-[10px] text-slate-400 font-normal">Compatível com ERPs e bancos BR</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onExport('json', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/10 font-medium text-slate-200 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Estrutura JSON (.json)</div>
                      <div className="text-[10px] text-slate-400 font-normal">Payload de integração REST</div>
                    </div>
                  </button>

                  <div className="border-t border-white/10 pt-2 mt-1 px-2.5">
                    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={includeHiddenExport}
                        onChange={(e) => setIncludeHiddenExport(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-[#007AFF] bg-slate-900 border-slate-700"
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
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] active:scale-97 text-slate-200 font-medium rounded-xl border border-white/[0.08] transition-all cursor-pointer text-xs backdrop-blur-md"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Regras Prontas</span>
          </button>

          {/* AI Intelligence Drawer Button (Apple Siri / AI Gradient) */}
          <button
            onClick={onOpenAIDrawer}
            id="apple-btn-ai"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-[#5E5CE6]/30 via-[#BF5AF2]/25 to-[#FF375F]/20 hover:from-[#5E5CE6]/40 hover:to-[#FF375F]/30 active:scale-97 text-purple-200 font-semibold rounded-xl border border-purple-400/30 transition-all cursor-pointer text-xs shadow-xs backdrop-blur-md"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
            <span>Assistente IA</span>
          </button>

          {/* User Profile Pill / Switcher (Apple Control Center style) */}
          {onOpenUserModal && (
            <button
              onClick={onOpenUserModal}
              id="apple-btn-user"
              className="flex items-center gap-2 px-2.5 py-1 bg-white/[0.06] hover:bg-white/[0.12] active:scale-97 text-slate-200 rounded-xl border border-white/[0.08] transition-all cursor-pointer text-xs ml-1"
              title="Trocar operador ou gerenciar permissões"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs border border-white/20">
                {currentUser?.avatar_initials || 'OP'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-[11px] font-bold text-slate-200 leading-tight">
                  {currentUser?.name || 'Operador'}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  {currentUser?.role === 'admin'
                    ? 'Administrador'
                    : currentUser?.role === 'auditor'
                    ? 'Auditor'
                    : 'Caixa / Operador'}
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* LOWER TAB BAR: Apple iPadOS Segmented Glass Controller */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between overflow-x-auto scrollbar-none gap-2">
        <div className="flex items-center p-1 bg-black/40 border border-white/[0.08] rounded-2xl backdrop-blur-xl shadow-inner-sm">
          {/* Tab 1: DEALER */}
          <button
            onClick={() => onTabChange('dealer')}
            id="apple-tab-dealer"
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer select-none ${
              activeTab === 'dealer'
                ? 'bg-gradient-to-b from-[#30D158] to-[#248A3D] text-white shadow-md shadow-emerald-950/50 border border-emerald-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>DEALER</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'dealer'
                  ? 'bg-black/30 text-white'
                  : 'bg-white/10 text-slate-400'
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
                ? 'bg-gradient-to-b from-[#0A84FF] to-[#0062D2] text-white shadow-md shadow-blue-950/50 border border-blue-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>SITEF</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'sitef'
                  ? 'bg-black/30 text-white'
                  : 'bg-white/10 text-slate-400'
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
                ? 'bg-gradient-to-b from-[#FF9F0A] to-[#C97200] text-white shadow-md shadow-amber-950/50 border border-amber-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>PENDENTE DE CDC</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'pendente_cdc'
                  ? 'bg-black/30 text-white'
                  : 'bg-white/10 text-slate-400'
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
                ? 'bg-gradient-to-b from-[#BF5AF2] to-[#7E22CE] text-white shadow-md shadow-purple-950/50 border border-purple-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>FECHAMENTO DE CONCILIAÇÃO</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'fechamento'
                  ? 'bg-black/30 text-white'
                  : 'bg-white/10 text-slate-400'
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
                ? 'bg-gradient-to-b from-[#5E5CE6] to-[#3B38A8] text-white shadow-md shadow-indigo-950/50 border border-indigo-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AUDITORIA SUPABASE</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        </div>

        {/* Apple Realtime Supabase Sync Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-[11px] font-medium text-slate-300 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[#30D158] shadow-[0_0_8px_#30D158]" />
          <span className="font-semibold text-slate-200">Supabase Live</span>
        </div>
      </div>
    </header>
  );
}
