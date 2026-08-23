import { SpreadsheetState } from '@/types/spreadsheet';
import { FechamentoItem } from '@/lib/fechamento-utils';
import { getSupabase, isSupabaseConfigured } from './supabase-client';
import {
  SESSION_MAX_HOURS,
  SESSION_MAX_AGE_MS,
  cleanEmailKey,
  isSessionExpired,
  saveUserPendingFile,
  extractMetricsFromSession,
  PendingFileRecord,
} from './pending-files-service';

export interface AppDiagnosticLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  module: string;
  message: string;
  details?: any;
}

export interface AutosaveSessionData {
  version: number;
  lastSavedAt: string;
  userEmail?: string;
  activeTab: string;
  dealerState: SpreadsheetState;
  sitefState: SpreadsheetState;
  pendenteCdcState: SpreadsheetState;
  manualFechamentoItems: FechamentoItem[];
  deletedFechamentoIds: string[];
  tabFilters?: {
    dealer?: { searchQuery?: string; sortColId?: string | null; sortDirection?: 'asc' | 'desc' };
    sitef?: { searchQuery?: string; sortColId?: string | null; sortDirection?: 'asc' | 'desc' };
    pendente_cdc?: { searchQuery?: string; sortColId?: string | null; sortDirection?: 'asc' | 'desc' };
    fechamento?: {
      searchQuery?: string;
      selectedEmpresaFilter?: string;
      empresaSortOrder?: 'asc' | 'desc' | 'none';
      filterMode?: 'all' | 'divergent' | 'concolidated' | 'pix_validation';
      viewMode?: 'grouped' | 'flat';
    };
    auditoria?: any;
  };
}

const LOCAL_STORAGE_LOGS_KEY = 'wanfinance_diagnostic_logs_v1';
const MAX_LOGS = 200;

export function getEmailSessionKey(email?: string): string {
  const clean = cleanEmailKey(email);
  return `wanfinance_active_session_v3_${clean}`;
}

// Log registry
let inMemoryLogs: AppDiagnosticLog[] = [];

export function logDiagnostic(
  level: 'info' | 'warn' | 'error' | 'success',
  module: string,
  message: string,
  details?: any
): AppDiagnosticLog {
  const logItem: AppDiagnosticLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    details: details ? JSON.parse(JSON.stringify(details, getCircularReplacer())) : undefined,
  };

  inMemoryLogs.unshift(logItem);
  if (inMemoryLogs.length > MAX_LOGS) {
    inMemoryLogs = inMemoryLogs.slice(0, MAX_LOGS);
  }

  // Persist locally
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(inMemoryLogs));
    } catch {
      // ignore storage quota errors
    }
  }

  // Console output
  const prefix = `[${level.toUpperCase()}][${module}]`;
  if (level === 'error') console.error(prefix, message, details || '');
  else if (level === 'warn') console.warn(prefix, message, details || '');
  else console.log(prefix, message, details || '');

  return logItem;
}

export function getDiagnosticLogs(): AppDiagnosticLog[] {
  if (typeof window !== 'undefined' && inMemoryLogs.length === 0) {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
      if (raw) inMemoryLogs = JSON.parse(raw);
    } catch {
      inMemoryLogs = [];
    }
  }
  return inMemoryLogs;
}

export function clearDiagnosticLogs(): void {
  inMemoryLogs = [];
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
  }
  logDiagnostic('info', 'System', 'Logs de diagnóstico foram limpos pelo usuário.');
}

/**
 * Autosave session to localStorage (scoped by email) and cloud APIs (for cross-device access)
 */
export async function saveAppSession(session: AutosaveSessionData): Promise<{ success: boolean; cloudSaved: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, cloudSaved: false };

  const cleanEmail = cleanEmailKey(session.userEmail);
  const emailKey = getEmailSessionKey(cleanEmail);
  let localOk = false;
  let cloudOk = false;

  const sessionWithTime: AutosaveSessionData = {
    ...session,
    userEmail: cleanEmail,
    lastSavedAt: new Date().toISOString(),
  };

  // 1. Email-Scoped LocalStorage Persistence (Instant, Zero Latency)
  try {
    const serialized = JSON.stringify(sessionWithTime);
    localStorage.setItem(emailKey, serialized);
    localOk = true;
  } catch (err: any) {
    logDiagnostic('warn', 'Autosave', `Falha ao gravar sessão em LocalStorage para ${cleanEmail}.`, err?.message);
  }

  // 2. Server API Workspace Sync for Cross-Device Support
  try {
    const res = await fetch('/api/fechamento/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: cleanEmail,
        lastActiveAt: sessionWithTime.lastSavedAt,
        dealerState: sessionWithTime.dealerState,
        sitefState: sessionWithTime.sitefState,
        pendenteCdcState: sessionWithTime.pendenteCdcState,
        manualFechamentoItems: sessionWithTime.manualFechamentoItems,
        deletedFechamentoIds: sessionWithTime.deletedFechamentoIds,
        activeTab: sessionWithTime.activeTab,
        tabFilters: sessionWithTime.tabFilters,
      }),
    });
    if (res.ok) {
      cloudOk = true;
    }
  } catch (err: any) {
    logDiagnostic('warn', 'CloudWorkspaceSync', `Falha na sincronização do workspace para ${cleanEmail}.`, err?.message);
  }

  // 3. Supabase Cloud Persistence (if configured)
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { error } = await retryWithBackoff(async () => {
        return await supabase
          .from('user_sessions')
          .upsert(
            {
              user_id: cleanEmail,
              session_payload: sessionWithTime,
              updated_at: sessionWithTime.lastSavedAt,
            },
            { onConflict: 'user_id' }
          );
      }, 3, 500);

      if (!error) {
        cloudOk = true;
      }
    } catch {}
  }

  return { success: localOk || cloudOk, cloudSaved: cloudOk };
}

/**
 * Load session from LocalStorage or Cloud API, strictly scoped by email and enforcing the 8-hour TTL rule.
 * If session is older than 8 hours, it archives to Pending Files and returns blank state.
 */
export async function loadAppSession(userEmail?: string): Promise<{
  data: AutosaveSessionData | null;
  source: 'local' | 'cloud' | 'none';
  wasAutoArchived?: boolean;
  archivedTitle?: string;
}> {
  if (typeof window === 'undefined') return { data: null, source: 'none' };

  const cleanEmail = cleanEmailKey(userEmail);
  const emailKey = getEmailSessionKey(cleanEmail);

  let rawSession: AutosaveSessionData | null = null;
  let source: 'local' | 'cloud' | 'none' = 'none';

  // 1. Try Cloud API first for cross-device retrieval
  try {
    const res = await fetch(`/api/fechamento/workspace?email=${encodeURIComponent(cleanEmail)}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        if (json.wasAutoArchived && json.archivedFile) {
          logDiagnostic('info', 'SessionTTL', `Sessão anterior de ${cleanEmail} (+8h) foi salva automaticamente em Arquivos Pendentes pelo servidor.`);
          // Clear local active key as well
          localStorage.removeItem(emailKey);
          return {
            data: null,
            source: 'none',
            wasAutoArchived: true,
            archivedTitle: json.archivedFile.title,
          };
        }
        if (json.activeWorkspace) {
          const ws = json.activeWorkspace;
          rawSession = {
            version: 3,
            lastSavedAt: ws.lastActiveAt,
            userEmail: cleanEmail,
            activeTab: ws.activeTab || 'dealer',
            dealerState: ws.dealerState,
            sitefState: ws.sitefState,
            pendenteCdcState: ws.pendenteCdcState,
            manualFechamentoItems: ws.manualFechamentoItems || [],
            deletedFechamentoIds: ws.deletedFechamentoIds || [],
            tabFilters: ws.tabFilters,
          };
          source = 'cloud';
        }
      }
    }
  } catch (err: any) {
    logDiagnostic('warn', 'SessionRecovery', 'Tentativa de busca no servidor falhou, buscando cache local...', err?.message);
  }

  // 2. Fallback to LocalStorage (strictly by email)
  if (!rawSession) {
    try {
      const localRaw = localStorage.getItem(emailKey);
      if (localRaw) {
        rawSession = JSON.parse(localRaw);
        source = 'local';
      }
    } catch (err: any) {
      logDiagnostic('warn', 'SessionRecovery', `Erro ao ler sessão local para ${cleanEmail}.`, err?.message);
    }
  }

  if (!rawSession) {
    return { data: null, source: 'none' };
  }

  // 3. Strict 8-Hour Rule Check
  const hasData =
    (rawSession.dealerState?.rawData && rawSession.dealerState.rawData.length > 0) ||
    (rawSession.sitefState?.rawData && rawSession.sitefState.rawData.length > 0) ||
    (rawSession.manualFechamentoItems && rawSession.manualFechamentoItems.length > 0);

  if (isSessionExpired(rawSession.lastSavedAt)) {
    let archivedTitle = '';
    if (hasData) {
      const metrics = extractMetricsFromSession(
        rawSession.dealerState,
        rawSession.sitefState,
        rawSession.pendenteCdcState,
        rawSession.manualFechamentoItems
      );
      const dateFormatted = new Date(rawSession.lastSavedAt).toLocaleString('pt-BR');
      archivedTitle = `Arquivado Automaticamente (+8h) - ${dateFormatted}`;

      const pendingRecord: PendingFileRecord = {
        id: `pend_auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userEmail: cleanEmail,
        createdAt: new Date().toISOString(),
        title: archivedTitle,
        description: `Sessão iniciada em ${dateFormatted} arquivada automaticamente por expirar o limite de 8h.`,
        source: 'auto_expired',
        dealerState: rawSession.dealerState,
        sitefState: rawSession.sitefState,
        pendenteCdcState: rawSession.pendenteCdcState,
        manualFechamentoItems: rawSession.manualFechamentoItems || [],
        deletedFechamentoIds: rawSession.deletedFechamentoIds || [],
        conciliatedEmpresas: {},
        activeTab: rawSession.activeTab,
        tabFilters: rawSession.tabFilters,
        metrics,
      };

      await saveUserPendingFile(pendingRecord);
      logDiagnostic('info', 'SessionTTL', `Sessão com mais de 8 horas arquivada automaticamente em Arquivos Pendentes para ${cleanEmail}.`);
    }

    // Clean active storage
    try {
      localStorage.removeItem(emailKey);
      fetch(`/api/fechamento/workspace?email=${encodeURIComponent(cleanEmail)}`, { method: 'DELETE' }).catch(() => {});
    } catch {}

    return {
      data: null,
      source: 'none',
      wasAutoArchived: Boolean(hasData),
      archivedTitle,
    };
  }

  // Session is fresh (<= 8 hours)
  logDiagnostic('info', 'SessionRecovery', `Sessão ativa de ${cleanEmail} restaurada com sucesso (${source.toUpperCase()}).`, {
    lastSavedAt: rawSession.lastSavedAt,
    dealerRows: rawSession.dealerState?.rawData?.length || 0,
    sitefRows: rawSession.sitefState?.rawData?.length || 0,
  });

  return { data: rawSession, source };
}

export function clearLocalSession(email?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanEmail = cleanEmailKey(email);
    const emailKey = getEmailSessionKey(cleanEmail);
    localStorage.removeItem(emailKey);
    fetch(`/api/fechamento/workspace?email=${encodeURIComponent(cleanEmail)}`, { method: 'DELETE' }).catch(() => {});
    logDiagnostic('info', 'Session', `Sessão ativa de ${cleanEmail} foi limpa.`);
  } catch (err) {
    console.error('Erro ao limpar sessão:', err);
  }
}

/**
 * Retry helper with exponential backoff for resilient API calls
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 600,
  factor = 2
): Promise<T> {
  let attempt = 0;
  let currentDelay = delayMs;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt >= retries) {
        logDiagnostic('error', 'RetryPolicy', `Tentativa ${attempt}/${retries} falhou: ${error?.message || error}`);
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= factor;
    }
  }
  throw new Error('Número máximo de tentativas atingido.');
}

function getCircularReplacer() {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular Ref]';
      seen.add(value);
    }
    return value;
  };
}
