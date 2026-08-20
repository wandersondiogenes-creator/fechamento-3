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
  activeParticipants: SessionParticipant[];
  chatMessages?: SessionChatMessage[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

const ACTIVE_SHARED_ROOM_STORAGE_KEY = 'wanfinance_active_shared_room_id_v1';

export function generateRoomCode(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `FC-${num}`;
}

export function saveActiveRoomIdLocally(roomId: string | null): void {
  if (typeof window === 'undefined') return;
  if (!roomId) {
    localStorage.removeItem(ACTIVE_SHARED_ROOM_STORAGE_KEY);
  } else {
    localStorage.setItem(ACTIVE_SHARED_ROOM_STORAGE_KEY, roomId);
  }
}

export function getActiveRoomIdLocally(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_SHARED_ROOM_STORAGE_KEY);
}

// API Calls to server backend

export async function createOrUpdateSharedSession(
  session: Partial<SharedFechamentoSession> & { id: string; items: FechamentoItem[] },
  currentUser: UserProfile
): Promise<{ success: boolean; session?: SharedFechamentoSession; error?: string }> {
  try {
    const res = await fetch('/api/fechamento/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          empresa: currentUser.empresa,
          role: currentUser.role,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Falha ao salvar sessão compartilhada' };
    }

    saveActiveRoomIdLocally(session.id);
    return { success: true, session: data.session };
  } catch (err: any) {
    console.error('Erro ao conectar sessão compartilhada:', err);
    return { success: false, error: err.message || 'Erro de conexão' };
  }
}

export async function fetchSharedSession(
  sessionId: string,
  currentUser?: UserProfile
): Promise<{ success: boolean; session?: SharedFechamentoSession; error?: string }> {
  try {
    const query = new URLSearchParams({ id: sessionId });
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
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Sessão não encontrada' };
    }

    return { success: true, session: data.session };
  } catch (err: any) {
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

export async function sendSharedSessionChatMessage(
  sessionId: string,
  user: UserProfile,
  messageText: string
): Promise<{ success: boolean; session?: SharedFechamentoSession; error?: string }> {
  try {
    const res = await fetch('/api/fechamento/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'chat',
        sessionId,
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
  try {
    const res = await fetch(`/api/fechamento/shared?id=${encodeURIComponent(sessionId)}&userId=${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
    });

    const data = await res.json();
    saveActiveRoomIdLocally(null);
    return { success: data.success, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
