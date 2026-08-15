'use client';

import React, { useRef, useState, useEffect } from 'react';
import { SpreadsheetState } from '@/types/spreadsheet';
import { getCurrentUser } from '@/lib/auth-service';
import { UserProfile } from '@/types/audit';
import {
  PanelLeft,
  Upload,
  Download,
  Plus,
  ClipboardPaste,
  Building2,
  SlidersHorizontal,
  ChevronDown,
  FileSpreadsheet,
  Table,
  FileText,
  Sparkles,
  Settings,
  ShieldCheck,
  CreditCard,
  Clock,
  Scale,
  Bookmark,
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
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenAddModal?: () => void;
}

export function ExcelHeader({
  state,
  activeTab,
  onTabChange,
  tabCounts,
  onImportFile,
  onTriggerFileImport,
  onOpenPresetsModal,
  onOpenAIDrawer,
  onExport,
  currentUser: initialUser,
  isSidebarOpen = true,
  onToggleSidebar,
  onOpenAddModal,
}: ExcelHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [includeHiddenExport, setIncludeHiddenExport] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => initialUser || getCurrentUser());

  // Company and Bank Mock State with Customization
  const [activeCompany, setActiveCompany] = useState({
    id: 16,
    name: 'VIA SUL MATRIZ',
    cnpj: '40841736000107',
  });
  const [activeAccount, setActiveAccount] = useState({
    bankCode: '033',
    bankName: 'SANTANDER',
    title: 'Santander - 4903471219 (YY38)',
    details: 'Ag: 3749 • Cc: 13000653-5 • NSA #11',
  });

  const [showCompanyMenu, setShowCompanyMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

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

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dealer':
        return 'Boletos a Pagar';
      case 'sitef':
        return 'Extrato & DDA (SITEF)';
      case 'pendente_cdc':
        return 'Pendentes de CDC';
      case 'fechamento':
        return 'Fechamento de Conciliação';
      case 'auditoria':
        return 'Auditoria Supabase Live';
      default:
        return 'Conciliação Financeira';
    }
  };

  const getTabSubtitle = () => {
    switch (activeTab) {
      case 'dealer':
        return 'Lote de Pagamentos';
      case 'sitef':
        return 'Conciliação de Cartões';
      case 'pendente_cdc':
        return 'Aguardando Aprovação';
      case 'fechamento':
        return 'Resumo de Caixa 100% Conciliado';
      case 'auditoria':
        return 'Histórico & RLS Security';
      default:
        return 'Módulo Financeiro';
    }
  };

  return (
    <div id="wanfinance-apple-header" className="w-full space-y-4">
      {/* File Upload Hidden Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* TOP HEADER ROW: Sidebar Toggle, Title, Category Badge & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Left Side: Sidebar Toggle & Page Title */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              id="apple-btn-toggle-sidebar"
              className="p-2 rounded-xl bg-white border border-slate-200/90 text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:scale-95 shadow-2xs transition-all cursor-pointer"
              title={isSidebarOpen ? 'Ocultar barra lateral' : 'Mostrar barra lateral'}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {getTabTitle()}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-medium text-[11px]">
              {getTabSubtitle()}
            </span>
          </div>
        </div>

        {/* Right Side: Quick Action Buttons (Novo Boleto & Colar em Lote / Exportar) */}
        <div className="flex items-center gap-2">
          {/* Novo Boleto / Novo Lançamento Button */}
          <button
            onClick={() => onOpenAddModal && onOpenAddModal()}
            id="apple-btn-new-item"
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 active:scale-97 text-slate-700 font-semibold rounded-xl border border-slate-200/90 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#007AFF]" />
            <span>+ Novo Boleto</span>
          </button>

          {/* Colar em Lote / Importar Button */}
          <button
            onClick={handleImportClick}
            id="apple-btn-paste-batch"
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 active:scale-97 text-slate-700 font-semibold rounded-xl border border-slate-200/90 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />
            <span>Colar em Lote</span>
          </button>

          {/* Export Dropdown (Clean White Pill) */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              id="apple-btn-export-dropdown"
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 active:scale-97 text-slate-700 font-semibold rounded-xl border border-slate-200/90 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 text-slate-800 space-y-1 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 py-1">
                    Formato de Exportação
                  </div>

                  <button
                    onClick={() => {
                      onExport('xlsx', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 font-medium text-slate-700 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Excel Workbook (.xlsx)</div>
                      <div className="text-[10px] text-slate-400">Planilha nativa formatada</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onExport('csv', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 font-medium text-slate-700 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-blue-50 text-[#007AFF] rounded-lg">
                      <Table className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">CSV Separado por Vírgula (.csv)</div>
                      <div className="text-[10px] text-slate-400">Padrão ERPs e bancos BR</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onExport('json', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 font-medium text-slate-700 transition-colors text-left"
                  >
                    <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">Estrutura JSON (.json)</div>
                      <div className="text-[10px] text-slate-400">Payload REST</div>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 pt-2 mt-1 px-2.5">
                    <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={includeHiddenExport}
                        onChange={(e) => setIncludeHiddenExport(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-[#007AFF] bg-white border-slate-300"
                      />
                      <span>Incluir colunas ocultas</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SELECTORS ROW (Matching screenshot: Empresa Ativa, Conta Bancária, Configurar Contas) */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Card 1: Empresa Ativa */}
        <div className="relative flex-1 min-w-[260px] max-w-sm">
          <div
            onClick={() => setShowCompanyMenu(!showCompanyMenu)}
            className="flex items-center justify-between p-2.5 bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl shadow-2xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              {/* Blue Squircle Building Icon */}
              <div className="w-10 h-10 rounded-xl bg-[#007AFF] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Empresa Ativa
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-[#007AFF] text-[9px] font-extrabold">
                    {activeCompany.id}
                  </span>
                </div>
                <span className="text-xs font-black text-slate-900 leading-tight group-hover:text-[#007AFF] transition-colors">
                  {activeCompany.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-medium">
                  {activeCompany.cnpj}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors mr-1" />
          </div>

          {showCompanyMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowCompanyMenu(false)}
              />
              <div className="absolute left-0 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 text-slate-800 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">
                  Selecionar Empresa
                </div>
                {[
                  { id: 16, name: 'VIA SUL MATRIZ', cnpj: '40841736000107' },
                  { id: 17, name: 'VIA SUL FILIAL 02', cnpj: '40841736000280' },
                  { id: 22, name: 'WANFINANCE DISTRIBUIDORA', cnpj: '12345678000199' },
                ].map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => {
                      setActiveCompany(comp);
                      setShowCompanyMenu(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                      activeCompany.id === comp.id
                        ? 'bg-blue-50 text-[#007AFF] font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{comp.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{comp.cnpj}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded-md">
                      #{comp.id}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Card 2: Conta Bancária */}
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <div
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="flex items-center justify-between p-2.5 bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl shadow-2xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              {/* Red Squircle Bank Code Badge (033 for Santander) */}
              <div className="w-10 h-10 rounded-xl bg-[#CC0000] text-white font-black text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                {activeAccount.bankCode}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Conta Bancária
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-[#CC0000] text-[9px] font-extrabold uppercase">
                    {activeAccount.bankName}
                  </span>
                </div>
                <span className="text-xs font-black text-slate-900 leading-tight group-hover:text-[#007AFF] transition-colors truncate max-w-[220px]">
                  {activeAccount.title}
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-medium truncate">
                  {activeAccount.details}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors mr-1" />
          </div>

          {showAccountMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowAccountMenu(false)}
              />
              <div className="absolute left-0 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-2 text-slate-800 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">
                  Selecionar Conta Bancária
                </div>
                {[
                  {
                    bankCode: '033',
                    bankName: 'SANTANDER',
                    title: 'Santander - 4903471219 (YY38)',
                    details: 'Ag: 3749 • Cc: 13000653-5 • NSA #11',
                  },
                  {
                    bankCode: '341',
                    bankName: 'ITAÚ',
                    title: 'Itaú Unibanco - Conta Principal',
                    details: 'Ag: 0455 • Cc: 99281-2 • NSA #04',
                  },
                  {
                    bankCode: '237',
                    bankName: 'BRADESCO',
                    title: 'Bradesco Prime - Caixa Cartões',
                    details: 'Ag: 2810 • Cc: 44102-9 • NSA #08',
                  },
                ].map((acc) => (
                  <button
                    key={acc.bankCode}
                    onClick={() => {
                      setActiveAccount(acc);
                      setShowAccountMenu(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                      activeAccount.bankCode === acc.bankCode
                        ? 'bg-blue-50 text-[#007AFF] font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{acc.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{acc.details}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 rounded-md font-mono">
                      {acc.bankCode}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Configurar Contas Button */}
        <button
          onClick={onOpenPresetsModal}
          id="apple-btn-configure-accounts"
          className="px-3.5 py-3 bg-white hover:bg-slate-50 active:scale-97 text-slate-700 font-medium rounded-2xl border border-slate-200/90 shadow-2xs transition-all flex items-center gap-2 cursor-pointer text-xs ml-auto"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <span>Configurar Contas</span>
        </button>
      </div>
    </div>
  );
}

