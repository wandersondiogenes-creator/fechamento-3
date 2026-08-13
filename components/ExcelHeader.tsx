'use client';

import React, { useRef, useState } from 'react';
import { SpreadsheetState } from '@/types/spreadsheet';
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
  Zap,
  Bookmark,
  RefreshCw,
  Building2,
} from 'lucide-react';

interface ExcelHeaderProps {
  state: SpreadsheetState;
  activeTab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento';
  onTabChange: (tab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento') => void;
  tabCounts: { dealer: number; sitef: number; pendente_cdc: number; fechamento?: number };
  onImportFile: (file: File) => void;
  onTriggerFileImport?: () => void;
  onAutoOrganize: () => void;
  onOpenPresetsModal: () => void;
  onOpenAIDrawer: () => void;
  onExport: (format: 'xlsx' | 'csv' | 'json', includeHidden: boolean) => void;
  onReset: () => void;
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
  onExport,
  onReset,
}: ExcelHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [includeHiddenExport, setIncludeHiddenExport] = useState(false);

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
    <header className="bg-slate-950/95 text-white border-b border-slate-800 shadow-xl sticky top-0 z-40 backdrop-blur-md">
      {/* Upper Main Bar: Branding & Primary Actions */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/80">
        {/* Left: Branding & Active File Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold tracking-tight">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 flex items-center justify-center shadow-2xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-white font-black text-sm tracking-tight block">
                TrataExcel Pro
              </span>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                Tesouraria & Conciliação
              </span>
            </div>
          </div>

          <div className="hidden md:block h-6 w-px bg-slate-800" />

          {/* Active File Metadata */}
          {state.fileName && (
            <div className="hidden lg:flex items-center gap-2 text-slate-400">
              <span className="font-semibold text-slate-200 truncate max-w-[180px]">
                {state.fileName}
              </span>
              <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] text-amber-400 font-mono border border-slate-700 font-bold">
                {state.processedData.length} linhas
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions Bar */}
        <div className="flex items-center flex-wrap gap-2">
          {/* File Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-lg border border-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span>Importar Excel</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Dados</span>
              <ChevronDown className="w-3 h-3 text-amber-200" />
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 p-2 text-slate-100 space-y-1">
                  <div className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider px-2 py-1">
                    Formato de Saída
                  </div>

                  <button
                    onClick={() => {
                      onExport('xlsx', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800 font-bold text-slate-200 transition-colors text-left"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs">Excel (.xlsx)</div>
                      <div className="text-[10px] text-slate-400 font-normal">Planilha nativa formatada</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onExport('csv', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800 font-bold text-slate-200 transition-colors text-left"
                  >
                    <Table className="w-4 h-4 text-blue-400" />
                    <div>
                      <div className="text-xs">CSV (.csv)</div>
                      <div className="text-[10px] text-slate-400 font-normal">Separador ponto e vírgula (BR)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onExport('json', includeHiddenExport);
                      setShowExportMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800 font-bold text-slate-200 transition-colors text-left"
                  >
                    <FileText className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="text-xs">JSON (.json)</div>
                      <div className="text-[10px] text-slate-400 font-normal">Estrutura pura de objetos</div>
                    </div>
                  </button>

                  <div className="border-t border-slate-800 pt-1.5 mt-1 px-2">
                    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer py-1">
                      <input
                        type="checkbox"
                        checked={includeHiddenExport}
                        onChange={(e) => setIncludeHiddenExport(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-amber-500 bg-slate-800 border-slate-700"
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
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition-all cursor-pointer text-xs"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Regras Prontas</span>
          </button>

          {/* AI Drawer Button */}
          <button
            onClick={onOpenAIDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-200 font-bold rounded-lg border border-indigo-800 transition-all cursor-pointer text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Assistente IA</span>
          </button>
        </div>
      </div>

      {/* TOP NAVIGATION TABS BAR (Upper Section of System) */}
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 py-0.5">
          {/* Tab 1: DEALER */}
          <button
            onClick={() => onTabChange('dealer')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-2 border cursor-pointer select-none ${
              activeTab === 'dealer'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-500/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'dealer' ? 'text-white' : 'text-emerald-400'}`} />
            <span>DEALER</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'dealer'
                  ? 'bg-emerald-950 text-emerald-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tabCounts.dealer}
            </span>
          </button>

          {/* Tab 2: Sitef */}
          <button
            onClick={() => onTabChange('sitef')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-2 border cursor-pointer select-none ${
              activeTab === 'sitef'
                ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-500/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <CreditCard className={`w-4 h-4 ${activeTab === 'sitef' ? 'text-white' : 'text-blue-400'}`} />
            <span>SITEF</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'sitef'
                  ? 'bg-blue-950 text-blue-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tabCounts.sitef}
            </span>
          </button>

          {/* Tab 3: PENDENTE DE CDC */}
          <button
            onClick={() => onTabChange('pendente_cdc')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-2 border cursor-pointer select-none ${
              activeTab === 'pendente_cdc'
                ? 'bg-amber-600 text-white border-amber-400 shadow-md ring-2 ring-amber-500/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Clock className={`w-4 h-4 ${activeTab === 'pendente_cdc' ? 'text-white' : 'text-amber-400'}`} />
            <span>PENDENTE DE CDC</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'pendente_cdc'
                  ? 'bg-amber-950 text-amber-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tabCounts.pendente_cdc}
            </span>
          </button>

          {/* Tab 4: FECHAMENTO */}
          <button
            onClick={() => onTabChange('fechamento')}
            className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-2 border cursor-pointer select-none ${
              activeTab === 'fechamento'
                ? 'bg-purple-600 text-white border-purple-400 shadow-md ring-2 ring-purple-500/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Scale className={`w-4 h-4 ${activeTab === 'fechamento' ? 'text-white' : 'text-purple-400'}`} />
            <span>FECHAMENTO DE CONCILIAÇÃO</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'fechamento'
                  ? 'bg-purple-950 text-purple-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tabCounts.fechamento ?? 0}
            </span>
          </button>
        </div>

        {/* Tab Helper Label */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-bold text-slate-400 pl-4 border-l border-slate-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sistema Atualizado</span>
        </div>
      </div>
    </header>
  );
}
