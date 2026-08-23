import { SpreadsheetState } from '@/types/spreadsheet';
import { FechamentoItem } from '@/lib/fechamento-utils';

export const SESSION_MAX_HOURS = 8;
export const SESSION_MAX_AGE_MS = SESSION_MAX_HOURS * 60 * 60 * 1000; // 8 hours in ms (28,800,000 ms)

export interface PendingFileRecord {
  id: string;
  userEmail: string;
  userName?: string;
  createdAt: string; // ISO string
  title: string;
  description?: string;
  source: 'auto_expired' | 'manual_save' | 'fechamento_snapshot';
  
  // Stored state
  dealerState: SpreadsheetState;
  sitefState: SpreadsheetState;
  pendenteCdcState: SpreadsheetState;
  manualFechamentoItems: FechamentoItem[];
  deletedFechamentoIds: string[];
  conciliatedEmpresas: Record<string, boolean | { isConciliated: boolean; reconciledBy?: string; reconciledAt?: string }>;
  tabFilters?: any;
  activeTab?: string;
  
  // Quick metrics
  metrics: {
    totalDealer: number;
    totalSitef: number;
    diferencaTotal: number;
    countDealer: number;
    countSitef: number;
    countPendenteCdc: number;
    countFechamento: number;
    countEmpresas: number;
    empresasNomes: string[];
  };
}

export interface UserWorkspaceSession {
  userEmail: string;
  userName?: string;
  lastActiveAt: string; // ISO string
  dealerState: SpreadsheetState;
  sitefState: SpreadsheetState;
  pendenteCdcState: SpreadsheetState;
  manualFechamentoItems: FechamentoItem[];
  deletedFechamentoIds: string[];
  conciliatedEmpresas: Record<string, boolean | { isConciliated: boolean; reconciledBy?: string; reconciledAt?: string }>;
  activeTab?: 'dealer' | 'sitef' | 'pendente_cdc' | 'fechamento' | 'auditoria';
  tabFilters?: any;
}

export function cleanEmailKey(email?: string): string {
  if (!email) return 'default_user@wanfinance.com';
  return email.trim().toLowerCase();
}

/**
 * Check if the given timestamp exceeds the 8-hour duration limit
 */
export function isSessionExpired(lastActiveAt?: string | null): boolean {
  if (!lastActiveAt) return false;
  try {
    const lastTime = new Date(lastActiveAt).getTime();
    if (isNaN(lastTime)) return false;
    const now = Date.now();
    return now - lastTime > SESSION_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function getSessionAgeDetails(lastActiveAt?: string | null): {
  isExpired: boolean;
  ageMs: number;
  ageHours: number;
  ageMinutes: number;
  formattedRemaining: string;
} {
  if (!lastActiveAt) {
    return { isExpired: false, ageMs: 0, ageHours: 0, ageMinutes: 0, formattedRemaining: '8h restantes' };
  }
  try {
    const lastTime = new Date(lastActiveAt).getTime();
    if (isNaN(lastTime)) {
      return { isExpired: false, ageMs: 0, ageHours: 0, ageMinutes: 0, formattedRemaining: '8h restantes' };
    }
    const ageMs = Date.now() - lastTime;
    const isExpired = ageMs > SESSION_MAX_AGE_MS;
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));

    const remainingMs = Math.max(0, SESSION_MAX_AGE_MS - ageMs);
    const remHours = Math.floor(remainingMs / (1000 * 60 * 60));
    const remMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const formattedRemaining = isExpired ? 'Expirado (+8h)' : `${remHours}h ${remMinutes}m restantes`;

    return {
      isExpired,
      ageMs,
      ageHours,
      ageMinutes,
      formattedRemaining,
    };
  } catch {
    return { isExpired: false, ageMs: 0, ageHours: 0, ageMinutes: 0, formattedRemaining: '8h restantes' };
  }
}

/**
 * Extract summary metrics from session payload
 */
export function extractMetricsFromSession(
  dealerState: SpreadsheetState,
  sitefState: SpreadsheetState,
  pendenteCdcState: SpreadsheetState,
  manualFechamentoItems: FechamentoItem[] = []
) {
  let totalDealer = 0;
  let totalSitef = 0;
  const empresasSet = new Set<string>();

  (dealerState?.processedData || []).forEach((row: any) => {
    const val = Number(row.entrada || row.valor || row.VALOR || 0) || 0;
    totalDealer += val;
    if (row.EMPRESA || row.empresa) empresasSet.add(String(row.EMPRESA || row.empresa));
  });

  (sitefState?.processedData || []).forEach((row: any) => {
    const val = Number(row.valor || row.VALOR || row.valor_bruto || 0) || 0;
    totalSitef += val;
    if (row.EMPRESA || row.empresa) empresasSet.add(String(row.EMPRESA || row.empresa));
  });

  manualFechamentoItems.forEach((item) => {
    if (item.empresa) empresasSet.add(item.empresa);
  });

  return {
    totalDealer,
    totalSitef,
    diferencaTotal: Math.abs(totalDealer - totalSitef),
    countDealer: dealerState?.processedData?.length || 0,
    countSitef: sitefState?.processedData?.length || 0,
    countPendenteCdc: pendenteCdcState?.processedData?.length || 0,
    countFechamento: manualFechamentoItems.length,
    countEmpresas: empresasSet.size,
    empresasNomes: Array.from(empresasSet),
  };
}

/**
 * Fetch all pending files for a specific email
 */
export async function fetchUserPendingFiles(email: string): Promise<PendingFileRecord[]> {
  const cleanEmail = cleanEmailKey(email);
  const localKey = `wanfinance_pending_files_${cleanEmail}`;

  // 1. Check local storage first
  let localFiles: PendingFileRecord[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) localFiles = JSON.parse(raw);
    } catch (err) {
      console.warn('Erro ao ler arquivos pendentes locais:', err);
    }
  }

  // 2. Query cloud API by email for cross-device synchronization
  try {
    const res = await fetch(`/api/fechamento/pending-files?email=${encodeURIComponent(cleanEmail)}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.pendingFiles)) {
        const cloudFiles: PendingFileRecord[] = data.pendingFiles;
        // Merge without duplicates
        const map = new Map<string, PendingFileRecord>();
        cloudFiles.forEach((f) => map.set(f.id, f));
        localFiles.forEach((f) => {
          if (!map.has(f.id)) map.set(f.id, f);
        });
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(localKey, JSON.stringify(merged));
          } catch {}
        }
        return merged;
      }
    }
  } catch (err) {
    console.warn('Erro ao sincronizar arquivos pendentes na API:', err);
  }

  return localFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Save / Archive a Pending File for an email
 */
export async function saveUserPendingFile(file: PendingFileRecord): Promise<boolean> {
  const cleanEmail = cleanEmailKey(file.userEmail);
  const localKey = `wanfinance_pending_files_${cleanEmail}`;

  // 1. Save locally
  if (typeof window !== 'undefined') {
    try {
      let list: PendingFileRecord[] = [];
      const raw = localStorage.getItem(localKey);
      if (raw) list = JSON.parse(raw);
      const existingIdx = list.findIndex((f) => f.id === file.id);
      if (existingIdx >= 0) {
        list[existingIdx] = file;
      } else {
        list.unshift(file);
      }
      localStorage.setItem(localKey, JSON.stringify(list));
    } catch (err) {
      console.warn('Erro ao salvar arquivo pendente localmente:', err);
    }
  }

  // 2. Push to server API
  try {
    const res = await fetch('/api/fechamento/pending-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(file),
    });
    return res.ok;
  } catch (err) {
    console.warn('Erro ao salvar arquivo pendente na API:', err);
    return true; // Local save succeeded
  }
}

/**
 * Delete a pending file
 */
export async function deleteUserPendingFile(id: string, email: string): Promise<boolean> {
  const cleanEmail = cleanEmailKey(email);
  const localKey = `wanfinance_pending_files_${cleanEmail}`;

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        const list: PendingFileRecord[] = JSON.parse(raw);
        const filtered = list.filter((f) => f.id !== id);
        localStorage.setItem(localKey, JSON.stringify(filtered));
      }
    } catch {}
  }

  try {
    await fetch(`/api/fechamento/pending-files?id=${encodeURIComponent(id)}&email=${encodeURIComponent(cleanEmail)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Erro ao deletar arquivo pendente no servidor:', err);
  }

  return true;
}

/**
 * Load User Active Workspace (enforcing 8-hour limit)
 */
export async function loadUserActiveWorkspace(
  email: string
): Promise<{
  workspace: UserWorkspaceSession | null;
  wasAutoArchived: boolean;
  archivedFile?: PendingFileRecord;
  source: 'cloud' | 'local' | 'none';
}> {
  const cleanEmail = cleanEmailKey(email);
  const localKey = `wanfinance_active_workspace_${cleanEmail}`;

  // 1. Fetch from server first for multi-device synchronization
  let sessionData: UserWorkspaceSession | null = null;
  let source: 'cloud' | 'local' | 'none' = 'none';

  try {
    const res = await fetch(`/api/fechamento/workspace?email=${encodeURIComponent(cleanEmail)}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        if (json.wasAutoArchived && json.archivedFile) {
          // Server auto-archived session because it was > 8 hours old
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem(localKey);
            } catch {}
          }
          return {
            workspace: null,
            wasAutoArchived: true,
            archivedFile: json.archivedFile,
            source: 'cloud',
          };
        }
        if (json.activeWorkspace) {
          sessionData = json.activeWorkspace;
          source = 'cloud';
        }
      }
    }
  } catch (err) {
    console.warn('Falha ao obter workspace da nuvem, testando cache local:', err);
  }

  // 2. Fallback to LocalStorage if server didn't provide
  if (!sessionData && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        sessionData = JSON.parse(raw);
        source = 'local';
      }
    } catch (err) {
      console.warn('Erro ao ler workspace local:', err);
    }
  }

  if (!sessionData) {
    return { workspace: null, wasAutoArchived: false, source: 'none' };
  }

  // 3. Client-side 8-hour validation check
  const hasData =
    (sessionData.dealerState?.rawData && sessionData.dealerState.rawData.length > 0) ||
    (sessionData.sitefState?.rawData && sessionData.sitefState.rawData.length > 0) ||
    (sessionData.manualFechamentoItems && sessionData.manualFechamentoItems.length > 0);

  if (isSessionExpired(sessionData.lastActiveAt)) {
    // Session is older than 8 hours!
    let archivedFile: PendingFileRecord | undefined;
    if (hasData) {
      // Auto-archive into Pending Files
      const metrics = extractMetricsFromSession(
        sessionData.dealerState,
        sessionData.sitefState,
        sessionData.pendenteCdcState,
        sessionData.manualFechamentoItems
      );
      const dateFormatted = new Date(sessionData.lastActiveAt).toLocaleString('pt-BR');
      archivedFile = {
        id: `pend_auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userEmail: cleanEmail,
        userName: sessionData.userName,
        createdAt: new Date().toISOString(),
        title: `Arquivado Automaticamente (+8h) - ${dateFormatted}`,
        description: `Sessão de trabalho iniciada em ${dateFormatted} arquivada por expiração do prazo de 8h.`,
        source: 'auto_expired',
        dealerState: sessionData.dealerState,
        sitefState: sessionData.sitefState,
        pendenteCdcState: sessionData.pendenteCdcState,
        manualFechamentoItems: sessionData.manualFechamentoItems || [],
        deletedFechamentoIds: sessionData.deletedFechamentoIds || [],
        conciliatedEmpresas: sessionData.conciliatedEmpresas || {},
        tabFilters: sessionData.tabFilters,
        activeTab: sessionData.activeTab,
        metrics,
      };

      await saveUserPendingFile(archivedFile);
    }

    // Clear active session to start fresh from blank
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(localKey);
      } catch {}
    }
    fetch(`/api/fechamento/workspace?email=${encodeURIComponent(cleanEmail)}`, { method: 'DELETE' }).catch(() => {});

    return {
      workspace: null,
      wasAutoArchived: Boolean(hasData),
      archivedFile,
      source,
    };
  }

  return {
    workspace: sessionData,
    wasAutoArchived: false,
    source,
  };
}

/**
 * Save / Update User Active Workspace
 */
export async function saveUserActiveWorkspace(workspace: UserWorkspaceSession): Promise<boolean> {
  const cleanEmail = cleanEmailKey(workspace.userEmail);
  const localKey = `wanfinance_active_workspace_${cleanEmail}`;

  // Update timestamp
  const updatedWorkspace: UserWorkspaceSession = {
    ...workspace,
    userEmail: cleanEmail,
    lastActiveAt: new Date().toISOString(),
  };

  // 1. Save locally
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(localKey, JSON.stringify(updatedWorkspace));
    } catch (err) {
      console.warn('Erro ao salvar workspace local:', err);
    }
  }

  // 2. Save on server API
  try {
    await fetch('/api/fechamento/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedWorkspace),
    });
    return true;
  } catch (err) {
    console.warn('Erro ao enviar workspace para nuvem:', err);
    return true;
  }
}

/**
 * Clear User Active Workspace
 */
export async function clearUserActiveWorkspace(email: string): Promise<void> {
  const cleanEmail = cleanEmailKey(email);
  const localKey = `wanfinance_active_workspace_${cleanEmail}`;

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(localKey);
    } catch {}
  }

  try {
    await fetch(`/api/fechamento/workspace?email=${encodeURIComponent(cleanEmail)}`, { method: 'DELETE' });
  } catch {}
}
