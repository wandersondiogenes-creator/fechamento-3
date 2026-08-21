'use client';

import React, { useState, useEffect } from 'react';
import {
  SharedFechamentoSession,
  SharedSpreadsheetPayload,
  createOrUpdateSharedSession,
  fetchSharedSession,
  listActiveSharedSessions,
  sendSharedSessionChatMessage,
  deleteSharedSession,
  leaveSharedSession,
  kickParticipantFromSession,
  generateRoomCode,
  extractRoomCode,
  saveActiveRoomIdLocally,
  clearActiveRoomLocally,
} from '@/lib/shared-fechamento-service';
import { FechamentoItem } from '@/lib/fechamento-utils';
import { UserProfile } from '@/types/audit';
import { getCurrentUser } from '@/lib/auth-service';
import {
  Users,
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
  MessageSquare,
  Send,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  LogOut,
  Trash2,
  UserX,
  Wifi,
  WifiOff,
  Clock,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
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
  dealerState?: SharedSpreadsheetPayload;
  sitefState?: SharedSpreadsheetPayload;
  pendenteCdcState?: SharedSpreadsheetPayload;
  activeSession: SharedFechamentoSession | null;
  onSessionConnected: (session: SharedFechamentoSession) => void;
  onSessionDisconnected: (isGuestLeaving?: boolean) => void;
  onManualSync: () => void;
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
  onManualSync,
}: SharedFechamentoModalProps) {
  const [activeTab, setActiveTab] = useState<'share' | 'join' | 'chat'>('share');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeRoomsList, setActiveRoomsList] = useState<SharedFechamentoSession[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  const currentUser: UserProfile = getCurrentUser();

  const isHost =
    activeSession?.createdBy?.id === currentUser.id ||
    activeSession?.createdBy?.email === currentUser.email ||
    currentUser.role === 'admin';

  // Load active rooms when tab is 'join' or modal opens
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

  // Create new shared session
  const handleCreateRoom = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const code = generateRoomCode();
      const defaultDate =
        fechamentoItems[0]?.data || new Date().toLocaleDateString('pt-BR');

      const newSession: Partial<SharedFechamentoSession> & { id: string } = {
        id: code,
        title: `Fechamento de Caixa - ${defaultDate}`,
        dataMovimento: defaultDate,
        status: 'active',
        items: fechamentoItems,
        conciliatedEmpresas,
        summary,
        dealerState: dealerState
          ? {
              fileName: dealerState.fileName,
              headers: dealerState.headers,
              columns: dealerState.columns,
              rawData: dealerState.rawData,
              processedData: dealerState.processedData,
              hasHeaderRow: dealerState.hasHeaderRow,
            }
          : undefined,
        sitefState: sitefState
          ? {
              fileName: sitefState.fileName,
              headers: sitefState.headers,
              columns: sitefState.columns,
              rawData: sitefState.rawData,
              processedData: sitefState.processedData,
              hasHeaderRow: sitefState.hasHeaderRow,
            }
          : undefined,
        pendenteCdcState: pendenteCdcState
          ? {
              fileName: pendenteCdcState.fileName,
              headers: pendenteCdcState.headers,
              columns: pendenteCdcState.columns,
              rawData: pendenteCdcState.rawData,
              processedData: pendenteCdcState.processedData,
              hasHeaderRow: pendenteCdcState.hasHeaderRow,
            }
          : undefined,
        version: 1,
      };

      const res = await createOrUpdateSharedSession(
        newSession,
        currentUser,
        'Criação da sala de fechamento compartilhada',
        'fechamento'
      );
      if (res.success && res.session) {
        onSessionConnected(res.session);
        loadRooms();
        setSuccessMsg(`Sala "${res.session.id}" criada com sucesso! Dealer, SiTef e Fechamento agora estão compartilhados em nuvem.`);
      } else {
        setErrorMsg(res.error || 'Não foi possível criar a sala compartilhada');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar sala');
    } finally {
      setIsLoading(false);
    }
  };

  // Join room by code
  const handleJoinRoom = async (codeToJoin?: string) => {
    const rawInput = codeToJoin || joinCodeInput;
    const cleanCode = extractRoomCode(rawInput);
    if (!cleanCode) {
      setErrorMsg('Informe o código da sala ou link de acesso válido (ex: FC-84920).');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchSharedSession(cleanCode, currentUser);
      if (res.success && res.session) {
        onSessionConnected(res.session);
        saveActiveRoomIdLocally(res.session.id);
        setActiveTab('share');
        setJoinCodeInput('');
        setSuccessMsg(`Conectado com sucesso à sala ${res.session.id}! Dados de Dealer, SiTef e Fechamento carregados.`);
      } else {
        setErrorMsg(res.error || `Sala "${cleanCode}" não encontrada ou expirada.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar à sala');
    } finally {
      setIsLoading(false);
    }
  };

  // Leave room (Participant Disconnect)
  const handleDisconnect = async () => {
    if (!activeSession) return;
    const userIsGuest = !isHost;
    
    setIsLoading(true);
    try {
      await leaveSharedSession(activeSession.id, currentUser);
    } catch {
      // ignore
    } finally {
      clearActiveRoomLocally();
      onSessionDisconnected(userIsGuest);
      setActiveTab('join');
      loadRooms();
      setIsLoading(false);
      onClose();
    }
  };

  // Delete Room (Host Admin)
  const handleDeleteRoom = async () => {
    if (!activeSession) return;
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente a sala "${activeSession.id}"?\n\n• Todos os participantes conectados terão a sala encerrada e os dados compartilhados sairão da tela deles.\n• Os dados permanecerão intactos na sua tela.`)) {
      return;
    }

    setIsDeletingRoom(true);
    setErrorMsg(null);
    try {
      const res = await deleteSharedSession(activeSession.id, currentUser);
      if (res.success) {
        clearActiveRoomLocally();
        // Host keeps data locally (isGuestLeaving = false)
        onSessionDisconnected(false);
        setActiveTab('join');
        loadRooms();
        setSuccessMsg(`Sala ${activeSession.id} excluída com sucesso. Seus dados locais continuam na tela.`);
      } else {
        setErrorMsg(res.error || 'Erro ao excluir a sala');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir sala');
    } finally {
      setIsDeletingRoom(false);
    }
  };

  // Kick participant (Host Admin)
  const handleKickParticipant = async (targetUser: { id: string; name: string }) => {
    if (!activeSession) return;
    if (!confirm(`Remover "${targetUser.name}" da sala compartilhada?\nOs dados serão retirados da tela deste usuário.`)) {
      return;
    }

    setKickingUserId(targetUser.id);
    try {
      const res = await kickParticipantFromSession(activeSession.id, currentUser, targetUser.id);
      if (res.success && res.session) {
        onSessionConnected(res.session);
        setSuccessMsg(`Usuário "${targetUser.name}" foi removido da sala.`);
      } else {
        setErrorMsg(res.error || 'Falha ao remover usuário.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao remover usuário');
    } finally {
      setKickingUserId(null);
    }
  };

  // Send collaborative message/note
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeSession) return;

    setIsSendingChat(true);
    try {
      const res = await sendSharedSessionChatMessage(activeSession.id, currentUser, chatInput.trim());
      if (res.success && res.session) {
        onSessionConnected(res.session);
        setChatInput('');
      }
    } catch {
      // ignore
    } finally {
      setIsSendingChat(false);
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
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
                  Compartilhamento em Tempo Real
                </h3>
                {activeSession ? (
                  <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    SALA ATIVA ({activeSession.id})
                  </span>
                ) : (
                  <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    NÃO CONECTADO
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Compartilhe e edite lançamentos do Dealer, SiTef e Fechamento colaborativamente em tempo real.
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
            <Share2 className="w-3.5 h-3.5" />
            <span>Sessão Atual</span>
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
            <span>Entrar / Salas Ativas ({activeRoomsList.length})</span>
          </button>

          {activeSession && (
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'chat'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Notas e Equipe {activeSession.chatMessages?.length ? `(${activeSession.chatMessages.length})` : ''}</span>
            </button>
          )}
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab 1: Current Session / Share */}
        {activeTab === 'share' && (
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {activeSession ? (
              <div className="space-y-4">
                {/* Active Session Card */}
                <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Código de Acesso da Sala
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
                        Data do Movimento
                      </span>
                      <p className="text-sm font-extrabold text-white">{activeSession.dataMovimento}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Criado por <strong>{activeSession.createdBy.name}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Shareable Link Box */}
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-750 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-300 font-mono truncate">{shareableLink}</span>
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link'}</span>
                    </button>
                  </div>

                  {/* Scope Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="text-slate-400 font-medium">Dados Sincronizados Online:</span>
                    <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">
                      Aba Dealer ({activeSession.dealerState?.rawData?.length || 0} lançamentos)
                    </span>
                    <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold">
                      Aba SiTef ({activeSession.sitefState?.rawData?.length || 0} lançamentos)
                    </span>
                    <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-md font-bold">
                      Fechamento ({activeSession.items?.length || 0} itens)
                    </span>
                  </div>

                  {/* Summary Indicators */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-750/70 text-center">
                    <div className="bg-slate-900/50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400">Total Dealer</span>
                      <p className="text-xs font-bold text-emerald-400">{formatBRL(activeSession.summary.totalDealer)}</p>
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400">Total SiTef</span>
                      <p className="text-xs font-bold text-blue-400">{formatBRL(activeSession.summary.totalSitef)}</p>
                    </div>
                    <div className="bg-slate-900/50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400">Diferença Total</span>
                      <p className={`text-xs font-bold ${activeSession.summary.diferencaTotal !== 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {formatBRL(activeSession.summary.diferencaTotal)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Connected Participants List with Admin Controls */}
                <div className="bg-slate-800/50 border border-slate-750 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span className="font-extrabold text-xs text-white">
                        Usuários Conectados ({activeSession.activeParticipants?.length || 1})
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Edição Colaborativa Online
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activeSession.activeParticipants?.map((part) => {
                      const isMe = part.id === currentUser.id || part.email === currentUser.email;
                      const isParticipantHost =
                        part.id === activeSession.createdBy?.id ||
                        part.email === activeSession.createdBy?.email ||
                        part.isHost;

                      return (
                        <div
                          key={part.id}
                          className="bg-slate-900/70 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xs flex items-center justify-center border border-emerald-400/40">
                              {part.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white">{part.name}</span>
                                {isMe && (
                                  <span className="bg-slate-700 text-slate-300 text-[9px] font-bold px-1.5 py-0.2 rounded-sm">
                                    VOCÊ
                                  </span>
                                )}
                                {isParticipantHost && (
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.2 rounded-sm">
                                    ADMIN / ANFITRIÃO
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400">{part.empresa} • {part.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-[10px] text-emerald-300 font-bold">Online</span>
                            </div>

                            {/* Admin Kick Participant Button */}
                            {isHost && !isParticipantHost && !isMe && (
                              <button
                                onClick={() => handleKickParticipant(part)}
                                disabled={kickingUserId === part.id}
                                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                title="Remover usuário da sala"
                              >
                                {kickingUserId === part.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <UserX className="w-3 h-3 text-rose-400" />
                                )}
                                <span>Remover</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Actions: Sync, Leave, and Admin Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={onManualSync}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sincronizar Agora</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Admin Delete Room Button */}
                    {isHost && (
                      <button
                        onClick={handleDeleteRoom}
                        disabled={isDeletingRoom}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Excluir a sala em nuvem para todos os convidados"
                      >
                        {isDeletingRoom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        <span>Excluir Sala</span>
                      </button>
                    )}

                    {/* Disconnect / Leave Room Button */}
                    <button
                      onClick={handleDisconnect}
                      disabled={isLoading}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 font-bold rounded-xl text-xs border border-slate-700 hover:border-rose-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair da Sala</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* No Active Session: Offer to create one */
              <div className="space-y-4 text-center py-4">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-3xl border border-emerald-500/20 flex items-center justify-center mx-auto shadow-inner">
                  <Globe className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto">
                  <h4 className="font-extrabold text-base text-white">Iniciar Nova Sala de Fechamento</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Crie um link e código exclusivo para que outros operadores editem e conciliem simultaneamente os lançamentos do Dealer, SiTef e Fechamento em tempo real.
                  </p>
                </div>

                <div className="bg-slate-800/50 border border-slate-750 p-4 rounded-2xl max-w-md mx-auto text-left space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Lançamentos Dealer:</span>
                    <span className="font-bold text-white">{dealerState?.rawData?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Lançamentos SiTef:</span>
                    <span className="font-bold text-white">{sitefState?.rawData?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Itens no Fechamento:</span>
                    <span className="font-bold text-white">{fechamentoItems.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Divergências Pendentes:</span>
                    <span className={`font-bold ${summary.countDivergencias > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {summary.countDivergencias}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-450 hover:to-teal-450 disabled:opacity-50 text-slate-950 font-black rounded-2xl text-sm transition-all shadow-lg flex items-center gap-2 mx-auto cursor-pointer"
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{isLoading ? 'Criando Sala em Nuvem...' : 'Criar Sala de Fechamento em Nuvem'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Join / Active Rooms */}
        {activeTab === 'join' && (
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Direct Code Input Box */}
            <div className="bg-slate-800/80 border border-slate-700/80 p-4 rounded-2xl space-y-3">
              <span className="text-xs font-extrabold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Conectar via Código ou Link da Sala</span>
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Ex: FC-84920 ou cole o link recebido"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 uppercase"
                />
                <button
                  onClick={() => handleJoinRoom()}
                  disabled={isLoading || !joinCodeInput.trim()}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-450 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  <span>Conectar</span>
                </button>
              </div>
            </div>

            {/* List of Active Rooms in Cloud */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-slate-300 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span>Salas de Fechamento Ativas na Rede ({activeRoomsList.length})</span>
                </span>
                <button
                  onClick={loadRooms}
                  className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Atualizar</span>
                </button>
              </div>

              {activeRoomsList.length === 0 ? (
                <div className="bg-slate-800/40 border border-slate-800 p-8 rounded-2xl text-center space-y-2">
                  <WifiOff className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">Nenhuma outra sala ativa no momento.</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Peça ao outro usuário para criar uma sala ou envie o código gerado para que ele conecte.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeRoomsList.map((room) => {
                    const isCurrent = activeSession?.id === room.id;
                    return (
                      <div
                        key={room.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-emerald-500/10 border-emerald-500/40'
                            : 'bg-slate-800/60 hover:bg-slate-800 border-slate-750'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl border border-slate-750 font-mono font-black text-xs">
                            {room.id}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white">{room.title}</span>
                              <span className="bg-slate-700 text-slate-300 text-[10px] font-bold px-2 py-0.2 rounded-full">
                                {room.items?.length || 0} lançamentos
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Aberta por <strong>{room.createdBy?.name || 'Operador'}</strong> ({room.createdBy?.empresa})
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-900/60 px-2 py-1 rounded-lg">
                            <Users className="w-3 h-3 text-emerald-400" />
                            <span>{room.activeParticipants?.length || 1} online</span>
                          </span>

                          {isCurrent ? (
                            <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl">
                              Conectado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleJoinRoom(room.id)}
                              disabled={isLoading}
                              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1"
                            >
                              <span>Entrar na Sala</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Chat / Collaborative Notes */}
        {activeTab === 'chat' && activeSession && (
          <div className="p-5 space-y-4 overflow-y-auto flex-1 flex flex-col justify-between">
            <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1">
              {(!activeSession.chatMessages || activeSession.chatMessages.length === 0) ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <span>Nenhuma anotação nesta sessão. Envie mensagens ou notas para os outros operadores.</span>
                </div>
              ) : (
                activeSession.chatMessages.map((msg) => {
                  const isMe = msg.userId === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                        <span className="font-bold">{msg.userName}</span>
                        {msg.empresa && <span>({msg.empresa})</span>}
                        <span>• {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        className={`p-3 rounded-2xl max-w-sm text-xs leading-relaxed ${
                          isMe
                            ? 'bg-emerald-500 text-slate-950 font-medium rounded-tr-xs'
                            : 'bg-slate-800 text-slate-200 rounded-tl-xs border border-slate-700'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escreva uma observação ou mensagem para a equipe..."
                className="flex-1 bg-slate-900 border border-slate-750 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isSendingChat || !chatInput.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-450 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Sessões seguras com sincronização bidirecional em nuvem</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
