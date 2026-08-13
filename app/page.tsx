'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ColumnConfig, ColumnRule, RulePreset, RuleType, SpreadsheetState } from '@/types/spreadsheet';
import {
  cleanAndOrganizeRawData,
  createSmartColumnConfigs,
  exportProcessedData,
  normalizeSitefRawData,
  parseFileToSpreadsheet,
  processSpreadsheetData,
  separateZeroValueDealerRows,
} from '@/lib/excel-utils';
import { FechamentoItem, generateAutoFechamento } from '@/lib/fechamento-utils';
import { SAMPLE_DATASETS } from '@/lib/sample-data';
import { ExcelHeader } from '@/components/ExcelHeader';
import { ExcelTable } from '@/components/ExcelTable';
import { FechamentoView } from '@/components/FechamentoView';
import { ColumnRuleModal } from '@/components/ColumnRuleModal';
import { PresetsModal } from '@/components/PresetsModal';
import { AIAssistantDrawer } from '@/components/AIAssistantDrawer';
import { Sparkles, FileSpreadsheet, Zap, CheckCircle2, Bookmark, FolderOpen, X, TrendingUp, TrendingDown, Wallet, Clock, RotateCcw, CreditCard } from 'lucide-react';

function buildEmptySpreadsheetState(defaultName: string = 'DEALER.xlsx'): SpreadsheetState {
  return {
    fileName: defaultName,
    headers: [],
    columns: [],
    rawData: [],
    processedData: [],
    hasHeaderRow: true,
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento'>('dealer');

  const [dealerState, setDealerState] = useState<SpreadsheetState>(() =>
    buildEmptySpreadsheetState('DEALER.xlsx')
  );

  const [sitefState, setSitefState] = useState<SpreadsheetState>(() =>
    buildEmptySpreadsheetState('SITEF.xlsx')
  );

  const [pendenteCdcState, setPendenteCdcState] = useState<SpreadsheetState>(() =>
    buildEmptySpreadsheetState('PENDENTE_DE_CDC.xlsx')
  );

  // Manual & deleted Fechamento state
  const [manualFechamentoItems, setManualFechamentoItems] = useState<FechamentoItem[]>([]);
  const [deletedFechamentoIds, setDeletedFechamentoIds] = useState<Set<string>>(new Set());

  // Automatic Fechamento computation based on current DEALER and SITEF data
  const autoFechamentoItems = useMemo(() => {
    return generateAutoFechamento(
      dealerState.processedData,
      dealerState.columns,
      sitefState.processedData,
      sitefState.columns
    );
  }, [dealerState.processedData, dealerState.columns, sitefState.processedData, sitefState.columns]);

  // Combined Fechamento items list
  const allFechamentoItems = useMemo(() => {
    const combined = [...manualFechamentoItems, ...autoFechamentoItems];
    return combined.filter((item) => !deletedFechamentoIds.has(item.id));
  }, [autoFechamentoItems, manualFechamentoItems, deletedFechamentoIds]);

  const spreadsheetState =
    activeTab === 'dealer'
      ? dealerState
      : activeTab === 'pendente_cdc'
      ? pendenteCdcState
      : sitefState;

  const setSpreadsheetState = useCallback(
    (updater: React.SetStateAction<SpreadsheetState>) => {
      if (activeTab === 'dealer') {
        setDealerState(updater);
      } else if (activeTab === 'pendente_cdc') {
        setPendenteCdcState(updater);
      } else if (activeTab === 'sitef') {
        setSitefState(updater);
      }
    },
    [activeTab]
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const triggerFileImport = () => {
    fileInputRef.current?.click();
  };

  // Auto Organize Banner State
  const [autoOrganizeBanner, setAutoOrganizeBanner] = useState<{
    show: boolean;
    message: string;
  } | null>(null);

  // Modal / Drawer States
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);

  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);

  // Process data whenever rawData or columns configuration changes
  const updateProcessedData = useCallback(
    (cols: ColumnConfig[], raw: Record<string, any>[]) => {
      if (activeTab === 'sitef') {
        const processed = processSpreadsheetData(raw, cols);
        setSitefState((prev) => ({
          ...prev,
          columns: cols,
          rawData: raw,
          processedData: processed,
        }));
      } else {
        // activeTab is 'dealer' or 'pendente_cdc'
        const otherRaw = activeTab === 'dealer' ? pendenteCdcState.rawData : dealerState.rawData;
        const combined = [...raw, ...otherRaw];

        const { dealerRows, pendenteCdcRows } = separateZeroValueDealerRows(combined, cols);

        const processedDealer = processSpreadsheetData(dealerRows, cols);
        const processedPendente = processSpreadsheetData(pendenteCdcRows, cols);

        setDealerState((prev) => ({
          ...prev,
          columns: cols,
          rawData: dealerRows,
          processedData: processedDealer,
        }));

        setPendenteCdcState((prev) => ({
          ...prev,
          columns: cols,
          rawData: pendenteCdcRows,
          processedData: processedPendente,
        }));
      }
    },
    [activeTab, dealerState.rawData, pendenteCdcState.rawData]
  );

  // Helper to construct initial column configs from headers array
  const createColumnConfigs = useCallback((headers: string[]): ColumnConfig[] => {
    return headers.map((header, idx) => {
      const colId = `col_${idx}`;
      const lower = header.toLowerCase();

      let type: ColumnConfig['type'] = 'text';
      const rules: ColumnRule[] = [];

      if (lower.includes('cpf')) {
        type = 'cpf';
      } else if (lower.includes('cnpj')) {
        type = 'cnpj';
      } else if (lower.includes('data') || lower.includes('dt_') || lower.includes('nasc')) {
        type = 'date';
      } else if (lower.includes('valor') || lower.includes('preco') || lower.includes('saldo') || lower.includes('custo')) {
        type = 'currency';
      }

      return {
        id: colId,
        originalHeader: header,
        customHeader: header,
        visible: true,
        type,
        rules,
      };
    });
  }, []);

  // Handler: Load Sample Dataset
  const loadSampleDataset = useCallback((datasetId: string) => {
    const sample = SAMPLE_DATASETS.find((s) => s.id === datasetId) || SAMPLE_DATASETS[0];

    if (sample.id === 'sitef') {
      const normalizedRaw = normalizeSitefRawData(sample.rawData, sample.headers);
      const columns = createColumnConfigs(sample.headers);
      columns.forEach((c) => {
        const h = c.originalHeader.toLowerCase();
        if (h.includes('bruto') || h.includes('taxa') || h.includes('liquido') || h.includes('líquido')) {
          c.type = 'currency';
          c.rules = [{ id: `r_curr_${c.id}`, type: 'format_currency_brl', enabled: true }];
        } else if (h.includes('data')) {
          c.type = 'date';
          c.rules = [{ id: `r_date_${c.id}`, type: 'convert_date', enabled: true, dateFormatConfig: { targetFormat: 'DD/MM/YYYY' } }];
        }
      });

      const processedData = processSpreadsheetData(normalizedRaw, columns);
      setSitefState({
        fileName: 'SITEF.xlsx',
        headers: sample.headers,
        columns,
        rawData: normalizedRaw,
        processedData,
        hasHeaderRow: true,
      });
      setActiveTab('sitef');
    } else {
      // DEALER dataset - clean and separate zero value rows into PENDENTE DE CDC
      const report = cleanAndOrganizeRawData(sample.headers, sample.rawData);
      const columns = createSmartColumnConfigs(report.cleanedHeaders, [
        ...report.cleanedRawData,
        ...(report.zeroValueRawData || []),
      ]);

      const dealerProcessed = processSpreadsheetData(report.cleanedRawData, columns);
      const pendenteProcessed = processSpreadsheetData(report.zeroValueRawData || [], columns);

      setDealerState({
        fileName: 'DEALER.xlsx',
        headers: report.cleanedHeaders,
        columns,
        rawData: report.cleanedRawData,
        processedData: dealerProcessed,
        hasHeaderRow: true,
      });

      setPendenteCdcState({
        fileName: 'PENDENTE_DE_CDC.xlsx',
        headers: report.cleanedHeaders,
        columns,
        rawData: report.zeroValueRawData || [],
        processedData: pendenteProcessed,
        hasHeaderRow: true,
      });

      if (datasetId === 'dealer') {
        setActiveTab('dealer');
      }
    }
    setAutoOrganizeBanner(null);
  }, [createColumnConfigs]);

  // Clean empty initial mount without loading sample datasets
  useEffect(() => {
    // Starts empty so only imported data is kept
  }, []);

  // Handler: Automatic Organization
  const handleAutoOrganize = useCallback(() => {
    if (activeTab === 'sitef') {
      const report = cleanAndOrganizeRawData(sitefState.headers, sitefState.rawData);
      const normalizedRaw = normalizeSitefRawData(report.cleanedRawData, report.cleanedHeaders);
      const columns = createSmartColumnConfigs(report.cleanedHeaders, normalizedRaw);
      const processedData = processSpreadsheetData(normalizedRaw, columns);

      setSitefState((prev) => ({
        ...prev,
        headers: report.cleanedHeaders,
        columns,
        rawData: normalizedRaw,
        processedData,
      }));
    } else {
      const combined = [...dealerState.rawData, ...pendenteCdcState.rawData];
      const report = cleanAndOrganizeRawData(dealerState.headers, combined);
      const columns = createSmartColumnConfigs(report.cleanedHeaders, [
        ...report.cleanedRawData,
        ...(report.zeroValueRawData || []),
      ]);

      const dealerProcessed = processSpreadsheetData(report.cleanedRawData, columns);
      const pendenteProcessed = processSpreadsheetData(report.zeroValueRawData || [], columns);

      setDealerState({
        fileName: dealerState.fileName || 'DEALER.xlsx',
        headers: report.cleanedHeaders,
        columns,
        rawData: report.cleanedRawData,
        processedData: dealerProcessed,
        hasHeaderRow: true,
      });

      setPendenteCdcState({
        fileName: 'PENDENTE_DE_CDC.xlsx',
        headers: report.cleanedHeaders,
        columns,
        rawData: report.zeroValueRawData || [],
        processedData: pendenteProcessed,
        hasHeaderRow: true,
      });
    }

    setAutoOrganizeBanner({
      show: true,
      message: `Planilha organizada com sucesso! Formatações, limpeza e distribuição automática entre DEALER e PENDENTE DE CDC aplicadas.`,
    });
  }, [activeTab, dealerState, pendenteCdcState, sitefState]);

  // Handler: Import File with Automatic Organization
  const handleImportFile = async (file: File) => {
    try {
      const { headers, rawData, fileName } = await parseFileToSpreadsheet(file);

      const report = cleanAndOrganizeRawData(headers, rawData);

      if (activeTab === 'sitef') {
        const normalizedRaw = normalizeSitefRawData(report.cleanedRawData, report.cleanedHeaders);
        const columns = createSmartColumnConfigs(report.cleanedHeaders, normalizedRaw);
        const processedData = processSpreadsheetData(normalizedRaw, columns);

        setSitefState({
          fileName,
          headers: report.cleanedHeaders,
          columns,
          rawData: normalizedRaw,
          processedData,
          hasHeaderRow: true,
        });

        setAutoOrganizeBanner({
          show: true,
          message: `Planilha "${fileName}" organizada, com nomes de empresas padronizados e tratada no modelo Sitef!`,
        });
      } else {
        const columns = createSmartColumnConfigs(report.cleanedHeaders, [
          ...report.cleanedRawData,
          ...(report.zeroValueRawData || []),
        ]);

        const dealerProcessed = processSpreadsheetData(report.cleanedRawData, columns);
        const pendenteProcessed = processSpreadsheetData(report.zeroValueRawData || [], columns);

        setDealerState({
          fileName,
          headers: report.cleanedHeaders,
          columns,
          rawData: report.cleanedRawData,
          processedData: dealerProcessed,
          hasHeaderRow: true,
        });

        setPendenteCdcState({
          fileName: 'PENDENTE_DE_CDC.xlsx',
          headers: report.cleanedHeaders,
          columns,
          rawData: report.zeroValueRawData || [],
          processedData: pendenteProcessed,
          hasHeaderRow: true,
        });

        const countZero = report.zeroValueRawData?.length || 0;
        setAutoOrganizeBanner({
          show: true,
          message: `Planilha "${fileName}" organizada e tratada no modelo DEALER! ${countZero > 0 ? `${countZero} lançamento(s) com valor zerado foram movidos automaticamente para a aba PENDENTE DE CDC e excluídos do DEALER.` : ''}`,
        });
      }
    } catch (err: any) {
      alert(`Erro ao carregar planilha: ${err.message || err}`);
    }
  };

  // Handler: Update Column Config
  const handleUpdateColumn = (updatedCol: ColumnConfig) => {
    const newCols = spreadsheetState.columns.map((c) => (c.id === updatedCol.id ? updatedCol : c));
    updateProcessedData(newCols, spreadsheetState.rawData);
  };

  // Handler: Visibility toggle for all
  const handleSetAllColumnsVisibility = (visible: boolean) => {
    const newCols = spreadsheetState.columns.map((c) => ({ ...c, visible }));
    updateProcessedData(newCols, spreadsheetState.rawData);
  };

  // Handler: Direct Cell Edit
  const handleUpdateCell = (rowIndex: number, colId: string, newValue: any) => {
    const updatedRaw = [...spreadsheetState.rawData];
    if (updatedRaw[rowIndex]) {
      updatedRaw[rowIndex] = {
        ...updatedRaw[rowIndex],
        [colId]: newValue,
      };
      updateProcessedData(spreadsheetState.columns, updatedRaw);
    }
  };

  // Handler: Delete Row
  const handleDeleteRow = (rowIndex: number) => {
    const updatedRaw = spreadsheetState.rawData.filter((_, idx) => idx !== rowIndex);
    updateProcessedData(spreadsheetState.columns, updatedRaw);
  };

  // Handler: Delete Multiple Rows
  const handleDeleteRows = (rowIndexes: number[]) => {
    const indexSet = new Set(rowIndexes);
    const updatedRaw = spreadsheetState.rawData.filter((_, idx) => !indexSet.has(idx));
    updateProcessedData(spreadsheetState.columns, updatedRaw);
  };

  // Handler: Add New Row / Launch
  const handleAddRow = (newRowData?: Record<string, any>) => {
    let rowToAdd = newRowData;
    if (!rowToAdd) {
      rowToAdd = {};
      spreadsheetState.columns.forEach((col) => {
        rowToAdd![col.id] = '';
      });
    }
    const updatedRaw = [rowToAdd, ...spreadsheetState.rawData];
    updateProcessedData(spreadsheetState.columns, updatedRaw);
  };

  // Handler: Apply Preset
  const handleApplyPreset = (preset: RulePreset) => {
    const updatedCols = spreadsheetState.columns.map((col) => {
      const headerName = (col.customHeader || col.originalHeader).toLowerCase();

      // Find matching rule definition
      const match = preset.columnRulesMatch.find((m) => {
        const regex = new RegExp(m.columnNameMatch, 'i');
        return regex.test(headerName);
      });

      if (match) {
        return {
          ...col,
          customHeader: match.customHeader || col.customHeader,
          rules: match.rules,
        };
      }
      return col;
    });

    updateProcessedData(updatedCols, spreadsheetState.rawData);
  };

  // Handler: AI Single Suggestion
  const handleApplySingleAISuggestion = (columnId: string, rule: ColumnRule) => {
    const updatedCols = spreadsheetState.columns.map((col) => {
      const isMatch =
        col.id.toLowerCase() === columnId.toLowerCase() ||
        col.customHeader.toLowerCase() === columnId.toLowerCase() ||
        col.originalHeader.toLowerCase() === columnId.toLowerCase();

      if (isMatch) {
        const existingRuleIndex = col.rules.findIndex((r) => r.type === rule.type);
        let newRules = [...col.rules];
        if (existingRuleIndex >= 0) {
          newRules[existingRuleIndex] = { ...newRules[existingRuleIndex], ...rule, enabled: true };
        } else {
          newRules.push(rule);
        }
        return {
          ...col,
          rules: newRules,
        };
      }
      return col;
    });
    updateProcessedData(updatedCols, spreadsheetState.rawData);
  };

  // Handler: AI Apply All Suggestions
  const handleApplyAllAISuggestions = (
    suggestions: Array<{ columnId: string; rule: ColumnRule }>
  ) => {
    let updatedCols = [...spreadsheetState.columns];
    suggestions.forEach(({ columnId, rule }) => {
      updatedCols = updatedCols.map((col) => {
        const isMatch =
          col.id.toLowerCase() === columnId.toLowerCase() ||
          col.customHeader.toLowerCase() === columnId.toLowerCase() ||
          col.originalHeader.toLowerCase() === columnId.toLowerCase();

        if (isMatch) {
          const existingRuleIndex = col.rules.findIndex((r) => r.type === rule.type);
          let newRules = [...col.rules];
          if (existingRuleIndex >= 0) {
            newRules[existingRuleIndex] = { ...newRules[existingRuleIndex], ...rule, enabled: true };
          } else {
            newRules.push(rule);
          }
          return {
            ...col,
            rules: newRules,
          };
        }
        return col;
      });
    });
    updateProcessedData(updatedCols, spreadsheetState.rawData);
  };

  // Handler: Open Column Modal
  const handleOpenColumnModal = (colId: string) => {
    setSelectedColumnId(colId);
    setIsColumnModalOpen(true);
  };

  // Summary metrics calculation for financial cards ("quadrados")
  const summaryMetrics = useMemo(() => {
    if (!spreadsheetState.processedData || spreadsheetState.processedData.length === 0) {
      return {
        totalEntrada: 0,
        totalSaida: 0,
        saldo: 0,
        totalEstornados: 0,
        countEstornados: 0,
        totalPendentes: 0,
        countPendentes: 0,
        count: 0,
        hasData: false,
        labelEntrada: activeTab === 'dealer' ? 'Soma Total de Entrada' : 'Valor Bruto Total (Entrada)',
        labelSaida: activeTab === 'dealer' ? 'Soma Total de Saída' : 'Taxas TEF Total (Saída)',
        labelSaldo: activeTab === 'dealer' ? 'Saldo Líquido' : 'Valor Líquido Total',
      };
    }

    const entradaCol = spreadsheetState.columns.find((c) => {
      const h = (c.customHeader || c.originalHeader)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return (
        h.includes('entrada') ||
        h.includes('valor bruto') ||
        h.includes('bruto') ||
        (h.includes('valor') && !h.includes('liquido') && !h.includes('taxa')) ||
        h.includes('receita')
      );
    });

    const saidaCol = spreadsheetState.columns.find((c) => {
      const h = (c.customHeader || c.originalHeader)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return h.includes('saida') || h.includes('taxa') || h.includes('despesa');
    });

    const liquidoCol = spreadsheetState.columns.find((c) => {
      const h = (c.customHeader || c.originalHeader)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return h.includes('liquido') || h.includes('saldo');
    });

    const statusCol = spreadsheetState.columns.find((c) => {
      const h = (c.customHeader || c.originalHeader)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return (
        h.includes('estado') ||
        h.includes('status') ||
        h.includes('situacao') ||
        h.includes('conciliacao')
      );
    });

    const parseNumber = (val: any): number => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      let str = String(val).trim();
      if (!str) return 0;

      const isNegative = str.includes('-') || str.includes('(');
      let cleaned = str.replace(/[^0-9.,]/g, '');
      if (!cleaned) return 0;

      if (cleaned.includes('.') && cleaned.includes(',')) {
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
          cleaned = cleaned.replace(/,/g, '');
        }
      } else if (cleaned.includes(',')) {
        cleaned = cleaned.replace(',', '.');
      }

      const num = parseFloat(cleaned);
      if (isNaN(num)) return 0;
      return isNegative ? -Math.abs(num) : num;
    };

    let totalEntrada = 0;
    let totalSaida = 0;
    let totalLiquidoExplicit = 0;
    let hasExplicitLiquido = false;

    let totalEstornados = 0;
    let countEstornados = 0;
    let totalPendentes = 0;
    let countPendentes = 0;

    spreadsheetState.processedData.forEach((row) => {
      const valEntrada = entradaCol ? parseNumber(row[entradaCol.id]) : 0;
      const valSaida = saidaCol ? parseNumber(row[saidaCol.id]) : 0;
      const valLiquido = liquidoCol ? parseNumber(row[liquidoCol.id]) : 0;

      totalEntrada += valEntrada;
      totalSaida += valSaida;
      if (liquidoCol) {
        totalLiquidoExplicit += valLiquido;
        hasExplicitLiquido = true;
      }

      // Determine status for estornado / pendente breakdown
      let statusStr = '';
      if (statusCol) {
        statusStr = String(row[statusCol.id] || '');
      } else {
        statusStr = Object.values(row).join(' ');
      }
      const normStatus = statusStr
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      const itemVal = valEntrada > 0 ? valEntrada : valLiquido;

      if (normStatus.includes('estornad') || normStatus.includes('estorno')) {
        totalEstornados += itemVal;
        countEstornados++;
      } else if (normStatus.includes('pendent')) {
        totalPendentes += itemVal;
        countPendentes++;
      }
    });

    const saldo = hasExplicitLiquido ? totalLiquidoExplicit : totalEntrada - totalSaida;

    return {
      totalEntrada,
      totalSaida,
      saldo,
      totalEstornados,
      countEstornados,
      totalPendentes,
      countPendentes,
      count: spreadsheetState.processedData.length,
      hasData: true,
      labelEntrada: activeTab === 'dealer' ? 'Soma Total de Entrada' : activeTab === 'pendente_cdc' ? 'Valor de Entrada Zerado' : 'Valor Bruto Total (Entrada)',
      labelSaida: activeTab === 'dealer' ? 'Soma Total de Saída' : activeTab === 'pendente_cdc' ? 'Saídas / Taxas' : 'Taxas TEF Total (Saída)',
      labelSaldo: activeTab === 'dealer' ? 'Saldo Líquido' : activeTab === 'pendente_cdc' ? 'Total Pendências CDC' : 'Valor Líquido Total',
    };
  }, [spreadsheetState.processedData, spreadsheetState.columns, activeTab]);

  const tabCounts = useMemo(
    () => ({
      dealer: dealerState.rawData.length,
      sitef: sitefState.rawData.length,
      pendente_cdc: pendenteCdcState.rawData.length,
      fechamento: allFechamentoItems.length,
    }),
    [
      dealerState.rawData.length,
      sitefState.rawData.length,
      pendenteCdcState.rawData.length,
      allFechamentoItems.length,
    ]
  );

  const handleAddFechamentoItem = useCallback((item: FechamentoItem) => {
    setManualFechamentoItems((prev) => [item, ...prev]);
  }, []);

  const handleDeleteFechamentoItems = useCallback((ids: string[]) => {
    setDeletedFechamentoIds((prev) => new Set([...Array.from(prev), ...ids]));
  }, []);

  const handleRecalculateFechamento = useCallback(() => {
    setDeletedFechamentoIds(new Set());
    setManualFechamentoItems([]);
  }, []);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased relative">
      {/* Background Treasury Image with dark executive tone overlay */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-25 filter contrast-125"
        style={{ backgroundImage: `url('/treasury_bg.jpg')` }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-slate-950/85 via-slate-950/90 to-slate-950 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Hidden Master File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleImportFile(e.target.files[0]);
            }
          }}
          accept=".xlsx, .xls, .csv"
          className="hidden"
        />

        {/* Excel Ribbon & Top System Navigation Header */}
        <ExcelHeader
          state={spreadsheetState}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          tabCounts={tabCounts}
          onImportFile={handleImportFile}
          onTriggerFileImport={triggerFileImport}
          onAutoOrganize={handleAutoOrganize}
          onOpenPresetsModal={() => setIsPresetsModalOpen(true)}
          onOpenAIDrawer={() => setIsAIDrawerOpen(true)}
          onExport={(format, includeHidden) =>
            exportProcessedData(spreadsheetState, format, includeHidden)
          }
          onReset={() =>
            setSpreadsheetState(
              buildEmptySpreadsheetState(
                activeTab === 'sitef'
                  ? 'SITEF.xlsx'
                  : activeTab === 'pendente_cdc'
                  ? 'PENDENTE_DE_CDC.xlsx'
                  : 'DEALER.xlsx'
              )
            )
          }
        />

        {/* Main Container Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 flex flex-col gap-3">
          {activeTab === 'fechamento' ? (
            <FechamentoView
              fechamentoItems={allFechamentoItems}
              onAddFechamentoItem={handleAddFechamentoItem}
              onDeleteFechamentoItems={handleDeleteFechamentoItems}
              onRecalculateAuto={handleRecalculateFechamento}
              onTriggerFileImport={triggerFileImport}
              activeTab={activeTab}
              tabCounts={tabCounts}
              onTabChange={(tab) => setActiveTab(tab)}
            />
          ) : (
            <>
          {/* Metric Summary Cards ("Quadrados com Soma do Valor de Entrada e Outros Totais") */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeTab === 'sitef' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
            {/* Card 1: Total de Entrada / Valor Bruto */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3.5 shadow-xl backdrop-blur-md hover:border-emerald-500/50 transition-all flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                  {summaryMetrics.labelEntrada}
                </span>
                <div className="text-xl font-black text-white tracking-tight">
                  {formatBRL(summaryMetrics.totalEntrada)}
                </div>
                <p className="text-[10px] text-emerald-300/80 font-semibold">
                  {summaryMetrics.hasData ? `${summaryMetrics.count} registros calculados` : 'Aguardando importação'}
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Total de Saída / Taxas */}
            <div className="bg-slate-900/90 border border-rose-500/30 rounded-xl p-3.5 shadow-xl backdrop-blur-md hover:border-rose-500/50 transition-all flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-400">
                  {summaryMetrics.labelSaida}
                </span>
                <div className="text-xl font-black text-white tracking-tight">
                  {formatBRL(summaryMetrics.totalSaida)}
                </div>
                <p className="text-[10px] text-rose-300/80 font-semibold">
                  {summaryMetrics.hasData ? 'Soma de taxas / saídas' : 'Aguardando importação'}
                </p>
              </div>
              <div className="w-10 h-10 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-rose-500/30">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3 (Sitef only): Estornados */}
            {activeTab === 'sitef' && (
              <div className="bg-slate-900/90 border border-purple-500/30 rounded-xl p-3.5 shadow-xl backdrop-blur-md hover:border-purple-500/50 transition-all flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-400">
                    Estornados
                  </span>
                  <div className="text-xl font-black text-white tracking-tight">
                    {formatBRL(summaryMetrics.totalEstornados)}
                  </div>
                  <p className="text-[10px] text-purple-300/80 font-semibold">
                    {summaryMetrics.countEstornados} transação(ões) estornada(s)
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-purple-500/30">
                  <RotateCcw className="w-5 h-5" />
                </div>
              </div>
            )}

            {/* Card 4 (Sitef only): Pendentes */}
            {activeTab === 'sitef' && (
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 shadow-xl backdrop-blur-md hover:border-amber-500/50 transition-all flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                    Pendentes
                  </span>
                  <div className="text-xl font-black text-white tracking-tight">
                    {formatBRL(summaryMetrics.totalPendentes)}
                  </div>
                  <p className="text-[10px] text-amber-300/80 font-semibold">
                    {summaryMetrics.countPendentes} transação(ões) pendente(s)
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            )}

            {/* Card: Saldo / Valor Líquido */}
            <div className="bg-slate-900/90 border border-blue-500/30 rounded-xl p-3.5 shadow-xl backdrop-blur-md hover:border-blue-500/50 transition-all flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-400">
                  {summaryMetrics.labelSaldo}
                </span>
                <div className={`text-xl font-black tracking-tight ${summaryMetrics.saldo >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {formatBRL(summaryMetrics.saldo)}
                </div>
                <p className="text-[10px] text-blue-300/80 font-semibold">
                  {activeTab === 'dealer' ? 'Resultado (Entradas − Saídas)' : 'Total líquido repassado'}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-500/30">
                <Wallet className="w-5 h-5" />
              </div>
            </div>

            {/* Card (Dealer only): Total de Registros */}
            {activeTab === 'dealer' && (
              <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3.5 shadow-xl backdrop-blur-md hover:border-slate-600 transition-all flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                    Total de Registros
                  </span>
                  <div className="text-xl font-black text-white tracking-tight">
                    {summaryMetrics.count} <span className="text-xs font-semibold text-slate-400">linhas</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    Aba DEALER
                  </p>
                </div>
                <div className="w-10 h-10 bg-slate-800 text-slate-300 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>
            )}

            {/* Card (Pendente CDC only): Status CDC */}
            {activeTab === 'pendente_cdc' && (
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-3.5 shadow-xl backdrop-blur-md hover:border-amber-500/50 transition-all flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                    Pendências CDC
                  </span>
                  <div className="text-xl font-black text-white tracking-tight">
                    {summaryMetrics.count} <span className="text-xs font-semibold text-amber-300">lançamento(s)</span>
                  </div>
                  <p className="text-[10px] text-amber-300/80 font-semibold">
                    Entrada zerada (R$ 0,00)
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            )}
          </div>

          {/* Excel Interactive Grid Table Component */}
          <div className="flex-1">
            <ExcelTable
              state={spreadsheetState}
              activeTab={activeTab}
              tabCounts={tabCounts}
              onTabChange={(tab) => setActiveTab(tab)}
              onUpdateColumn={handleUpdateColumn}
              onSetAllColumnsVisibility={handleSetAllColumnsVisibility}
              onUpdateCell={handleUpdateCell}
              onDeleteRow={handleDeleteRow}
              onDeleteRows={handleDeleteRows}
              onAddRow={handleAddRow}
              onOpenColumnModal={handleOpenColumnModal}
              onOpenAIDrawer={() => setIsAIDrawerOpen(true)}
              onTriggerFileImport={triggerFileImport}
            />
          </div>
            </>
          )}
        </main>
      </div>

      {/* Modals & Drawer Overlays */}
      <ColumnRuleModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columns={spreadsheetState.columns}
        selectedColumnId={selectedColumnId}
        onUpdateColumn={handleUpdateColumn}
      />

      <PresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        columns={spreadsheetState.columns}
        onApplyPreset={handleApplyPreset}
      />

      <AIAssistantDrawer
        isOpen={isAIDrawerOpen}
        onClose={() => setIsAIDrawerOpen(false)}
        columns={spreadsheetState.columns}
        rawData={spreadsheetState.rawData}
        onApplySingleSuggestion={handleApplySingleAISuggestion}
        onApplyAllSuggestions={handleApplyAllAISuggestions}
      />
    </div>
  );
}
