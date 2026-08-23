import { pgTable, text, timestamp, serial, jsonb, numeric } from 'drizzle-orm/pg-core';

export const importedFiles = pgTable('imported_files', {
  id: serial('id').primaryKey(),
  fileName: text('file_name').notNull(),
  importedAt: timestamp('imported_at').defaultNow().notNull(),
  totalRows: serial('total_rows'),
  headers: jsonb('headers').$type<string[]>().notNull(),
});

export const dealerRecords = pgTable('dealer_records', {
  id: serial('id').primaryKey(),
  fileId: serial('file_id'),
  data: text('data'),
  entrada: numeric('entrada', { precision: 12, scale: 2 }),
  saida: numeric('saida', { precision: 12, scale: 2 }),
  contaClassificacao: text('conta_classificacao'),
  historico: text('historico'),
  rawContent: jsonb('raw_content'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const rulePresets = pgTable('rule_presets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  rulesConfig: jsonb('rules_config').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sharedFechamentos = pgTable('shared_fechamentos', {
  id: text('id').primaryKey(), // e.g. FC-84920 or uuid
  title: text('title').notNull(),
  dataMovimento: text('data_movimento').notNull(),
  createdBy: jsonb('created_by').notNull(),
  status: text('status').notNull().default('active'),
  items: jsonb('items').notNull(),
  conciliatedEmpresas: jsonb('conciliated_empresas').notNull().default({}),
  summary: jsonb('summary').notNull(),
  dealerState: jsonb('dealer_state'),
  sitefState: jsonb('sitef_state'),
  pendenteCdcState: jsonb('pendente_cdc_state'),
  kickedUserIds: jsonb('kicked_user_ids').$type<string[]>().default([]),
  activeParticipants: jsonb('active_participants').notNull().default([]),
  chatMessages: jsonb('chat_messages').notNull().default([]),
  version: serial('version'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const fechamentoRecords = pgTable('fechamento_records', {
  id: text('id').primaryKey(),
  dataMovimento: text('data_movimento').notNull(),
  dataFechamento: text('data_fechamento').notNull(),
  operador: text('operador').notNull(),
  observacoes: text('observacoes'),
  totalDealer: numeric('total_dealer', { precision: 14, scale: 2 }),
  totalSitef: numeric('total_sitef', { precision: 14, scale: 2 }),
  diferencaTotal: numeric('diferenca_total', { precision: 14, scale: 2 }),
  countTotal: serial('count_total'),
  countEmpresas: serial('count_empresas'),
  empresasNomes: jsonb('empresas_nomes').$type<string[]>().notNull(),
  breakdownPorBandeira: jsonb('breakdown_por_bandeira').notNull(),
  status: text('status').notNull(),
  items: jsonb('items').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userWorkspaces = pgTable('user_workspaces', {
  userEmail: text('user_email').primaryKey(),
  lastActiveAt: text('last_active_at').notNull(),
  workspacePayload: jsonb('workspace_payload').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userPendingFiles = pgTable('user_pending_files', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  title: text('title').notNull(),
  source: text('source').notNull(), // 'auto_expired' | 'manual_save' | 'fechamento_snapshot'
  payload: jsonb('payload').notNull(),
  metrics: jsonb('metrics').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

