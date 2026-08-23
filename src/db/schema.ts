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
  userEmail: text('user_email'),
  empresa: text('empresa').notNull(),
  banco: text('banco').notNull(),
  data: text('data'),
  tipo: text('tipo').notNull(),
  valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
  status: text('status').notNull(),
  motivoDivergencia: text('motivo_divergencia'),
  registroDealer: jsonb('registro_dealer'),
  registroSitef: jsonb('registro_sitef'),
  metaData: jsonb('meta_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
