import { AuditLogEntry, AuditLogFilters, AuditOperationType } from '@/types/audit';
import { getCurrentUser } from './auth-service';
import { supabase } from './supabase';

const AUDIT_STORAGE_KEY = 'trataexcel_audit_logs_v1';

// Internal local cache for instant UI rendering and fallback
function getLocalAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Erro ao ler logs de auditoria do cache local:', err);
    return [];
  }
}

function saveLocalAuditLogs(logs: AuditLogEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep max 1000 items in local cache
    const trimmed = logs.slice(0, 1000);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Erro ao salvar cache de auditoria:', err);
  }
}

/**
 * Registra uma ação de auditoria imutável no Supabase e no cache sincronizado.
 */
export async function logAuditAction(entry: {
  operacao: AuditOperationType | string;
  descricao: string;
  empresa?: string;
  banco?: string;
  registro?: string;
  valor?: number;
  situacao_anterior?: string;
  situacao_nova?: string;
  lote_id?: string;
  meta_data?: Record<string, any>;
}): Promise<AuditLogEntry> {
  const activeUser = getCurrentUser();

  const newLog: AuditLogEntry = {
    id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
    created_at: new Date().toISOString(),
    user_id: activeUser.id,
    user_name: activeUser.name,
    empresa: entry.empresa || activeUser.empresa || 'TODAS / GLOBAL',
    banco: entry.banco || 'BANCO DO BRASIL',
    operacao: entry.operacao,
    descricao: entry.descricao,
    registro: entry.registro || '-',
    valor: entry.valor ?? undefined,
    situacao_anterior: entry.situacao_anterior || '-',
    situacao_nova: entry.situacao_nova || '-',
    lote_id: entry.lote_id || '-',
    meta_data: entry.meta_data || {},
  };

  // 1. Atualiza cache local imediatamente
  const currentLogs = getLocalAuditLogs();
  const updatedLogs = [newLog, ...currentLogs];
  saveLocalAuditLogs(updatedLogs);

  // 2. Persiste no Supabase
  try {
    const { error } = await supabase.from('audit_logs').insert([
      {
        id: newLog.id,
        created_at: newLog.created_at,
        user_id: newLog.user_id,
        user_name: newLog.user_name,
        empresa: newLog.empresa,
        banco: newLog.banco,
        operacao: newLog.operacao,
        descricao: newLog.descricao,
        registro: newLog.registro,
        valor: newLog.valor,
        situacao_anterior: newLog.situacao_anterior,
        situacao_nova: newLog.situacao_nova,
        lote_id: newLog.lote_id,
        meta_data: newLog.meta_data,
      },
    ]);

    if (error) {
      console.warn('Persistência no Supabase via REST retornou aviso/erro:', error.message);
    }
  } catch (err) {
    console.warn('Não foi possível salvar log no Supabase (operando via sincronização fallback):', err);
  }

  return newLog;
}

/**
 * Busca logs de auditoria do Supabase com fallback para o cache local sincronizado.
 */
export async function fetchAuditLogs(filters?: AuditLogFilters): Promise<AuditLogEntry[]> {
  let logs: AuditLogEntry[] = [];

  try {
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.empresa) {
      query = query.ilike('empresa', `%${filters.empresa}%`);
    }
    if (filters?.banco) {
      query = query.ilike('banco', `%${filters.banco}%`);
    }
    if (filters?.operacao) {
      query = query.eq('operacao', filters.operacao);
    }
    if (filters?.lote_id) {
      query = query.eq('lote_id', filters.lote_id);
    }

    const { data, error } = await query.limit(200);

    if (!error && Array.isArray(data) && data.length > 0) {
      logs = data.map((item) => ({
        id: item.id,
        created_at: item.created_at,
        user_id: item.user_id,
        user_name: item.user_name,
        empresa: item.empresa,
        banco: item.banco,
        operacao: item.operacao,
        descricao: item.descricao,
        registro: item.registro,
        valor: item.valor ? Number(item.valor) : undefined,
        situacao_anterior: item.situacao_anterior,
        situacao_nova: item.situacao_nova,
        lote_id: item.lote_id,
        meta_data: item.meta_data,
      }));

      // Mescla com logs locais que possam ainda não ter sincronizado
      const local = getLocalAuditLogs();
      const existingIds = new Set(logs.map((l) => l.id));
      for (const loc of local) {
        if (!existingIds.has(loc.id)) {
          logs.push(loc);
        }
      }
      logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      saveLocalAuditLogs(logs);
    } else {
      logs = getLocalAuditLogs();
    }
  } catch (err) {
    console.warn('Erro ao consultar Supabase, usando cache de auditoria local:', err);
    logs = getLocalAuditLogs();
  }

  // Aplica filtros em memória se necessário
  return filterAuditLogsInMemory(logs, filters);
}

function filterAuditLogsInMemory(logs: AuditLogEntry[], filters?: AuditLogFilters): AuditLogEntry[] {
  if (!filters) return logs;

  return logs.filter((log) => {
    if (filters.user_id && log.user_id !== filters.user_id) return false;
    if (filters.empresa && !log.empresa?.toLowerCase().includes(filters.empresa.toLowerCase())) return false;
    if (filters.banco && !log.banco?.toLowerCase().includes(filters.banco.toLowerCase())) return false;
    if (filters.operacao && log.operacao !== filters.operacao) return false;
    if (filters.lote_id && !log.lote_id?.toLowerCase().includes(filters.lote_id.toLowerCase())) return false;
    if (filters.registro && !log.registro?.toLowerCase().includes(filters.registro.toLowerCase())) return false;
    if (filters.situacao && !log.situacao_nova?.toLowerCase().includes(filters.situacao.toLowerCase())) return false;

    if (filters.valor_min !== undefined && (log.valor === undefined || log.valor < filters.valor_min)) return false;
    if (filters.valor_max !== undefined && (log.valor === undefined || log.valor > filters.valor_max)) return false;

    if (filters.data_inicial) {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      if (logDate < filters.data_inicial) return false;
    }

    if (filters.data_final) {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      if (logDate > filters.data_final) return false;
    }

    if (filters.query) {
      const q = filters.query.toLowerCase();
      const match =
        log.user_name.toLowerCase().includes(q) ||
        log.operacao.toLowerCase().includes(q) ||
        log.descricao.toLowerCase().includes(q) ||
        (log.empresa && log.empresa.toLowerCase().includes(q)) ||
        (log.registro && log.registro.toLowerCase().includes(q)) ||
        (log.lote_id && log.lote_id.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });
}

/**
 * Busca a linha do tempo (histórico próprio) de um lançamento ou NSU específico.
 */
export async function getItemAuditTimeline(registroOrId: string): Promise<AuditLogEntry[]> {
  const allLogs = await fetchAuditLogs();
  if (!registroOrId) return [];

  const target = registroOrId.toLowerCase().trim();

  return allLogs.filter((log) => {
    if (log.registro && log.registro.toLowerCase().includes(target)) return true;
    if (log.meta_data && JSON.stringify(log.meta_data).toLowerCase().includes(target)) return true;
    if (log.lote_id && log.lote_id.toLowerCase().includes(target)) return true;
    return false;
  });
}

/**
 * Subscrição em Tempo Real via Supabase Realtime
 */
export function subscribeToAuditRealtime(onNewLog: (log: AuditLogEntry) => void) {
  try {
    const channel = supabase
      .channel('public:audit_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          if (payload.new) {
            const newLog: AuditLogEntry = {
              id: payload.new.id,
              created_at: payload.new.created_at,
              user_id: payload.new.user_id,
              user_name: payload.new.user_name,
              empresa: payload.new.empresa,
              banco: payload.new.banco,
              operacao: payload.new.operacao,
              descricao: payload.new.descricao,
              registro: payload.new.registro,
              valor: payload.new.valor ? Number(payload.new.valor) : undefined,
              situacao_anterior: payload.new.situacao_anterior,
              situacao_nova: payload.new.situacao_nova,
              lote_id: payload.new.lote_id,
              meta_data: payload.new.meta_data,
            };

            // Atualiza local
            const current = getLocalAuditLogs();
            if (!current.some((l) => l.id === newLog.id)) {
              saveLocalAuditLogs([newLog, ...current]);
              onNewLog(newLog);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Erro ao conectar ao canal Realtime do Supabase:', err);
    return () => {};
  }
}
