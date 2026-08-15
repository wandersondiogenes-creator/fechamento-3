'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ColumnConfig, SpreadsheetState } from '@/types/spreadsheet';
import { ColumnVisibilityPopover } from './ColumnVisibilityPopover';
import { isValidCPF } from '@/lib/validators';
import {
  CADASTRO_EMPRESAS,
  CADASTRO_DEPARTAMENTOS,
  CADASTRO_CONTAS_GERENCIAIS,
  isEmpresaColumn,
  isDepartamentoColumn,
  isContaGerencialColumn,
  isDateColumn,
  toInputDateFormat,
  toDisplayDateFormat,
} from '@/lib/cadastros';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings2,
  EyeOff,
  Edit2,
  Filter,
  Check,
  X,
  Sparkles,
  Layers,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  CreditCard,
  Clock,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Plus,
  PlusCircle,
  CheckSquare,
  Square,
  Scale,
  Building2,
  FolderTree,
  Calendar,
} from 'lucide-react';

interface ExcelTableProps {
  state: SpreadsheetState;
  activeTab?: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento';
  onTabChange?: (tab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento') => void;
  tabCounts?: { dealer: number; sitef: number; pendente_cdc: number; fechamento?: number };
  onUpdateColumn: (updatedCol: ColumnConfig) => void;
  onSetAllColumnsVisibility: (visible: boolean) => void;
  onUpdateCell: (rowIndex: number, colId: string, newValue: any) => void;
  onDeleteRow?: (rowIndex: number) => void;
  onDeleteRows?: (rowIndexes: number[]) => void;
  onAddRow?: (newRowData?: Record<string, any>) => void;
  onOpenColumnModal: (columnId: string) => void;
  onOpenAIDrawer: () => void;
  onTriggerFileImport?: () => void;
}

function getStatusBadge(val: any, header?: string) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;
  const norm = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const normHeader = (header || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isStatusCol =
    normHeader.includes('estado') ||
    normHeader.includes('status') ||
    normHeader.includes('situacao') ||
    normHeader.includes('conciliacao');

  if (norm.includes('pendent')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
        <Clock className="w-3 h-3 text-amber-700" />
        {str}
      </span>
    );
  }

  if (norm.includes('estornad') || norm.includes('estorno')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
        <RotateCcw className="w-3 h-3 text-purple-700" />
        {str}
      </span>
    );
  }

  if (
    isStatusCol &&
    (norm.includes('aprovad') || norm.includes('conciliad') || norm === 'ok' || norm.includes('pago'))
  ) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        {str}
      </span>
    );
  }

  return null;
}

export function ExcelTable({
  state,
  activeTab = 'dealer',
  onTabChange,
  tabCounts = { dealer: 0, sitef: 0, pendente_cdc: 0, fechamento: 0 },
  onUpdateColumn,
  onSetAllColumnsVisibility,
  onUpdateCell,
  onDeleteRow,
  onDeleteRows,
  onAddRow,
  onOpenColumnModal,
  onOpenAIDrawer,
  onTriggerFileImport,
}: ExcelTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColId, setSortColId] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewRawData, setViewRawData] = useState<boolean>(false);

  // Column inline renaming state
  const [editingHeaderColId, setEditingHeaderColId] = useState<string | null>(null);
  const [editingHeaderValue, setEditingHeaderValue] = useState('');

  // Cell inline editing state
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colId: string } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState<string>('');

  // Multi-cell selection range state for bottom status bar statistics
  const [selectedCells, setSelectedCells] = useState<Array<{ rowIndex: number; colId: string }>>([]);

  // Delete confirmation modal state
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{
    isOpen: boolean;
    indexesToDelete: number[];
  }>({ isOpen: false, indexesToDelete: [] });

  // Manual Row Addition Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRowFormData, setNewRowFormData] = useState<Record<string, string>>({});

  const activeColumns = useMemo(
    () => state.columns.filter((c) => c.visible),
    [state.columns]
  );

  const displayData = viewRawData ? state.rawData : state.processedData;

  // Derived selected row indexes
  const selectedRowIndexes = useMemo(() => {
    return Array.from(new Set(selectedCells.map((c) => c.rowIndex)));
  }, [selectedCells]);

  // Filter and Sort Data
  const filteredAndSortedData = useMemo(() => {
    let result = displayData.map((row, index) => ({ row, originalIndex: index }));

    // Global Search Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(({ row }) =>
        activeColumns.some((col) => {
          const val = row[col.id];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
        })
      );
    }

    // Column Sorting
    if (sortColId) {
      result.sort((a, b) => {
        const valA = a.row[sortColId];
        const valB = b.row[sortColId];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined || valA === '') return 1;
        if (valB === null || valB === undefined || valB === '') return -1;

        const numA = Number(valA);
        const numB = Number(valB);

        if (!isNaN(numA) && !isNaN(numB)) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (sortDirection === 'asc') {
          return strA.localeCompare(strB, 'pt-BR');
        } else {
          return strB.localeCompare(strA, 'pt-BR');
        }
      });
    }

    return result;
  }, [displayData, searchQuery, activeColumns, sortColId, sortDirection]);

  // Selection handlers
  const handleSelectAllRows = () => {
    const visibleOriginalIndexes = filteredAndSortedData.map((d) => d.originalIndex);
    const isAllSelected =
      visibleOriginalIndexes.length > 0 &&
      visibleOriginalIndexes.every((idx) => selectedRowIndexes.includes(idx));

    if (isAllSelected) {
      setSelectedCells([]);
    } else {
      const newCells: Array<{ rowIndex: number; colId: string }> = [];
      visibleOriginalIndexes.forEach((idx) => {
        activeColumns.forEach((col) => {
          newCells.push({ rowIndex: idx, colId: col.id });
        });
      });
      setSelectedCells(newCells);
    }
  };

  const handleToggleRowSelection = (originalIndex: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isRowSelected = selectedRowIndexes.includes(originalIndex);

    if (isRowSelected) {
      setSelectedCells((prev) => prev.filter((c) => c.rowIndex !== originalIndex));
    } else {
      const newCells = activeColumns.map((col) => ({
        rowIndex: originalIndex,
        colId: col.id,
      }));
      setSelectedCells((prev) => [
        ...prev.filter((c) => c.rowIndex !== originalIndex),
        ...newCells,
      ]);
    }
  };

  const handleRequestDeleteSelected = () => {
    if (selectedRowIndexes.length === 0) return;
    setDeleteConfirmInfo({
      isOpen: true,
      indexesToDelete: selectedRowIndexes,
    });
  };

  const handleConfirmDelete = () => {
    const { indexesToDelete } = deleteConfirmInfo;
    if (indexesToDelete.length > 0) {
      if (onDeleteRows) {
        onDeleteRows(indexesToDelete);
      } else if (onDeleteRow) {
        const sorted = [...indexesToDelete].sort((a, b) => b - a);
        sorted.forEach((idx) => onDeleteRow(idx));
      }
    }
    setDeleteConfirmInfo({ isOpen: false, indexesToDelete: [] });
    setSelectedCells([]);
  };

  // Open Add Launch Modal
  const handleOpenAddModal = () => {
    const defaults: Record<string, string> = {};
    const todayStr = new Date().toLocaleDateString('pt-BR');

    state.columns.forEach((col) => {
      const headerText = col.customHeader || col.originalHeader;
      const h = headerText
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (isEmpresaColumn(headerText)) {
        defaults[col.id] = CADASTRO_EMPRESAS[0]; // "BYD - ARRUDA"
      } else if (isDepartamentoColumn(headerText)) {
        defaults[col.id] = CADASTRO_DEPARTAMENTOS[0]; // "30129-CAIXA LOJA - DEPTO.OFICINA"
      } else if (isContaGerencialColumn(headerText)) {
        defaults[col.id] = CADASTRO_CONTAS_GERENCIAIS[0]; // "30129-CAIXA LOJA - DEPTO.OFICINA"
      } else if (isDateColumn(headerText)) {
        defaults[col.id] = todayStr;
      } else if (h.includes('estado') || h.includes('status') || h.includes('situacao')) {
        defaults[col.id] = 'APROVADO';
      } else if (h.includes('autorizacao') || h.includes('aut')) {
        defaults[col.id] = Math.floor(100000 + Math.random() * 900000).toString();
      } else if (h.includes('nsu')) {
        defaults[col.id] = Math.floor(100000000 + Math.random() * 900000000).toString();
      } else {
        defaults[col.id] = '';
      }
    });

    setNewRowFormData(defaults);
    setIsAddModalOpen(true);
  };

  // Save New Launch
  const handleSaveNewRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddRow) {
      onAddRow(newRowFormData);
    }
    setIsAddModalOpen(false);
  };

  // Handle Column Header Inline Rename Commit
  const handleCommitHeaderRename = (col: ColumnConfig) => {
    if (editingHeaderValue.trim() !== '') {
      onUpdateColumn({ ...col, customHeader: editingHeaderValue.trim() });
    }
    setEditingHeaderColId(null);
  };

  // Handle Cell Editing Commit
  const handleCommitCellEdit = () => {
    if (editingCell) {
      onUpdateCell(editingCell.rowIndex, editingCell.colId, editingCellValue);
      setEditingCell(null);
    }
  };

  // Selection statistics calculation for Excel status bar
  const selectionStats = useMemo(() => {
    if (selectedCells.length === 0) return null;

    let count = selectedCells.length;
    let numericValues: number[] = [];

    selectedCells.forEach(({ rowIndex, colId }) => {
      const row = displayData[rowIndex];
      if (row) {
        const val = row[colId];
        const num = Number(val);
        if (val !== '' && val !== null && val !== undefined && !isNaN(num)) {
          numericValues.push(num);
        }
      }
    });

    const sum = numericValues.reduce((a, b) => a + b, 0);
    const avg = numericValues.length > 0 ? sum / numericValues.length : null;

    return {
      count,
      numericCount: numericValues.length,
      sum: numericValues.length > 0 ? sum : null,
      avg,
    };
  }, [selectedCells, displayData]);

  // Convert Column Index to Excel Column Letters (A, B, C... AA, AB)
  const getExcelColumnLabel = (index: number): string => {
    let label = '';
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode((i % 26) + 65) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  };

  if (!state.columns || state.columns.length === 0) {
    const isDealer = activeTab === 'dealer';

    return (
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md flex flex-col h-full overflow-hidden text-slate-100">
        <div className="p-10 text-center flex flex-col items-center justify-center my-auto space-y-5 max-w-xl mx-auto">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center shadow-lg border border-amber-500/30">
            {isDealer ? (
              <FileSpreadsheet className="w-8 h-8 text-amber-400" />
            ) : (
              <CreditCard className="w-8 h-8 text-amber-400" />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-white text-lg">
              Aba {isDealer ? 'DEALER' : 'Sitef'} (Em Branco)
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md">
              O aplicativo está pronto no modelo <strong className="text-amber-400">{isDealer ? 'DEALER' : 'Sitef'}</strong>. Clique no botão abaixo para importar seu arquivo Excel e aplicar a limpeza e regras automáticas deste modelo.
            </p>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-left text-xs text-slate-300 space-y-2 w-full">
            <div className="font-extrabold text-amber-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Regras do Modelo {isDealer ? 'DEALER' : 'Sitef TEF'}:
            </div>
            {isDealer ? (
              <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-300">
                <li>Exclusão de colunas indesejadas (Conta Classificação, Dias, Parc., Histórico, Dep., Dat Acon)</li>
                <li>Remoção automática de linhas sem data ou sem valor na Entrada</li>
                <li>Formatação em Moeda Brasileira (R$) para colunas de Entrada e Saída</li>
              </ul>
            ) : (
              <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-300">
                <li>Tratamento de extratos SiTef TEF (Data Transação, Hora, NSU, Autorização, Bandeira)</li>
                <li>Conciliação de transações e formatação de Valor Bruto, Taxa TEF e Valor Líquido em R$</li>
                <li>Identificação de bandeiras (Visa, Mastercard, Elo, Amex, Pix) e tipo de transação</li>
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              onClick={onTriggerFileImport}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Importar Arquivo ({isDealer ? 'Modelo DEALER' : 'Modelo Sitef'})</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0E1524]/90 rounded-2xl border border-white/[0.08] shadow-2xl backdrop-blur-2xl flex flex-col h-full overflow-hidden text-slate-100">
      {/* Table Action Controls Toolbar */}
      <div className="p-3.5 bg-[#0A0E1A]/80 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search Input & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar em qualquer campo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 border border-white/10 rounded-xl bg-white/[0.05] text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white/[0.08] transition-all"
            />
          </div>

          {/* Import Excel Button */}
          {onTriggerFileImport && (
            <button
              onClick={onTriggerFileImport}
              className="px-3.5 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] active:scale-97 text-slate-100 font-semibold rounded-xl text-xs border border-white/10 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
              title={`Importar nova planilha para o modelo ${
                activeTab === 'dealer'
                  ? 'DEALER'
                  : activeTab === 'sitef'
                  ? 'Sitef'
                  : 'PENDENTE DE CDC'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-[#0A84FF]" />
              <span>Importar Excel</span>
            </button>
          )}

          {/* Add Launch Button */}
          {onAddRow && (
            <button
              onClick={handleOpenAddModal}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#30D158] to-[#248A3D] hover:brightness-110 active:scale-97 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 border border-emerald-400/30 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Adicionar um novo lançamento manualmente nesta aba"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Lançamento</span>
            </button>
          )}

          {/* Delete Selected Rows Button */}
          {selectedRowIndexes.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRequestDeleteSelected}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border border-rose-400/30"
                title="Excluir lançamentos selecionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Selecionados ({selectedRowIndexes.length})</span>
              </button>
              <button
                onClick={() => setSelectedCells([])}
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/15 text-slate-300 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1"
                title="Limpar seleção"
              >
                <X className="w-3 h-3" />
                <span className="hidden md:inline">Limpar</span>
              </button>
            </div>
          )}
        </div>

        {/* View Toggle (Dados Tratados vs Dados Brutos) */}
        <div className="flex items-center gap-2.5">
          <div className="inline-flex bg-black/40 border border-white/[0.08] p-1 rounded-xl text-[11px] font-semibold backdrop-blur-md">
            <button
              onClick={() => setViewRawData(false)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                !viewRawData
                  ? 'bg-gradient-to-b from-[#007AFF] to-[#0A84FF] text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dados Tratados ({state.processedData.length})
            </button>
            <button
              onClick={() => setViewRawData(true)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewRawData
                  ? 'bg-gradient-to-b from-[#007AFF] to-[#0A84FF] text-white shadow-xs font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dados Brutos
            </button>
          </div>

          {/* Column Visibility Manager */}
          <ColumnVisibilityPopover
            columns={state.columns}
            onToggleVisibility={(id) => {
              const col = state.columns.find((c) => c.id === id);
              if (col) onUpdateColumn({ ...col, visible: !col.visible });
            }}
            onSetAllVisibility={onSetAllColumnsVisibility}
          />
        </div>
      </div>

      {/* Banner / Legend for Sitef Statuses */}
      {activeTab === 'sitef' && (
        <div className="px-3.5 py-2 bg-amber-950/40 border-b border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              Transações <strong className="text-white">PENDENTES</strong> e <strong className="text-white">ESTORNADAS</strong> são mantidas na tabela e destacadas para conferência.
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-900/60 text-amber-300 font-extrabold border border-amber-700/60">
              <Clock className="w-3 h-3 text-amber-400" /> Pendentes
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-900/60 text-purple-300 font-extrabold border border-purple-700/60">
              <RotateCcw className="w-3 h-3 text-purple-400" /> Estornadas
            </span>
          </div>
        </div>
      )}

      {/* Banner for PENDENTE DE CDC Tab */}
      {activeTab === 'pendente_cdc' && (
        <div className="px-3.5 py-2 bg-amber-950/40 border-b border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong className="text-white">Aba PENDENTE DE CDC:</strong> Lançamentos do DEALER com valor de entrada zerado (R$ 0,00) isolados para conferência.
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] bg-amber-900/60 border border-amber-700/60 text-amber-300 font-bold px-2 py-0.5 rounded-md">
            Excluídos automaticamente da aba DEALER
          </span>
        </div>
      )}

      {/* Main Grid Scroll Area */}
      <div className="flex-1 overflow-auto max-h-[68vh] relative bg-slate-950">
        <table className="w-full text-left border-collapse text-xs select-none">
          {/* Header Row */}
          <thead className="bg-slate-950 text-slate-200 font-semibold sticky top-0 z-10 border-b border-slate-800 shadow-md">
            <tr>
              {/* Row Number Counter Column Header */}
              <th className="w-12 px-2 py-2.5 border-r border-slate-800 bg-slate-950 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={handleSelectAllRows}
                    className="p-0.5 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                    title={
                      selectedRowIndexes.length === filteredAndSortedData.length && filteredAndSortedData.length > 0
                        ? 'Desmarcar todos'
                        : 'Selecionar todos os lançamentos'
                    }
                  >
                    {selectedRowIndexes.length === filteredAndSortedData.length && filteredAndSortedData.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </button>
                </div>
              </th>

              {/* Data Columns */}
              {activeColumns.map((col, index) => {
                const activeRulesCount = col.rules.filter((r) => r.enabled).length;
                const isSorted = sortColId === col.id;

                let ruleTagBadge = null;
                if (col.type === 'date') {
                  ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800">DD/MM/AAAA</span>;
                } else if (col.type === 'currency') {
                  ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-950 text-amber-300 border border-amber-800">BRL (R$)</span>;
                } else if (col.type === 'cpf' || col.type === 'cnpj') {
                  ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-950 text-blue-300 border border-blue-800">{col.type.toUpperCase()}</span>;
                } else if (activeRulesCount > 0) {
                  ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-950 text-indigo-300 border border-indigo-800">{activeRulesCount} REGRAS</span>;
                }

                return (
                  <th
                    key={col.id}
                    className="min-w-[150px] px-3 py-2 border-r border-slate-800 bg-slate-950 hover:bg-slate-900 transition-colors relative group"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      {/* Excel Letter & Rules Badge */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 font-mono">
                          {getExcelColumnLabel(index)}
                        </span>
                        {ruleTagBadge}
                      </div>

                      {/* Sorting & Config Buttons */}
                      <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100">
                        <button
                          onClick={() => {
                            if (sortColId === col.id) {
                              if (sortDirection === 'asc') setSortDirection('desc');
                              else {
                                setSortColId(null);
                              }
                            } else {
                              setSortColId(col.id);
                              setSortDirection('asc');
                            }
                          }}
                          className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                            isSorted ? 'text-amber-400 font-bold' : 'text-slate-500'
                          }`}
                          title="Ordenar coluna"
                        >
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3" />
                          )}
                        </button>

                        <button
                          onClick={() => onOpenColumnModal(col.id)}
                          className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title="Configurar regras da coluna"
                        >
                          <Settings2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Header Label / Inline Rename */}
                    {editingHeaderColId === col.id ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="text"
                          value={editingHeaderValue}
                          onChange={(e) => setEditingHeaderValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitHeaderRename(col);
                            if (e.key === 'Escape') setEditingHeaderColId(null);
                          }}
                          autoFocus
                          className="w-full px-1 py-0.5 text-xs border border-amber-500 rounded bg-slate-900 text-white font-bold"
                        />
                        <button
                          onClick={() => handleCommitHeaderRename(col)}
                          className="p-0.5 bg-amber-600 text-white rounded hover:bg-amber-700"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDoubleClick={() => {
                          setEditingHeaderColId(col.id);
                          setEditingHeaderValue(col.customHeader || col.originalHeader);
                        }}
                        className="font-extrabold text-slate-200 text-[11px] uppercase tracking-wider truncate cursor-pointer hover:text-amber-400 flex items-center justify-between"
                        title="Clique duplo para renomear"
                      >
                        <span className="truncate">{col.customHeader || col.originalHeader}</span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="bg-[#0C121E] divide-y divide-white/[0.04]">
            {filteredAndSortedData.map(({ row, originalIndex }, displayRowIndex) => {
              const rowCombinedText = Object.values(row)
                .map((v) => (v ? String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : ''))
                .join(' ');

              const isPendenteRow = rowCombinedText.includes('pendent');
              const isEstornadaRow = rowCombinedText.includes('estornad') || rowCombinedText.includes('estorno');
              const isRowSelected = selectedRowIndexes.includes(originalIndex);

              let rowClass = 'hover:bg-white/[0.04] transition-colors';
              if (isRowSelected) {
                rowClass = 'bg-[#007AFF]/15 hover:bg-[#007AFF]/25 border-l-4 border-l-[#007AFF] transition-colors';
              } else if (isPendenteRow) {
                rowClass = 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-500 transition-colors';
              } else if (isEstornadaRow) {
                rowClass = 'bg-purple-500/10 hover:bg-purple-500/15 border-l-4 border-l-purple-500 transition-colors';
              }

              return (
                <tr key={`row_${originalIndex}`} className={rowClass}>
                  {/* Row Number Cell */}
                  <td
                    onClick={(e) => handleToggleRowSelection(originalIndex, e)}
                    className="px-2 py-2 border-r border-white/[0.06] bg-black/20 text-center font-mono text-[11px] text-slate-400 font-semibold select-none cursor-pointer hover:bg-white/10 transition-colors"
                    title="Clique para selecionar a linha inteira"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={(e) => handleToggleRowSelection(originalIndex, e)}
                        className="p-0.5 text-slate-400 hover:text-[#0A84FF]"
                      >
                        {isRowSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-[#0A84FF]" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </button>
                      <span>{displayRowIndex + 1}</span>
                      {isEstornadaRow && onDeleteRow && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmInfo({
                              isOpen: true,
                              indexesToDelete: [originalIndex],
                            });
                          }}
                          className="p-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg shadow-xs transition-all flex items-center justify-center border border-rose-500/30"
                          title="Excluir transação estornada (Autorização / Cartão)"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Data Cells */}
                  {activeColumns.map((col) => {
                    const cellValue = row[col.id];
                    const isEditing =
                      editingCell?.rowIndex === originalIndex && editingCell?.colId === col.id;

                    const isSelected = selectedCells.some(
                      (sc) => sc.rowIndex === originalIndex && sc.colId === col.id
                    );

                    // Validate CPF for visual badge indicator
                    const isCpfCol =
                      col.type === 'cpf' ||
                      col.rules.some((r) => r.enabled && r.type === 'format_cpf');
                    const invalidCpf =
                      isCpfCol && cellValue && String(cellValue).trim() !== '' && !isValidCPF(String(cellValue));

                    const statusBadge = getStatusBadge(cellValue, col.customHeader || col.originalHeader);

                    return (
                      <td
                        key={`${originalIndex}_${col.id}`}
                        onClick={(e) => {
                          if (e.shiftKey || e.ctrlKey) {
                            setSelectedCells((prev) => [
                              ...prev,
                              { rowIndex: originalIndex, colId: col.id },
                            ]);
                          } else {
                            setSelectedCells([{ rowIndex: originalIndex, colId: col.id }]);
                          }
                        }}
                        onDoubleClick={() => {
                          setEditingCell({ rowIndex: originalIndex, colId: col.id });
                          setEditingCellValue(
                            cellValue !== undefined && cellValue !== null ? String(cellValue) : ''
                          );
                        }}
                        className={`px-2.5 py-1.5 border-r border-white/[0.06] font-mono text-xs transition-colors relative ${
                          isSelected ? 'bg-[#007AFF]/20 ring-1 ring-[#007AFF]' : ''
                        } ${invalidCpf ? 'bg-amber-500/15' : ''}`}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingCellValue}
                              onChange={(e) => setEditingCellValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommitCellEdit();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              autoFocus
                              className="w-full px-2 py-1 border border-[#007AFF] bg-[#0A0E1A] text-white rounded-lg font-medium focus:outline-none text-xs"
                            />
                            <button
                              onClick={handleCommitCellEdit}
                              className="p-1 bg-[#007AFF] text-white rounded-lg hover:bg-blue-600"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1">
                            {statusBadge ? (
                              <div className="flex items-center gap-1.5">
                                {statusBadge}
                                {isEstornadaRow && onDeleteRow && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmInfo({
                                        isOpen: true,
                                        indexesToDelete: [originalIndex],
                                      });
                                    }}
                                    className="p-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 rounded-lg shadow-xs transition-all flex items-center gap-1 text-[10px] font-bold"
                                    title="Excluir estorno"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-400" />
                                    <span className="hidden sm:inline">Excluir</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`truncate ${
                                  cellValue === null || cellValue === undefined || String(cellValue).trim() === ''
                                    ? 'text-slate-600 italic text-[11px]'
                                    : 'text-slate-200'
                                }`}
                              >
                                {cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== ''
                                  ? String(cellValue)
                                  : '(vazio)'}
                              </span>
                            )}

                            {invalidCpf && (
                              <span
                                className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-sans text-[9px] font-bold flex-shrink-0"
                                title="CPF com dígito verificador inválido"
                              >
                                CPF Inválido
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {filteredAndSortedData.length === 0 && (
              <tr>
                <td
                  colSpan={activeColumns.length + 1}
                  className="p-12 text-center text-slate-500 italic text-xs"
                >
                  Nenhum registro encontrado para esta busca ou filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Apple Pro Bottom Sheet Bar */}
      <div className="px-4 py-2 bg-[#0A0E1A]/95 border-t border-white/[0.08] flex items-center justify-between text-xs backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">Aba Ativa:</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-white/10 text-white font-bold text-xs uppercase tracking-wide">
            {activeTab === 'dealer'
              ? 'DEALER'
              : activeTab === 'sitef'
              ? 'SITEF'
              : activeTab === 'pendente_cdc'
              ? 'PENDENTE DE CDC'
              : 'FECHAMENTO'}
          </span>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3">
          <span>
            Total: <strong className="text-slate-200">{displayData.length}</strong> registros
          </span>
          {searchQuery && (
            <span className="text-[#0A84FF] font-semibold">
              Filtrados: {filteredAndSortedData.length}
            </span>
          )}
          <span className="hidden sm:inline">
            Colunas: <strong className="text-slate-200">{activeColumns.length}</strong> / {state.columns.length}
          </span>
        </div>
      </div>

      {/* Excel Bottom Selection Stats Bar */}
      <div className="px-4 py-1.5 bg-black/40 border-t border-white/[0.06] text-slate-400 text-[11px] flex flex-wrap items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-3">
          <span>
            {selectedRowIndexes.length > 0 ? (
              <span className="text-[#0A84FF] font-bold">
                {selectedRowIndexes.length} linha(s) selecionada(s)
              </span>
            ) : selectedCells.length > 0 ? (
              <span className="text-[#0A84FF] font-bold">
                {selectedCells.length} célula(s) selecionada(s)
              </span>
            ) : (
              'Nenhuma seleção ativa'
            )}
          </span>
        </div>

        {/* Selected Cells Statistics Bar */}
        {selectionStats ? (
          <div className="flex items-center gap-3 text-slate-700 bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-2xs font-semibold">
            <span>Contagem: {selectionStats.count}</span>
            {selectionStats.sum !== null && (
              <>
                <span className="text-slate-300">|</span>
                <span>Soma: {selectionStats.sum.toLocaleString('pt-BR')}</span>
                <span className="text-slate-300">|</span>
                <span>Média: {selectionStats.avg?.toFixed(2)}</span>
              </>
            )}
          </div>
        ) : (
          <span className="text-slate-400 italic text-[10px]">
            Clique nas células para ver soma e média
          </span>
        )}
      </div>

      {/* Modal: Adicionar Novo Lançamento */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-extrabold text-base tracking-wide">
                  Novo Lançamento ({activeTab === 'dealer' ? 'Aba DEALER' : 'Aba SiTef'})
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRow} className="p-6 overflow-y-auto space-y-5 flex-1">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Preencha os campos abaixo para adicionar um novo registro. Selecione a <strong>Empresa</strong> e o <strong>Departamento</strong> nas opções disponíveis.
              </p>

              {/* Datalists globais para sugestões instantâneas */}
              <datalist id="empresas-datalist">
                {CADASTRO_EMPRESAS.map((emp) => (
                  <option key={emp} value={emp} />
                ))}
              </datalist>

              <datalist id="departamentos-datalist">
                {CADASTRO_DEPARTAMENTOS.map((dep) => (
                  <option key={dep} value={dep} />
                ))}
              </datalist>

              <datalist id="contas-datalist">
                {CADASTRO_CONTAS_GERENCIAIS.map((cta) => (
                  <option key={cta} value={cta} />
                ))}
              </datalist>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeColumns.map((col) => {
                  const label = col.customHeader || col.originalHeader;
                  const isEmp = isEmpresaColumn(label);
                  const isDep = isDepartamentoColumn(label);
                  const isCta = isContaGerencialColumn(label);
                  const isDate = isDateColumn(label);

                  return (
                    <div key={col.id} className="space-y-1.5 sm:col-span-1">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block truncate flex items-center gap-1.5">
                        {isEmp && <Building2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {isDep && <FolderTree className="w-3.5 h-3.5 text-blue-600" />}
                        {isCta && <Scale className="w-3.5 h-3.5 text-indigo-600" />}
                        {isDate && <Calendar className="w-3.5 h-3.5 text-amber-600" />}
                        <span>{label}</span>
                      </label>

                      {isEmp ? (
                        <select
                          value={newRowFormData[col.id] || ''}
                          onChange={(e) =>
                            setNewRowFormData((prev) => ({
                              ...prev,
                              [col.id]: e.target.value,
                            }))
                          }
                          className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-emerald-50/50 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-xs transition-all"
                        >
                          <option value="">-- Selecione a Empresa (52 Opções) --</option>
                          {CADASTRO_EMPRESAS.map((emp) => (
                            <option key={emp} value={emp}>
                              {emp}
                            </option>
                          ))}
                        </select>
                      ) : isDep ? (
                        <select
                          value={newRowFormData[col.id] || ''}
                          onChange={(e) =>
                            setNewRowFormData((prev) => ({
                              ...prev,
                              [col.id]: e.target.value,
                            }))
                          }
                          className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-blue-50/50 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-xs transition-all"
                        >
                          <option value="">-- Selecione o Departamento --</option>
                          {CADASTRO_DEPARTAMENTOS.map((dep) => (
                            <option key={dep} value={dep}>
                              {dep}
                            </option>
                          ))}
                        </select>
                      ) : isCta ? (
                        <select
                          value={newRowFormData[col.id] || ''}
                          onChange={(e) =>
                            setNewRowFormData((prev) => ({
                              ...prev,
                              [col.id]: e.target.value,
                            }))
                          }
                          className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-indigo-50/50 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-xs transition-all"
                        >
                          <option value="">-- Selecione a Conta Gerencial --</option>
                          {CADASTRO_CONTAS_GERENCIAIS.map((cta) => (
                            <option key={cta} value={cta}>
                              {cta}
                            </option>
                          ))}
                        </select>
                      ) : isDate ? (
                        <input
                          type="date"
                          value={toInputDateFormat(newRowFormData[col.id] || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewRowFormData((prev) => ({
                              ...prev,
                              [col.id]: toDisplayDateFormat(val),
                            }));
                          }}
                          className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-amber-50/30 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer shadow-xs transition-all"
                        />
                      ) : (
                        <input
                          type="text"
                          value={newRowFormData[col.id] || ''}
                          onChange={(e) =>
                            setNewRowFormData((prev) => ({
                              ...prev,
                              [col.id]: e.target.value,
                            }))
                          }
                          placeholder={`Digite ${label}...`}
                          className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-400 placeholder:font-normal shadow-xs transition-all"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Lançamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Exclusão de Lançamento(s) */}
      {deleteConfirmInfo.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            <div className="px-5 py-3.5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Confirmar Exclusão</h3>
              </div>
              <button
                onClick={() => setDeleteConfirmInfo({ isOpen: false, indexesToDelete: [] })}
                className="p-1 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Tem certeza de que deseja excluir{' '}
                <strong className="text-rose-600 font-bold">
                  {deleteConfirmInfo.indexesToDelete.length}{' '}
                  {deleteConfirmInfo.indexesToDelete.length === 1 ? 'lançamento' : 'lançamentos'}
                </strong>{' '}
                da aba <span className="font-bold uppercase text-slate-900">{activeTab}</span>?
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 space-y-1">
                <p className="font-bold">⚠️ Atenção:</p>
                <p>Esta operação atualizará imediatamente os totais e saldos do painel financeiro.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmInfo({ isOpen: false, indexesToDelete: [] })}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir Definitivamente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
