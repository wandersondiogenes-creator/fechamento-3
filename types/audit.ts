export type UserRole = 'admin' | 'gerente' | 'operador' | 'auditor';

export type UserPermission =
  | 'visualizar_historico'
  | 'visualizar_lancamentos_outros'
  | 'criar_lancamentos'
  | 'alterar_lancamentos'
  | 'excluir_lancamentos'
  | 'fechar_lote'
  | 'reabrir_fechamento'
  | 'visualizar_auditoria_completa'
  | 'administrar_usuarios';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: UserPermission[];
  avatar?: string;
  empresa?: string;
  created_at?: string;
}

export type AuditOperationType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'IMPORTACAO_ARQUIVO'
  | 'IMPORTACAO_COMPROVANTE'
  | 'CRIACAO_LANCAMENTO'
  | 'ALTERACAO_LANCAMENTO'
  | 'EXCLUSAO_LANCAMENTO'
  | 'FECHAMENTO_LOTE'
  | 'REABERTURA_LOTE'
  | 'FECHAMENTO_DIARIO'
  | 'ALTERACAO_FECHAMENTO'
  | 'CONCILIACAO'
  | 'ALTERACAO_STATUS'
  | 'EXPORTACAO_ARQUIVO'
  | 'GERACAO_CNAB'
  | 'DOWNLOAD_DOC'
  | 'CADASTRO_EMPRESA'
  | 'ALTERACAO_EMPRESA'
  | 'CADASTRO_USUARIO'
  | 'ALTERACAO_PERMISSOES';

export interface AuditLogEntry {
  id: string;
  created_at: string; // ISO string
  user_id: string;
  user_name: string;
  empresa?: string;
  banco?: string;
  operacao: AuditOperationType | string;
  descricao: string;
  registro?: string; // Document / NSU / Record ID
  documento_afetado?: string;
  valor?: number;
  situacao_anterior?: string;
  situacao_nova?: string;
  lote_id?: string;
  meta_data?: Record<string, any>;
}

export interface AuditLogFilters {
  user_id?: string;
  empresa?: string;
  banco?: string;
  operacao?: string;
  data_inicial?: string; // YYYY-MM-DD
  data_final?: string; // YYYY-MM-DD
  situacao?: string;
  lote_id?: string;
  registro?: string;
  documento_afetado?: string;
  valor_min?: number;
  valor_max?: number;
  query?: string;
}
