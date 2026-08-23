'use client';

import React, { useState, useEffect } from 'react';
import {
  SharedFechamentoSession,
  createOrUpdateSharedSession,
  fetchSharedSession,
  listActiveSharedSessions,
  sendSharedSessionChatMessage,
  closeSharedSession,
  generateRoomCode,
  extractRoomCode,
  saveActiveRoomIdLocally,
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
  Wifi,
  WifiOff,
  Clock,
  UserCheck,
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

  const isHost = activeSession
    ? activeSession.createdBy.id === currentUser.id ||
      activeSession.createdBy.email === currentUser.email ||
      currentUser.role === 'admin' ||
      currentUser.role === 'administrador'
    : true;

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

  // Create new shared session with Dealer & SiTef states included
  const handleCreateRoom = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const code = generateRoomCode();
      const defaultDate =
        fechamentoItems[0]?.data || new Date().toLocaleDateString('pt-BR');

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
      };

      const res = await createOrUpdateSharedSession(newSession, currentUser);
      if (res.success && res.session) {
        onSessionConnected(res.session);
        loadRooms();
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
      setErrorMsg('Informe o código da sala ou link de acesso válido (ex: FC-93641).');
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
      } else {
        setErrorMsg(res.error || `Sala "${cleanCode}" não encontrada ou expirada.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar à sala');
    } finally {
      setIsLoading(false);
    }
  };

  // Leave room (Guest or User)
  const handleLeaveRoom = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    try {
      await import('@/lib/shared-fechamento-service').then(m => m.leaveSharedSession(activeSession.id, currentUser));
      onSessionDisconnected(true);
      saveActiveRoomIdLocally(null);
      setActiveTab('join');
      loadRooms();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao sair da sala');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete room (Host/Admin only)
  const handleDeleteRoom = async () => {
    if (!activeSession) return;
    if (!window.confirm(`Tem certeza de que deseja excluir a sala "${activeSession.id}" definitivamente? Todos os convidados serão desconectados e os dados da sala serão removidos para eles.`)) {
      return;
    }
    setIsDeletingRoom(true);
    setErrorMsg(null);
    try {
      const res = await import('@/lib/shared-fechamento-service').then(m => m.deleteSharedSession(activeSession.id, currentUser));
      if (res.success) {
        onSessionDisconnected(false);
        saveActiveRoomIdLocally(null);
        setActiveTab('join');
        loadRooms();
        onClose();
      } else {
        setErrorMsg(res.error || 'Erro ao excluir a sala');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir a sala');
    } finally {
      setIsDeletingRoom(false);
    }
  };

  // Kick participant (Host/Admin only)
  const handleKickParticipant = async (targetUserId: string, targetUserName: string) => {
    if (!activeSession) return;
    if (!window.confirm(`Deseja remover "${targetUserName}" desta sala de fechamento?`)) {
      return;
    }
    setKickingUserId(targetUserId);
    setErrorMsg(null);
    try {
      const res = await import('@/lib/shared-fechamento-service').then(m =>
        m.kickParticipantFromSharedSession(activeSession.id, targetUserId, currentUser)
      );
      if (res.success && res.session) {
        onSessionConnected(res.session);
        setSuccessMsg(`Usuário "${targetUserName}" foi removido da sala.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res.error || 'Erro ao remover usuário');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao remover participante');
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
                    CONECTADO ({activeSession.id})
                  </span>
                ) : (
                  <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    NÃO CONECTADO
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Visualize e concilie o fechamento simultaneamente em computadores diferentes.
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
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
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
            <span>{errorMsg}</span>
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
                {/* Synchronization Badge */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-extrabold text-emerald-300">
                      Sincronização Online Ativa: Dealer, SiTef e Fechamento
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                    Tempo Real
                  </span>
                </div>

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

                  {/* Summary Indicators */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-750/70 text-center">
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

                {/* Connected Participants List */}
                <div className="bg-slate-800/50 border border-slate-750 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span className="font-extrabold text-xs text-white">
                        Usuários Conectados ({activeSession.activeParticipants?.length || 1})
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Sincronização Ativa
                    </span>
                  </div>

                  <div className="space-y-2">
                    {activeSession.activeParticipants?.map((part) => {
                      const isMe = part.id === currentUser.id || part.email === currentUser.email;
                      const canKick = isHost && !isMe && !part.isHost;

                      return (
                        <div
                          key={part.id}
                          className="bg-slate-900/70 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-xs flex items-center justify-center border border-emerald-400/40 shrink-0">
                              {part.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-white truncate">{part.name}</span>
                                {isMe && (
                                  <span className="bg-slate-700 text-slate-300 text-[9px] font-bold px-1.5 py-0.2 rounded-sm">
                                    VOCÊ
                                  </span>
                                )}
                                {part.isHost && (
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.2 rounded-sm">
                                    ANFITRIÃO
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">{part.empresa} • {part.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-[10px] text-emerald-300 font-bold">Online</span>
                            </div>

                            {canKick && (
                              <button
                                onClick={() => handleKickParticipant(part.id, part.name)}
                                disabled={kickingUserId === part.id}
                                className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold rounded-lg border border-rose-500/40 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                title="Remover usuário da sala"
                              >
                                {kickingUserId === part.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <X className="w-3 h-3" />
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

                {/* Host vs Guest Administrative Bottom Actions */}
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={onManualSync}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sincronizar Agora</span>
                    </button>

                    {isHost ? (
                      <button
                        onClick={handleDeleteRoom}
                        disabled={isDeletingRoom}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingRoom ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        <span>Excluir Sala Definitivamente</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleLeaveRoom}
                        disabled={isLoading}
                        className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-extrabold rounded-xl text-xs border border-rose-500/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sair da Sala (Limpar Tela)</span>
                      </button>
                    )}
                  </div>

                  {isHost ? (
                    <p className="text-[11px] text-slate-400">
                      ℹ️ <strong>Painel do Administrador</strong>: Ao excluir a sala, a sessão será encerrada e os dados serão removidos da tela dos convidados, permanecendo salvos na sua tela.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      ℹ️ Ao clicar em <strong>Sair da Sala</strong>, você será desconectado e os dados compartilhados serão limpos da sua tela automaticamente.
                    </p>
                  )}
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
                    Crie um link e código exclusivo para que outros operadores ou gestores acompanhem esta conciliação ao mesmo tempo em outros computadores.
                  </p>
                </div>

                <div className="bg-slate-800/50 border border-slate-750 p-4 rounded-2xl max-w-md mx-auto text-left space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total de Lançamentos:</span>
                    <span className="font-bold text-white">{fechamentoItems.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Divergências Pendentes:</span>
                    <span className={`font-bold ${summary.countDivergencias > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {summary.countDivergencias}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Empresas Conciliadas:</span>
                    <span className="font-bold text-emerald-400">
                      {Object.values(conciliatedEmpresas).filter(Boolean).length}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading || fechamentoItems.length === 0}
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
                    Peça ao outro usuário para clicar em &quot;Compartilhar Fechamento&quot; para que a sala apareça aqui automaticamente.
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
                                {room.items.length} lançamentos
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
