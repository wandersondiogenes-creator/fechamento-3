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
