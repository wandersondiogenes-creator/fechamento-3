import { SpreadsheetState } from '@/types/spreadsheet';
import { FechamentoItem } from '@/lib/fechamento-utils';
import { getSupabase, isSupabaseConfigured } from './supabase-client';

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

const LOCAL_STORAGE_SESSION_KEY = 'wanfinance_active_session_v2';
const LOCAL_STORAGE_LOGS_KEY = 'wanfinance_diagnostic_logs_v1';
const MAX_LOGS = 200;

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
 * Autosave session to localStorage and optional Supabase cloud
 */
export async function saveAppSession(session: AutosaveSessionData): Promise<{ success: boolean; cloudSaved: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, cloudSaved: false };

  let localOk = false;
  let cloudOk = false;

  // 1. LocalStorage Persistence (Instant, Zero Latency)
  try {
    const serialized = JSON.stringify(session);
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, serialized);
    localOk = true;
  } catch (err: any) {
    logDiagnostic('warn', 'Autosave', 'Falha ao gravar sessão em LocalStorage (cota excedida ou desativado).', err?.message);
  }

  // 2. Supabase Cloud Persistence (Safe against device clear / Vercel container refresh)
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const userKey = session.userEmail || 'default_user';
      const { error } = await retryWithBackoff(async () => {
        return await supabase
          .from('user_sessions')
          .upsert(
            {
              user_id: userKey,
              session_payload: session,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
      }, 3, 500);

      if (error) {
        logDiagnostic('warn', 'SupabaseSync', 'Erro ao sincronizar sessão na nuvem Supabase.', error.message);
      } else {
        cloudOk = true;
        logDiagnostic('info', 'SupabaseSync', 'Sessão sincronizada com sucesso no Supabase.');
      }
    } catch (err: any) {
      logDiagnostic('warn', 'SupabaseSync', 'Falha na conexão com Supabase durante autosave.', err?.message);
    }
  }

  return { success: localOk || cloudOk, cloudSaved: cloudOk };
}

/**
 * Load session from LocalStorage or Supabase Cloud fallback
 */
export async function loadAppSession(userEmail?: string): Promise<{ data: AutosaveSessionData | null; source: 'local' | 'cloud' | 'none' }> {
  if (typeof window === 'undefined') return { data: null, source: 'none' };

  // 1. Try local storage first
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (raw) {
      const parsed: AutosaveSessionData = JSON.parse(raw);
      if (parsed && (parsed.dealerState?.rawData?.length || parsed.sitefState?.rawData?.length || parsed.manualFechamentoItems?.length)) {
        logDiagnostic('info', 'SessionRecovery', 'Sessão local recuperada com sucesso.', {
          lastSavedAt: parsed.lastSavedAt,
          dealerRows: parsed.dealerState?.rawData?.length || 0,
          sitefRows: parsed.sitefState?.rawData?.length || 0,
        });
        return { data: parsed, source: 'local' };
      }
    }
  } catch (err: any) {
    logDiagnostic('warn', 'SessionRecovery', 'Erro ao ler sessão local.', err?.message);
  }

  // 2. Try Supabase cloud
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const userKey = userEmail || 'default_user';
      const { data, error } = await retryWithBackoff(async () => {
        return await supabase
          .from('user_sessions')
          .select('session_payload, updated_at')
          .eq('user_id', userKey)
          .maybeSingle();
      }, 3, 500);

      if (data?.session_payload) {
        logDiagnostic('info', 'SessionRecovery', 'Sessão recuperada da nuvem Supabase.', {
          updatedAt: data.updated_at,
        });
        return { data: data.session_payload as AutosaveSessionData, source: 'cloud' };
      }
    } catch (err: any) {
      logDiagnostic('warn', 'SessionRecovery', 'Falha ao buscar sessão no Supabase.', err?.message);
    }
  }

  return { data: null, source: 'none' };
}

export function clearLocalSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    logDiagnostic('info', 'Session', 'Sessão local foi reiniciada.');
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
        logDiagnostic('error', 'RetryPolicy', `Tentativa ${attempt}/${retries} falhou definitivamente: ${error?.message || error}`);
        throw error;
      }
      logDiagnostic('warn', 'RetryPolicy', `Falha na tentativa ${attempt}/${retries}. Reexecutando em ${currentDelay}ms...`);
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
