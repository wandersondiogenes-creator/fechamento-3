'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { FechamentoItem } from '@/lib/fechamento-utils';
import { FechamentoCaixaModal } from './FechamentoCaixaModal';
import { HistoricoFechamentoModal } from './HistoricoFechamentoModal';
import { SharedFechamentoModal } from './SharedFechamentoModal';
import { FechamentoCaixaRecord } from '@/lib/fechamento-caixa-service';
import {
  SharedFechamentoSession,
  fetchSharedSession,
  createOrUpdateSharedSession,
  getActiveRoomIdLocally,
  saveActiveRoomIdLocally,
} from '@/lib/shared-fechamento-service';
import { getCurrentUser } from '@/lib/auth-service';
import {
  CADASTRO_EMPRESAS,
  CADASTRO_DEPARTAMENTOS,
  CADASTRO_CONTAS_GERENCIAIS,
  toInputDateFormat,
  toDisplayDateFormat,
} from '@/lib/cadastros';
import {
  TrendingUp,
  Scale,
  AlertTriangle,
  Plus,
  PlusCircle,
  Trash2,
  X,
  Search,
  RefreshCw,
  Building2,
  FolderTree,
  CheckCircle2,
  CreditCard,
  Download,
  Layers,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Check,
  Lock,
  History,
  FileCheck,
  RotateCcw,
  Calendar,
  ArrowDownAZ,
  ArrowUpZA,
  SortAsc,
  Filter,
  Share2,
  Users,
  Radio,
  Globe,
  Copy,
  Wifi,
  LogOut,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface FechamentoViewProps {
  fechamentoItems?: FechamentoItem[];
  items?: FechamentoItem[];
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  selectedEmpresaFilter?: string;
  onSelectedEmpresaFilterChange?: (emp: string) => void;
  empresaSortOrder?: 'asc' | 'desc' | 'none';
  onEmpresaSortOrderChange?: (order: 'asc' | 'desc' | 'none') => void;
  filterMode?: 'all' | 'divergent' | 'concolidated' | 'pix_validation';
  onFilterModeChange?: (mode: 'all' | 'divergent' | 'concolidated' | 'pix_validation') => void;
  viewMode?: 'grouped' | 'flat';
  onViewModeChange?: (view: 'grouped' | 'flat') => void;
  onAddFechamentoItem: (newItem: FechamentoItem) => void;
  onDeleteFechamentoItems: (idsToDelete: string[]) => void;
  onUpdateFechamentoItem?: (updatedItem: FechamentoItem) => void;
  onRecalculateAuto?: () => void;
  onTriggerFileImport?: () => void;
  activeTab?: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento';
  tabCounts?: { dealer: number; sitef: number; pendente_cdc: number; fechamento?: number };
  onTabChange?: (tab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento') => void;
  onFechamentoConcluido?: (record: FechamentoCaixaRecord) => void;
  onRestoreFechamentoRecord?: (record: FechamentoCaixaRecord) => void;
  activeSharedSession?: SharedFechamentoSession | null;
  onSharedSessionChange?: (session: SharedFechamentoSession | null) => void;
  onApplySharedItems?: (items: FechamentoItem[], conciliated: Record<string, boolean>) => void;
}

export function FechamentoView({
  fechamentoItems: fechamentoItemsProp,
  items: itemsProp,
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  selectedEmpresaFilter: externalSelectedEmpresaFilter,
  onSelectedEmpresaFilterChange,
  empresaSortOrder: externalEmpresaSortOrder,
  onEmpresaSortOrderChange,
  filterMode: externalFilterMode,
  onFilterModeChange,
  viewMode: externalViewMode,
  onViewModeChange,
  onAddFechamentoItem,
  onDeleteFechamentoItems,
  onRecalculateAuto,
  onTriggerFileImport,
  onFechamentoConcluido,
  onRestoreFechamentoRecord,
  activeSharedSession: externalActiveSharedSession,
  onSharedSessionChange,
  onApplySharedItems,
}: FechamentoViewProps) {
  const fechamentoItems = useMemo(
    () => fechamentoItemsProp || itemsProp || [],
    [fechamentoItemsProp, itemsProp]
  );

  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalSelectedEmpresaFilter, setInternalSelectedEmpresaFilter] = useState<string>('ALL');
  const [internalEmpresaSortOrder, setInternalEmpresaSortOrder] = useState<'asc' | 'desc' | 'none'>('asc');
  const [internalFilterMode, setInternalFilterMode] = useState<'all' | 'divergent' | 'concolidated' | 'pix_validation'>('all');
  const [internalViewMode, setInternalViewMode] = useState<'grouped' | 'flat'>('grouped');

  const [internalSharedSession, setInternalSharedSession] = useState<SharedFechamentoSession | null>(null);
  const activeSharedSession = externalActiveSharedSession !== undefined ? externalActiveSharedSession : internalSharedSession;

  const setSharedSession = useCallback((s: SharedFechamentoSession | null) => {
    if (onSharedSessionChange) onSharedSessionChange(s);
    else setInternalSharedSession(s);
  }, [onSharedSessionChange]);

  const [isSharedModalOpen, setIsSharedModalOpen] = useState(false);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [lastSyncText, setLastSyncText] = useState<string>('');
  const [copiedSessionLink, setCopiedSessionLink] = useState(false);
  const currentUser = getCurrentUser();

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = (val: string) => {
    if (onSearchQueryChange) onSearchQueryChange(val);
    else setInternalSearchQuery(val);
  };

  const selectedEmpresaFilter = externalSelectedEmpresaFilter !== undefined ? externalSelectedEmpresaFilter : internalSelectedEmpresaFilter;
  const setSelectedEmpresaFilter = (val: string) => {
    if (onSelectedEmpresaFilterChange) onSelectedEmpresaFilterChange(val);
    else setInternalSelectedEmpresaFilter(val);
  };

  const empresaSortOrder = externalEmpresaSortOrder !== undefined ? externalEmpresaSortOrder : internalEmpresaSortOrder;
  const setEmpresaSortOrder = (val: 'asc' | 'desc' | 'none') => {
    if (onEmpresaSortOrderChange) onEmpresaSortOrderChange(val);
    else setInternalEmpresaSortOrder(val);
  };

  const filterMode = externalFilterMode !== undefined ? externalFilterMode : internalFilterMode;
  const setFilterMode = (val: 'all' | 'divergent' | 'concolidated' | 'pix_validation') => {
    if (onFilterModeChange) onFilterModeChange(val);
    else setInternalFilterMode(val);
  };

  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode;
  const setViewMode = (val: 'grouped' | 'flat') => {
    if (onViewModeChange) onViewModeChange(val);
    else setInternalViewMode(val);
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // State to track empresas marked as reconciled in the system by the user
  const [conciliatedEmpresas, setConciliatedEmpresas] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wanfinance_conciliated_empresas_v1');
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  // Real-time collaborative polling sync
  const lastKnownVersionRef = useRef<number>(activeSharedSession?.version || 0);

  const performLiveSync = useCallback(async (showIndicator = false) => {
    if (!activeSharedSession?.id) return;
    if (showIndicator) setIsSyncingLive(true);
    try {
      const res = await fetchSharedSession(activeSharedSession.id, currentUser);
      if (res.success && res.session) {
        const serverSession = res.session;
        setSharedSession(serverSession);
        setLastSyncText(new Date().toLocaleTimeString('pt-BR'));

        if (serverSession.version > lastKnownVersionRef.current) {
          lastKnownVersionRef.current = serverSession.version;
          if (serverSession.conciliatedEmpresas) {
            setConciliatedEmpresas(serverSession.conciliatedEmpresas);
          }
          if (onApplySharedItems && serverSession.items) {
            onApplySharedItems(serverSession.items, serverSession.conciliatedEmpresas || {});
          }
        }
      }
    } catch {
      // ignore
    } finally {
      if (showIndicator) {
        setTimeout(() => setIsSyncingLive(false), 500);
      }
    }
  }, [activeSharedSession?.id, currentUser, onApplySharedItems, setSharedSession]);

  useEffect(() => {
    if (!activeSharedSession?.id) return;
    performLiveSync(false);
    const interval = setInterval(() => {
      performLiveSync(false);
    }, 3500);
    return () => clearInterval(interval);
  }, [activeSharedSession?.id, performLiveSync]);

  // Push local updates to shared session
  const pushUpdateToSharedRoom = useCallback(
    async (
      updatedItems: FechamentoItem[],
      updatedConciliated: Record<string, boolean>
    ) => {
      if (!activeSharedSession?.id) return;
      try {
        const payload: Partial<SharedFechamentoSession> & { id: string; items: FechamentoItem[] } = {
          id: activeSharedSession.id,
          title: activeSharedSession.title,
          dataMovimento: activeSharedSession.dataMovimento,
          status: 'active',
          items: updatedItems,
          conciliatedEmpresas: updatedConciliated,
          summary,
        };
        const res = await createOrUpdateSharedSession(payload, currentUser);
        if (res.success && res.session) {
          lastKnownVersionRef.current = res.session.version;
          setSharedSession(res.session);
        }
      } catch (err) {
        console.warn('Erro ao propagar alterações na sala compartilhada:', err);
      }
    },
    [activeSharedSession, currentUser, summary, setSharedSession]
  );

  const toggleEmpresaConciliada = (empName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setConciliatedEmpresas((prev) => {
      const next = {
        ...prev,
        [empName]: !prev[empName],
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('wanfinance_conciliated_empresas_v1', JSON.stringify(next));
        } catch {
          // Ignore storage quota error
        }
      }
      if (activeSharedSession?.id) {
        pushUpdateToSharedRoom(fechamentoItems, next);
      }
      return next;
    });
  };

  // Collapse / Expand states
  const [collapsedEmpresas, setCollapsedEmpresas] = useState<Record<string, boolean>>({});
  const [collapsedDepartamentos, setCollapsedDepartamentos] = useState<Record<string, boolean>>({});

  // Modal: Add New Fechamento Launch
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    empresa: CADASTRO_EMPRESAS[0], // "BYD - ARRUDA"
    departamento: CADASTRO_DEPARTAMENTOS[0], // "30129-CAIXA LOJA - DEPTO.OFICINA"
    contaGerencial: CADASTRO_CONTAS_GERENCIAIS[0], // "30129-CAIXA LOJA - DEPTO.OFICINA"
    caixaLoja: 'Loja 01 - Caixa Central',
    data: new Date().toLocaleDateString('pt-BR'),
    nsu: '',
    tipoPagamento: 'Cartão de Crédito',
    bandeiraDealer: 'VISA',
    bandeiraSitef: 'VISA',
    valorDealer: '',
    valorSitef: '',
    status: 'CONCILIADO',
  });

  // Modal: Confirm Delete
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    ids: string[];
  }>({ isOpen: false, ids: [] });

  // Modal: Fechamento de Caixa do Dia & Histórico
  const [isFechamentoCaixaModalOpen, setIsFechamentoCaixaModalOpen] = useState(false);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [restoredRecordInfo, setRestoredRecordInfo] = useState<{
    dataMovimento: string;
    operador: string;
    count: number;
  } | null>(null);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  // List of unique empresas for dropdown
  const empresaList = useMemo(() => {
    const setEmp = new Set<string>();
    fechamentoItems.forEach((i) => {
      if (i.empresa) setEmp.add(i.empresa);
    });
    return Array.from(setEmp).sort();
  }, [fechamentoItems]);

  // KPI Metrics calculation
  const summary = useMemo(() => {
    let totalDealer = 0;
    let totalSitef = 0;
    let countDivergencias = 0;
    let countConciliados = 0;
    let countPixValidacao = 0;

    fechamentoItems.forEach((item) => {
      totalDealer += item.valorDealer || 0;
      totalSitef += item.valorSitef || 0;
      if (item.isPixValidationNeeded || item.status.includes('VALIDAÇÃO NECESSÁRIA')) {
        countPixValidacao++;
      }
      if (item.temDivergencia) {
        countDivergencias++;
      } else {
        countConciliados++;
      }
    });

    const diferencaTotal = Math.round((totalDealer - totalSitef) * 100) / 100;

    return {
      totalDealer,
      totalSitef,
      diferencaTotal,
      countTotal: fechamentoItems.length,
      countDivergencias,
      countConciliados,
      countPixValidacao,
    };
  }, [fechamentoItems]);

  // Filter items based on searchQuery, selectedEmpresaFilter, and filterMode
  const filteredItems = useMemo(() => {
    return fechamentoItems.filter((item) => {
      if (selectedEmpresaFilter !== 'ALL' && item.empresa !== selectedEmpresaFilter) {
        return false;
      }
      if (filterMode === 'divergent' && !item.temDivergencia) return false;
      if (filterMode === 'concolidated' && item.temDivergencia) return false;
      if (
        filterMode === 'pix_validation' &&
        !(item.isPixValidationNeeded || item.status.includes('VALIDAÇÃO NECESSÁRIA'))
      ) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.empresa.toLowerCase().includes(q) ||
        (item.departamento && item.departamento.toLowerCase().includes(q)) ||
        item.contaGerencial.toLowerCase().includes(q) ||
        item.caixaLoja.toLowerCase().includes(q) ||
        item.nsu.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.data.toLowerCase().includes(q) ||
        item.tipoPagamento.toLowerCase().includes(q) ||
        (item.bandeiraDealer && item.bandeiraDealer.toLowerCase().includes(q)) ||
        (item.bandeiraSitef && item.bandeiraSitef.toLowerCase().includes(q)) ||
        (item.criterioConciliacao && item.criterioConciliacao.toLowerCase().includes(q))
      );
    }).sort((a, b) => {
      if (empresaSortOrder === 'asc') {
        const empDiff = a.empresa.localeCompare(b.empresa, 'pt-BR');
        if (empDiff !== 0) return empDiff;
      } else if (empresaSortOrder === 'desc') {
        const empDiff = b.empresa.localeCompare(a.empresa, 'pt-BR');
        if (empDiff !== 0) return empDiff;
      }
      return 0;
    });
  }, [fechamentoItems, selectedEmpresaFilter, filterMode, searchQuery, empresaSortOrder]);

  // Grouped structure: Empresa -> Departamento -> Items
  const groupedByEmpresa = useMemo(() => {
    const map: Record<
      string,
      {
        empresaName: string;
        totalDealer: number;
        totalSitef: number;
        diferencaTotal: number;
        countDivergencias: number;
        countTotal: number;
        departamentos: Record<
          string,
          {
            departamentoName: string;
            totalDealer: number;
            totalSitef: number;
            diferencaTotal: number;
            countDivergencias: number;
            items: FechamentoItem[];
          }
        >;
      }
    > = {};

    filteredItems.forEach((item) => {
      const emp = item.empresa || 'Empresa 01';
      const dep = item.departamento || item.contaGerencial || 'Geral';

      if (!map[emp]) {
        map[emp] = {
          empresaName: emp,
          totalDealer: 0,
          totalSitef: 0,
          diferencaTotal: 0,
          countDivergencias: 0,
          countTotal: 0,
          departamentos: {},
        };
      }

      const empObj = map[emp];
      empObj.totalDealer += item.valorDealer || 0;
      empObj.totalSitef += item.valorSitef || 0;
      if (item.temDivergencia) empObj.countDivergencias++;
      empObj.countTotal++;

      if (!empObj.departamentos[dep]) {
        empObj.departamentos[dep] = {
          departamentoName: dep,
          totalDealer: 0,
          totalSitef: 0,
          diferencaTotal: 0,
          countDivergencias: 0,
          items: [],
        };
      }

      const depObj = empObj.departamentos[dep];
      depObj.items.push(item);
      depObj.totalDealer += item.valorDealer || 0;
      depObj.totalSitef += item.valorSitef || 0;
      if (item.temDivergencia) depObj.countDivergencias++;
    });

    Object.values(map).forEach((emp) => {
      emp.totalDealer = Math.round(emp.totalDealer * 100) / 100;
      emp.totalSitef = Math.round(emp.totalSitef * 100) / 100;
      emp.diferencaTotal = Math.round((emp.totalDealer - emp.totalSitef) * 100) / 100;

      Object.values(emp.departamentos).forEach((dep) => {
        dep.totalDealer = Math.round(dep.totalDealer * 100) / 100;
        dep.totalSitef = Math.round(dep.totalSitef * 100) / 100;
        dep.diferencaTotal = Math.round((dep.totalDealer - dep.totalSitef) * 100) / 100;
      });
    });

    // Sort keys based on empresaSortOrder
    const sortedEntries = Object.entries(map).sort(([empA], [empB]) => {
      if (empresaSortOrder === 'asc') return empA.localeCompare(empB, 'pt-BR');
      if (empresaSortOrder === 'desc') return empB.localeCompare(empA, 'pt-BR');
      return 0;
    });

    const sortedMap: typeof map = {};
    sortedEntries.forEach(([key, val]) => {
      sortedMap[key] = val;
    });

    return sortedMap;
  }, [filteredItems, empresaSortOrder]);

  // Collapse / Expand handlers
  const toggleEmpresaCollapse = (empName: string) => {
    setCollapsedEmpresas((prev) => {
      const isCurrentlyCollapsed = prev[empName] ?? true;
      return {
        ...prev,
        [empName]: !isCurrentlyCollapsed,
      };
    });
  };

  const toggleDepartamentoCollapse = (key: string) => {
    setCollapsedDepartamentos((prev) => {
      const isCurrentlyCollapsed = prev[key] ?? true;
      return {
        ...prev,
        [key]: !isCurrentlyCollapsed,
      };
    });
  };

  const handleExpandAll = () => {
    const newEmpState: Record<string, boolean> = {};
    Object.keys(groupedByEmpresa).forEach((emp) => {
      newEmpState[emp] = false;
    });
    setCollapsedEmpresas(newEmpState);
    setCollapsedDepartamentos({});
  };

  const handleCollapseAll = () => {
    const newEmpState: Record<string, boolean> = {};
    Object.keys(groupedByEmpresa).forEach((emp) => {
      newEmpState[emp] = true;
    });
    setCollapsedEmpresas(newEmpState);
  };

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i) => i.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Add Item Submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const valD = parseFloat(addForm.valorDealer.replace(',', '.')) || 0;
    const valS = parseFloat(addForm.valorSitef.replace(',', '.')) || 0;
    const dif = Math.round((valD - valS) * 100) / 100;
    const isPix =
      addForm.tipoPagamento.toLowerCase().includes('pix') ||
      addForm.bandeiraDealer.toLowerCase().includes('pix') ||
      addForm.bandeiraSitef.toLowerCase().includes('pix');
    const hasBandDiv =
      !isPix && addForm.bandeiraDealer.toUpperCase() !== addForm.bandeiraSitef.toUpperCase();
    const temDivergencia = isPix ? false : (Math.abs(dif) > 0.01 || hasBandDiv || addForm.status !== 'CONCILIADO');

    const newItem: FechamentoItem = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      empresa: addForm.empresa.trim() || 'Empresa 01 - Matriz',
      departamento: addForm.departamento.trim() || 'Financeiro / Cartões',
      contaGerencial: addForm.contaGerencial.trim() || '1.01.02 - Cartões de Crédito',
      caixaLoja: addForm.caixaLoja.trim() || 'Loja 01 - Caixa Central',
      data: addForm.data.trim() || new Date().toLocaleDateString('pt-BR'),
      nsu: addForm.nsu.trim() || (isPix ? 'PIX' : 'S/N'),
      tipoPagamento: isPix ? 'PIX' : (addForm.tipoPagamento.trim() || 'Cartão de Crédito'),
      bandeiraDealer: isPix ? 'PIX' : addForm.bandeiraDealer.toUpperCase(),
      bandeiraSitef: isPix ? 'PIX' : addForm.bandeiraSitef.toUpperCase(),
      divergenciaBandeira: hasBandDiv,
      isPix,
      valorDealer: valD,
      valorSitef: isPix ? valD : valS,
      diferenca: isPix ? 0 : dif,
      status: isPix
        ? 'PIX – ASSOCIADO À EMPRESA'
        : temDivergencia
        ? hasBandDiv
          ? 'DIVERGÊNCIA DE BANDEIRA'
          : 'DIVERGÊNCIA DE VALOR'
        : 'CONCILIADO',
      temDivergencia,
      detalhes: isPix
        ? 'Lançamento Pix associado à empresa sem divergência'
        : 'Lançamento manual adicionado no fechamento',
      origem: 'manual',
    };

    onAddFechamentoItem(newItem);
    setIsAddModalOpen(false);
  };

  // Confirm Delete Handler
  const handleConfirmDelete = () => {
    onDeleteFechamentoItems(deleteConfirm.ids);
    setSelectedIds((prev) => prev.filter((id) => !deleteConfirm.ids.includes(id)));
    setDeleteConfirm({ isOpen: false, ids: [] });
  };

  // Export Fechamento to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Itemized List
    const dataToExport = filteredItems.map((item) => ({
      'Empresa (Dealer)': item.empresa,
      'Departamento': item.departamento,
      'Conta Gerencial': item.contaGerencial,
      'Caixa / Loja': item.caixaLoja,
      'Data': item.data,
      'NSU Dealer / NSU Host SiTef': item.nsu,
      'Tipo / Forma': item.tipoPagamento,
      'Bandeira Dealer': item.bandeiraDealer || '—',
      'Bandeira SiTef': item.bandeiraSitef || '—',
      'Divergência Bandeira?': item.divergenciaBandeira ? 'SIM' : 'NÃO',
      'Coluna Dealer (R$)': item.valorDealer,
      'Coluna Sitef (R$)': item.valorSitef,
      'Diferença (R$)': item.diferenca,
      'Status Conciliação': item.status,
      'Motivo da Divergência / Conciliação': item.detalhes || item.status,
      'Divergência?': item.temDivergencia ? 'SIM' : 'NÃO',
    }));

    const wsItems = XLSX.utils.json_to_sheet(dataToExport);
    XLSX.utils.book_append_sheet(wb, wsItems, 'Lançamentos Fechamento');

    // Sheet 2: Resumo por Empresa e Conta Gerencial
    const resumoMap: Record<
      string,
      {
        empresa: string;
        contaGerencial: string;
        count: number;
        totalDealer: number;
        totalSitef: number;
        diferenca: number;
      }
    > = {};

    filteredItems.forEach((item) => {
      const emp = item.empresa || 'Empresa Geral';
      const cta = item.contaGerencial || item.departamento || 'Conta Não Especificada';
      const key = `${emp}__${cta}`;

      if (!resumoMap[key]) {
        resumoMap[key] = {
          empresa: emp,
          contaGerencial: cta,
          count: 0,
          totalDealer: 0,
          totalSitef: 0,
          diferenca: 0,
        };
      }

      resumoMap[key].count += 1;
      resumoMap[key].totalDealer += item.valorDealer || 0;
      resumoMap[key].totalSitef += item.valorSitef || 0;
      resumoMap[key].diferenca += (item.valorDealer || 0) - (item.valorSitef || 0);
    });

    const sortedResumo = Object.values(resumoMap).sort((a, b) => {
      if (a.empresa !== b.empresa) return a.empresa.localeCompare(b.empresa);
      return a.contaGerencial.localeCompare(b.contaGerencial);
    });

    const resumoRows = [
      ['RESUMO CONSOLIDADO POR EMPRESA E CONTA GERENCIAL'],
      ['GERADO EM:', new Date().toLocaleString('pt-BR')],
      ['TOTAL DE ITENS:', filteredItems.length],
      [''],
      [
        'Empresa',
        'Conta Gerencial / Departamento',
        'Qtd. Lançamentos',
        'Total Dealer (R$)',
        'Total SiTef (R$)',
        'Diferença (R$)',
        'Situação',
      ],
    ];

    let sumQtd = 0;
    let sumDealer = 0;
    let sumSitef = 0;
    let sumDif = 0;

    sortedResumo.forEach((r) => {
      sumQtd += r.count;
      sumDealer += r.totalDealer;
      sumSitef += r.totalSitef;
      sumDif += r.diferenca;

      resumoRows.push([
        r.empresa,
        r.contaGerencial,
        String(r.count),
        formatBRL(r.totalDealer),
        formatBRL(r.totalSitef),
        formatBRL(r.diferenca),
        Math.abs(r.diferenca) < 0.01 ? 'CONCILIADO' : 'DIVERGENTE',
      ]);
    });

    resumoRows.push([
      'TOTAL GERAL',
      'CONSOLIDAÇÃO GERAL',
      String(sumQtd),
      formatBRL(sumDealer),
      formatBRL(sumSitef),
      formatBRL(sumDif),
      Math.abs(sumDif) < 0.01 ? '100% CONCILIADO' : 'DIVERGENTE',
    ]);

    const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Empresa e Conta');

    XLSX.writeFile(wb, `Fechamento_Conciliacao_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* Restored Historic Record Notice Banner */}
      {restoredRecordInfo && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 text-amber-200 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <RotateCcw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-amber-300">
                  REEXIBINDO CAIXA HISTÓRICO - MOVIMENTO {restoredRecordInfo.dataMovimento}
                </span>
                <span className="bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  {restoredRecordInfo.count} LANÇAMENTOS
                </span>
              </div>
              <p className="text-xs text-amber-200/80">
                Operador responsável: <strong>{restoredRecordInfo.operador}</strong>. Você está reexibindo as informações salvas deste fechamento no painel.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setRestoredRecordInfo(null);
              onFechamentoConcluido?.({} as any);
            }}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <X className="w-4 h-4" />
            <span>Limpar e Iniciar Novo Caixa</span>
          </button>
        </div>
      )}

      {/* Top Banner: Fechamento do Dia CTA */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base text-white">Fechamento do Caixa do Dia</h2>
              {summary.countTotal > 0 && summary.countDivergencias === 0 && (
                <span className="bg-emerald-500 text-slate-950 font-black px-2.5 py-0.5 rounded-full text-[10px] tracking-wide animate-pulse">
                  100% CONCILIADO
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {summary.countTotal === 0
                ? 'Importe planilhas para conferir e encerrar o caixa.'
                : summary.countDivergencias === 0
                ? 'Todos os lançamentos estão conciliados. Clique para encerrar o caixa e emitir relatórios em PDF/Excel.'
                : `Atenção: Há ${summary.countDivergencias} divergência(s) pendente(s) a resolver antes do encerramento.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time Share Button */}
          <button
            onClick={() => setIsSharedModalOpen(true)}
            className={`px-3.5 py-2 font-bold rounded-xl text-xs border transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
              activeSharedSession
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
          >
            {activeSharedSession ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Sala: <strong>{activeSharedSession.id}</strong> ({activeSharedSession.activeParticipants?.length || 1} online)
                </span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span>Compartilhar Fechamento</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsHistoricoModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <History className="w-4 h-4 text-amber-400" />
            <span>Histórico de Fechamentos</span>
          </button>

          <button
            onClick={() => setIsFechamentoCaixaModalOpen(true)}
            className={`px-4 py-2 font-extrabold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer ${
              summary.countTotal > 0 && summary.countDivergencias === 0
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 hover:scale-102'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Fechar Caixa do Dia</span>
          </button>
        </div>
      </div>

      {/* Real-time Shared Session Collaboration Banner */}
      {activeSharedSession && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-emerald-500/40 p-3.5 rounded-2xl text-white flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-xs text-white">
                  Sessão Compartilhada em Tempo Real:
                </span>
                <span className="bg-emerald-500 text-slate-950 font-mono font-black text-xs px-2 py-0.5 rounded-md">
                  {activeSharedSession.id}
                </span>
                <span className="text-[11px] text-emerald-300 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {activeSharedSession.activeParticipants?.length || 1} computadores conectados
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Participantes:{' '}
                <strong className="text-slate-200">
                  {activeSharedSession.activeParticipants?.map((p) => p.name).join(', ') || currentUser.name}
                </strong>
                {lastSyncText && ` • Sincronizado às ${lastSyncText}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(`${window.location.origin}/?sala=${activeSharedSession.id}`);
                  setCopiedSessionLink(true);
                  setTimeout(() => setCopiedSessionLink(false), 2000);
                }
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copiedSessionLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSessionLink ? 'Link Copiado!' : 'Copiar Link da Sala'}</span>
            </button>

            <button
              onClick={() => performLiveSync(true)}
              disabled={isSyncingLive}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingLive ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>

            <button
              onClick={() => setIsSharedModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Ver Conectados / Chat</span>
            </button>

            <button
              onClick={() => {
                setSharedSession(null);
                saveActiveRoomIdLocally(null);
              }}
              className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/30 transition-all cursor-pointer"
              title="Desconectar da Sala"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Dashboard Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Dealer */}
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
              Total DEALER (R$)
            </span>
            <div className="text-2xl font-black text-emerald-950 tracking-tight">
              {formatBRL(summary.totalDealer)}
            </div>
            <p className="text-[10px] text-emerald-700 font-medium">
              Lançamentos validados no Dealer
            </p>
          </div>
          <div className="w-11 h-11 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-200 shadow-2xs">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Total Sitef */}
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-800">
              Total SITEF (R$)
            </span>
            <div className="text-2xl font-black text-blue-950 tracking-tight">
              {formatBRL(summary.totalSitef)}
            </div>
            <p className="text-[10px] text-blue-700 font-medium">
              Extrato capturado no SiTef
            </p>
          </div>
          <div className="w-11 h-11 bg-blue-100 text-blue-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-200 shadow-2xs">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Diferença Dealer x Sitef */}
        <div
          className={`bg-white border rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3 ${
            summary.diferencaTotal === 0
              ? 'border-emerald-300 bg-emerald-50/30'
              : 'border-amber-300 bg-amber-50/40'
          }`}
        >
          <div className="space-y-1">
            <span
              className={`text-[11px] font-black uppercase tracking-wider ${
                summary.diferencaTotal === 0 ? 'text-emerald-800' : 'text-amber-900'
              }`}
            >
              Diferença (Dealer - Sitef)
            </span>
            <div
              className={`text-2xl font-black tracking-tight ${
                summary.diferencaTotal === 0
                  ? 'text-emerald-800'
                  : summary.diferencaTotal > 0
                  ? 'text-amber-900'
                  : 'text-rose-700'
              }`}
            >
              {formatBRL(summary.diferencaTotal)}
            </div>
            <p className="text-[10px] font-medium text-slate-600">
              {summary.diferencaTotal === 0
                ? 'Valores consolidados por empresa'
                : 'Saldo apurado em divergência'}
            </p>
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-2xs ${
              summary.diferencaTotal === 0
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            <Scale className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Qtd. Divergências */}
        <div className="bg-white border border-amber-300 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
              Qtd. Divergências
            </span>
            <div className="text-2xl font-black text-amber-950 tracking-tight flex items-center gap-2">
              <span>{summary.countDivergencias}</span>
              <span className="text-xs font-bold text-amber-800 px-2 py-0.5 bg-amber-100 border border-amber-300 rounded-full">
                {summary.countTotal > 0
                  ? `${((summary.countDivergencias / summary.countTotal) * 100).toFixed(0)}%`
                  : '0%'}
              </span>
            </div>
            <p className="text-[10px] text-amber-800 font-semibold">
              Destacadas para verificação
            </p>
          </div>
          <div className="w-11 h-11 bg-amber-500 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Action Bar & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Empresa Select Filter & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Empresa Filter Dropdown & Alphabetical Sort */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-xs">
              <Building2 className="w-4 h-4 text-slate-500 ml-1" />
              <span className="font-bold text-slate-700 hidden sm:inline">Empresa:</span>
              <select
                value={selectedEmpresaFilter}
                onChange={(e) => setSelectedEmpresaFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="ALL">Todas as Empresas ({empresaList.length})</option>
                {empresaList.map((emp) => (
                  <option key={emp} value={emp}>
                    {emp}
                  </option>
                ))}
              </select>

              {/* Botão de Ordenação Alfabética A-Z / Z-A */}
              <button
                type="button"
                onClick={() =>
                  setEmpresaSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                }
                className={`px-2 py-1 rounded-md text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                  empresaSortOrder === 'asc'
                    ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-2xs'
                    : 'bg-indigo-100 border-indigo-300 text-indigo-900 shadow-2xs'
                }`}
                title={
                  empresaSortOrder === 'asc'
                    ? 'Empresas em ordem alfabética (A → Z). Clique para inverter (Z → A)'
                    : 'Empresas em ordem decrescente (Z → A). Clique para inverter (A → Z)'
                }
              >
                {empresaSortOrder === 'asc' ? (
                  <>
                    <ArrowDownAZ className="w-3.5 h-3.5 text-amber-700" />
                    <span>A → Z</span>
                  </>
                ) : (
                  <>
                    <ArrowUpZA className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Z → A</span>
                  </>
                )}
              </button>

              {selectedEmpresaFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedEmpresaFilter('ALL')}
                  className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded transition-colors"
                  title="Limpar filtro de empresa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por NSU, Conta, Caixa, Bandeira..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 bg-slate-50 focus:bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Mode Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas ({summary.countTotal})
              </button>
              <button
                onClick={() => setFilterMode('divergent')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                  filterMode === 'divergent'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-800 hover:bg-amber-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Divergências ({summary.countDivergencias})</span>
              </button>
              <button
                onClick={() => setFilterMode('concolidated')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                  filterMode === 'concolidated'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                Conciliados ({summary.countConciliados})
              </button>
              <button
                onClick={() => setFilterMode('pix_validation')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                  filterMode === 'pix_validation'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-indigo-800 hover:bg-indigo-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-indigo-300" />
                <span>Validação PIX ({summary.countPixValidacao})</span>
              </button>
            </div>
          </div>

          {/* Right: Actions & Collapse/Expand All */}
          <div className="flex items-center gap-2">
            {/* Expand / Collapse All Controls */}
            {viewMode === 'grouped' && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                <button
                  onClick={handleExpandAll}
                  className="px-2 py-1 hover:bg-white text-slate-700 font-bold rounded flex items-center gap-1 text-[11px]"
                  title="Expandir todas as empresas"
                >
                  <Maximize2 className="w-3 h-3 text-amber-600" />
                  <span>Ampliar</span>
                </button>
                <button
                  onClick={handleCollapseAll}
                  className="px-2 py-1 hover:bg-white text-slate-700 font-bold rounded flex items-center gap-1 text-[11px]"
                  title="Recolher todas as empresas"
                >
                  <Minimize2 className="w-3 h-3 text-slate-600" />
                  <span>Recolher</span>
                </button>
              </div>
            )}

            {/* Toggle View Mode */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 ${
                  viewMode === 'grouped' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
                title="Agrupar por Empresa e Departamento"
              >
                <FolderTree className="w-3.5 h-3.5 text-amber-600" />
                <span>Por Empresa</span>
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 ${
                  viewMode === 'flat' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
                title="Visualização em Tabela Única"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Lista Plana</span>
              </button>
            </div>

            {/* Recalculate Auto Button */}
            {onRecalculateAuto && (
              <button
                onClick={onRecalculateAuto}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Refazer comparação entre Dealer e SiTef"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                <span>Comparar Novamente</span>
              </button>
            )}

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>

            {/* Fechamento do Dia Button */}
            <button
              onClick={() => setIsFechamentoCaixaModalOpen(true)}
              className={`px-3.5 py-1.5 font-extrabold rounded-lg text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer ${
                summary.countTotal > 0 && summary.countDivergencias === 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
              title="Encerrar Caixa do Dia e Gerar Relatórios"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Fechar Caixa do Dia</span>
            </button>

            {/* Add Launch Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-lg text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Adicionar Lançamento</span>
            </button>

            {/* Delete Selected Button */}
            {selectedIds.length > 0 && (
              <button
                onClick={() => setDeleteConfirm({ isOpen: true, ids: selectedIds })}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
              <Scale className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">
              Nenhum lançamento de fechamento encontrado
            </h4>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              Importe planilhas nas abas <strong>DEALER</strong> e <strong>Sitef</strong> ou clique no botão <strong>&quot;+ Adicionar Lançamento&quot;</strong> para incluir registros manuais no fechamento.
            </p>
            {onTriggerFileImport && (
              <button
                onClick={onTriggerFileImport}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all inline-flex items-center gap-2 mt-2"
              >
                Importar Planilha Excel
              </button>
            )}
          </div>
        ) : viewMode === 'grouped' ? (
          /* Grouped Accordion View: Empresa -> Departamento */
          <div className="divide-y divide-slate-200">
            {Object.entries(groupedByEmpresa).map(([empName, empData]) => {
              const isEmpCollapsed = collapsedEmpresas[empName] ?? true;

              return (
                <div key={empName} className="bg-slate-50/40">
                  {/* Level 1: Empresa Accordion Header */}
                  {(() => {
                    const isEmpresaConciliada = !!conciliatedEmpresas[empName];

                    return (
                      <div
                        onClick={() => toggleEmpresaCollapse(empName)}
                        className={`px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-all duration-300 border-b-2 select-none ${
                          isEmpresaConciliada
                            ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 hover:from-emerald-500/20 hover:to-teal-500/15 border-emerald-400/80 shadow-[0_4px_20px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/30'
                            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-900 border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <button className={`p-1 rounded-md border shadow-2xs transition-colors ${
                            isEmpresaConciliada
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : 'bg-white text-amber-600 border-slate-300'
                          }`}>
                            {isEmpCollapsed ? (
                              <ChevronRight className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          <Building2 className={`w-5 h-5 transition-colors ${isEmpresaConciliada ? 'text-emerald-600' : 'text-amber-600'}`} />
                          <div className="flex items-center gap-2.5">
                            <span className={`font-extrabold text-base transition-colors ${isEmpresaConciliada ? 'text-emerald-950' : 'text-slate-900'}`}>{empName}</span>
                            <span className={`text-[11px] border px-2.5 py-0.5 rounded-full font-bold transition-colors ${
                              isEmpresaConciliada
                                ? 'bg-emerald-100/90 text-emerald-900 border-emerald-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}>
                              {empData.countTotal} lançamento(s)
                            </span>
                            {isEmpresaConciliada && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-[0_2px_10px_rgba(16,185,129,0.35)] animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                                Conciliado no Sistema
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Totals for Empresa & Apple iPhone 17 Conciliate Control */}
                        <div className="flex items-center flex-wrap gap-2.5 text-xs">
                          {/* Apple iPhone 17 Pro Dynamic Glass Button: Conciliar Empresa no Sistema */}
                          <button
                            type="button"
                            onClick={(e) => toggleEmpresaConciliada(empName, e)}
                            title={
                              isEmpresaConciliada
                                ? 'Empresa já confirmada como conciliada no sistema. Clique para desmarcar.'
                                : 'Clique para marcar esta empresa como 100% conciliada no sistema.'
                            }
                            className={`group relative overflow-hidden px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all duration-300 cursor-pointer ${
                              isEmpresaConciliada
                                ? 'bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.45),inset_0_1px_1px_rgba(255,255,255,0.4)] border border-emerald-300 hover:brightness-110 active:scale-95'
                                : 'bg-white/80 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-300/80 hover:border-emerald-400 shadow-xs hover:shadow-[0_0_12px_rgba(16,185,129,0.25)] active:scale-95'
                            }`}
                          >
                            {/* Apple Light Specular Sweep Reflection */}
                            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

                            <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                              isEmpresaConciliada
                                ? 'bg-white text-emerald-700 shadow-2xs scale-110'
                                : 'border-2 border-slate-400 group-hover:border-emerald-600'
                            }`}>
                              {isEmpresaConciliada && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            <span className="font-extrabold tracking-tight whitespace-nowrap">
                              {isEmpresaConciliada ? 'Conciliado no Sistema' : 'Conciliar no Sistema'}
                            </span>
                          </button>

                          <div className={`border px-3 py-1 rounded-lg shadow-2xs transition-colors ${
                            isEmpresaConciliada ? 'bg-emerald-50/80 border-emerald-300' : 'bg-white border-emerald-300'
                          }`}>
                            <span className="text-[10px] uppercase text-emerald-800 font-bold block">
                              Total Dealer:
                            </span>
                            <span className="font-extrabold text-emerald-950">
                              {formatBRL(empData.totalDealer)}
                            </span>
                          </div>

                          <div className={`border px-3 py-1 rounded-lg shadow-2xs transition-colors ${
                            isEmpresaConciliada ? 'bg-blue-50/80 border-blue-300' : 'bg-white border-blue-300'
                          }`}>
                            <span className="text-[10px] uppercase text-blue-800 font-bold block">
                              Total Sitef:
                            </span>
                            <span className="font-extrabold text-blue-950">
                              {formatBRL(empData.totalSitef)}
                            </span>
                          </div>

                          <div className={`border px-3 py-1 rounded-lg shadow-2xs transition-colors ${
                            isEmpresaConciliada ? 'bg-white border-emerald-300' : 'bg-white border-slate-300'
                          }`}>
                            <span className="text-[10px] uppercase text-slate-600 font-bold block">
                              Diferença:
                            </span>
                            <span
                              className={`font-black ${
                                empData.diferencaTotal === 0
                                  ? 'text-emerald-700'
                                  : 'text-amber-800 font-extrabold'
                              }`}
                            >
                              {formatBRL(empData.diferencaTotal)}
                            </span>
                          </div>

                          {empData.countDivergencias > 0 ? (
                            <span className="bg-amber-500 text-white font-black px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1 shadow-2xs">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {empData.countDivergencias} Divergência(s)
                            </span>
                          ) : (
                            <span className="bg-emerald-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1 shadow-2xs">
                              <Check className="w-3.5 h-3.5" />
                              100% Conciliado
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Level 2: Departamentos inside Empresa (Visible if not collapsed) */}
                  {!isEmpCollapsed && (
                    <div className="divide-y divide-slate-200 bg-white">
                      {Object.entries(empData.departamentos).map(([depName, depData]) => {
                        const depKey = `${empName}_${depName}`;
                        const isDepCollapsed = collapsedDepartamentos[depKey] ?? true;

                        return (
                          <div key={depKey} className="border-t border-slate-200">
                            {/* Departamento Header */}
                            <div
                              onClick={() => toggleDepartamentoCollapse(depKey)}
                              className="px-5 py-2.5 bg-slate-200/70 hover:bg-slate-200 text-slate-800 flex flex-wrap items-center justify-between gap-3 cursor-pointer text-xs font-bold select-none border-b border-slate-300/80"
                            >
                              <div className="flex items-center gap-2">
                                <button className="p-0.5 text-slate-600">
                                  {isDepCollapsed ? (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <FolderTree className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-slate-900 text-xs">Departamento: {depName}</span>
                                <span className="text-[10px] bg-white text-slate-700 border border-slate-300 px-2 py-0.2 rounded-full font-bold shadow-2xs">
                                  {depData.items.length} item(ns)
                                </span>
                              </div>

                              {/* Department Totals */}
                              <div className="flex items-center gap-3 text-[11px]">
                                <span>
                                  Dealer:{' '}
                                  <strong className="text-emerald-800 font-extrabold">
                                    {formatBRL(depData.totalDealer)}
                                  </strong>
                                </span>
                                <span>
                                  Sitef:{' '}
                                  <strong className="text-blue-800 font-extrabold">
                                    {formatBRL(depData.totalSitef)}
                                  </strong>
                                </span>
                                <span
                                  className={
                                    depData.diferencaTotal !== 0
                                      ? 'text-amber-800 font-extrabold'
                                      : 'text-emerald-700 font-bold'
                                  }
                                >
                                  Diferença: {formatBRL(depData.diferencaTotal)}
                                </span>
                              </div>
                            </div>

                            {/* Table of Items (Visible if department not collapsed) */}
                            {!isDepCollapsed && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-200/80 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-300">
                                      <th className="p-2.5 w-10 text-center">
                                        <input
                                          type="checkbox"
                                          checked={
                                            depData.items.length > 0 &&
                                            depData.items.every((i) => selectedIds.includes(i.id))
                                          }
                                          onChange={() => {
                                            const depIds = depData.items.map((i) => i.id);
                                            const allSelected = depIds.every((id) =>
                                              selectedIds.includes(id)
                                            );
                                            if (allSelected) {
                                              setSelectedIds((prev) =>
                                                prev.filter((id) => !depIds.includes(id))
                                              );
                                            } else {
                                              setSelectedIds((prev) =>
                                                Array.from(new Set([...prev, ...depIds]))
                                              );
                                            }
                                          }}
                                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                        />
                                      </th>
                                      <th className="p-2.5">Data</th>
                                      <th className="p-2.5">NSU (Cartão)</th>
                                      <th className="p-2.5">Tipo / Bandeira</th>
                                      <th className="p-2.5 text-right bg-emerald-50/50 text-emerald-900 border-x border-emerald-200">
                                        Coluna Dealer (R$)
                                      </th>
                                      <th className="p-2.5 text-right bg-blue-50/50 text-blue-900 border-r border-blue-200">
                                        Coluna Sitef (R$)
                                      </th>
                                      <th className="p-2.5 text-right">Diferença (R$)</th>
                                      <th className="p-2.5 text-center">Status / Conciliação</th>
                                      <th className="p-2.5 w-12 text-center">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200 bg-white">
                                    {depData.items.map((item) => {
                                      const isSelected = selectedIds.includes(item.id);
                                      const isBandDiv = item.divergenciaBandeira;
                                      const isPixValNeeded =
                                        item.isPixValidationNeeded || item.status.includes('VALIDAÇÃO NECESSÁRIA');
                                      const isEmpConciliated = !!conciliatedEmpresas[item.empresa];

                                      return (
                                        <tr
                                          key={item.id}
                                          className={`transition-all duration-200 text-xs ${
                                            isEmpConciliated
                                              ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-emerald-50/40 hover:from-emerald-100/90 hover:to-teal-100/60 border-l-4 border-l-emerald-500 shadow-[inset_0_1px_0_rgba(16,185,129,0.1)]'
                                              : isPixValNeeded
                                              ? 'bg-indigo-50/90 hover:bg-indigo-100/90 border-l-4 border-l-indigo-600'
                                              : isBandDiv
                                              ? 'bg-purple-50/90 hover:bg-purple-100/90 border-l-4 border-l-purple-600'
                                              : item.temDivergencia
                                              ? 'bg-amber-50/90 hover:bg-amber-100/90 border-l-4 border-l-amber-500'
                                              : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                                          } ${isSelected ? 'bg-amber-100/70 ring-1 ring-amber-400' : ''}`}
                                        >
                                          <td className="p-2.5 text-center">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => handleToggleSelect(item.id)}
                                              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                            />
                                          </td>
                                          <td className={`p-2.5 font-medium whitespace-nowrap ${isEmpConciliated ? 'text-emerald-950 font-bold' : 'text-slate-700'}`}>
                                            {item.data || '—'}
                                          </td>
                                          <td className={`p-2.5 font-mono font-bold whitespace-nowrap ${isEmpConciliated ? 'text-emerald-900' : 'text-slate-900'}`}>
                                            {item.nsu}
                                          </td>
                                          <td className="p-2.5 whitespace-nowrap">
                                            <div className="flex flex-col gap-0.5">
                                              <span className={`font-bold ${isEmpConciliated ? 'text-emerald-950' : 'text-slate-800'}`}>
                                                {item.tipoPagamento}
                                              </span>
                                              <div className="flex items-center gap-1 text-[10px]">
                                                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                                                  Dealer: {item.bandeiraDealer || '—'}
                                                </span>
                                                <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-300 font-semibold">
                                                  Sitef: {item.bandeiraSitef || '—'}
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          {/* Coluna Dealer */}
                                          <td className="p-2.5 text-right font-black text-emerald-950 bg-emerald-50/30 border-x border-emerald-200/60 whitespace-nowrap">
                                            {formatBRL(item.valorDealer)}
                                          </td>
                                          {/* Coluna Sitef */}
                                          <td className="p-2.5 text-right font-black text-blue-950 bg-blue-50/30 border-r border-blue-200/60 whitespace-nowrap">
                                            {formatBRL(item.valorSitef)}
                                          </td>
                                          {/* Diferença */}
                                          <td className="p-2.5 text-right whitespace-nowrap">
                                            <span
                                              className={`px-2 py-0.5 rounded font-extrabold ${
                                                item.temDivergencia
                                                  ? 'bg-amber-200 text-amber-950 border border-amber-300 shadow-2xs'
                                                  : 'text-emerald-700 font-semibold'
                                              }`}
                                            >
                                              {formatBRL(item.diferenca)}
                                            </span>
                                          </td>
                                          {/* Status */}
                                          <td className="p-2.5 text-center whitespace-nowrap">
                                            {isEmpConciliated ? (
                                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] border border-emerald-400 uppercase tracking-tight">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                                                CONCILIADO NO SISTEMA
                                              </span>
                                            ) : isPixValNeeded ? (
                                              <span
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-indigo-600 text-white shadow-2xs uppercase cursor-help"
                                                title={item.detalhes || 'PIX – Validação necessária (ambiguidade de lançamentos)'}
                                              >
                                                <AlertTriangle className="w-3 h-3 text-indigo-200" />
                                                PIX – VALIDAÇÃO NECESSÁRIA
                                              </span>
                                            ) : isBandDiv ? (
                                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-purple-600 text-white shadow-2xs uppercase">
                                                <AlertTriangle className="w-3 h-3 text-amber-300" />
                                                DIVERGÊNCIA DE BANDEIRA
                                              </span>
                                            ) : item.temDivergencia ? (
                                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-amber-500 text-white shadow-2xs uppercase">
                                                <AlertTriangle className="w-3 h-3" />
                                                {item.status}
                                              </span>
                                            ) : item.isPix ? (
                                              <div className="flex flex-col items-center gap-0.5">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                                                  <CheckCircle2 className="w-3 h-3 text-teal-600" />
                                                  CONCILIADO (PIX)
                                                </span>
                                                {item.criterioConciliacao && (
                                                  <span
                                                    className="text-[9px] text-teal-900 font-semibold max-w-[180px] truncate"
                                                    title={item.detalhes || item.criterioConciliacao}
                                                  >
                                                    {item.criterioConciliacao}
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                CONCILIADO
                                              </span>
                                            )}
                                          </td>
                                          {/* Action */}
                                          <td className="p-2.5 text-center">
                                            <button
                                              onClick={() =>
                                                setDeleteConfirm({ isOpen: true, ids: [item.id] })
                                              }
                                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                              title="Excluir lançamento"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Flat Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredItems.length > 0 &&
                        filteredItems.every((i) => selectedIds.includes(i.id))
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                  </th>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Departamento / Conta</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">NSU</th>
                  <th className="p-3">Tipo / Bandeira</th>
                  <th className="p-3 text-right bg-emerald-950 text-emerald-200">
                    Coluna Dealer (R$)
                  </th>
                  <th className="p-3 text-right bg-blue-950 text-blue-200">
                    Coluna Sitef (R$)
                  </th>
                  <th className="p-3 text-right">Diferença (R$)</th>
                  <th className="p-3 text-center">Status Conciliação</th>
                  <th className="p-3 w-12 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isBandDiv = item.divergenciaBandeira;
                  const isPixValNeeded =
                    item.isPixValidationNeeded || item.status.includes('VALIDAÇÃO NECESSÁRIA');
                  const isEmpConciliated = !!conciliatedEmpresas[item.empresa];

                  return (
                    <tr
                      key={item.id}
                      className={`transition-all duration-200 text-xs ${
                        isEmpConciliated
                          ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-emerald-50/40 hover:from-emerald-100/90 hover:to-teal-100/60 border-l-4 border-l-emerald-500 shadow-[inset_0_1px_0_rgba(16,185,129,0.1)]'
                          : isPixValNeeded
                          ? 'bg-indigo-50/90 hover:bg-indigo-100/90 border-l-4 border-l-indigo-600'
                          : isBandDiv
                          ? 'bg-purple-50/90 hover:bg-purple-100/90 border-l-4 border-l-purple-600'
                          : item.temDivergencia
                          ? 'bg-amber-50/90 hover:bg-amber-100/90 border-l-4 border-l-amber-500'
                          : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                      } ${isSelected ? 'bg-amber-100/70 ring-1 ring-amber-400' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                        <span>{item.empresa}</span>
                        {isEmpConciliated && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" title="Empresa Conciliada no Sistema" />
                        )}
                      </td>
                      <td className="p-3 text-slate-700">
                        {item.departamento || item.contaGerencial}
                      </td>
                      <td className="p-3 text-slate-700 whitespace-nowrap">{item.data || '—'}</td>
                      <td className={`p-3 font-mono font-bold whitespace-nowrap ${isEmpConciliated ? 'text-emerald-950' : 'text-slate-900'}`}>
                        {item.nsu}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={`font-bold ${isEmpConciliated ? 'text-emerald-950' : 'text-slate-800'}`}>{item.tipoPagamento}</span>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                              Dealer: {item.bandeiraDealer || '—'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-300 font-semibold">
                              Sitef: {item.bandeiraSitef || '—'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-black text-emerald-950 bg-emerald-50/30 whitespace-nowrap">
                        {formatBRL(item.valorDealer)}
                      </td>
                      <td className="p-3 text-right font-black text-blue-950 bg-blue-50/30 whitespace-nowrap">
                        {formatBRL(item.valorSitef)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded font-extrabold ${
                            item.temDivergencia
                              ? 'bg-amber-200 text-amber-950 border border-amber-300 shadow-2xs'
                              : 'text-emerald-700 font-semibold'
                          }`}
                        >
                          {formatBRL(item.diferenca)}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {isEmpConciliated ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] border border-emerald-400 uppercase tracking-tight">
                            <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                            CONCILIADO NO SISTEMA
                          </span>
                        ) : isPixValNeeded ? (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-indigo-600 text-white shadow-2xs uppercase cursor-help"
                            title={item.detalhes || 'PIX – Validação necessária (ambiguidade de lançamentos)'}
                          >
                            <AlertTriangle className="w-3 h-3 text-indigo-200" />
                            PIX – VALIDAÇÃO NECESSÁRIA
                          </span>
                        ) : isBandDiv ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-purple-600 text-white shadow-2xs uppercase">
                            <AlertTriangle className="w-3 h-3 text-amber-300" />
                            DIVERGÊNCIA DE BANDEIRA
                          </span>
                        ) : item.temDivergencia ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-amber-500 text-white shadow-2xs uppercase">
                            <AlertTriangle className="w-3 h-3" />
                            {item.status}
                          </span>
                        ) : item.isPix ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                              <CheckCircle2 className="w-3 h-3 text-teal-600" />
                              {item.status || 'CONCILIADO (PIX)'}
                            </span>
                            {(item.criterioConciliacao || item.detalhes) && (
                              <span
                                className="text-[9px] text-teal-900 font-semibold max-w-[180px] truncate"
                                title={item.detalhes || item.criterioConciliacao}
                              >
                                {item.criterioConciliacao || item.detalhes}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            CONCILIADO
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, ids: [item.id] })}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Adicionar Lançamento no Fechamento */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <PlusCircle className="w-5 h-5 text-white" />
                <h3 className="font-extrabold text-base tracking-wide">
                  + Adicionar Lançamento no Fechamento
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-5 max-h-[85vh] overflow-y-auto">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Adicione um lançamento manual selecionando a empresa, departamento e informando os valores para Dealer e Sitef.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Empresa (52 Cadastradas)</span>
                  </label>
                  <select
                    value={addForm.empresa}
                    onChange={(e) => setAddForm({ ...addForm, empresa: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-amber-50/50 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer shadow-xs transition-all"
                  >
                    {CADASTRO_EMPRESAS.map((emp) => (
                      <option key={emp} value={emp}>
                        {emp}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                    <span>Departamento</span>
                  </label>
                  <select
                    value={addForm.departamento}
                    onChange={(e) => setAddForm({ ...addForm, departamento: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-blue-50/50 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-xs transition-all"
                  >
                    {CADASTRO_DEPARTAMENTOS.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Conta Gerencial</span>
                  </label>
                  <select
                    value={addForm.contaGerencial}
                    onChange={(e) => setAddForm({ ...addForm, contaGerencial: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-indigo-50/50 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-xs transition-all"
                  >
                    {CADASTRO_CONTAS_GERENCIAIS.map((cta) => (
                      <option key={cta} value={cta}>
                        {cta}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Data do Cx</span>
                  </label>
                  <input
                    type="date"
                    value={toInputDateFormat(addForm.data)}
                    onChange={(e) => setAddForm({ ...addForm, data: toDisplayDateFormat(e.target.value) })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-amber-50/30 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer shadow-xs transition-all"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    NSU / Código Transação
                  </label>
                  <input
                    type="text"
                    value={addForm.nsu}
                    onChange={(e) => setAddForm({ ...addForm, nsu: e.target.value })}
                    placeholder="Ex: 849201"
                    className="w-full px-3.5 py-2.5 text-sm font-bold text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 font-mono shadow-xs transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Bandeira Dealer
                  </label>
                  <input
                    type="text"
                    value={addForm.bandeiraDealer}
                    onChange={(e) => setAddForm({ ...addForm, bandeiraDealer: e.target.value })}
                    placeholder="Ex: VISA, MASTER, ELO"
                    className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 shadow-xs transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Bandeira Sitef
                  </label>
                  <input
                    type="text"
                    value={addForm.bandeiraSitef}
                    onChange={(e) => setAddForm({ ...addForm, bandeiraSitef: e.target.value })}
                    placeholder="Ex: VISA, MASTER, ELO"
                    className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-900 bg-white border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 shadow-xs transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Coluna Dealer (R$)
                  </label>
                  <input
                    type="text"
                    value={addForm.valorDealer}
                    onChange={(e) => setAddForm({ ...addForm, valorDealer: e.target.value })}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 text-sm font-extrabold text-emerald-950 bg-emerald-50/70 border-2 border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Coluna Sitef (R$)
                  </label>
                  <input
                    type="text"
                    value={addForm.valorSitef}
                    onChange={(e) => setAddForm({ ...addForm, valorSitef: e.target.value })}
                    placeholder="0,00"
                    className="w-full px-3.5 py-2.5 text-sm font-extrabold text-blue-950 bg-blue-50/70 border-2 border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs transition-all"
                  />
                </div>
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
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Lançamento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Exclusão */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Excluir Lançamento(s) do Fechamento</h3>
              </div>
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, ids: [] })}
                className="p-1 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-slate-800">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Tem certeza de que deseja excluir{' '}
                <strong className="text-rose-600 font-bold">
                  {deleteConfirm.ids.length}{' '}
                  {deleteConfirm.ids.length === 1 ? 'lançamento' : 'lançamentos'}
                </strong>{' '}
                do Fechamento?
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 space-y-1">
                <p className="font-bold">⚠️ Recálculo Automático:</p>
                <p>O painel de totais e a diferença de saldos serão atualizados instantaneamente.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ isOpen: false, ids: [] })}
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

      {/* Modal: Fechamento do Caixa do Dia */}
      <FechamentoCaixaModal
        isOpen={isFechamentoCaixaModalOpen}
        onClose={() => setIsFechamentoCaixaModalOpen(false)}
        fechamentoItems={fechamentoItems}
        onSuccessClosure={(record) => {
          setRestoredRecordInfo(null);
          onFechamentoConcluido?.(record);
        }}
        onFilterDivergences={() => setFilterMode('divergent')}
      />

      {/* Modal: Histórico de Fechamentos do Caixa */}
      <HistoricoFechamentoModal
        isOpen={isHistoricoModalOpen}
        onClose={() => setIsHistoricoModalOpen(false)}
        onRestoreRecord={(record) => {
          setRestoredRecordInfo({
            dataMovimento: record.dataMovimento,
            operador: record.operador,
            count: record.countTotal,
          });
          onRestoreFechamentoRecord?.(record);
        }}
      />

      {/* Modal: Compartilhamento em Tempo Real de Fechamento */}
      <SharedFechamentoModal
        isOpen={isSharedModalOpen}
        onClose={() => setIsSharedModalOpen(false)}
        fechamentoItems={fechamentoItems}
        conciliatedEmpresas={conciliatedEmpresas}
        summary={summary}
        activeSession={activeSharedSession}
        onSessionConnected={(session) => {
          setSharedSession(session);
          if (session.conciliatedEmpresas) {
            setConciliatedEmpresas(session.conciliatedEmpresas);
          }
          if (onApplySharedItems && session.items) {
            onApplySharedItems(session.items, session.conciliatedEmpresas || {});
          }
        }}
        onSessionDisconnected={() => {
          setSharedSession(null);
          saveActiveRoomIdLocally(null);
        }}
        onManualSync={() => performLiveSync(true)}
      />
    </div>
  );
}
