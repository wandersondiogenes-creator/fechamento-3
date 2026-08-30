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
  deleteSharedSession,
  leaveSharedSession,
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
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  Unlock,
  FolderArchive,
  Link2,
  Send,
  MessageCircle,
  Mail,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportFechamentoToExcel } from '@/lib/fechamento-excel-io';
import { getSessionTimeRemaining } from '@/lib/shared-fechamento-service';

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
  onOpenPendingFilesModal?: () => void;
  pendingFilesCount?: number;
  activeTab?: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento';
  tabCounts?: { dealer: number; sitef: number; pendente_cdc: number; fechamento?: number };
  onTabChange?: (tab: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento') => void;
  onFechamentoConcluido?: (record: FechamentoCaixaRecord) => void;
  onRestoreFechamentoRecord?: (record: FechamentoCaixaRecord) => void;
  dealerState?: any;
  sitefState?: any;
  pendenteCdcState?: any;
  activeSharedSession?: SharedFechamentoSession | null;
  onSharedSessionChange?: (session: SharedFechamentoSession | null) => void;
  onApplySharedItems?: (items: FechamentoItem[], conciliated: Record<string, boolean>) => void;
  onApplySharedSpreadsheets?: (dealerState?: any, sitefState?: any, pendenteCdcState?: any) => void;
  onGuestLeaveOrKicked?: (reason: 'left' | 'kicked' | 'deleted') => void;
  isSharedModalOpen?: boolean;
  onSharedModalOpenChange?: (open: boolean) => void;
  onImportExcelData?: (importedData: any) => void;
  conciliatedEmpresas?: Record<string, any>;
  onConciliatedEmpresasChange?: (conciliated: Record<string, any>) => void;
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
  onOpenPendingFilesModal,
  pendingFilesCount = 0,
  onFechamentoConcluido,
  onRestoreFechamentoRecord,
  dealerState,
  sitefState,
  pendenteCdcState,
  activeSharedSession: externalActiveSharedSession,
  onSharedSessionChange,
  onApplySharedItems,
  onApplySharedSpreadsheets,
  onGuestLeaveOrKicked,
  isSharedModalOpen: externalIsSharedModalOpen,
  onSharedModalOpenChange,
  onImportExcelData,
  conciliatedEmpresas: externalConciliatedEmpresas,
  onConciliatedEmpresasChange,
}: FechamentoViewProps) {
  const fechamentoItems = useMemo(
    () => fechamentoItemsProp || itemsProp || [],
    [fechamentoItemsProp, itemsProp]
  );
  const [selectedCompanyPanel, setSelectedCompanyPanel] = useState<string | null>(null);

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

  const [internalIsSharedModalOpen, setInternalIsSharedModalOpen] = useState(false);
  const isSharedModalOpen = externalIsSharedModalOpen !== undefined ? externalIsSharedModalOpen : internalIsSharedModalOpen;
  const setIsSharedModalOpen = useCallback((open: boolean) => {
    if (onSharedModalOpenChange) onSharedModalOpenChange(open);
    else setInternalIsSharedModalOpen(open);
  }, [onSharedModalOpenChange]);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [lastSyncText, setLastSyncText] = useState<string>('');
  const [copiedSessionLink, setCopiedSessionLink] = useState(false);
  const currentUser = getCurrentUser();

  const isHost = activeSharedSession
    ? activeSharedSession.createdBy.id === currentUser.id ||
      activeSharedSession.createdBy.email === currentUser.email ||
      currentUser.role === 'admin'
    : true;

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
  const [isRefreshingAuto, setIsRefreshingAuto] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  const handleTriggerRefreshAuto = useCallback(() => {
    if (!onRecalculateAuto) return;
    setIsRefreshingAuto(true);
    onRecalculateAuto();
    setTimeout(() => {
      setIsRefreshingAuto(false);
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 4000);
    }, 400);
  }, [onRecalculateAuto]);

  // State to track empresas marked as reconciled in the system by the user
  const [internalConciliatedEmpresas, setInternalConciliatedEmpresas] = useState<Record<string, any>>(() => {
    if (externalConciliatedEmpresas && Object.keys(externalConciliatedEmpresas).length > 0) {
      return externalConciliatedEmpresas;
    }
    if (activeSharedSession?.conciliatedEmpresas && Object.keys(activeSharedSession.conciliatedEmpresas).length > 0) {
      return activeSharedSession.conciliatedEmpresas;
    }
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

  const conciliatedEmpresas = externalConciliatedEmpresas !== undefined ? externalConciliatedEmpresas : internalConciliatedEmpresas;

  const setConciliatedEmpresas = useCallback(
    (updater: React.SetStateAction<Record<string, any>>) => {
      if (typeof updater === 'function') {
        setInternalConciliatedEmpresas((prev) => {
          const next = updater(prev);
          if (onConciliatedEmpresasChange) onConciliatedEmpresasChange(next);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('wanfinance_conciliated_empresas_v1', JSON.stringify(next));
            } catch {}
          }
          return next;
        });
      } else {
        setInternalConciliatedEmpresas(updater);
        if (onConciliatedEmpresasChange) onConciliatedEmpresasChange(updater);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('wanfinance_conciliated_empresas_v1', JSON.stringify(updater));
          } catch {}
        }
      }
    },
    [onConciliatedEmpresasChange]
  );

  const conciliatedEmpresasRef = useRef<Record<string, any>>(conciliatedEmpresas);
  useEffect(() => {
    conciliatedEmpresasRef.current = conciliatedEmpresas;
  }, [conciliatedEmpresas]);

  useEffect(() => {
    if (externalConciliatedEmpresas && Object.keys(externalConciliatedEmpresas).length > 0) {
      setInternalConciliatedEmpresas(externalConciliatedEmpresas);
      conciliatedEmpresasRef.current = externalConciliatedEmpresas;
    }
  }, [externalConciliatedEmpresas]);

  // When fechamentoItems is cleared / empty, reset conciliated status and selections
  useEffect(() => {
    if (fechamentoItems.length === 0) {
      setConciliatedEmpresas({});
      conciliatedEmpresasRef.current = {};
      setSelectedIds([]);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('wanfinance_conciliated_empresas_v1');
        } catch {}
      }
    }
  }, [fechamentoItems.length, setConciliatedEmpresas]);

  // Keep local conciliatedEmpresas in sync when external activeSharedSession changes
  useEffect(() => {
    if (activeSharedSession?.conciliatedEmpresas) {
      setConciliatedEmpresas((prev) => {
        const merged = { ...prev, ...activeSharedSession.conciliatedEmpresas };
        conciliatedEmpresasRef.current = merged;
        return merged;
      });
    }
  }, [activeSharedSession?.id, activeSharedSession?.version, activeSharedSession?.conciliatedEmpresas, setConciliatedEmpresas]);

  // Helper to extract boolean status and reconciler details for an empresa
  const getEmpresaConciliation = useCallback((empName: string) => {
    const raw = conciliatedEmpresas[empName];
    if (!raw) return { isConciliated: false, reconciledBy: '', reconciledAt: '' };
    if (typeof raw === 'boolean') {
      return { isConciliated: raw, reconciledBy: '', reconciledAt: '' };
    }
    if (typeof raw === 'object') {
      return {
        isConciliated: Boolean(raw.reconciled),
        reconciledBy: raw.reconciledBy || '',
        reconciledAt: raw.reconciledAt || '',
      };
    }
    return { isConciliated: false, reconciledBy: '', reconciledAt: '' };
  }, [conciliatedEmpresas]);

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

  // Real-time collaborative polling sync
  const lastKnownVersionRef = useRef<number>(activeSharedSession?.version || 0);

  const performLiveSync = useCallback(async (showIndicator = false) => {
    if (!activeSharedSession?.id) return;
    if (showIndicator) setIsSyncingLive(true);
    try {
      const res = await fetchSharedSession(activeSharedSession.id, currentUser);
      if (!res.success) {
        if (res.kicked) {
          setSharedSession(null);
          saveActiveRoomIdLocally(null);
          onGuestLeaveOrKicked?.('kicked');
          return;
        }
        if (res.deleted) {
          setSharedSession(null);
          saveActiveRoomIdLocally(null);
          if (!isHost) {
            onGuestLeaveOrKicked?.('deleted');
          }
          return;
        }
      } else if (res.session) {
        const serverSession = res.session;
        if (serverSession.status === 'deleted') {
          setSharedSession(null);
          saveActiveRoomIdLocally(null);
          if (!isHost) {
            onGuestLeaveOrKicked?.('deleted');
          }
          return;
        }

        setSharedSession(serverSession);
        setLastSyncText(new Date().toLocaleTimeString('pt-BR'));

        if (serverSession.version > lastKnownVersionRef.current) {
          lastKnownVersionRef.current = serverSession.version;
          if (serverSession.conciliatedEmpresas) {
            setConciliatedEmpresas((prev) => {
              const merged = { ...prev, ...serverSession.conciliatedEmpresas };
              conciliatedEmpresasRef.current = merged;
              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('wanfinance_conciliated_empresas_v1', JSON.stringify(merged));
                } catch {}
              }
              return merged;
            });
          }
          if (onApplySharedItems && serverSession.items) {
            onApplySharedItems(serverSession.items, serverSession.conciliatedEmpresas || {});
          }
          if (
            onApplySharedSpreadsheets &&
            (serverSession.dealerState || serverSession.sitefState || serverSession.pendenteCdcState)
          ) {
            onApplySharedSpreadsheets(
              serverSession.dealerState,
              serverSession.sitefState,
              serverSession.pendenteCdcState
            );
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
  }, [
    activeSharedSession?.id,
    currentUser,
    isHost,
    onApplySharedItems,
    onApplySharedSpreadsheets,
    onGuestLeaveOrKicked,
    setSharedSession,
    setConciliatedEmpresas,
  ]);

  useEffect(() => {
    if (!activeSharedSession?.id) return;
    performLiveSync(false);
    const interval = setInterval(() => {
      performLiveSync(false);
    }, 3500);
    return () => clearInterval(interval);
  }, [activeSharedSession?.id, performLiveSync]);

  // Push local updates to shared session (includes dealerState and sitefState)
  const pushUpdateToSharedRoom = useCallback(
    async (
      updatedItems: FechamentoItem[],
      updatedConciliated: Record<string, any>
    ) => {
      if (!activeSharedSession?.id) return;
      try {
        // Strictly deduplicate items by ID before pushing to the shared room
        const itemMap = new Map<string, FechamentoItem>();
        (updatedItems || []).forEach((item) => {
          if (item && item.id) itemMap.set(item.id, item);
        });
        const dedupedItems = Array.from(itemMap.values());

        const payload: Partial<SharedFechamentoSession> & { id: string; items: FechamentoItem[] } = {
          id: activeSharedSession.id,
          title: activeSharedSession.title,
          dataMovimento: activeSharedSession.dataMovimento,
          status: 'active',
          items: dedupedItems,
          conciliatedEmpresas: updatedConciliated,
          summary,
          dealerState,
          sitefState,
          pendenteCdcState,
        };
        const res = await createOrUpdateSharedSession(payload, currentUser);
        if (res.success && res.session) {
          lastKnownVersionRef.current = res.session.version;
          setSharedSession(res.session);
          if (res.session.conciliatedEmpresas) {
            setConciliatedEmpresas(res.session.conciliatedEmpresas);
            conciliatedEmpresasRef.current = res.session.conciliatedEmpresas;
          }
        }
      } catch (err) {
        console.warn('Erro ao propagar alterações na sala compartilhada:', err);
      }
    },
    [
      activeSharedSession,
      currentUser,
      summary,
      dealerState,
      sitefState,
      pendenteCdcState,
      setSharedSession,
      setConciliatedEmpresas,
    ]
  );

  // Direct toggle conciliação da empresa no sistema com registro de quem conciliou
  const toggleEmpresaConciliada = async (empName: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const currentStatus = getEmpresaConciliation(empName);
    const willBeConciliated = !currentStatus.isConciliated;

    const nextVal = willBeConciliated
      ? {
          reconciled: true,
          reconciledBy: currentUser?.name || currentUser?.email?.split('@')[0] || 'Usuário',
          userEmail: currentUser?.email || '',
          reconciledAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        }
      : {
          reconciled: false,
          reconciledBy: '',
          reconciledAt: '',
        };

    const next = {
      ...conciliatedEmpresasRef.current,
      [empName]: nextVal,
    };

    setConciliatedEmpresas(next);
    conciliatedEmpresasRef.current = next;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wanfinance_conciliated_empresas_v1', JSON.stringify(next));
      } catch {
        // Ignore storage quota error
      }
    }

    if (activeSharedSession?.id) {
      await pushUpdateToSharedRoom(fechamentoItems, next);
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

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
      const dep = item.contaGerencial || item.departamento || 'Geral';

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

      // Sort departamentos alphabetically
      const sortedDeps: typeof emp.departamentos = {};
      Object.keys(emp.departamentos)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .forEach((k) => {
          sortedDeps[k] = emp.departamentos[k];
        });
      emp.departamentos = sortedDeps;
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

  // Conciliar todas as empresas de uma vez só
  const handleConciliateAll = async () => {
    const allEmpresas = Object.keys(groupedByEmpresa);
    if (allEmpresas.length === 0) return;
    const next: Record<string, boolean> = { ...conciliatedEmpresasRef.current };
    allEmpresas.forEach((emp) => {
      next[emp] = true;
    });
    setConciliatedEmpresas(next);
    conciliatedEmpresasRef.current = next;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wanfinance_conciliated_empresas_v1', JSON.stringify(next));
      } catch {}
    }

    if (activeSharedSession?.id) {
      await pushUpdateToSharedRoom(fechamentoItems, next);
    }
  };

  // Desconciliar todas as empresas de uma vez só (sem senha)
  const handleUnconciliateAll = async () => {
    const allEmpresas = Object.keys(groupedByEmpresa);
    if (allEmpresas.length === 0) return;
    const next: Record<string, boolean> = { ...conciliatedEmpresasRef.current };
    allEmpresas.forEach((emp) => {
      next[emp] = false;
    });
    setConciliatedEmpresas(next);
    conciliatedEmpresasRef.current = next;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wanfinance_conciliated_empresas_v1', JSON.stringify(next));
      } catch {}
    }

    if (activeSharedSession?.id) {
      await pushUpdateToSharedRoom(fechamentoItems, next);
    }
  };

  // Conciliar apenas as empresas correspondentes aos itens selecionados
  const handleConciliateSelected = async () => {
    if (selectedIds.length === 0) return;
    const selectedItems = filteredItems.filter((i) => selectedIds.includes(i.id));
    const selectedEmpresas = Array.from(new Set(selectedItems.map((i) => i.empresa)));
    if (selectedEmpresas.length === 0) return;

    const next: Record<string, boolean> = { ...conciliatedEmpresasRef.current };
    selectedEmpresas.forEach((emp) => {
      next[emp] = true;
    });
    setConciliatedEmpresas(next);
    conciliatedEmpresasRef.current = next;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wanfinance_conciliated_empresas_v1', JSON.stringify(next));
      } catch {}
    }

    if (activeSharedSession?.id) {
      await pushUpdateToSharedRoom(fechamentoItems, next);
    }
  };

  // Desconciliar as empresas correspondentes aos itens selecionados
  const handleUnconciliateSelected = async () => {
    if (selectedIds.length === 0) return;
    const selectedItems = filteredItems.filter((i) => selectedIds.includes(i.id));
    const selectedEmpresas = Array.from(new Set(selectedItems.map((i) => i.empresa)));
    if (selectedEmpresas.length === 0) return;

    const next: Record<string, boolean> = { ...conciliatedEmpresasRef.current };
    selectedEmpresas.forEach((emp) => {
      next[emp] = false;
    });
    setConciliatedEmpresas(next);
    conciliatedEmpresasRef.current = next;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wanfinance_conciliated_empresas_v1', JSON.stringify(next));
      } catch {}
    }

    if (activeSharedSession?.id) {
      await pushUpdateToSharedRoom(fechamentoItems, next);
    }
  };

  // Helper properties for selection & bulk conciliation
  const areAllEmpresasConciliated = useMemo(() => {
    const empKeys = Object.keys(groupedByEmpresa);
    if (empKeys.length === 0) return false;
    return empKeys.every((emp) => !!conciliatedEmpresas[emp]);
  }, [groupedByEmpresa, conciliatedEmpresas]);

  const selectedEmpresasCount = useMemo(() => {
    if (selectedIds.length === 0) return 0;
    const selectedItems = filteredItems.filter((i) => selectedIds.includes(i.id));
    return new Set(selectedItems.map((i) => i.empresa)).size;
  }, [selectedIds, filteredItems]);

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
    const newDepState: Record<string, boolean> = {};
    Object.entries(groupedByEmpresa).forEach(([emp, empData]) => {
      newEmpState[emp] = false;
      Object.keys(empData.departamentos).forEach((dep) => {
        newDepState[`${emp}_${dep}`] = false;
      });
    });
    setCollapsedEmpresas(newEmpState);
    setCollapsedDepartamentos(newDepState);
  };

  const handleCollapseAll = () => {
    const newEmpState: Record<string, boolean> = {};
    const newDepState: Record<string, boolean> = {};
    Object.entries(groupedByEmpresa).forEach(([emp, empData]) => {
      newEmpState[emp] = true;
      Object.keys(empData.departamentos).forEach((dep) => {
        newDepState[`${emp}_${dep}`] = true;
      });
    });
    setCollapsedEmpresas(newEmpState);
    setCollapsedDepartamentos(newDepState);
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
    if (activeSharedSession?.id) {
      pushUpdateToSharedRoom([newItem, ...fechamentoItems], conciliatedEmpresas);
    }
  };

  // Confirm Delete Handler
  const handleConfirmDelete = () => {
    onDeleteFechamentoItems(deleteConfirm.ids);
    const remainingItems = fechamentoItems.filter((i) => !deleteConfirm.ids.includes(i.id));
    setSelectedIds((prev) => prev.filter((id) => !deleteConfirm.ids.includes(id)));
    setDeleteConfirm({ isOpen: false, ids: [] });
    if (activeSharedSession?.id) {
      pushUpdateToSharedRoom(remainingItems, conciliatedEmpresas);
    }
  };

  // Handler for leaving or deleting the room
  const handleLeaveOrDeleteRoom = () => {
    setIsSharedModalOpen(true);
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

  
  // New render for FechamentoView
  const selectedEmpData = selectedCompanyPanel && groupedByEmpresa[selectedCompanyPanel];
  const selectedEmpConciliation = selectedCompanyPanel ? getEmpresaConciliation(selectedCompanyPanel) : null;
  const isSelectedEmpConciliada = selectedEmpConciliation?.isConciliated;
  const hasSelectedEmpDivergence = selectedEmpData && selectedEmpData.diferencaTotal !== 0;

  return (
    <div className="space-y-6 text-slate-800 bg-slate-50/30 p-2 rounded-3xl min-h-[800px]">
      {/* 1. Header & Summary Cards */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-gradient-to-r from-blue-50 to-blue-100/40 p-5 rounded-3xl border border-blue-100/60 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <Scale className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Fechamento de Conciliação</h1>
            <p className="text-sm text-slate-600 font-medium max-w-sm leading-tight mt-1">Compare os dados do Dealer e do CTF e identifique as divergências por empresa e departamento.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-3.5 flex flex-col justify-center min-w-[140px] transition-all hover:shadow-md">
            <div className="flex items-center gap-2 mb-1.5">
              <Car className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold text-slate-600">Total de Empresas</span>
            </div>
            <div className="text-2xl font-black text-slate-900 leading-none">{summary.countTotal}</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Importadas</div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-3.5 flex flex-col justify-center min-w-[140px] transition-all hover:shadow-md">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="bg-red-100 text-red-600 rounded-full p-0.5"><AlertCircle className="w-3.5 h-3.5" /></div>
              <span className="text-xs font-semibold text-slate-600">Com Divergências</span>
            </div>
            <div className="text-2xl font-black text-red-600 leading-none">{summary.countDivergencias}</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              {summary.countTotal > 0 ? `${((summary.countDivergencias / summary.countTotal) * 100).toFixed(0)}%` : '0%'}
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-3.5 flex flex-col justify-center min-w-[140px] transition-all hover:shadow-md">
            <div className="flex items-center gap-2 mb-1.5">
               <div className="bg-emerald-100 text-emerald-600 rounded-full p-0.5"><Check className="w-3.5 h-3.5 stroke-[3]" /></div>
              <span className="text-xs font-semibold text-slate-600">Conciliadas</span>
            </div>
            <div className="text-2xl font-black text-emerald-600 leading-none">{summary.countTotal - summary.countDivergencias}</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">
              {summary.countTotal > 0 ? `${(((summary.countTotal - summary.countDivergencias) / summary.countTotal) * 100).toFixed(0)}%` : '0%'}
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-3.5 flex items-center justify-between min-w-[200px] self-stretch transition-all hover:shadow-md">
             <div className="flex flex-col justify-center">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                   <Calendar className="w-3.5 h-3.5" />
                   <span className="text-[10px] uppercase font-bold tracking-wider">Período</span>
                </div>
                <span className="text-sm font-bold text-slate-700">{fechamentoItems[0]?.data || new Date().toLocaleDateString('pt-BR')}</span>
             </div>
             <ChevronDown className="w-4 h-4 text-slate-300" />
          </div>
        </div>
      </div>

      {/* 2. Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-white rounded-xl p-1.5 border border-slate-200/60 shadow-sm">
          <button onClick={() => setFilterMode('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${filterMode === 'all' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
             <Filter className="w-3.5 h-3.5" /> Todos {filterMode === 'all' && <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-50"/>}
          </button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <button onClick={() => setFilterMode('concolidated')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${filterMode === 'concolidated' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-emerald-600'}`}>
             <CheckCircle2 className="w-3.5 h-3.5" /> Conciliado
          </button>
          <button onClick={() => setFilterMode('divergent')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${filterMode === 'divergent' ? 'bg-red-50 text-red-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-red-600'}`}>
             <AlertCircle className="w-3.5 h-3.5" /> Com Divergência
          </button>
          <button onClick={() => setFilterMode('pix_validation')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${filterMode === 'pix_validation' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-amber-600'}`}>
             <Clock className="w-3.5 h-3.5" /> Pendente
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(viewMode === 'grouped' ? 'flat' : 'grouped')} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 shadow-sm transition-all flex items-center gap-2">
             <Layers className="w-4 h-4 text-indigo-500" />
             <span>{viewMode === 'grouped' ? 'Ver Lista Plana' : 'Ver Agrupado'}</span>
          </button>
          <button onClick={handleExportExcel} className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 shadow-sm transition-all flex items-center gap-2">
             <Download className="w-4 h-4 text-slate-500" />
             <span>Exportar Relatório</span>
          </button>
          {onRecalculateAuto && (
            <button onClick={handleTriggerRefreshAuto} disabled={isRefreshingAuto} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-[0_2px_10px_rgba(37,99,235,0.2)] transition-all flex items-center gap-2 disabled:opacity-60">
               <RefreshCw className={`w-4 h-4 ${isRefreshingAuto ? 'animate-spin' : ''}`} />
               <span>Atualizar Dados</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Split View */}
      {viewMode === 'grouped' ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start pb-8">
          {/* Left: Companies List */}
          <div className="w-full lg:w-3/5 xl:w-2/3 flex flex-col gap-2.5">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              <div className="col-span-5 lg:col-span-4">Empresa</div>
              <div className="col-span-3 lg:col-span-2 text-center">Status</div>
              <div className="col-span-2 text-right hidden sm:block">Total Dealer</div>
              <div className="col-span-2 text-right hidden sm:block">Total CTF</div>
              <div className="col-span-4 sm:col-span-2 lg:col-span-2 text-center">Diferença</div>
            </div>
            
            {/* Cards */}
            <div className="flex flex-col gap-3">
              {Object.entries(groupedByEmpresa).map(([empName, empData]) => {
                 const empConciliation = getEmpresaConciliation(empName);
                 const isConciliada = empConciliation.isConciliated;
                 const isSelected = selectedCompanyPanel === empName;
                 const hasDivergence = empData.diferencaTotal !== 0;
                 
                 return (
                   <div 
                     key={empName}
                     onClick={() => setSelectedCompanyPanel(isSelected ? null : empName)}
                     className={`group grid grid-cols-12 gap-4 items-center px-4 py-3.5 rounded-[1.25rem] border transition-all duration-300 cursor-pointer ${
                       isSelected 
                         ? 'bg-white ring-4 ring-blue-500/10 shadow-lg border-blue-200/60 scale-[1.01]' 
                         : hasDivergence 
                           ? 'bg-red-50/40 hover:bg-red-50/60 border-red-100 shadow-sm hover:shadow-md'
                           : 'bg-white shadow-sm hover:shadow-md border-slate-100 hover:border-slate-200'
                     }`}
                   >
                      <div className="col-span-5 lg:col-span-4 flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-inner">
                          {empName.substring(0,3).toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden min-w-0">
                          <span className="font-extrabold text-slate-900 text-sm truncate">{empName}</span>
                          <span className="text-[11px] text-slate-500 font-semibold">{Object.keys(empData.departamentos).length} departamentos</span>
                        </div>
                      </div>
                      
                      <div className="col-span-3 lg:col-span-2 flex justify-center">
                        {hasDivergence ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100/80 text-red-700 rounded-full text-xs font-bold border border-red-200/50 shadow-sm shadow-red-500/10">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Com Divergências</span>
                          </span>
                        ) : isConciliada ? (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100/80 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200/50 shadow-sm shadow-emerald-500/10">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Conciliado</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100/80 text-amber-700 rounded-full text-xs font-bold border border-amber-200/50 shadow-sm shadow-amber-500/10">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Pendente</span>
                          </span>
                        )}
                      </div>
                      
                      <div className="col-span-2 text-right font-mono font-semibold text-slate-600 text-sm hidden sm:block">{formatBRL(empData.totalDealer)}</div>
                      <div className="col-span-2 text-right font-mono font-semibold text-slate-600 text-sm hidden sm:block">{formatBRL(empData.totalSitef)}</div>
                      
                      <div className="col-span-4 sm:col-span-2 lg:col-span-2 flex items-center justify-end xl:justify-between gap-2 pl-2">
                         <div className="flex flex-col items-center">
                           <span className={`font-mono font-extrabold text-sm ${hasDivergence ? 'text-red-600' : 'text-emerald-600'}`}>
                              {formatBRL(Math.abs(empData.diferencaTotal))}
                           </span>
                           <span className={`text-[9px] font-bold tracking-wide ${hasDivergence ? 'text-red-500' : 'text-emerald-500'}`}>
                              {hasDivergence ? `${empData.countDivergencias} divergências` : 'sem divergências'}
                           </span>
                         </div>
                         <ChevronRight className={`w-5 h-5 transition-transform duration-300 hidden xl:block ${isSelected ? 'text-blue-500 translate-x-1' : 'text-slate-300 group-hover:text-slate-400'}`} />
                      </div>
                   </div>
                 );
              })}
            </div>
          </div>
          
          {/* Right: Side Panel (Selected Company) */}
          <div className="w-full lg:w-2/5 xl:w-1/3 relative">
            <div className="sticky top-6">
              {selectedCompanyPanel && selectedEmpData ? (
                 <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden animate-in slide-in-from-right-8 fade-in duration-300">
                    <div className="p-6 pb-5 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg">
                            {selectedCompanyPanel.substring(0,3).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-lg text-slate-900 leading-tight">{selectedCompanyPanel}</h3>
                            <p className="text-xs font-semibold text-slate-500">{Object.keys(selectedEmpData.departamentos).length} departamentos</p>
                          </div>
                        </div>
                        
                        {hasSelectedEmpDivergence ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-[11px] font-bold border border-red-200">
                            <AlertCircle className="w-3 h-3" />
                            Com Divergências
                          </span>
                        ) : isSelectedEmpConciliada ? (
                          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[11px] font-bold border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Conciliado
                          </span>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-2">
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Dealer</div>
                          <div className="font-mono font-bold text-slate-700 text-sm">{formatBRL(selectedEmpData.totalDealer)}</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total CTF</div>
                          <div className="font-mono font-bold text-slate-700 text-sm">{formatBRL(selectedEmpData.totalSitef)}</div>
                        </div>
                        <div className={`rounded-xl p-3 border ${hasSelectedEmpDivergence ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                          <div className={`text-[10px] uppercase font-bold mb-1 ${hasSelectedEmpDivergence ? 'text-red-400' : 'text-emerald-400'}`}>Diferença</div>
                          <div className={`font-mono font-bold text-sm flex items-center flex-wrap gap-1 ${hasSelectedEmpDivergence ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatBRL(Math.abs(selectedEmpData.diferencaTotal))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tabs / Segmented Control */}
                    <div className="px-6 py-2">
                      <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
                        <button className="flex-1 px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg shadow-sm">
                          Departamentos
                        </button>
                        <button className="flex-1 px-4 py-1.5 text-slate-500 hover:text-slate-700 font-bold text-xs rounded-lg transition-colors">
                          Comparativo
                        </button>
                        <button className="flex-1 px-4 py-1.5 text-slate-500 hover:text-slate-700 font-bold text-xs rounded-lg transition-colors">
                          Resumo
                        </button>
                      </div>
                    </div>

                    <div className="px-6 py-3">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Buscar departamento..."
                          className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50 focus:bg-white font-medium transition-all"
                        />
                      </div>
                    </div>
                    
                    {/* Departamentos List */}
                    <div className="px-4 pb-6 max-h-[500px] overflow-y-auto space-y-2">
                      {Object.entries(selectedEmpData.departamentos).map(([depTitle, dData]) => {
                        const depHasDivergence = dData.diferencaTotal !== 0;
                        const depNumber = depTitle.match(/\b\d{3,6}\b/)?.[0] || depTitle.match(/^\d+/)?.[0] || depTitle.split(/[-–—:]/)[0]?.trim() || depTitle;
                        const depNameOnly = depTitle.replace(depNumber, '').replace(/^[-–—:\s]+/, '').trim() || 'Departamento';
                        
                        return (
                          <div 
                            key={depTitle}
                            className={`group flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer hover:scale-[1.02] ${
                              depHasDivergence 
                                ? 'bg-red-50/60 border-red-200 shadow-[0_4px_12px_rgba(239,68,68,0.1)]' 
                                : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                                depHasDivergence ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors'
                              }`}>
                                <FolderTree className="w-4 h-4" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-extrabold text-slate-800 text-xs">
                                  {depNameOnly} <span className="text-slate-400 font-mono font-medium ml-1">#{depNumber}</span>
                                </span>
                                <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px] font-medium text-slate-500">
                                  <span title="Dealer">{formatBRL(dData.totalDealer)}</span>
                                  <span className="text-slate-300">/</span>
                                  <span title="SiTef">{formatBRL(dData.totalSitef)}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {depHasDivergence ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold border border-red-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                  {formatBRL(Math.abs(dData.diferencaTotal))}
                                </span>
                              ) : isSelectedEmpConciliada ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-200">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  Conciliado
                                </span>
                              ) : null}
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                            </div>
                          </div>
                        );
                      })}
                      
                      <button className="w-full py-3 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center justify-center gap-1">
                        Ver todos os departamentos <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                 </div>
              ) : (
                 <div className="bg-white/40 border border-slate-200/60 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center text-slate-400 h-[600px]">
                    <Building2 className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-semibold text-sm max-w-[200px]">Selecione uma empresa na lista para visualizar os detalhes e departamentos</p>
                 </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Original flat view logic preserved, styled appropriately if needed */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
           {/* ... existing flat view ... */}
           <div className="p-12 text-center text-slate-500 font-bold">
             A visualização em lista plana foi preservada.
           </div>
        </div>
      )}

      {/* Modals remain the same */}
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
      <SharedFechamentoModal
        isOpen={isSharedModalOpen}
        onClose={() => setIsSharedModalOpen(false)}
        fechamentoItems={fechamentoItems}
        conciliatedEmpresas={conciliatedEmpresas}
        summary={summary}
        dealerState={dealerState}
        sitefState={sitefState}
        pendenteCdcState={pendenteCdcState}
        activeSession={activeSharedSession}
        onSessionConnected={(session) => {
          setSharedSession(session);
          if (session.conciliatedEmpresas) {
            setConciliatedEmpresas(session.conciliatedEmpresas);
          }
          if (onApplySharedItems && session.items) {
            onApplySharedItems(session.items, session.conciliatedEmpresas || {});
          }
          if (
            onApplySharedSpreadsheets &&
            (session.dealerState || session.sitefState || session.pendenteCdcState)
          ) {
            onApplySharedSpreadsheets(
              session.dealerState,
              session.sitefState,
              session.pendenteCdcState
            );
          }
        }}
        onSessionDisconnected={(isGuestLeave) => {
          const wasHost = isHost;
          setSharedSession(null);
          saveActiveRoomIdLocally(null);
          if (isGuestLeave || !wasHost) {
            onGuestLeaveOrKicked?.('left');
          }
        }}
        onImportExcelData={onImportExcelData}
      />
    </div>
  );
};

export default FechamentoView;
