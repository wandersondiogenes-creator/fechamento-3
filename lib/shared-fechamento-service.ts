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

export function extractRoomCode(raw: string | null | undefined): string {
  if (!raw) return '';
  let str = String(raw).trim();

  // If it's a URL or contains query parameters / paths
  if (str.includes('?') || str.includes('/') || str.includes('=')) {
    try {
      // 1. Search for parameter matches: sala=, shared=, fechamento=, code=, id=, room=
      const paramMatch = str.match(/[?&#](?:sala|shared|fechamento|code|id|room)=([^&#\s]+)/i);
      if (paramMatch && paramMatch[1]) {
        str = decodeURIComponent(paramMatch[1]).trim();
      } else {
        // 2. Search for FC-XXXXX in the URL string
        const fcMatch = str.match(/(FC-?\d{4,8})/i);
        if (fcMatch && fcMatch[1]) {
          str = fcMatch[1].trim();
        } else {
          // 3. Last path segment fallback
          const lastSegment = str.split(/[/?#]/).filter(Boolean).pop();
          if (lastSegment) {
            str = decodeURIComponent(lastSegment).trim();
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Normalize FC prefix: if user typed "93641" or "fc93641" or "FC 93641" or "fc-93641"
  const cleanAlphaNum = str.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
  const directDigits = cleanAlphaNum.match(/^(\d{4,6})$/);
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

// API Calls to server backend

export async function createOrUpdateSharedSession(
  session: Partial<SharedFechamentoSession> & { id: string; items: FechamentoItem[] },
  currentUser: UserProfile
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
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Falha ao salvar sessão compartilhada' };
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
): Promise<{ success: boolean; session?: SharedFechamentoSession; error?: string }> {
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
