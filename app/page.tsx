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
import { FechamentoCaixaRecord } from '@/lib/fechamento-caixa-service';
import { logAuditAction } from '@/lib/audit-service';
import { getCurrentUser, isUserLoggedIn, logoutUser } from '@/lib/auth-service';
import { UserProfile } from '@/types/audit';
import { SAMPLE_DATASETS } from '@/lib/sample-data';
import { ExcelHeader } from '@/components/ExcelHeader';
import { ExcelTable } from '@/components/ExcelTable';
import { FechamentoView } from '@/components/FechamentoView';
import { AuditView, AuditViewFilters } from '@/components/AuditView';
import { UserSelectorModal } from '@/components/UserSelectorModal';
import { ColumnRuleModal } from '@/components/ColumnRuleModal';
import { PresetsModal } from '@/components/PresetsModal';
import { AIAssistantDrawer } from '@/components/AIAssistantDrawer';
import { ICloudLoginView } from '@/components/ICloudLoginView';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { SystemDiagnosticsModal } from '@/components/SystemDiagnosticsModal';
import {
  saveAppSession,
  loadAppSession,
  clearLocalSession,
  logDiagnostic,
  AutosaveSessionData,
} from '@/lib/autosave-service';
import { Sparkles, FileSpreadsheet, Zap, CheckCircle2, Bookmark, FolderOpen, X, TrendingUp, TrendingDown, Wallet, Clock, RotateCcw, CreditCard, ShieldCheck, HardDriveDownload } from 'lucide-react';

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
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => getCurrentUser());

  useEffect(() => {
    setMounted(true);
    setIsAuthenticated(isUserLoggedIn());
    setCurrentUser(getCurrentUser());
  }, []);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    logoutUser();
    setIsAuthenticated(false);
  };

  const [activeTab, setActiveTab] = useState<'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento' | 'auditoria'>('dealer');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  const [dealerState, setDealerState] = useState<SpreadsheetState>(() =>
    buildEmptySpreadsheetState('DEALER.xlsx')
  );

  const [sitefState, setSitefState] = useState<SpreadsheetState>(() =>
    buildEmptySpreadsheetState('SITEF.xlsx')
  );

  const [pendenteCdcState, setPendenteCdcState] = useState<SpreadsheetState>(() =>
    buildEmptySpreadsheetState('PENDENTE_DE_CDC.xlsx')
  );

  // Per-tab persistent search, filter and sort states
  const [tabFilters, setTabFilters] = useState<{
    dealer: { searchQuery: string; sortColId: string | null; sortDirection: 'asc' | 'desc' };
    sitef: { searchQuery: string; sortColId: string | null; sortDirection: 'asc' | 'desc' };
    pendente_cdc: { searchQuery: string; sortColId: string | null; sortDirection: 'asc' | 'desc' };
    fechamento: {
      searchQuery: string;
      selectedEmpresaFilter: string;
      empresaSortOrder: 'asc' | 'desc' | 'none';
      filterMode: 'all' | 'divergent' | 'concolidated' | 'pix_validation';
      viewMode: 'grouped' | 'flat';
    };
    auditoria: AuditViewFilters;
  }>({
    dealer: { searchQuery: '', sortColId: null, sortDirection: 'asc' },
    sitef: { searchQuery: '', sortColId: null, sortDirection: 'asc' },
    pendente_cdc: { searchQuery: '', sortColId: null, sortDirection: 'asc' },
    fechamento: {
      searchQuery: '',
      selectedEmpresaFilter: 'ALL',
      empresaSortOrder: 'asc',
      filterMode: 'all',
      viewMode: 'grouped',
    },
    auditoria: {
      activeSubTab: 'dashboard',
    },
  });

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
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

  // Autosave status state
  const [autosaveStatus, setAutosaveStatus] = useState<{
    lastSaved: Date | null;
    isSaving: boolean;
    cloudSaved: boolean;
  }>({
    lastSaved: null,
    isSaving: false,
    cloudSaved: false,
  });

  // Recovery banner indicator
  const [recoveredBanner, setRecoveredBanner] = useState<{
    show: boolean;
    source: 'local' | 'cloud';
    lastSavedAt: string;
  } | null>(null);

  // Autosave Trigger Function
  const triggerAutosave = useCallback(
    async (
      dState = dealerState,
      sState = sitefState,
      pState = pendenteCdcState,
      mItems = manualFechamentoItems,
      dIds = deletedFechamentoIds,
      tab = activeTab,
      filters = tabFilters
    ) => {
      setAutosaveStatus((prev) => ({ ...prev, isSaving: true }));
      const sessionData: AutosaveSessionData = {
        version: 2,
        lastSavedAt: new Date().toISOString(),
        userEmail: currentUser?.email || 'infroberto360@gmail.com',
        activeTab: tab,
        dealerState: dState,
        sitefState: sState,
        pendenteCdcState: pState,
        manualFechamentoItems: mItems,
        deletedFechamentoIds: Array.from(dIds),
        tabFilters: filters,
      };

      const result = await saveAppSession(sessionData);
      setAutosaveStatus({
        lastSaved: new Date(),
        isSaving: false,
        cloudSaved: result.cloudSaved,
      });
    },
    [
      dealerState,
      sitefState,
      pendenteCdcState,
      manualFechamentoItems,
      deletedFechamentoIds,
      activeTab,
      tabFilters,
      currentUser?.email,
    ]
  );

  // Restore Session Function
  const restoreSavedSession = useCallback(async () => {
    try {
      const res = await loadAppSession(currentUser?.email);
      if (res.data) {
        const { data, source } = res;
        if (data.dealerState) setDealerState(data.dealerState);
        if (data.sitefState) setSitefState(data.sitefState);
        if (data.pendenteCdcState) setPendenteCdcState(data.pendenteCdcState);
        if (data.manualFechamentoItems) setManualFechamentoItems(data.manualFechamentoItems);
        if (data.deletedFechamentoIds) setDeletedFechamentoIds(new Set(data.deletedFechamentoIds));
        if (data.activeTab) setActiveTab(data.activeTab as any);
        if (data.tabFilters) {
          setTabFilters((prev) => ({
            ...prev,
            ...data.tabFilters,
            dealer: { ...prev.dealer, ...(data.tabFilters?.dealer || {}) },
            sitef: { ...prev.sitef, ...(data.tabFilters?.sitef || {}) },
            pendente_cdc: { ...prev.pendente_cdc, ...(data.tabFilters?.pendente_cdc || {}) },
            fechamento: { ...prev.fechamento, ...(data.tabFilters?.fechamento || {}) },
            auditoria: { ...prev.auditoria, ...(data.tabFilters?.auditoria || {}) },
          }));
        }

        setRecoveredBanner({
          show: true,
          source,
          lastSavedAt: data.lastSavedAt,
        });

        logDiagnostic(
          'success',
          'Autosave',
          `Sessão anterior restaurada com sucesso a partir da fonte: ${source.toUpperCase()}`,
          { lastSavedAt: data.lastSavedAt }
        );
      }
    } catch (err: any) {
      logDiagnostic('warn', 'Autosave', 'Erro ao restaurar sessão anterior.', err?.message);
    }
  }, [currentUser?.email]);

  // Initial mount: attempt session recovery if local/cloud session exists
  useEffect(() => {
    restoreSavedSession();
  }, [restoreSavedSession]);

  // Debounced Autosave on data changes
  useEffect(() => {
    if (!mounted) return;
    const hasData =
      dealerState.rawData.length > 0 ||
      sitefState.rawData.length > 0 ||
      pendenteCdcState.rawData.length > 0 ||
      manualFechamentoItems.length > 0;

    if (hasData) {
      const timer = setTimeout(() => {
        triggerAutosave();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [
    dealerState,
    sitefState,
    pendenteCdcState,
    manualFechamentoItems,
    deletedFechamentoIds,
    activeTab,
    mounted,
    triggerAutosave,
  ]);

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

        logAuditAction({
          operacao: 'IMPORTACAO_ARQUIVO',
          descricao: `Importação da planilha SiTef "${fileName}" com ${normalizedRaw.length} lançamentos.`,
          documento_afetado: fileName,
          meta_data: { aba: 'sitef', qtd_registros: normalizedRaw.length },
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

        logAuditAction({
          operacao: 'IMPORTACAO_ARQUIVO',
          descricao: `Importação da planilha Dealer "${fileName}" com ${report.cleanedRawData.length} lançamentos válidos e ${countZero} lançamentos zerados.`,
          documento_afetado: fileName,
          meta_data: { aba: activeTab, qtd_validos: report.cleanedRawData.length, qtd_zerados: countZero },
        });

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
      const oldValue = updatedRaw[rowIndex][colId];
      const col = spreadsheetState.columns.find((c) => c.id === colId);
      const colName = col ? col.customHeader || col.originalHeader : colId;

      updatedRaw[rowIndex] = {
        ...updatedRaw[rowIndex],
        [colId]: newValue,
      };
      updateProcessedData(spreadsheetState.columns, updatedRaw);

      logAuditAction({
        operacao: 'ALTERACAO_LANCAMENTO',
        descricao: `Edição da coluna "${colName}" na linha #${rowIndex + 1} (Aba: ${activeTab.toUpperCase()})`,
        situacao_anterior: String(oldValue ?? ''),
        situacao_nova: String(newValue ?? ''),
        documento_afetado: `Linha #${rowIndex + 1}`,
      });
    }
  };

  // Handler: Delete Row
  const handleDeleteRow = (rowIndex: number) => {
    const rowToDelete = spreadsheetState.rawData[rowIndex];
    const updatedRaw = spreadsheetState.rawData.filter((_, idx) => idx !== rowIndex);
    updateProcessedData(spreadsheetState.columns, updatedRaw);

    logAuditAction({
      operacao: 'EXCLUSAO_LANCAMENTO',
      descricao: `Exclusão manual do lançamento na linha #${rowIndex + 1} (Aba: ${activeTab.toUpperCase()})`,
      documento_afetado: `Linha #${rowIndex + 1}`,
      meta_data: rowToDelete || {},
    });
  };

  // Handler: Delete Multiple Rows
  const handleDeleteRows = (rowIndexes: number[]) => {
    const indexSet = new Set(rowIndexes);
    const updatedRaw = spreadsheetState.rawData.filter((_, idx) => !indexSet.has(idx));
    updateProcessedData(spreadsheetState.columns, updatedRaw);

    logAuditAction({
      operacao: 'EXCLUSAO_LANCAMENTO',
      descricao: `Exclusão em lote de ${rowIndexes.length} lançamentos (Aba: ${activeTab.toUpperCase()})`,
      documento_afetado: `${rowIndexes.length} registros`,
    });
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

    logAuditAction({
      operacao: 'CRIACAO_LANCAMENTO',
      descricao: `Inclusão manual de novo lançamento (Aba: ${activeTab.toUpperCase()})`,
      meta_data: rowToAdd || {},
    });
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

  const handleFechamentoConcluido = useCallback((record?: FechamentoCaixaRecord) => {
    // Clear all imported spreadsheets and manual items to leave screen clean for next cash closure
    setDealerState(buildEmptySpreadsheetState('DEALER.xlsx'));
    setSitefState(buildEmptySpreadsheetState('SITEF.xlsx'));
    setPendenteCdcState(buildEmptySpreadsheetState('PENDENTE_DE_CDC.xlsx'));
    setManualFechamentoItems([]);
    setDeletedFechamentoIds(new Set());
  }, []);

  const handleRestoreFechamentoRecord = useCallback((record: FechamentoCaixaRecord) => {
    // Clear current raw spreadsheet state so restored items display cleanly
    setDealerState(buildEmptySpreadsheetState('DEALER.xlsx'));
    setSitefState(buildEmptySpreadsheetState('SITEF.xlsx'));
    setPendenteCdcState(buildEmptySpreadsheetState('PENDENTE_DE_CDC.xlsx'));
    setDeletedFechamentoIds(new Set());
    setManualFechamentoItems(record.items || []);
    setActiveTab('fechamento');
  }, []);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 bg-white/90 border border-black/[0.08] px-6 py-4 rounded-2xl shadow-xl backdrop-blur-xl">
          <div className="w-5 h-5 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-700">Carregando Wanfinance Pro...</span>
        </div>
      </div>
    );
  }

  // Require Gmail Login if not authenticated (iCloud styled login page)
  if (!isAuthenticated) {
    return (
      <ICloudLoginView
        onLoginSuccess={handleLoginSuccess}
        defaultEmail="infroberto360@gmail.com"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans antialiased relative selection:bg-[#007AFF]/20 selection:text-[#0071E3]">
      {/* Apple Dynamic Light Ambient Shimmers */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[300px] bg-blue-400/[0.05] rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-1/3 right-1/4 w-[500px] h-[300px] bg-indigo-400/[0.04] rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/3 w-[600px] h-[300px] bg-purple-400/[0.04] rounded-full blur-[160px] pointer-events-none" />

      {/* Subtle Ceramic Grid Background Texture */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(#00000008_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

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

        {/* Apple macOS / iPadOS Pro System Header */}
        <ExcelHeader
          state={spreadsheetState}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          tabCounts={tabCounts}
          currentUser={currentUser}
          onOpenUserModal={() => setIsUserModalOpen(true)}
          onImportFile={handleImportFile}
          onTriggerFileImport={triggerFileImport}
          onAutoOrganize={handleAutoOrganize}
          onOpenPresetsModal={() => setIsPresetsModalOpen(true)}
          onOpenAIDrawer={() => setIsAIDrawerOpen(true)}
          onLogout={handleLogout}
          onOpenDiagnostics={() => setIsDiagnosticsModalOpen(true)}
          autosaveStatus={autosaveStatus}
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

        {/* Autosave Recovery Notification Banner */}
        {recoveredBanner && recoveredBanner.show && (
          <div className="max-w-7xl mx-auto px-4 w-full pt-3">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center justify-between shadow-xs animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <span>Sessão anterior restaurada com segurança</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-200/60 text-emerald-800 text-[10px] uppercase font-mono">
                      {recoveredBanner.source === 'cloud' ? 'Supabase Cloud' : 'Cache Local'}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Seus dados, colunas tratadas e conciliações foram recuperados (salvo em{' '}
                    {new Date(recoveredBanner.lastSavedAt).toLocaleTimeString('pt-BR')}).
                  </div>
                </div>
              </div>
              <button
                onClick={() => setRecoveredBanner(null)}
                className="w-7 h-7 rounded-lg hover:bg-emerald-200/50 flex items-center justify-center text-emerald-800 text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Main Container Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col gap-4">
          <AppErrorBoundary fallbackTitle="Instabilidade no Módulo Financeiro">
            {activeTab === 'auditoria' ? (
              <AuditView
                filters={tabFilters.auditoria}
                onFiltersChange={(newFilters) => {
                  setTabFilters((prev) => ({
                    ...prev,
                    auditoria: newFilters,
                  }));
                }}
              />
            ) : activeTab === 'fechamento' ? (
              <FechamentoView
                fechamentoItems={allFechamentoItems}
                searchQuery={tabFilters.fechamento.searchQuery}
                onSearchQueryChange={(q) => {
                  setTabFilters((prev) => ({
                    ...prev,
                    fechamento: { ...prev.fechamento, searchQuery: q },
                  }));
                }}
                selectedEmpresaFilter={tabFilters.fechamento.selectedEmpresaFilter}
                onSelectedEmpresaFilterChange={(emp) => {
                  setTabFilters((prev) => ({
                    ...prev,
                    fechamento: { ...prev.fechamento, selectedEmpresaFilter: emp },
                  }));
                }}
                empresaSortOrder={tabFilters.fechamento.empresaSortOrder}
                onEmpresaSortOrderChange={(order) => {
                  setTabFilters((prev) => ({
                    ...prev,
                    fechamento: { ...prev.fechamento, empresaSortOrder: order },
                  }));
                }}
                filterMode={tabFilters.fechamento.filterMode}
                onFilterModeChange={(mode) => {
                  setTabFilters((prev) => ({
                    ...prev,
                    fechamento: { ...prev.fechamento, filterMode: mode },
                  }));
                }}
                viewMode={tabFilters.fechamento.viewMode}
                onViewModeChange={(vMode) => {
                  setTabFilters((prev) => ({
                    ...prev,
                    fechamento: { ...prev.fechamento, viewMode: vMode },
                  }));
                }}
                onAddFechamentoItem={handleAddFechamentoItem}
                onDeleteFechamentoItems={handleDeleteFechamentoItems}
                onRecalculateFechamento={handleRecalculateFechamento}
                onFechamentoConcluido={handleFechamentoConcluido}
                onRestoreFechamentoRecord={handleRestoreFechamentoRecord}
              />
            ) : (
              <>
                {/* Apple iPhone Pro Metric Summary Cards */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeTab === 'sitef' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3.5`}>
            {/* Card 1: Total de Entrada / Valor Bruto */}
            <div className="bg-white/90 border border-black/[0.06] hover:border-emerald-500/40 rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md backdrop-blur-xl transition-all duration-200 group flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                  {summaryMetrics.labelEntrada}
                </span>
                <div className="text-2xl font-black text-[#1D1D1F] tracking-tight font-mono">
                  {formatBRL(summaryMetrics.totalEntrada)}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {summaryMetrics.hasData ? `${summaryMetrics.count} registros calculados` : 'Aguardando importação'}
                </p>
              </div>
              <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0 border border-emerald-100 shadow-2xs">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Total de Saída / Taxas */}
            <div className="bg-white/90 border border-black/[0.06] hover:border-rose-500/40 rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md backdrop-blur-xl transition-all duration-200 group flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                  {summaryMetrics.labelSaida}
                </span>
                <div className="text-2xl font-black text-[#1D1D1F] tracking-tight font-mono">
                  {formatBRL(summaryMetrics.totalSaida)}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {summaryMetrics.hasData ? 'Soma de taxas / saídas' : 'Aguardando importação'}
                </p>
              </div>
              <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center flex-shrink-0 border border-rose-100 shadow-2xs">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3 (Sitef only): Estornados */}
            {activeTab === 'sitef' && (
              <div className="bg-white/90 border border-black/[0.06] hover:border-purple-500/40 rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md backdrop-blur-xl transition-all duration-200 group flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">
                    Estornados
                  </span>
                  <div className="text-2xl font-black text-[#1D1D1F] tracking-tight font-mono">
                    {formatBRL(summaryMetrics.totalEstornados)}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {summaryMetrics.countEstornados} transação(ões) estornada(s)
                  </p>
                </div>
                <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0 border border-purple-100 shadow-2xs">
                  <RotateCcw className="w-5 h-5" />
                </div>
              </div>
            )}

            {/* Card 4 (Sitef only): Pendentes */}
            {activeTab === 'sitef' && (
              <div className="bg-white/90 border border-black/[0.06] hover:border-amber-500/40 rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md backdrop-blur-xl transition-all duration-200 group flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                    Pendentes
                  </span>
                  <div className="text-2xl font-black text-[#1D1D1F] tracking-tight font-mono">
                    {formatBRL(summaryMetrics.totalPendentes)}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {summaryMetrics.countPendentes} transação(ões) pendente(s)
                  </p>
                </div>
                <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0 border border-amber-100 shadow-2xs">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            )}

            {/* Card: Saldo / Valor Líquido */}
            <div className="bg-white/90 border border-black/[0.06] hover:border-blue-500/40 rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md backdrop-blur-xl transition-all duration-200 group flex items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#007AFF]">
                  {summaryMetrics.labelSaldo}
                </span>
                <div className={`text-2xl font-black tracking-tight font-mono ${summaryMetrics.saldo >= 0 ? 'text-[#1D1D1F]' : 'text-rose-600'}`}>
                  {formatBRL(summaryMetrics.saldo)}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {activeTab === 'dealer' ? 'Resultado (Entradas − Saídas)' : 'Total líquido repassado'}
                </p>
              </div>
              <div className="w-11 h-11 bg-blue-50 text-[#007AFF] rounded-2xl flex items-center justify-center flex-shrink-0 border border-blue-100 shadow-2xs">
                <Wallet className="w-5 h-5" />
              </div>
            </div>

            {/* Card (Dealer only): Total de Registros */}
            {activeTab === 'dealer' && (
              <div className="bg-white/90 border border-black/[0.06] hover:border-slate-300 rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md backdrop-blur-xl transition-all duration-200 group flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Total de Registros
                  </span>
                  <div className="text-2xl font-black text-[#1D1D1F] tracking-tight font-mono">
                    {summaryMetrics.count} <span className="text-xs font-semibold text-slate-400">linhas</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Aba DEALER
                  </p>
                </div>
                <div className="w-11 h-11 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center flex-shrink-0 border border-slate-200 shadow-2xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>
            )}

            {/* Card (Pendente CDC only): Status CDC */}
            {activeTab === 'pendente_cdc' && (
              <div className="bg-white/90 border border-black/[0.06] hover:border-amber-500/40 rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-md backdrop-blur-xl transition-all duration-200 group flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                    Pendências CDC
                  </span>
                  <div className="text-2xl font-black text-[#1D1D1F] tracking-tight font-mono">
                    {summaryMetrics.count} <span className="text-xs font-semibold text-amber-600">lançamento(s)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Entrada zerada (R$ 0,00)
                  </p>
                </div>
                <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0 border border-amber-100 shadow-2xs">
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
              searchQuery={
                activeTab === 'dealer'
                  ? tabFilters.dealer.searchQuery
                  : activeTab === 'sitef'
                  ? tabFilters.sitef.searchQuery
                  : activeTab === 'pendente_cdc'
                  ? tabFilters.pendente_cdc.searchQuery
                  : ''
              }
              onSearchQueryChange={(q) => {
                if (activeTab === 'dealer' || activeTab === 'sitef' || activeTab === 'pendente_cdc') {
                  setTabFilters((prev) => ({
                    ...prev,
                    [activeTab]: { ...prev[activeTab], searchQuery: q },
                  }));
                }
              }}
              sortColId={
                activeTab === 'dealer'
                  ? tabFilters.dealer.sortColId
                  : activeTab === 'sitef'
                  ? tabFilters.sitef.sortColId
                  : activeTab === 'pendente_cdc'
                  ? tabFilters.pendente_cdc.sortColId
                  : null
              }
              sortDirection={
                activeTab === 'dealer'
                  ? tabFilters.dealer.sortDirection
                  : activeTab === 'sitef'
                  ? tabFilters.sitef.sortDirection
                  : activeTab === 'pendente_cdc'
                  ? tabFilters.pendente_cdc.sortDirection
                  : 'asc'
              }
              onSortChange={(colId, dir) => {
                if (activeTab === 'dealer' || activeTab === 'sitef' || activeTab === 'pendente_cdc') {
                  setTabFilters((prev) => ({
                    ...prev,
                    [activeTab]: { ...prev[activeTab], sortColId: colId, sortDirection: dir },
                  }));
                }
              }}
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
          </AppErrorBoundary>
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

      {/* Operator Switcher / User Management Modal */}
      <UserSelectorModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onUserChanged={(newUser) => {
          setCurrentUser(newUser);
        }}
      />

      {/* System Diagnostics, Resilience & Autosave Telemetry Modal */}
      <SystemDiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
        autosaveStatus={autosaveStatus}
        onForceSave={() => triggerAutosave()}
        onRestoreSession={() => restoreSavedSession()}
      />
    </div>
  );
}
