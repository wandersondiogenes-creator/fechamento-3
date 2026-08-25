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
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  sortColId?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (colId: string | null, direction: 'asc' | 'desc') => void;
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
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  sortColId: externalSortColId,
  sortDirection: externalSortDirection = 'asc',
  onSortChange,
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
  // Local state fallback if not controlled externally
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalSortColId, setInternalSortColId] = useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] = useState<'asc' | 'desc'>('asc');

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = (val: string) => {
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    } else {
      setInternalSearchQuery(val);
    }
  };

  const sortColId = externalSortColId !== undefined ? externalSortColId : internalSortColId;
  const sortDirection = externalSortDirection !== undefined ? externalSortDirection : internalSortDirection;
  const setSortColIdAndDirection = (colId: string | null, dir: 'asc' | 'desc') => {
    if (onSortChange) {
      onSortChange(colId, dir);
    } else {
      setInternalSortColId(colId);
      setInternalSortDirection(dir);
    }
  };

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
      <div className="bg-white/90 rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.03)] backdrop-blur-xl flex flex-col h-full overflow-hidden text-[#1D1D1F]">
        <div className="p-10 text-center flex flex-col items-center justify-center my-auto space-y-5 max-w-xl mx-auto">
          <div className="w-16 h-16 bg-blue-50 text-[#007AFF] rounded-2xl flex items-center justify-center shadow-xs border border-blue-100">
            {isDealer ? (
              <FileSpreadsheet className="w-8 h-8 text-[#007AFF]" />
            ) : (
              <CreditCard className="w-8 h-8 text-[#007AFF]" />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-extrabold text-[#1D1D1F] text-lg">
              Aba {isDealer ? 'DEALER' : 'Sitef'} (Em Branco)
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed max-w-md">
              O aplicativo está pronto no modelo <strong className="text-[#007AFF]">{isDealer ? 'DEALER' : 'Sitef'}</strong>. Clique no botão abaixo para importar seu arquivo Excel e aplicar a limpeza e regras automáticas deste modelo.
            </p>
          </div>

          <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 text-left text-xs text-slate-700 space-y-2 w-full">
            <div className="font-extrabold text-blue-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#007AFF]" />
              Regras do Modelo {isDealer ? 'DEALER' : 'Sitef TEF'}:
            </div>
            {isDealer ? (
              <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-600">
                <li>Exclusão de colunas indesejadas (Conta Classificação, Dias, Parc., Histórico, Dep., Dat Acon)</li>
                <li>Remoção automática de linhas sem data ou sem valor na Entrada</li>
                <li>Formatação em Moeda Brasileira (R$) para colunas de Entrada e Saída</li>
              </ul>
            ) : (
              <ul className="space-y-1.5 text-[11px] list-disc list-inside text-slate-600">
                <li>Tratamento de extratos SiTef TEF (Data Transação, Hora, NSU, Autorização, Bandeira)</li>
                <li>Conciliação de transações e formatação de Valor Bruto, Taxa TEF e Valor Líquido em R$</li>
                <li>Identificação de bandeiras (Visa, Mastercard, Elo, Amex, Pix) e tipo de transação</li>
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              onClick={onTriggerFileImport}
              className="px-5 py-2.5 bg-gradient-to-b from-[#007AFF] to-[#0062D2] hover:brightness-105 active:scale-97 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
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
    <div className="bg-white/90 rounded-2xl border border-black/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.04)] backdrop-blur-xl flex flex-col h-full overflow-hidden text-[#1D1D1F]">
      {/* Table Action Controls Toolbar */}
      <div className="p-3.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search Input & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar em qualquer campo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 border border-slate-200 rounded-xl bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent transition-all shadow-2xs"
            />
          </div>

          {/* Import Excel Button */}
          {onTriggerFileImport && (
            <button
              onClick={onTriggerFileImport}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 active:scale-97 text-slate-800 font-semibold rounded-xl text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              title={`Importar nova planilha para o modelo ${
                activeTab === 'dealer'
                  ? 'DEALER'
                  : activeTab === 'sitef'
                  ? 'Sitef'
                  : 'PENDENTE DE CDC'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-[#007AFF]" />
              <span>Importar Excel</span>
            </button>
          )}

          {/* Add Launch Button */}
          {onAddRow && (
            <button
              onClick={handleOpenAddModal}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-97 text-white font-bold rounded-xl text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
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
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Excluir lançamentos selecionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Selecionados ({selectedRowIndexes.length})</span>
              </button>
              <button
                onClick={() => setSelectedCells([])}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
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
          <div className="inline-flex bg-slate-200/80 border border-slate-300/60 p-0.5 rounded-xl text-[11px] font-semibold">
            <button
              onClick={() => setViewRawData(false)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                !viewRawData
                  ? 'bg-white text-[#007AFF] shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dados Tratados ({state.processedData.length})
            </button>
            <button
              onClick={() => setViewRawData(true)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewRawData
                  ? 'bg-white text-[#007AFF] shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
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
        <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Transações <strong className="text-amber-950">PENDENTES</strong> e <strong className="text-purple-950">ESTORNADAS</strong> são mantidas na tabela e destacadas para conferência.
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-200">
              <Clock className="w-3 h-3 text-amber-600" /> Pendentes
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold border border-purple-200">
              <RotateCcw className="w-3 h-3 text-purple-600" /> Estornadas
            </span>
          </div>
        </div>
      )}

      {/* Banner for PENDENTE DE CDC Tab */}
      {activeTab === 'pendente_cdc' && (
        <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong className="text-amber-950">Aba PENDENTE DE CDC:</strong> Lançamentos do DEALER com valor de entrada zerado (R$ 0,00) isolados para conferência.
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 border border-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-md">
            Excluídos automaticamente da aba DEALER
          </span>
        </div>
      )}

      {/* Main Grid Scroll Area */}
      <div className="flex-1 overflow-auto max-h-[68vh] relative bg-white">
        <table className="w-full text-left border-collapse text-xs select-none">
          {/* Header Row */}
          <thead className="bg-slate-100/90 text-slate-800 font-semibold sticky top-0 z-10 border-b border-slate-200 shadow-2xs backdrop-blur-md">
            <tr>
              {/* Row Number Counter Column Header */}
              <th className="w-12 px-2 py-2.5 border-r border-slate-200 bg-slate-100 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={handleSelectAllRows}
                    className="p-0.5 text-slate-500 hover:text-[#007AFF] transition-colors cursor-pointer"
                    title={
                      selectedRowIndexes.length === filteredAndSortedData.length && filteredAndSortedData.length > 0
                        ? 'Desmarcar todos'
                        : 'Selecionar todos os lançamentos'
                    }
                  >
                    {selectedRowIndexes.length === filteredAndSortedData.length && filteredAndSortedData.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[#007AFF]" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
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
                  ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">DD/MM/AAAA</span>;
                } else if (col.type === 'currency') {
                  ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">BRL (R$)</span>;
                } else if (col.type === 'cpf' || col.type === 'cnpj') {
                  ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">{col.type.toUpperCase()}</span>;
                } else if (activeRulesCount > 0) {
                  ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">{activeRulesCount} REGRAS</span>;
                }

                return (
                  <th
                    key={col.id}
                    className="min-w-[150px] px-3 py-2 border-r border-slate-200 bg-slate-100/90 hover:bg-slate-200/60 transition-colors relative group"
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
                              if (sortDirection === 'asc') {
                                setSortColIdAndDirection(col.id, 'desc');
                              } else {
                                setSortColIdAndDirection(null, 'asc');
                              }
                            } else {
                              setSortColIdAndDirection(col.id, 'asc');
                            }
                          }}
                          className={`p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer ${
                            isSorted ? 'text-[#007AFF] font-bold' : 'text-slate-400'
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
                          className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded transition-colors cursor-pointer"
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
                          className="w-full px-1 py-0.5 text-xs border border-[#007AFF] rounded bg-white text-slate-900 font-bold"
                        />
                        <button
                          onClick={() => handleCommitHeaderRename(col)}
                          className="p-0.5 bg-[#007AFF] text-white rounded hover:bg-blue-600"
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
                        className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider truncate cursor-pointer hover:text-[#007AFF] flex items-center justify-between"
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
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredAndSortedData.map(({ row, originalIndex }, displayRowIndex) => {
              const rowCombinedText = Object.values(row)
                .map((v) => (v ? String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : ''))
                .join(' ');

              const isPendenteRow = rowCombinedText.includes('pendent');
              const isEstornadaRow = rowCombinedText.includes('estornad') || rowCombinedText.includes('estorno');
              const isRowSelected = selectedRowIndexes.includes(originalIndex);

              let rowClass = 'hover:bg-slate-50/80 transition-colors';
              if (isRowSelected) {
                rowClass = 'bg-blue-50/80 hover:bg-blue-100/70 border-l-4 border-l-[#007AFF] transition-colors';
              } else if (isPendenteRow) {
                rowClass = 'bg-amber-50/70 hover:bg-amber-100/60 border-l-4 border-l-amber-500 transition-colors';
              } else if (isEstornadaRow) {
                rowClass = 'bg-purple-50/70 hover:bg-purple-100/60 border-l-4 border-l-purple-500 transition-colors';
              }

              return (
                <tr key={`row_${originalIndex}`} className={rowClass}>
                  {/* Row Number Cell */}
                  <td
                    onClick={(e) => handleToggleRowSelection(originalIndex, e)}
                    className="px-2 py-2 border-r border-slate-200 bg-slate-50/50 text-center font-mono text-[11px] text-slate-500 font-semibold select-none cursor-pointer hover:bg-slate-100 transition-colors"
                    title="Clique para selecionar a linha inteira"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={(e) => handleToggleRowSelection(originalIndex, e)}
                        className="p-0.5 text-slate-400 hover:text-[#007AFF]"
                      >
                        {isRowSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-[#007AFF]" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400" />
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
                          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg shadow-2xs transition-all flex items-center justify-center border border-rose-200"
                          title="Excluir transação estornada (Autorização / Cartão)"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
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
                        className={`px-2.5 py-1.5 border-r border-slate-200 font-mono text-xs transition-colors relative ${
                          isSelected ? 'bg-blue-100/60 ring-1 ring-[#007AFF]' : ''
                        } ${invalidCpf ? 'bg-amber-50' : ''}`}
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
                              className="w-full px-2 py-1 border border-[#007AFF] bg-white text-slate-900 rounded-lg font-medium focus:outline-none text-xs"
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
                                    className="p-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg shadow-2xs transition-all flex items-center gap-1 text-[10px] font-bold"
                                    title="Excluir estorno"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-600" />
                                    <span className="hidden sm:inline">Excluir</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span
                                className={`truncate ${
                                  cellValue === null || cellValue === undefined || String(cellValue).trim() === ''
                                    ? 'text-slate-400 italic text-[11px]'
                                    : 'text-slate-800'
                                }`}
                              >
                                {cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== ''
                                  ? String(cellValue)
                                  : '(vazio)'}
                              </span>
                            )}

                            {invalidCpf && (
                              <span
                                className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded font-sans text-[9px] font-bold flex-shrink-0"
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
                  className="p-12 text-center text-slate-400 italic text-xs"
                >
                  Nenhum registro encontrado para esta busca ou filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Apple Pro Bottom Sheet Bar */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[11px]">Aba Ativa:</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wide">
            {activeTab === 'dealer'
              ? 'DEALER'
              : activeTab === 'sitef'
              ? 'SITEF'
              : activeTab === 'pendente_cdc'
              ? 'PENDENTE DE CDC'
              : 'FECHAMENTO'}
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3">
          <span>
            Total: <strong className="text-slate-800">{displayData.length}</strong> registros
          </span>
          {searchQuery && (
            <span className="text-[#007AFF] font-semibold">
              Filtrados: {filteredAndSortedData.length}
            </span>
          )}
          <span className="hidden sm:inline">
            Colunas: <strong className="text-slate-800">{activeColumns.length}</strong> / {state.columns.length}
          </span>
        </div>
      </div>

      {/* Excel Bottom Selection Stats Bar */}
      <div className="px-4 py-1.5 bg-slate-100 border-t border-slate-200 text-slate-600 text-[11px] flex flex-wrap items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-3">
          <span>
            {selectedRowIndexes.length > 0 ? (
              <span className="text-[#007AFF] font-bold">
                {selectedRowIndexes.length} linha(s) selecionada(s)
              </span>
            ) : selectedCells.length > 0 ? (
              <span className="text-[#007AFF] font-bold">
                {selectedCells.length} célula(s) selecionada(s)
              </span>
            ) : (
              'Nenhuma seleção ativa'
            )}
          </span>
        </div>

        {/* Selected Cells Statistics Bar */}
        {selectionStats ? (
          <div className="flex items-center gap-3 text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs font-semibold">
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-extrabold text-base tracking-wide text-white">
                      Novo Lançamento
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                      {activeTab === 'dealer'
                        ? 'Aba DEALER'
                        : activeTab === 'sitef'
                        ? 'Aba SiTef'
                        : 'Aba Pendente de CDC'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Preencha os campos abaixo. As opções de Empresa, Departamento e Conta Gerencial possuem sugestões e listas integradas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRow} className="flex flex-col flex-1 overflow-hidden bg-slate-50/60">
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

              <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
                {/* Information Header Banner */}
                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 flex items-center gap-3 text-xs text-emerald-950">
                  <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    O novo lançamento será inserido instantaneamente nesta aba e sincronizado com o módulo de <strong>Fechamento</strong> e conciliações automáticas.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4.5">
                  {activeColumns.map((col) => {
                    const label = col.customHeader || col.originalHeader;
                    const isEmp = isEmpresaColumn(label);
                    const isDep = isDepartamentoColumn(label);
                    const isCta = isContaGerencialColumn(label);
                    const isDate = isDateColumn(label);
                    const isLongText = /HIST[OÓ]RICO|OBSERVA[CÇ][OÕ]ES|DETALHE/i.test(label);
                    const isCurrency = /ENTRADA|SA[IÍ]DA|VALOR|TAXA|L[IÍ]QUIDO|BRUTO/i.test(label);

                    // Dynamic column spans for wide readable layout
                    let colSpanClass = 'sm:col-span-1';
                    if (isEmp) {
                      colSpanClass = 'sm:col-span-2 md:col-span-2 xl:col-span-2';
                    } else if (isLongText) {
                      colSpanClass = 'sm:col-span-2 md:col-span-3 xl:col-span-4';
                    }

                    return (
                      <div key={col.id} className={`space-y-1.5 ${colSpanClass}`}>
                        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block flex items-center justify-between gap-1.5">
                          <span className="flex items-center gap-1.5 truncate">
                            {isEmp && <Building2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                            {isDep && <FolderTree className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                            {isCta && <Scale className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                            {isDate && <Calendar className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                            <span className="truncate">{label}</span>
                          </span>
                          {isEmp && (
                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md flex-shrink-0">
                              52 Opções
                            </span>
                          )}
                          {isCurrency && (
                            <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded-md flex-shrink-0">
                              R$
                            </span>
                          )}
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
                            className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-emerald-50/70 border-2 border-emerald-300 hover:border-emerald-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-xs transition-all"
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
                            className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-blue-50/70 border-2 border-blue-300 hover:border-blue-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-xs transition-all"
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
                            className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-indigo-50/70 border-2 border-indigo-300 hover:border-indigo-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-xs transition-all"
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
                            className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-amber-50/50 border-2 border-amber-300 hover:border-amber-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer shadow-xs transition-all"
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
                            placeholder={isCurrency ? '0,00' : `Digite ${label}...`}
                            className={`w-full px-3.5 py-2.5 text-sm rounded-xl border-2 transition-all shadow-xs ${
                              isCurrency
                                ? 'bg-white border-slate-300 font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                                : 'bg-white border-slate-300 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-400 placeholder:font-normal'
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pinned Bottom Action Toolbar */}
              <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shadow-md">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  {activeColumns.length} campos configurados
                </span>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-97 text-white font-extrabold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Lançamento</span>
                  </button>
                </div>
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
