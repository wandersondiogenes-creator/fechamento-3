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
