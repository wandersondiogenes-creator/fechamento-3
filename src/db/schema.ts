import { pgTable, text, serial, timestamp, numeric, jsonb, integer } from 'drizzle-orm/pg-core';

export const importedFiles = pgTable('imported_files', {
  id: serial('id').primaryKey(),
  fileName: text('file_name').notNull(),
  headers: jsonb('headers').$type<string[]>(),
  totalRows: integer('total_rows').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const dealerRecords = pgTable('dealer_records', {
  id: serial('id').primaryKey(),
  fileId: integer('file_id').references(() => importedFiles.id),
  data: text('data'),
  entrada: numeric('entrada', { precision: 12, scale: 2 }),
  saida: numeric('saida', { precision: 12, scale: 2 }),
  contaClassificacao: text('conta_classificacao'),
  historico: text('historico'),
  rawContent: jsonb('raw_content'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userWorkspaces = pgTable('user_workspaces', {
  id: serial('id').primaryKey(),
  userEmail: text('user_email').notNull().unique(),
  lastActiveAt: text('last_active_at').notNull(),
  workspacePayload: jsonb('workspace_payload').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userPendingFiles = pgTable('user_pending_files', {
  id: text('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  title: text('title').notNull(),
  source: text('source').notNull(),
  payload: jsonb('payload').notNull(),
  metrics: jsonb('metrics'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fechamentoRecords = pgTable('fechamento_records', {
  id: text('id').primaryKey(),
  dataMovimento: text('data_movimento').notNull(),
  dataFechamento: text('data_fechamento').notNull(),
  operador: text('operador').notNull(),
  observacoes: text('observacoes'),
  totalDealer: numeric('total_dealer', { precision: 12, scale: 2 }).notNull(),
  totalSitef: numeric('total_sitef', { precision: 12, scale: 2 }).notNull(),
  diferencaTotal: numeric('diferenca_total', { precision: 12, scale: 2 }).notNull(),
  countTotal: integer('count_total').default(0),
  countEmpresas: integer('count_empresas').default(0),
  empresasNomes: jsonb('empresas_nomes').$type<string[]>(),
  breakdownPorBandeira: jsonb('breakdown_por_bandeira'),
  status: text('status').notNull(),
  items: jsonb('items').$type<any[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sharedFechamentos = pgTable('shared_fechamentos', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  dataMovimento: text('data_movimento').notNull(),
  createdBy: jsonb('created_by').notNull(),
  status: text('status').notNull().default('active'),
  items: jsonb('items').$type<any[]>().notNull(),
  conciliatedEmpresas: jsonb('conciliated_empresas'),
  summary: jsonb('summary'),
  dealerState: jsonb('dealer_state'),
  sitefState: jsonb('sitef_state'),
  pendenteCdcState: jsonb('pendente_cdc_state'),
  kickedUserIds: jsonb('kicked_user_ids'),
  activeParticipants: jsonb('active_participants'),
  chatMessages: jsonb('chat_messages'),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const rulePresets = pgTable('rule_presets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  rulesConfig: jsonb('rules_config').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
