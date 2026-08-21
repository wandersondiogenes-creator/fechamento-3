import { FechamentoItem } from './fechamento-utils';
import { UserProfile } from '@/types/audit';

export interface SessionParticipant {
  id: string;
  name: string;
  email: string;
  role: string;
  empresa: string;
  lastSeen: string; // ISO string
  isHost?: boolean;
}

export interface SessionChatMessage {
  id: string;
  userId: string;
  userName: string;
  empresa?: string;
  text: string;
  timestamp: string;
}

export interface SharedSpreadsheetPayload {
  fileName?: string;
  headers?: string[];
  columns?: any[];
  rawData?: Record<string, any>[];
  processedData?: Record<string, any>[];
  hasHeaderRow?: boolean;
}

export interface SharedFechamentoSession {
  id: string; // Short code e.g. FC-84920
  title: string;
  dataMovimento: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    empresa: string;
    role: string;
  };
  status: 'active' | 'closed' | 'archived';
  items: FechamentoItem[];
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
  activeParticipants: SessionParticipant[];
  kickedUserIds?: string[];
  chatMessages?: SessionChatMessage[];
  lastAction?: {
    userId: string;
    userName: string;
    description: string;
    tab?: string;
    timestamp: string;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
}

const ACTIVE_SHARED_ROOM_STORAGE_KEY = 'wanfinance_active_shared_room_id_v1';
const SHARED_SESSIONS_LOCAL_KEY = 'wanfinance_shared_sessions_backup_v1';

function getLocalSharedSessionsBackup(): Record<string, SharedFechamentoSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SHARED_SESSIONS_LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalSharedSessionBackup(session: SharedFechamentoSession): void {
  if (typeof window === 'undefined' || !session) return;
  try {
    const map = getLocalSharedSessionsBackup();
    // Ensure items in session are deduplicated before storing
    const itemMap = new Map<string, any>();
    (session.items || []).forEach((i) => {
      if (i && i.id) itemMap.set(i.id, i);
    });
    const cleanedSession: SharedFechamentoSession = {
      ...session,
      items: Array.from(itemMap.values()),
    };
    map[session.id] = cleanedSession;
    localStorage.setItem(SHARED_SESSIONS_LOCAL_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function generateRoomCode(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `FC-${num}`;
}

export function extractRoomCode(raw: string | null | undefined): string {
  if (!raw) return '';
  let str = String(raw).trim();

  // Try decoding up to 3 times in case of nested encoding
  for (let i = 0; i < 3; i++) {
    if (str.includes('%')) {
      try {
        str = decodeURIComponent(str);
      } catch {
        break;
      }
    }
  }

  // If it's a URL or contains query parameters / paths
  if (str.includes('?') || str.includes('/') || str.includes('=') || str.includes('&') || str.includes('#')) {
    try {
      // 1. Search for parameter matches: sala=, shared=, fechamento=, code=, id=, room=
      const paramMatch = str.match(/[?&#](?:sala|shared|fechamento|code|id|room)=([^&#\s]+)/i);
      if (paramMatch && paramMatch[1]) {
        str = paramMatch[1].trim();
      } else {
        // 2. Search for FC-XXXXX directly in the string
        const fcMatch = str.match(/(FC-?\d{4,8})/i);
        if (fcMatch && fcMatch[1]) {
          str = fcMatch[1].trim();
        } else {
          // 3. Last path segment fallback
          const lastSegment = str.split(/[/?#]/).filter(Boolean).pop();
          if (lastSegment) {
            str = lastSegment.trim();
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Normalize FC prefix: if user typed "68049" or "fc68049" or "FC 68049" or "fc-68049"
  const cleanAlphaNum = str.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
  const directDigits = cleanAlphaNum.match(/^(\d{4,8})$/);
  if (directDigits) {
    return `FC-${directDigits[1]}`;
  }

  const fcDigits = cleanAlphaNum.match(/^FC-?(\d{4,8})$/i);
  if (fcDigits) {
    return `FC-${fcDigits[1]}`;
  }

  return cleanAlphaNum;
}

export function saveActiveRoomIdLocally(roomId: string | null): void {
  if (typeof window === 'undefined') return;
  if (!roomId) {
    localStorage.removeItem(ACTIVE_SHARED_ROOM_STORAGE_KEY);
  } else {
    localStorage.setItem(ACTIVE_SHARED_ROOM_STORAGE_KEY, extractRoomCode(roomId));
  }
}

export function getActiveRoomIdLocally(): string | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(ACTIVE_SHARED_ROOM_STORAGE_KEY);
  return val ? extractRoomCode(val) : null;
}

export function clearActiveRoomLocally(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACTIVE_SHARED_ROOM_STORAGE_KEY);
    // Clean URL query parameter without full reload
    const url = new URL(window.location.href);
    url.searchParams.delete('sala');
    url.searchParams.delete('shared');
    url.searchParams.delete('code');
    url.searchParams.delete('fechamento');
    url.searchParams.delete('room');
    url.searchParams.delete('id');
    window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
  } catch {
    // ignore
  }
}

// API Calls to server backend

export async function createOrUpdateSharedSession(
  session: Partial<SharedFechamentoSession> & { id: string },
  currentUser: UserProfile,
  actionDescription?: string,
  actionTab?: string
): Promise<{ success: boolean; session?: SharedFechamentoSession; error?: string }> {
  try {
    const cleanId = extractRoomCode(session.id);
    const sessionToSave = {
      ...session,
      id: cleanId,
    };

    const res = await fetch('/api/fechamento/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: sessionToSave,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          empresa: currentUser.empresa,
          role: currentUser.role,
        },
        actionDescription,
        actionTab,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Falha ao salvar sessão compartilhada' };
    }

    if (data.session) {
      saveLocalSharedSessionBackup(data.session);
    }
    saveActiveRoomIdLocally(cleanId);
    return { success: true, session: data.session };
  } catch (err: any) {
    console.error('Erro ao conectar sessão compartilhada:', err);
    return { success: false, error: err.message || 'Erro de conexão' };
  }
}

export async function fetchSharedSession(
  sessionId: string,
  currentUser?: UserProfile
): Promise<{
  success: boolean;
  session?: SharedFechamentoSession;
  kicked?: boolean;
  closed?: boolean;
  error?: string;
}> {
  try {
    const cleanId = extractRoomCode(sessionId);
    if (!cleanId) {
      return { success: false, error: 'Código de sala inválido' };
    }

    const query = new URLSearchParams({ id: cleanId });
    if (currentUser) {
      query.set('userId', currentUser.id);
      query.set('userName', currentUser.name);
      query.set('userEmail', currentUser.email);
      query.set('userEmpresa', currentUser.empresa);
      query.set('userRole', currentUser.role);
    }

    const res = await fetch(`/api/fechamento/shared?${query.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json();

    if (data.kicked) {
      clearActiveRoomLocally();
      return { success: false, kicked: true, error: data.error || 'Você foi desconectado da sala pelo anfitrião.' };
    }

    if (data.closed) {
      clearActiveRoomLocally();
      return { success: false, closed: true, error: data.error || 'A sala compartilhada foi encerrada pelo anfitrião.' };
    }

    if (!res.ok || !data.success || !data.session) {
      // Check local backup fallback (in case user opened room created on same browser)
      const localBackup = getLocalSharedSessionsBackup()[cleanId];
      if (localBackup && currentUser) {
        // Re-push local session to server
        createOrUpdateSharedSession(localBackup, currentUser).catch(() => {});
        return { success: true, session: localBackup };
      }
      return { success: false, error: data?.error || `Sala "${cleanId}" não encontrada ou expirada.` };
    }

    // Check if session returned is closed
    if (data.session.status === 'closed') {
      clearActiveRoomLocally();
      return { success: false, closed: true, error: 'A sala compartilhada foi encerrada pelo anfitrião.' };
    }

    // Check if user was kicked in session list
    if (currentUser && data.session.kickedUserIds?.includes(currentUser.id)) {
      clearActiveRoomLocally();
      return { success: false, kicked: true, error: 'Você foi desconectado da sala pelo anfitrião.' };
    }

    saveLocalSharedSessionBackup(data.session);
    return { success: true, session: data.session };
  } catch (err: any) {
    const cleanId = extractRoomCode(sessionId);
    const localBackup = getLocalSharedSessionsBackup()[cleanId];
    if (localBackup) {
      return { success: true, session: localBackup };
    }
    return { success: false, error: err.message || 'Erro de rede' };
  }
}

export async function listActiveSharedSessions(): Promise<SharedFechamentoSession[]> {
  try {
    const res = await fetch('/api/fechamento/shared?list=true', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.sessions)) {
      return data.sessions;
    }
    return [];
  } catch (err) {
    console.error('Erro ao listar salas ativas:', err);
    return [];
  }
}

export async function leaveSharedSession(
  sessionId: string,
  user: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = extractRoomCode(sessionId);
    const res = await fetch('/api/fechamento/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'leave',
        sessionId: cleanId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          empresa: user.empresa,
          role: user.role,
        },
      }),
    });

    clearActiveRoomLocally();
    const data = await res.json();
    return { success: data.success, error: data.error };
  } catch (err: any) {
    clearActiveRoomLocally();
    return { success: true };
  }
}

export async function kickParticipantFromSession(
  sessionId: string,
  adminUser: UserProfile,
  targetUserId: string
): Promise<{ success: boolean; session?: SharedFechamentoSession; error?: string }> {
  try {
    const cleanId = extractRoomCode(sessionId);
    const res = await fetch('/api/fechamento/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'kick',
        sessionId: cleanId,
        adminUser: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          empresa: adminUser.empresa,
          role: adminUser.role,
        },
        targetUserId,
      }),
    });

    const data = await res.json();
    return { success: data.success, session: data.session, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao remover participante' };
  }
}

export async function deleteSharedSession(
  sessionId: string,
  adminUser: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = extractRoomCode(sessionId);
    const res = await fetch(`/api/fechamento/shared?id=${encodeURIComponent(cleanId)}&userId=${encodeURIComponent(adminUser.id)}`, {
      method: 'DELETE',
    });

    clearActiveRoomLocally();
    const data = await res.json();
    return { success: data.success, error: data.error };
  } catch (err: any) {
    clearActiveRoomLocally();
    return { success: false, error: err.message };
  }
}

export async function sendSharedSessionChatMessage(
  sessionId: string,
  user: UserProfile,
  messageText: string
): Promise<{ success: boolean; session?: SharedFechamentoSession; error?: string }> {
  try {
    const cleanId = extractRoomCode(sessionId);
    const res = await fetch('/api/fechamento/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat',
        sessionId: cleanId,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          empresa: user.empresa,
          role: user.role,
        },
        message: messageText,
      }),
    });

    const data = await res.json();
    return { success: data.success, session: data.session, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function closeSharedSession(
  sessionId: string,
  user: UserProfile
): Promise<{ success: boolean; error?: string }> {
  return deleteSharedSession(sessionId, user);
}

