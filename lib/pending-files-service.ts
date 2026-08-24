import { SpreadsheetState } from '@/types/spreadsheet';
import { FechamentoItem, calculateSummaryMetrics } from './fechamento-utils';

export const SESSION_MAX_HOURS = 8;
export const SESSION_MAX_AGE_MS = SESSION_MAX_HOURS * 60 * 60 * 1000;

export interface SessionMetrics {
  totalEntradas: number;
  totalSaidas: number;
  saldoLiquido: number;
  totalRegistros: number;
  dealerRowCount: number;
  sitefRowCount: number;
  pendenteCdcRowCount: number;
}

export interface PendingFileRecord {
  id: string;
  userEmail: string;
  userName?: string;
  createdAt: string;
  title: string;
  description?: string;
  source: 'auto_expired' | 'manual_save' | 'daily_closure';
  dealerState?: SpreadsheetState;
  sitefState?: SpreadsheetState;
  pendenteCdcState?: SpreadsheetState;
  manualFechamentoItems?: FechamentoItem[];
  deletedFechamentoIds?: string[];
  conciliatedEmpresas?: Record<string, boolean>;
  activeTab?: string;
  tabFilters?: any;
  metrics: SessionMetrics;
}

export interface UserWorkspaceSession {
  userEmail: string;
  userName?: string;
  lastActiveAt: string;
  dealerState: SpreadsheetState;
  sitefState: SpreadsheetState;
  pendenteCdcState: SpreadsheetState;
  manualFechamentoItems: FechamentoItem[];
  deletedFechamentoIds: string[];
  conciliatedEmpresas?: Record<string, boolean>;
  activeTab?: string;
  tabFilters?: any;
}

export function cleanEmailKey(email?: string): string {
  if (!email || typeof email !== 'string') return 'infroberto360@gmail.com';
  return email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '');
}

export function isSessionExpired(lastSavedAt?: string | null): boolean {
  if (!lastSavedAt) return true;
  try {
    const savedTime = new Date(lastSavedAt).getTime();
    if (isNaN(savedTime)) return true;
    const now = Date.now();
    return now - savedTime > SESSION_MAX_AGE_MS;
  } catch {
    return true;
  }
}

export function extractMetricsFromSession(
  dealerState?: SpreadsheetState,
  sitefState?: SpreadsheetState,
  pendenteCdcState?: SpreadsheetState,
  manualItems?: FechamentoItem[]
): SessionMetrics {
  const summary = calculateSummaryMetrics(manualItems || []);
  return {
    totalEntradas: summary.totalDealer || 0,
    totalSaidas: summary.totalSitef || 0,
    saldoLiquido: summary.diferencaTotal || 0,
    totalRegistros: (dealerState?.rawData?.length || 0) + (sitefState?.rawData?.length || 0),
    dealerRowCount: dealerState?.rawData?.length || 0,
    sitefRowCount: sitefState?.rawData?.length || 0,
    pendenteCdcRowCount: pendenteCdcState?.rawData?.length || 0,
  };
}

export async function fetchUserPendingFiles(userEmail?: string): Promise<PendingFileRecord[]> {
  const cleanEmail = cleanEmailKey(userEmail);
  try {
    const res = await fetch(`/api/fechamento/pending-files?email=${encodeURIComponent(cleanEmail)}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.pendingFiles)) {
        return json.pendingFiles;
      }
    }
  } catch (err) {
    console.warn('Erro ao buscar arquivos pendentes via API:', err);
  }

  // Local fallback
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`wanfinance_pending_files_${cleanEmail}`);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return [];
}

export async function saveUserPendingFile(file: PendingFileRecord): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = cleanEmailKey(file.userEmail);
  const fileWithEmail: PendingFileRecord = {
    ...file,
    userEmail: cleanEmail,
    createdAt: file.createdAt || new Date().toISOString(),
  };

  // Local backup
  if (typeof window !== 'undefined') {
    try {
      const key = `wanfinance_pending_files_${cleanEmail}`;
      const existing = localStorage.getItem(key);
      const list: PendingFileRecord[] = existing ? JSON.parse(existing) : [];
      const updated = [fileWithEmail, ...list.filter((f) => f.id !== fileWithEmail.id)];
      localStorage.setItem(key, JSON.stringify(updated.slice(0, 100)));
    } catch {}
  }

  // Server persistence
  try {
    const res = await fetch('/api/fechamento/pending-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fileWithEmail),
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err?.message };
  }

  return { success: true };
}

export async function deleteUserPendingFile(id: string, userEmail?: string): Promise<boolean> {
  const cleanEmail = cleanEmailKey(userEmail);
  if (typeof window !== 'undefined') {
    try {
      const key = `wanfinance_pending_files_${cleanEmail}`;
      const existing = localStorage.getItem(key);
      if (existing) {
        const list: PendingFileRecord[] = JSON.parse(existing);
        localStorage.setItem(key, JSON.stringify(list.filter((f) => f.id !== id)));
      }
    } catch {}
  }

  try {
    const res = await fetch(`/api/fechamento/pending-files?id=${encodeURIComponent(id)}&email=${encodeURIComponent(cleanEmail)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}
