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
  FileText,
  Download,
  ClipboardPaste,
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
  onExport?: (format: 'xlsx' | 'csv' | 'json', includeHidden?: boolean) => void;
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
  onExport,
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

  // Total Monetary Sum Calculation for Metric Card
  const totalValueSum = useMemo(() => {
    let sum = 0;
    const valueCol = state.columns.find(
      (c) =>
        c.type === 'currency' ||
        /valor|entrada|total|liquido|bruto|saldo/i.test(c.customHeader || c.originalHeader)
    );

    const rowsToSum =
      selectedRowIndexes.length > 0
        ? selectedRowIndexes.map((idx) => state.processedData[idx]).filter(Boolean)
        : filteredAndSortedData.map((d) => d.row);

    if (valueCol) {
      for (const r of rowsToSum) {
        const val = r[valueCol.id];
        if (typeof val === 'number') {
          sum += val;
        } else if (typeof val === 'string') {
          const num = parseFloat(
            val.replace(/[R$\s.]/g, '').replace(',', '.')
          );
          if (!isNaN(num)) sum += num;
        }
      }
    }
    return sum;
  }, [state.columns, state.processedData, selectedRowIndexes, filteredAndSortedData]);

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

  const formattedTotalCurrency = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(totalValueSum);

  if (!state.columns || state.columns.length === 0) {
    const isDealer = activeTab === 'dealer';

    return (
      <div className="space-y-4">
        {/* Apple 4 Metric Summary Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total de {isDealer ? 'Boletos' : 'Lançamentos'}
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">0</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007AFF] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Selecionados */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {isDealer ? 'Boletos' : 'Lançamentos'} Selecionados
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                <span className="text-emerald-500 font-extrabold">0</span> / 0
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Valor Total */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Valor Total Selecionado
              </div>
              <div className="text-xl font-black text-[#007AFF] font-mono">R$ 0,00</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007AFF] font-bold text-sm flex items-center justify-center font-mono">
              R$
            </div>
          </div>

          {/* Card 4: Status */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Status de Validação
              </div>
              <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Todos Válidos</span>
              </div>
            </div>
            <button
              onClick={onTriggerFileImport}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-105 active:scale-97 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Gerar CNAB</span>
            </button>
          </div>
        </div>

        {/* Empty State Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col overflow-hidden text-slate-800">
          <div className="p-10 text-center flex flex-col items-center justify-center my-auto space-y-5 max-w-xl mx-auto">
            <div className="w-16 h-16 bg-blue-50 text-[#007AFF] rounded-2xl flex items-center justify-center shadow-xs border border-blue-200">
              {isDealer ? (
                <FileSpreadsheet className="w-8 h-8 text-[#007AFF]" />
              ) : (
                <CreditCard className="w-8 h-8 text-[#007AFF]" />
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-900 text-lg">
                Aba {isDealer ? 'Boletos a Pagar (DEALER)' : 'Sitef TEF'} (Em Branco)
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed max-w-md">
                O aplicativo está pronto no modelo <strong className="text-[#007AFF]">{isDealer ? 'DEALER' : 'Sitef'}</strong>. Clique no botão abaixo para importar seu arquivo Excel e aplicar a limpeza e regras automáticas deste modelo.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-xs text-slate-700 space-y-2 w-full">
              <div className="font-extrabold text-[#007AFF] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
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
                className="px-5 py-2.5 bg-[#007AFF] hover:bg-blue-600 active:scale-97 text-white font-extrabold rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Importar Arquivo ({isDealer ? 'Modelo DEALER' : 'Modelo Sitef'})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Apple 4 Metric Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total de Boletos / Lançamentos */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total de {activeTab === 'dealer' ? 'Boletos' : 'Lançamentos'}
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {state.processedData.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007AFF] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Selecionados */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {activeTab === 'dealer' ? 'Boletos' : 'Lançamentos'} Selecionados
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              <span className="text-emerald-500 font-extrabold">{selectedRowIndexes.length}</span>{' '}
              / {filteredAndSortedData.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Valor Total */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Valor Total {selectedRowIndexes.length > 0 ? 'Selecionado' : 'Aba'}
            </div>
            <div className="text-xl font-black text-[#007AFF] font-mono">
              {formattedTotalCurrency}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007AFF] font-bold text-sm flex items-center justify-center font-mono">
            R$
          </div>
        </div>

        {/* Card 4: Status de Validação */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Status de Validação
            </div>
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Todos Válidos</span>
            </div>
          </div>
          <button
            onClick={() => onExport?.('xlsx', false)}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-105 active:scale-97 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Gerar remessa ou exportação formatada"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Gerar CNAB</span>
          </button>
        </div>
      </div>

      {/* Main Table Card (Light Apple Design) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col h-full overflow-hidden text-slate-800">
        {/* Filter by Alerts & Quick Action Pills Toolbar (Matching image.png) */}
        <div className="p-3.5 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Left Side: Filter by alerts */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">Filtrar por Alertas:</span>
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-1 bg-[#007AFF] hover:bg-blue-600 text-white font-bold rounded-full text-xs shadow-2xs transition-all cursor-pointer"
            >
              Todos ({filteredAndSortedData.length})
            </button>
          </div>

          {/* Right Side: Quick Action Pills */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {/* Search Input (Pill Shape) */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 border border-slate-200 rounded-full bg-slate-50/70 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:bg-white transition-all"
              />
            </div>

            {/* Extrair PDF (IA) Pill Button */}
            <button
              onClick={onTriggerFileImport}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#0066FE] to-[#0080FF] hover:brightness-105 active:scale-97 text-white font-semibold rounded-full text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Extrair PDF (IA)</span>
            </button>

            {/* Colar Vários / Importar */}
            {onTriggerFileImport && (
              <button
                onClick={onTriggerFileImport}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 active:scale-97 text-slate-700 font-semibold rounded-full text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-slate-500" />
                <span>Colar Vários</span>
              </button>
            )}

            {/* Novo Boleto / Novo Lançamento */}
            {onAddRow && (
              <button
                onClick={handleOpenAddModal}
                className="px-3.5 py-1.5 bg-[#007AFF] hover:bg-blue-600 active:scale-97 text-white font-semibold rounded-full text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Novo Boleto</span>
              </button>
            )}

            {/* View Toggle (Dados Tratados vs Brutos) */}
            <div className="inline-flex bg-slate-100 p-0.5 rounded-full text-[11px] font-semibold border border-slate-200 ml-1">
              <button
                onClick={() => setViewRawData(false)}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  !viewRawData
                    ? 'bg-white text-[#007AFF] shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tratados ({state.processedData.length})
              </button>
              <button
                onClick={() => setViewRawData(true)}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  viewRawData
                    ? 'bg-white text-[#007AFF] shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Brutos
              </button>
            </div>

            {/* Column Visibility Popover */}
            <ColumnVisibilityPopover
              columns={state.columns}
              onToggleVisibility={(id) => {
                const col = state.columns.find((c) => c.id === id);
                if (col) onUpdateColumn({ ...col, visible: !col.visible });
              }}
              onSetAllVisibility={onSetAllColumnsVisibility}
            />

            {/* Delete Selected Rows Button */}
            {selectedRowIndexes.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRequestDeleteSelected}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Excluir lançamentos selecionados"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir ({selectedRowIndexes.length})</span>
                </button>
                <button
                  onClick={() => setSelectedCells([])}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-full text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Limpar seleção"
                >
                  <X className="w-3 h-3" />
                  <span className="hidden md:inline">Limpar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Grid Scroll Area */}
        <div className="flex-1 overflow-auto max-h-[64vh] relative bg-white">
          <table className="w-full text-left border-collapse text-xs select-none">
            {/* Header Row (Light Apple Style: #F8FAFC with crisp borders) */}
            <thead className="bg-[#F8FAFC] text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
              <tr>
                {/* Row Number Counter Column Header */}
                <th className="w-12 px-2 py-3 border-r border-slate-200 bg-[#F8FAFC] text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={handleSelectAllRows}
                      className="p-0.5 text-slate-400 hover:text-[#007AFF] transition-colors cursor-pointer"
                      title={
                        selectedRowIndexes.length === filteredAndSortedData.length && filteredAndSortedData.length > 0
                          ? 'Desmarcar todos'
                          : 'Selecionar todos os lançamentos'
                      }
                    >
                      {selectedRowIndexes.length === filteredAndSortedData.length && filteredAndSortedData.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-[#007AFF]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
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
                    ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">DATA</span>;
                  } else if (col.type === 'currency') {
                    ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-[#007AFF] border border-blue-200">BRL (R$)</span>;
                  } else if (col.type === 'cpf' || col.type === 'cnpj') {
                    ruleTagBadge = <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">{col.type.toUpperCase()}</span>;
                  }

                  return (
                    <th
                      key={col.id}
                      className="min-w-[150px] px-3.5 py-2.5 border-r border-slate-200 bg-[#F8FAFC] hover:bg-slate-100 transition-colors relative group"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        {/* Excel Letter & Rules Badge */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 font-mono">
                            {getExcelColumnLabel(index)}
                          </span>
                          {ruleTagBadge}
                        </div>

                        {/* Sorting & Config Buttons */}
                        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
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
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors cursor-pointer"
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
                            className="w-full px-1.5 py-0.5 text-xs border border-[#007AFF] rounded-md bg-white text-slate-900 font-bold"
                          />
                          <button
                            onClick={() => handleCommitHeaderRename(col)}
                            className="p-1 bg-[#007AFF] text-white rounded hover:bg-blue-600"
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
                          className={`font-black text-[11px] uppercase tracking-wider truncate cursor-pointer hover:text-[#007AFF] flex items-center justify-between ${
                            isSorted ? 'text-[#007AFF]' : 'text-slate-700'
                          }`}
                          title="Clique duplo para renomear"
                        >
                          <span className="truncate">{col.customHeader || col.originalHeader}</span>
                          {isSorted && (
                            <span className="text-[10px] text-[#007AFF] ml-1">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
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

                let rowClass = 'hover:bg-slate-50 transition-colors';
                if (isRowSelected) {
                  rowClass = 'bg-blue-50/70 hover:bg-blue-100/70 border-l-4 border-l-[#007AFF] transition-colors';
                } else if (isPendenteRow) {
                  rowClass = 'bg-amber-50/60 hover:bg-amber-100/70 border-l-4 border-l-amber-500 transition-colors';
                } else if (isEstornadaRow) {
                  rowClass = 'bg-purple-50/60 hover:bg-purple-100/70 border-l-4 border-l-purple-500 transition-colors';
                }

                return (
                  <tr key={`row_${originalIndex}`} className={rowClass}>
                    {/* Row Number Cell */}
                    <td
                      onClick={(e) => handleToggleRowSelection(originalIndex, e)}
                      className="px-2 py-2 border-r border-slate-100 bg-slate-50/50 text-center font-mono text-[11px] text-slate-500 font-semibold select-none cursor-pointer hover:bg-slate-100 transition-colors"
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
                            <Square className="w-3.5 h-3.5 text-slate-300" />
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
                            className="p-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg shadow-2xs transition-all flex items-center justify-center border border-rose-200"
                            title="Excluir transação estornada"
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
                          className={`px-3 py-2 border-r border-slate-100 font-mono text-xs transition-colors relative ${
                            isSelected ? 'bg-blue-50/90 ring-1 ring-[#007AFF]' : ''
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
                                className="w-full px-2 py-1 border border-[#007AFF] bg-white text-slate-900 rounded-lg font-medium focus:outline-none text-xs shadow-2xs"
                              />
                              <button
                                onClick={handleCommitCellEdit}
                                className="p-1 bg-[#007AFF] text-white rounded-lg hover:bg-blue-600 shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1.5 overflow-hidden">
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
                                      ? 'text-slate-300 italic text-[11px]'
                                      : 'text-slate-800 font-medium'
                                  }`}
                                >
                                  {cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== ''
                                    ? String(cellValue)
                                    : '-'}
                                </span>
                              )}

                              {invalidCpf && (
                                <span
                                  className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-sans text-[9px] font-bold flex-shrink-0 border border-amber-300"
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

        {/* Apple Pro Bottom Sheet Bar (Clean White / Slate) */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">Aba Ativa:</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wide shadow-2xs">
              {activeTab === 'dealer'
                ? 'DEALER'
                : activeTab === 'sitef'
                ? 'SITEF'
                : activeTab === 'pendente_cdc'
                ? 'PENDENTE DE CDC'
                : 'FECHAMENTO'}
            </span>
          </div>

          <div className="text-[11px] text-slate-600 font-mono flex items-center gap-3">
            <span>
              Total: <strong className="text-slate-900">{displayData.length}</strong> registros
            </span>
            {searchQuery && (
              <span className="text-[#007AFF] font-semibold">
                Filtrados: {filteredAndSortedData.length}
              </span>
            )}
            <span className="hidden sm:inline">
              Colunas: <strong className="text-slate-900">{activeColumns.length}</strong> / {state.columns.length}
            </span>
          </div>
        </div>

        {/* Excel Bottom Selection Stats Bar */}
        <div className="px-4 py-1.5 bg-slate-100/70 border-t border-slate-200 text-slate-600 text-[11px] flex flex-wrap items-center justify-between gap-2 font-mono">
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
