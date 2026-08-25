'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  SharedFechamentoSession,
  createOrUpdateSharedSession,
  fetchSharedSession,
  listActiveSharedSessions,
  deleteSharedSession,
  generateRoomCode,
  extractRoomCode,
  saveActiveRoomIdLocally,
  getSessionTimeRemaining,
  isSessionExpired,
} from '@/lib/shared-fechamento-service';
import { FechamentoItem } from '@/lib/fechamento-utils';
import { UserProfile } from '@/types/audit';
import { getCurrentUser } from '@/lib/auth-service';
import { exportFechamentoToExcel, importFechamentoFromExcel } from '@/lib/fechamento-excel-io';
import {
  Share2,
  Copy,
  Check,
  Globe,
  Radio,
  RefreshCw,
  X,
  Plus,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Clock,
  MessageCircle,
  Mail,
  Link2,
  CheckCircle2,
  Eye,
  Info,
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  Lock,
} from 'lucide-react';

interface SharedFechamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  fechamentoItems: FechamentoItem[];
  conciliatedEmpresas: Record<string, boolean>;
  summary: {
    totalDealer: number;
    totalSitef: number;
    diferencaTotal: number;
    countTotal: number;
    countDivergencias: number;
    countConciliados: number;
    countPixValidacao: number;
  };
  dealerState?: any;
  sitefState?: any;
  pendenteCdcState?: any;
  activeSession: SharedFechamentoSession | null;
  onSessionConnected: (session: SharedFechamentoSession) => void;
  onSessionDisconnected: (isGuestLeave?: boolean) => void;
  onManualSync?: () => void;
  onImportExcelData?: (importedData: any) => void;
}

export function SharedFechamentoModal({
  isOpen,
  onClose,
  fechamentoItems,
  conciliatedEmpresas,
  summary,
  dealerState,
  sitefState,
  pendenteCdcState,
  activeSession,
  onSessionConnected,
  onSessionDisconnected,
  onImportExcelData,
}: SharedFechamentoModalProps) {
  const [activeTab, setActiveTab] = useState<'share' | 'join' | 'excel'>('share');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeRoomsList, setActiveRoomsList] = useState<SharedFechamentoSession[]>([]);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isImportingFile, setIsImportingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentUser: UserProfile = getCurrentUser();

  const isHost = activeSession
    ? activeSession.createdBy.id === currentUser.id ||
      activeSession.createdBy.email === currentUser.email ||
      currentUser.role === 'admin'
    : true;

  // Real-time time remaining calculation
  const [timeRemaining, setTimeRemaining] = useState(getSessionTimeRemaining(activeSession));

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => {
      const remaining = getSessionTimeRemaining(activeSession);
      setTimeRemaining(remaining);
      if (remaining.isExpired) {
        setErrorMsg('Este link de compartilhamento atingiu o tempo limite de 8 horas e foi expirado.');
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Load active rooms when modal opens
  const loadRooms = async () => {
    try {
      const rooms = await listActiveSharedSessions();
      setActiveRoomsList(rooms);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRooms();
      setErrorMsg(null);
      setSuccessMsg(null);
      if (activeSession) {
        setActiveTab('share');
        setTimeRemaining(getSessionTimeRemaining(activeSession));
      }
    }
  }, [isOpen, activeSession]);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareableLink = activeSession ? `${currentUrl}/?sala=${activeSession.id}` : '';

  const handleCopyLink = () => {
    if (!shareableLink) return;
    navigator.clipboard.writeText(shareableLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    if (!activeSession) return;
    navigator.clipboard.writeText(activeSession.id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const handleShareWhatsApp = () => {
    if (!shareableLink || !activeSession) return;
    const timeText = timeRemaining.isExpired ? 'Expirado' : timeRemaining.formatted;
    const msg =
      `*Fechamento de Conciliação - Wanfinance*\n` +
      `Olá! Segue o link com a cópia segura do Fechamento de Caixa do dia *${activeSession.dataMovimento || ''}*:\n\n` +
      `🔗 *Acessar Fechamento:* ${shareableLink}\n` +
      `🔑 *Código da Cópia:* ${activeSession.id}\n` +
      `⏳ *Validade do Link:* 8 horas (${timeText})\n\n` +
      `📊 *Total Dealer:* ${formatBRL(activeSession.summary?.totalDealer || 0)}\n` +
      `💳 *Total SiTef:* ${formatBRL(activeSession.summary?.totalSitef || 0)}\n` +
      `⚠️ *Divergências:* ${activeSession.summary?.countDivergencias || 0}\n\n` +
      `_Enviado por ${currentUser.name} (${currentUser.empresa})_`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const handleShareEmail = () => {
    if (!shareableLink || !activeSession) return;
    const timeText = timeRemaining.isExpired ? 'Expirado' : timeRemaining.formatted;
    const subject = `Link de Fechamento de Caixa (Cópia Segura 8h) - ${activeSession.dataMovimento || 'Wanfinance'}`;
    const body =
      `Olá,\n\nSegue o link para visualização do Fechamento de Caixa de Conciliação:\n\n` +
      `Link Direto: ${shareableLink}\n` +
      `Código de Acesso: ${activeSession.id}\n` +
      `Validade: 8 horas (${timeText}) - após esse período o link expira automaticamente por segurança.\n` +
      `Data do Movimento: ${activeSession.dataMovimento}\n\n` +
      `Resumo Financeiro:\n` +
      `- Total Dealer: ${formatBRL(activeSession.summary?.totalDealer || 0)}\n` +
      `- Total SiTef: ${formatBRL(activeSession.summary?.totalSitef || 0)}\n` +
      `- Diferença: ${formatBRL(activeSession.summary?.diferencaTotal || 0)}\n` +
      `- Divergências Pendentes: ${activeSession.summary?.countDivergencias || 0}\n\n` +
      `Ao acessar, você terá uma cópia completa de todos os lançamentos e status das 52 empresas sem risco de concorrência ou conflitos online.\n\n` +
      `Atenciosamente,\n${currentUser.name} (${currentUser.empresa})`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  };

  // Generate new 8-hour snapshot link
  const handleCreateSnapshotLink = async (autoCopy = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const code = generateRoomCode();
      const defaultDate =
        fechamentoItems[0]?.data || new Date().toLocaleDateString('pt-BR');

      const now = Date.now();
      const expiresAt = new Date(now + 8 * 60 * 60 * 1000).toISOString();

      const newSession: Partial<SharedFechamentoSession> & { id: string; items: FechamentoItem[] } = {
        id: code,
        title: `Fechamento de Caixa - ${defaultDate}`,
        dataMovimento: defaultDate,
        status: 'active',
        items: fechamentoItems,
        conciliatedEmpresas,
        summary,
        dealerState,
        sitefState,
        pendenteCdcState,
        version: 1,
        expiresAt,
      };

      const res = await createOrUpdateSharedSession(newSession, currentUser);
      if (res.success && res.session) {
        onSessionConnected(res.session);
        setTimeRemaining(getSessionTimeRemaining(res.session));
        loadRooms();
        if (autoCopy && typeof window !== 'undefined') {
          const newLink = `${window.location.origin}/?sala=${res.session.id}`;
          navigator.clipboard.writeText(newLink);
          setCopiedLink(true);
          setSuccessMsg(`Link seguro gerado com sucesso (Válido por 8 horas): ${res.session.id}`);
          setTimeout(() => {
            setCopiedLink(false);
            setSuccessMsg(null);
          }, 4000);
        } else {
          setSuccessMsg(`Link de fechamento gerado com sucesso! Válido por 8 horas.`);
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      } else {
        setErrorMsg(res.error || 'Não foi possível gerar o link de compartilhamento.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao gerar link de compartilhamento');
    } finally {
      setIsLoading(false);
    }
  };

  // Join/Import snapshot by code or link
  const handleJoinSnapshot = async (codeToJoin?: string) => {
    const rawInput = codeToJoin || joinCodeInput;
    const cleanCode = extractRoomCode(rawInput);
    if (!cleanCode) {
      setErrorMsg('Informe um código de fechamento ou link válido (ex: FC-93641).');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchSharedSession(cleanCode, currentUser);
      if (res.success && res.session) {
        if (isSessionExpired(res.session)) {
          setErrorMsg('Este link de fechamento expirou (validade máxima de 8 horas ultrapassada).');
          return;
        }
        onSessionConnected(res.session);
        setTimeRemaining(getSessionTimeRemaining(res.session));
        setSuccessMsg(`Cópia do fechamento "${res.session.id}" carregada com sucesso na sua tela!`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.error || `Link "${cleanCode}" não encontrado ou já expirou.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar link');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete/Invalidate link immediately
  const handleDeleteSnapshot = async () => {
    if (!activeSession) return;
    setIsDeletingRoom(true);
    try {
      const res = await deleteSharedSession(activeSession.id, currentUser);
      if (res.success) {
        onSessionDisconnected(false);
        saveActiveRoomIdLocally('');
        loadRooms();
        setSuccessMsg('Link de compartilhamento excluído e invalidado com sucesso.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || 'Não foi possível excluir o link');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir link');
    } finally {
      setIsDeletingRoom(false);
      setConfirmDeleteOpen(false);
    }
  };

  // Export full Excel backup (.xlsx)
  const handleExportFullExcel = () => {
    exportFechamentoToExcel({
      items: fechamentoItems,
      conciliatedEmpresas,
      dealerState,
      sitefState,
      pendenteCdcState,
      summary,
      dataMovimento: fechamentoItems[0]?.data || new Date().toLocaleDateString('pt-BR'),
      operador: currentUser.name,
      observacoes: 'Backup completo para importação e restauração exata no Wanfinance',
    });
    setSuccessMsg('Arquivo Excel (.xlsx) de backup baixado com sucesso!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Import full Excel backup (.xlsx)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingFile(true);
    setErrorMsg(null);
    try {
      const res = await importFechamentoFromExcel(file);
      if (res.success && res.data) {
        if (onImportExcelData) {
          onImportExcelData(res.data);
        }
        setSuccessMsg(`Fechamento restaurado com sucesso do Excel! (${res.data.items.length} lançamentos recuperados)`);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res.error || 'Falha ao importar o arquivo Excel.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao ler arquivo Excel');
    } finally {
      setIsImportingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-750 text-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-750/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white tracking-tight">
                  Encaminhar Fechamento & Arquivo Excel
                </h3>
                {activeSession ? (
                  <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    LINK ATIVO ({activeSession.id})
                  </span>
                ) : (
                  <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    SEM LINK ATIVO
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Gere link de cópia segura com validade de 8h (sem conflitos) ou exporte/importe em Excel.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Header */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-5 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('share')}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'share'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Gerar Link (8 Horas)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('join');
              loadRooms();
            }}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'join'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Abrir Link / Código ({activeRoomsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('excel')}
            className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'excel'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Baixar / Restaurar Excel (.xlsx)</span>
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              {successMsg}
            </span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              {errorMsg}
            </span>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 1: Current Session / Share Link (8h) */}
        {activeTab === 'share' && (
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Rule of 8 hours and isolated snapshot explanation */}
            <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-xs text-white">
                    Compartilhamento Seguro (Snapshot Estático)
                  </h4>
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-2 py-0.2 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Validade: 8 Horas
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Quem receber o link terá acesso a uma <strong>cópia integral e isolada</strong> de todo o fechamento (Dealer, SiTef, CDC e 52 empresas). Não há sincronização concorrente online, garantindo <strong>zero conflitos</strong> de tela. Após <strong>8 horas</strong>, o link expira e é excluído automaticamente.
                </p>
              </div>
            </div>

            {activeSession ? (
              <div className="space-y-4">
                {/* Active Snapshot Card */}
                <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Código do Fechamento
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-2xl font-black text-emerald-400 bg-slate-900/90 px-3 py-1 rounded-xl border border-emerald-500/30 tracking-widest">
                          {activeSession.id}
                        </span>
                        <button
                          onClick={handleCopyCode}
                          className="p-2 bg-slate-700 hover:bg-slate-650 text-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title="Copiar Código"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Tempo de Validade
                      </span>
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        <Clock className={`w-4 h-4 ${timeRemaining.isExpired ? 'text-rose-400' : 'text-amber-400'}`} />
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                          timeRemaining.isExpired
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {timeRemaining.formatted}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Criado por <strong>{activeSession.createdBy?.name}</strong> ({activeSession.dataMovimento})
                      </p>
                    </div>
                  </div>

                  {/* Share Action Box */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-850 p-4 rounded-2xl border border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-extrabold text-xs text-white">
                          Link Direto para Encaminhar ao Usuário
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                        <Eye className="w-3 h-3 text-emerald-400" />
                        Acesso Imediato
                      </span>
                    </div>

                    {/* Shareable Link Box */}
                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-750 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-200 font-mono select-all truncate">{shareableLink}</span>
                      </div>
                      <button
                        onClick={handleCopyLink}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                      </button>
                    </div>

                    {/* Direct Quick Forward Channels */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={handleShareWhatsApp}
                        className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold rounded-xl border border-emerald-500/40 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        <span>Encaminhar no WhatsApp</span>
                      </button>

                      <button
                        onClick={handleShareEmail}
                        className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold rounded-xl border border-blue-500/40 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                      >
                        <Mail className="w-4 h-4 text-blue-400" />
                        <span>Encaminhar por E-mail</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Indicators */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-750 text-center">
                    <div className="bg-slate-900/50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400">Lançamentos</span>
                      <p className="text-xs font-bold text-white">{activeSession.items?.length || 0}</p>
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400">Total Dealer</span>
                      <p className="text-xs font-bold text-emerald-400">{formatBRL(activeSession.summary?.totalDealer || 0)}</p>
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400">Total SiTef</span>
                      <p className="text-xs font-bold text-blue-400">{formatBRL(activeSession.summary?.totalSitef || 0)}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  {/* Inline Confirmation for Deleting Room */}
                  {confirmDeleteOpen && (
                    <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-xl space-y-2 animate-in fade-in">
                      <p className="text-xs text-rose-200 font-bold">
                        ⚠️ Deseja excluir e invalidar este link de compartilhamento agora?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDeleteSnapshot}
                          disabled={isDeletingRoom}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isDeletingRoom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          <span>Sim, Excluir Link</span>
                        </button>
                        <button
                          onClick={() => setConfirmDeleteOpen(false)}
                          disabled={isDeletingRoom}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={() => handleCreateSnapshotLink(true)}
                      disabled={isLoading}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-60"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>Gerar Novo Link (Renovar 8h)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportFullExcel}
                        className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                        title="Baixar arquivo Excel de backup para importação posterior"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar Excel (.xlsx)</span>
                      </button>

                      {isHost && !confirmDeleteOpen && (
                        <button
                          onClick={() => setConfirmDeleteOpen(true)}
                          className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold rounded-xl border border-rose-500/40 text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Excluir Link</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* No Active Snapshot yet - Prompt to create */
              <div className="bg-slate-800/60 border border-slate-700 p-6 rounded-2xl text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                  <Link2 className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h4 className="font-extrabold text-base text-white">
                    Nenhum link de fechamento ativo no momento
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Clique no botão abaixo para gerar um link direto com a cópia exata do fechamento atual ({fechamentoItems.length} lançamentos e status das 52 empresas). O link terá <strong>validade de 8 horas</strong>.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => handleCreateSnapshotLink(true)}
                    disabled={isLoading || fechamentoItems.length === 0}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    <span>Gerar Link de Encaminhamento (8h)</span>
                  </button>

                  <button
                    onClick={handleExportFullExcel}
                    className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Baixar Arquivo Excel (.xlsx)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Join / Open Snapshot Link */}
        {activeTab === 'join' && (
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Input Form */}
            <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-3">
              <label className="block text-xs font-extrabold text-white">
                Colar Link de Fechamento ou Código (ex: FC-12345):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="https://.../?sala=FC-12345 ou FC-12345"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinSnapshot();
                  }}
                />
                <button
                  onClick={() => handleJoinSnapshot()}
                  disabled={isLoading || !joinCodeInput.trim()}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>Abrir Fechamento</span>
                </button>
              </div>
            </div>

            {/* Active Snapshots List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-300">
                  Links de Fechamento Disponíveis ({activeRoomsList.length})
                </span>
                <button
                  onClick={loadRooms}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar</span>
                </button>
              </div>

              {activeRoomsList.length === 0 ? (
                <div className="bg-slate-800/40 border border-slate-750 p-6 rounded-2xl text-center text-xs text-slate-400">
                  Nenhum link ativo encontrado no momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeRoomsList.map((room) => {
                    const isCurrent = activeSession?.id === room.id;
                    const rem = getSessionTimeRemaining(room);

                    return (
                      <div
                        key={room.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs text-emerald-400 bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-500/30">
                              {room.id}
                            </span>
                            <span className="font-bold text-xs text-white truncate">{room.title}</span>
                            <span className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-md font-bold flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {rem.formatted}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            Criado por <strong>{room.createdBy?.name}</strong> • Movimento: {room.dataMovimento} • {room.items?.length || 0} lançamentos
                          </p>
                        </div>

                        <button
                          onClick={() => handleJoinSnapshot(room.id)}
                          disabled={isLoading}
                          className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
                        >
                          <span>Carregar Cópia</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Excel Backup & Restore (.xlsx) */}
        {activeTab === 'excel' && (
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-xs text-white">
                  Backup e Restauração Fiel em Excel (.xlsx)
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Baixe o arquivo completo do fechamento contendo todas as 52 empresas, lançamentos de Dealer, SiTef e conciliações. Você pode reimportar este mesmo arquivo a qualquer momento para <strong>trazer as informações exatamente como foram criadas</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export Box */}
              <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Download className="w-5 h-5" />
                    <h5 className="font-extrabold text-xs text-white">Baixar Arquivo Excel</h5>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Gera a planilha com todas as abas (Fechamento, Status das 52 Empresas, Dealer e SiTef) e metadados de restauração 100% fiel.
                  </p>
                </div>
                <button
                  onClick={handleExportFullExcel}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Fechamento (.xlsx)</span>
                </button>
              </div>

              {/* Import Box */}
              <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Upload className="w-5 h-5" />
                    <h5 className="font-extrabold text-xs text-white">Importar Arquivo Excel</h5>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Selecione um arquivo <code>.xlsx</code> previamente exportado para recarregar todos os dados exatamente como foram salvos.
                  </p>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImportingFile}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isImportingFile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{isImportingFile ? 'Lendo Excel...' : 'Selecionar Arquivo (.xlsx)'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Wanfinance Fechamento Seguro • 8h TTL</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
